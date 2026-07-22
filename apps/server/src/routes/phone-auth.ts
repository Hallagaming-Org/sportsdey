import crypto from "node:crypto";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq, gt, gte, inArray, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { createHashCookie, createSignedSessionCookieString } from "@/auth";
import { SESSION_TTL_MS, SET_AUTH_TOKEN_HEADER } from "@/constants/session";
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
		token: z.string(),
		authToken: z.string().optional(),
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

	const profileIncomplete = needsProfileCompletion(signedInUser);

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

	const { cookie: sessionCookie, signedToken } =
		await createSignedSessionCookieString(token, c.env.BETTER_AUTH_SECRET, {
			nodeEnv: c.env.NODE_ENV,
			authUrl: c.env.BETTER_AUTH_URL,
			cookieDomain: c.env.COOKIE_DOMAIN,
		});
	c.header("Set-Cookie", sessionCookie, { append: true });
	// Expose signed token for clients that cannot rely on cross-origin cookies.
	c.header(SET_AUTH_TOKEN_HEADER, signedToken);
	c.header(
		"Access-Control-Expose-Headers",
		`${SET_AUTH_TOKEN_HEADER}, Set-Auth-Token`,
	);

	const hashCookie = createHashCookie(
		token,
		c.env.NODE_ENV,
		c.env.COOKIE_DOMAIN,
		c.env.BETTER_AUTH_URL,
	);
	c.header("Set-Cookie", hashCookie, { append: true });

	return c.json(
		{
			success: true as const,
			data: {
				message: "Phone number verified. Sign-in successful.",
				token,
				authToken: signedToken,
				expiresAt: expiresAt.toISOString(),
				user: {
					id: signedInUser.id,
					name: signedInUser.name,
					email: signedInUser.email,
					mobileNumber: signedInUser.mobileNumber,
				},
				isFirstTimeSignIn,
				needsProfileCompletion: profileIncomplete,
			},
		},
		200,
	);
});

export default phoneAuthRoute;
