import crypto from "node:crypto";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { and, desc, eq, gt, gte, inArray, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { createAuth, createHashCookie, createSignedSessionCookieString } from "@/auth";
import { SESSION_TTL_MS } from "@/constants/session";
import * as schema from "@/db/schema";
import { sendOtpWithAfricaTalking } from "@/utils/africastalking";
import {
	buildPhonePlaceholderEmail,
	buildPhonePlaceholderName,
	isDefaultPhoneUserName,
	isPhonePlaceholderEmail,
} from "@/utils/phone-user";
import type { CloudflareBindings } from "../types";

const phoneAuthRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_REQUEST_WINDOW_MS = 10 * 60 * 1000;
const OTP_MAX_REQUESTS_PER_WINDOW = 5;

const NIGERIAN_LOCAL_REGEX = /^0[789][01]\d{8}$/;
const NIGERIAN_INTL_REGEX = /^(?:\+?234)[789][01]\d{8}$/;

const RequestOtpSchema = z.object({
	phoneNumber: z.string().openapi({ example: "08012345678" }),
});

const VerifyOtpSchema = z.object({
	phoneNumber: z.string().openapi({ example: "08012345678" }),
	otp: z.string().length(6).openapi({ example: "123456" }),
});

const PhonePasswordSchema = z.object({
	phoneNumber: z.string().openapi({ example: "08012345678" }),
	password: z.string().min(6).openapi({ example: "secret12" }),
});

const SetPasswordSchema = z.object({
	password: z.string().min(6).openapi({ example: "secret12" }),
});

const SuccessMessageSchema = z.object({
	success: z.literal(true),
	data: z.object({
		message: z.string(),
	}),
});

const VerifySuccessSchema = z.object({
	success: z.literal(true),
	data: z.object({
		message: z.string(),
		expiresAt: z.string(),
		user: z.object({
			id: z.string(),
			name: z.string(),
			email: z.string(),
			mobileNumber: z.string().nullable(),
		}),
		isFirstTimeSignIn: z.boolean().optional(),
		needsProfileCompletion: z.boolean().optional(),
	}),
});

const ErrorSchema = z.object({
	success: z.literal(false),
	error: z.string(),
	details: z.any().nullable().optional(),
});

function normalizePhone(phone: string): string | null {
	const cleaned = phone.replace(/\s+/g, "").replace(/-/g, "");
	if (NIGERIAN_LOCAL_REGEX.test(cleaned)) {
		return `+234${cleaned.slice(1)}`;
	}
	if (NIGERIAN_INTL_REGEX.test(cleaned)) {
		return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
	}
	return null;
}

/** Formats that may already exist on a user row from older writes or account edits. */
function phoneNumberLookupValues(e164Phone: string): string[] {
	const digits = e164Phone.replace(/\D/g, "");
	const local =
		digits.startsWith("234") && digits.length === 13
			? `0${digits.slice(3)}`
			: null;
	return Array.from(
		new Set(
			[
				e164Phone,
				digits,
				local,
				digits.startsWith("234") ? `+${digits}` : null,
			].filter((value): value is string => Boolean(value)),
		),
	);
}

/**
 * Complete-profile is only for users who still have the generated `User ####` name.
 * Once they set a real name, returning logins should skip onboarding even if email
 * is still the phone placeholder.
 */
function needsProfileCompletion(user: { name: string }): boolean {
	const name = user.name.trim();
	return name.length <= 1 || isDefaultPhoneUserName(name);
}

function isUnresolvedPhonePlaceholder(user: {
	name: string;
	email: string;
}): boolean {
	return (
		isDefaultPhoneUserName(user.name) && isPhonePlaceholderEmail(user.email)
	);
}

/** Phone-OTP accounts that lost mobile_number (no OAuth account row). */
async function findRecoverablePhoneOrphan(
	db: ReturnType<typeof drizzle<typeof schema>>,
) {
	const candidates = await db
		.select({
			user: schema.user,
			accountId: schema.account.id,
		})
		.from(schema.user)
		.leftJoin(schema.account, eq(schema.account.userId, schema.user.id))
		.where(sql`${schema.user.mobileNumber} IS NULL`)
		.orderBy(desc(schema.user.updatedAt))
		.limit(20);

	const phoneOnly = candidates
		.filter((row) => row.accountId == null)
		.map((row) => row.user);

	const completed = phoneOnly.filter(
		(user) => !isUnresolvedPhonePlaceholder(user),
	);

	// Only auto-recover when there is a single unambiguous completed profile.
	if (completed.length === 1) {
		return completed[0] ?? null;
	}
	return null;
}

function hashOtp(otp: string): string {
	return crypto.createHash("sha256").update(otp).digest("hex");
}

function generateOtp(): string {
	return Math.floor(100000 + Math.random() * 900000).toString();
}

function createSessionToken(): string {
	return crypto.randomBytes(64).toString("hex");
}

function verificationId(): string {
	return `${crypto.randomUUID()}`;
}

function userId(): string {
	return `${crypto.randomUUID()}`;
}

type PhoneDb = ReturnType<typeof drizzle<typeof schema>>;

async function findUserByPhone(db: PhoneDb, phoneNumber: string) {
	const phoneLookup = phoneNumberLookupValues(phoneNumber);
	const phoneDigits = phoneNumber.replace(/\D/g, "");
	const placeholderEmail = buildPhonePlaceholderEmail(phoneDigits);
	const [existingByPhone] = await db
		.select()
		.from(schema.user)
		.where(
			or(
				inArray(schema.user.mobileNumber, phoneLookup),
				eq(schema.user.email, placeholderEmail),
			),
		)
		.limit(1);
	return existingByPhone ?? null;
}

async function upsertCredentialPassword(
	db: PhoneDb,
	user: { id: string; email: string },
	password: string,
) {
	const hashed = await hashPassword(password);
	const now = new Date();
	const [existing] = await db
		.select()
		.from(schema.account)
		.where(
			and(
				eq(schema.account.userId, user.id),
				eq(schema.account.providerId, "credential"),
			),
		)
		.limit(1);

	if (existing) {
		await db
			.update(schema.account)
			.set({
				password: hashed,
				updatedAt: now,
			})
			.where(eq(schema.account.id, existing.id));
		return;
	}

	await db.insert(schema.account).values({
		id: `${crypto.randomUUID()}`,
		accountId: user.email,
		providerId: "credential",
		userId: user.id,
		password: hashed,
		createdAt: now,
		updatedAt: now,
	});
}

async function issuePhoneSession(
	c: { env: CloudflareBindings; req: { header: (name: string) => string | undefined }; header: (name: string, value: string, opts?: { append: boolean }) => void },
	db: PhoneDb,
	signedInUser: typeof schema.user.$inferSelect,
	isFirstTimeSignIn: boolean,
) {
	const token = createSessionToken();
	const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
	const loginIp = c.req.header("cf-connecting-ip") || null;
	const now = new Date();

	await db.insert(schema.session).values({
		id: `${crypto.randomUUID()}`,
		token,
		expiresAt,
		createdAt: now,
		updatedAt: now,
		userId: signedInUser.id,
		ipAddress: loginIp,
		userAgent: c.req.header("user-agent") || null,
	});

	await db
		.update(schema.user)
		.set({ lastLoginIp: loginIp })
		.where(eq(schema.user.id, signedInUser.id));

	const sessionCookie = await createSignedSessionCookieString(
		token,
		c.env.BETTER_AUTH_SECRET,
		{
			nodeEnv: c.env.NODE_ENV,
			authUrl: c.env.BETTER_AUTH_URL,
		},
	);
	c.header("Set-Cookie", sessionCookie, { append: true });

	const hashCookie = createHashCookie(
		token,
		c.env.NODE_ENV,
		c.env.BETTER_AUTH_URL,
	);
	c.header("Set-Cookie", hashCookie, { append: true });

	return {
		message: "Sign-in successful.",
		expiresAt: expiresAt.toISOString(),
		user: {
			id: signedInUser.id,
			name: signedInUser.name,
			email: signedInUser.email,
			mobileNumber: signedInUser.mobileNumber,
		},
		isFirstTimeSignIn,
		needsProfileCompletion: needsProfileCompletion(signedInUser),
	};
}

const requestOtpRoute = createRoute({
	method: "post",
	path: "/request-otp",
	tags: ["Phone Auth"],
	summary: "Request phone OTP",
	request: {
		body: { content: { "application/json": { schema: RequestOtpSchema } } },
	},
	responses: {
		200: {
			description: "OTP sent",
			content: { "application/json": { schema: SuccessMessageSchema } },
		},
		400: {
			description: "Bad request",
			content: { "application/json": { schema: ErrorSchema } },
		},
		429: {
			description: "Rate limited",
			content: { "application/json": { schema: ErrorSchema } },
		},
		500: {
			description: "Provider not configured",
			content: { "application/json": { schema: ErrorSchema } },
		},
		502: {
			description: "Provider error",
			content: { "application/json": { schema: ErrorSchema } },
		},
	},
});

const verifyOtpRoute = createRoute({
	method: "post",
	path: "/verify-otp",
	tags: ["Phone Auth"],
	summary: "Verify phone OTP and sign in",
	request: {
		body: { content: { "application/json": { schema: VerifyOtpSchema } } },
	},
	responses: {
		200: {
			description: "OTP verified",
			content: { "application/json": { schema: VerifySuccessSchema } },
		},
		400: {
			description: "Bad request",
			content: { "application/json": { schema: ErrorSchema } },
		},
		401: {
			description: "Invalid OTP",
			content: { "application/json": { schema: ErrorSchema } },
		},
		429: {
			description: "Too many attempts",
			content: { "application/json": { schema: ErrorSchema } },
		},
		500: {
			description: "Failed to create session",
			content: { "application/json": { schema: ErrorSchema } },
		},
	},
});

const loginRoute = createRoute({
	method: "post",
	path: "/login",
	tags: ["Phone Auth"],
	summary: "Sign in with phone number and password",
	request: {
		body: { content: { "application/json": { schema: PhonePasswordSchema } } },
	},
	responses: {
		200: {
			description: "Signed in",
			content: { "application/json": { schema: VerifySuccessSchema } },
		},
		400: {
			description: "Bad request",
			content: { "application/json": { schema: ErrorSchema } },
		},
		401: {
			description: "Invalid credentials",
			content: { "application/json": { schema: ErrorSchema } },
		},
	},
});

const setPasswordRoute = createRoute({
	method: "post",
	path: "/set-password",
	tags: ["Phone Auth"],
	summary: "Set or replace password for the signed-in phone user",
	request: {
		body: { content: { "application/json": { schema: SetPasswordSchema } } },
	},
	responses: {
		200: {
			description: "Password saved",
			content: { "application/json": { schema: SuccessMessageSchema } },
		},
		400: {
			description: "Bad request",
			content: { "application/json": { schema: ErrorSchema } },
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorSchema } },
		},
	},
});

phoneAuthRoute.openapi(requestOtpRoute, async (c) => {
	const { phoneNumber: rawPhoneNumber } = c.req.valid("json");
	const phoneNumber = normalizePhone(rawPhoneNumber);
	if (!phoneNumber) {
		return c.json(
			{
				success: false as const,
				error: "Invalid Nigerian phone number",
			},
			400,
		);
	}

	if (!c.env.AFRICASTALKING_API_KEY || !c.env.AFRICASTALKING_USERNAME) {
		return c.json(
			{ success: false as const, error: "SMS provider is not configured" },
			500,
		);
	}

	const db = drizzle(c.env.DB, { schema });
	const identifier = `phone_login:${phoneNumber}`;
	const now = new Date();

	const latest = await db
		.select()
		.from(schema.verification)
		.where(eq(schema.verification.identifier, identifier))
		.orderBy(desc(schema.verification.createdAt))
		.limit(1);

	const [recentCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(schema.verification)
		.where(
			and(
				eq(schema.verification.identifier, identifier),
				gte(
					schema.verification.createdAt,
					new Date(Date.now() - OTP_REQUEST_WINDOW_MS),
				),
			),
		);

	if ((recentCount?.count ?? 0) >= OTP_MAX_REQUESTS_PER_WINDOW) {
		return c.json(
			{
				success: false as const,
				error: "Too many OTP requests. Try again later.",
			},
			429,
		);
	}

	const previous = latest[0];
	if (previous) {
		const elapsed = now.getTime() - previous.createdAt.getTime();
		if (elapsed < OTP_RESEND_COOLDOWN_MS) {
			return c.json(
				{
					success: false as const,
					error: "OTP resend cooldown active. Please wait a bit.",
				},
				429,
			);
		}
	}

	const otp = generateOtp();
	const otpHash = hashOtp(otp);
	const message = `Your SportsDey verification code is ${otp}. It expires in 5 minutes.`;


	//  To be the deleted
	// console.log("AT env check:", {
	// 	username: c.env.AFRICASTALKING_USERNAME,
	// 	apiKeyLength: c.env.AFRICASTALKING_API_KEY?.length,
	// 	apiKeyPreview: c.env.AFRICASTALKING_API_KEY?.slice(0, 10),
	// });


	const providerResult = await sendOtpWithAfricaTalking({
		apiKey: c.env.AFRICASTALKING_API_KEY,
		username: c.env.AFRICASTALKING_USERNAME,
		senderId: c.env.AFRICASTALKING_SENDER_ID,
		phoneNumber,
		message,
	});

	if (!providerResult.ok) {
		return c.json(
			{
				success: false as const,
				error: "Failed to send OTP",
				details: {
					providerStatus: providerResult.status,
					recipients: providerResult.recipients,
					providerError: providerResult.error,
				},
			},
			502,
		);
	}

	await db.insert(schema.verification).values({
		id: verificationId(),
		identifier,
		value: JSON.stringify({
			type: "phone_otp",
			otpHash,
			attempts: 0,
			consumed: false,
		}),
		expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
	});

	return c.json(
		{ success: true as const, data: { message: "OTP sent successfully" } },
		200,
	);
});

phoneAuthRoute.openapi(verifyOtpRoute, async (c) => {
	const { phoneNumber: rawPhoneNumber, otp } = c.req.valid("json");
	const phoneNumber = normalizePhone(rawPhoneNumber);
	if (!phoneNumber) {
		return c.json(
			{
				success: false as const,
				error: "Invalid phone number",
			},
			400,
		);
	}

	const db = drizzle(c.env.DB, { schema });
	const identifier = `phone_login:${phoneNumber}`;

	const [otpRecord] = await db
		.select()
		.from(schema.verification)
		.where(
			and(
				eq(schema.verification.identifier, identifier),
				gt(schema.verification.expiresAt, new Date()),
			),
		)
		.orderBy(desc(schema.verification.createdAt))
		.limit(1);

	if (!otpRecord) {
		return c.json(
			{ success: false as const, error: "OTP expired or not found" },
			401,
		);
	}

	const payload = JSON.parse(otpRecord.value) as {
		otpHash?: string;
		attempts?: number;
		consumed?: boolean;
	};

	if (payload.consumed) {
		return c.json({ success: false as const, error: "OTP already used" }, 401);
	}

	const attempts = payload.attempts ?? 0;
	if (attempts >= OTP_MAX_ATTEMPTS) {
		return c.json(
			{ success: false as const, error: "Too many OTP attempts" },
			429,
		);
	}

	const incomingHash = hashOtp(otp);
	if (!payload.otpHash || incomingHash !== payload.otpHash) {
		await db
			.update(schema.verification)
			.set({
				value: JSON.stringify({
					...payload,
					attempts: attempts + 1,
				}),
			})
			.where(eq(schema.verification.id, otpRecord.id));

		return c.json({ success: false as const, error: "Invalid OTP" }, 401);
	}

	await db
		.update(schema.verification)
		.set({
			value: JSON.stringify({
				...payload,
				consumed: true,
			}),
		})
		.where(eq(schema.verification.id, otpRecord.id));

	const phoneDigits = phoneNumber.replace(/\D/g, "");
	const phoneLookup = phoneNumberLookupValues(phoneNumber);
	const placeholderEmail = buildPhonePlaceholderEmail(phoneDigits);

	const [existingByPhone] = await db
		.select()
		.from(schema.user)
		.where(
			or(
				inArray(schema.user.mobileNumber, phoneLookup),
				eq(schema.user.email, placeholderEmail),
			),
		)
		.limit(1);

	const recoverableOrphan = await findRecoverablePhoneOrphan(db);

	let signedInUser = existingByPhone ?? null;
	let isFirstTimeSignIn = false;

	// A newer incomplete phone row can shadow the real profile after mobile_number
	// was wiped by a bad PATCH. Prefer the completed orphan and drop the duplicate.
	if (
		signedInUser &&
		isUnresolvedPhonePlaceholder(signedInUser) &&
		recoverableOrphan &&
		recoverableOrphan.id !== signedInUser.id
	) {
		await db
			.delete(schema.session)
			.where(eq(schema.session.userId, signedInUser.id));
		await db.delete(schema.user).where(eq(schema.user.id, signedInUser.id));
		signedInUser = null;
	}

	if (!signedInUser && recoverableOrphan) {
		const [reattached] = await db
			.update(schema.user)
			.set({ mobileNumber: phoneNumber })
			.where(eq(schema.user.id, recoverableOrphan.id))
			.returning();
		signedInUser = reattached ?? recoverableOrphan;
	}

	if (!signedInUser) {
		isFirstTimeSignIn = true;

		const [newUser] = await db
			.insert(schema.user)
			.values({
				id: userId(),
				name: buildPhonePlaceholderName(phoneDigits),
				email: placeholderEmail,
				emailVerified: false,
				mobileNumber: phoneNumber,
				verificationStatus: "pending_verification",
			})
			.returning();
		if (!newUser) {
			return c.json(
				{ success: false as const, error: "Failed to create or load user" },
				500,
			);
		}
		signedInUser = newUser;
	} else if (signedInUser.mobileNumber !== phoneNumber) {
		const [updatedUser] = await db
			.update(schema.user)
			.set({ mobileNumber: phoneNumber })
			.where(eq(schema.user.id, signedInUser.id))
			.returning();
		if (updatedUser) {
			signedInUser = updatedUser;
		}
	}

	if (!signedInUser) {
		return c.json(
			{ success: false as const, error: "Failed to create or load user" },
			500,
		);
	}

	const sessionData = await issuePhoneSession(
		c,
		db,
		signedInUser,
		isFirstTimeSignIn,
	);

	return c.json(
		{
			success: true as const,
			data: {
				...sessionData,
				message: "Phone number verified. Sign-in successful.",
			},
		},
		200,
	);
});

phoneAuthRoute.openapi(loginRoute, async (c) => {
	const { phoneNumber: rawPhoneNumber, password } = c.req.valid("json");
	const phoneNumber = normalizePhone(rawPhoneNumber);
	if (!phoneNumber) {
		return c.json(
			{
				success: false as const,
				error: "Invalid Nigerian phone number",
			},
			400,
		);
	}

	const db = drizzle(c.env.DB, { schema });
	const signedInUser = await findUserByPhone(db, phoneNumber);
	if (!signedInUser) {
		return c.json(
			{ success: false as const, error: "Invalid phone number or password" },
			401,
		);
	}

	const [credential] = await db
		.select()
		.from(schema.account)
		.where(
			and(
				eq(schema.account.userId, signedInUser.id),
				eq(schema.account.providerId, "credential"),
			),
		)
		.limit(1);

	if (!credential?.password) {
		return c.json(
			{
				success: false as const,
				error: "This account has no password yet. Use Forgot password to set one.",
			},
			401,
		);
	}

	const passwordOk = await verifyPassword({
		hash: credential.password,
		password,
	});
	if (!passwordOk) {
		return c.json(
			{ success: false as const, error: "Invalid phone number or password" },
			401,
		);
	}

	const sessionData = await issuePhoneSession(c, db, signedInUser, false);
	return c.json({ success: true as const, data: sessionData }, 200);
});

phoneAuthRoute.openapi(setPasswordRoute, async (c) => {
	const auth = createAuth(c.env);
	const sessionResult = await auth.api.getSession({
		headers: c.req.raw.headers,
	});
	if (!sessionResult?.user?.id) {
		return c.json(
			{ success: false as const, error: "Unauthorized" },
			401,
		);
	}

	const { password } = c.req.valid("json");
	const db = drizzle(c.env.DB, { schema });
	const [user] = await db
		.select()
		.from(schema.user)
		.where(eq(schema.user.id, sessionResult.user.id))
		.limit(1);

	if (!user) {
		return c.json(
			{ success: false as const, error: "Unauthorized" },
			401,
		);
	}

	await upsertCredentialPassword(db, user, password);
	return c.json(
		{
			success: true as const,
			data: { message: "Password updated successfully" },
		},
		200,
	);
});

export default phoneAuthRoute;
