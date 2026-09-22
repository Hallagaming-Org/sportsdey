import crypto from "node:crypto";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { and, desc, eq, gt, gte, inArray, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
	createAuth,
	createHashCookie,
	createSignedSessionCookieString,
} from "@/auth";
import { SESSION_TTL_MS } from "@/constants/session";
import * as schema from "@/db/schema";
import {
	optionalExecutionCtx,
	scheduleBonusEnginePlayerOnAppLogin,
} from "@/services/bonus-engine";
import { sendOtpWithAfricaTalking } from "@/utils/africastalking";
import { isD1CapacityError } from "@/utils/d1-errors";
import {
	normalizeNigerianPhone,
	phoneNumberLookupValues,
	phonePlaceholderEmailLookupValues,
} from "@/utils/nigerian-phone";
import {
	buildPhonePlaceholderEmail,
	buildPhonePlaceholderName,
	isDefaultPhoneUserName,
	isPhonePlaceholderEmail,
} from "@/utils/phone-user";
import {
	AuthLoginDataSchema,
	buildAuthLoginResponse,
} from "@/utils/auth-login-response";
import { scheduleWebengageUserProfileSync } from "@/utils/webengage-user-profile";
import type { CloudflareBindings } from "../types";

const phoneAuthRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_REQUEST_WINDOW_MS = 10 * 60 * 1000;
const OTP_MAX_REQUESTS_PER_WINDOW = 5;

const PhoneAuthPurposeSchema = z
	.enum(["signup", "login", "reset"])
	.optional()
	.openapi({ example: "signup" });

const RequestOtpSchema = z.object({
	phoneNumber: z.string().openapi({ example: "08012345678" }),
	/** When `signup`, reject numbers that already have an account. */
	purpose: PhoneAuthPurposeSchema,
});

const VerifyOtpSchema = z.object({
	phoneNumber: z.string().openapi({ example: "08012345678" }),
	otp: z.string().length(6).openapi({ example: "123456" }),
	/** When `signup`, reject numbers that already have an account. */
	purpose: PhoneAuthPurposeSchema,
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
	data: AuthLoginDataSchema,
});

const ErrorSchema = z.object({
	success: z.literal(false),
	error: z.string(),
	details: z.any().nullable().optional(),
});

function normalizePhone(phone: string): string | null {
	return normalizeNigerianPhone(phone);
}

const PHONE_ALREADY_REGISTERED_ERROR =
	"This phone number is already registered. Please log in instead.";

/** Phone-OTP rows that still look like unresolved placeholders (name + email). */
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
	const bytes = new Uint8Array(64);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "hex")).join(
		"",
	);
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
	const placeholderEmails = phonePlaceholderEmailLookupValues(phoneNumber);
	const matches = await db
		.select({
			user: schema.user,
			credentialPassword: schema.account.password,
		})
		.from(schema.user)
		.leftJoin(
			schema.account,
			and(
				eq(schema.account.userId, schema.user.id),
				eq(schema.account.providerId, "credential"),
			),
		)
		.where(
			or(
				inArray(schema.user.mobileNumber, phoneLookup),
				inArray(schema.user.email, placeholderEmails),
			),
		)
		.orderBy(desc(schema.user.updatedAt));

	if (matches.length === 0) return null;

	const withPassword = matches.find((row) => row.credentialPassword);
	return (withPassword ?? matches[0])?.user ?? null;
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
	c: {
		env: CloudflareBindings;
		req: { header: (name: string) => string | undefined };
		header: (name: string, value: string, opts?: { append: boolean }) => void;
	},
	db: PhoneDb,
	signedInUser: typeof schema.user.$inferSelect,
	isFirstTimeSignIn: boolean,
) {
	const token = createSessionToken();
	const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
	const loginIp = c.req.header("cf-connecting-ip") || null;
	const userAgent = c.req.header("user-agent") || null;
	const now = new Date();
	const sessionId = `${crypto.randomUUID()}`;

	await db.insert(schema.session).values({
		id: sessionId,
		token,
		expiresAt,
		createdAt: now,
		updatedAt: now,
		userId: signedInUser.id,
		ipAddress: loginIp,
		userAgent,
	});

	await db
		.update(schema.user)
		.set({ lastLoginIp: loginIp })
		.where(eq(schema.user.id, signedInUser.id));

	scheduleBonusEnginePlayerOnAppLogin({
		env: c.env,
		userId: signedInUser.id,
		username: signedInUser.name || signedInUser.email || signedInUser.id,
		executionCtx: optionalExecutionCtx(c),
	});

	const authSecret = c.env.BETTER_AUTH_SECRET?.trim();
	if (!authSecret) {
		throw new Error("BETTER_AUTH_SECRET is missing or empty");
	}

	const sessionCookie = await createSignedSessionCookieString(
		token,
		authSecret,
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

	// Parity with Better Auth `bearer` plugin (used by mobile / cross-origin clients).
	c.header("set-auth-token", token);
	c.header("Access-Control-Expose-Headers", "set-auth-token");

	return buildAuthLoginResponse({
		session: {
			id: sessionId,
			token,
			userId: signedInUser.id,
			expiresAt,
			createdAt: now,
			updatedAt: now,
			ipAddress: loginIp,
			userAgent,
		},
		user: signedInUser,
		message: "Sign-in successful.",
		isFirstTimeSignIn,
	});
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
		409: {
			description: "Phone already registered (signup)",
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
		409: {
			description: "Phone already registered (signup)",
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
	const { phoneNumber: rawPhoneNumber, purpose } = c.req.valid("json");
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
	const existing = await findUserByPhone(db, phoneNumber);

	// Missing purpose is treated as signup so mobile clients that omit it
	// cannot re-OTP registered numbers.
	if (purpose === "login" || purpose === "reset") {
		if (!existing) {
			return c.json(
				{
					success: false as const,
					error: "No account found for this phone number. Please sign up.",
				},
				404,
			);
		}
	} else if (existing) {
		return c.json(
			{
				success: false as const,
				error: PHONE_ALREADY_REGISTERED_ERROR,
			},
			409,
		);
	}

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
	const { phoneNumber: rawPhoneNumber, otp, purpose } = c.req.valid("json");
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
	const existingForPurpose = await findUserByPhone(db, phoneNumber);

	if (purpose === "login" || purpose === "reset") {
		if (!existingForPurpose) {
			return c.json(
				{
					success: false as const,
					error: "No account found for this phone number. Please sign up.",
				},
				404,
			);
		}
	} else if (existingForPurpose) {
		// signup or omitted purpose — never allow another registration OTP/verify
		return c.json(
			{
				success: false as const,
				error: PHONE_ALREADY_REGISTERED_ERROR,
			},
			409,
		);
	}

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
	const placeholderEmails = phonePlaceholderEmailLookupValues(phoneNumber);

	const [existingByPhone] = await db
		.select()
		.from(schema.user)
		.where(
			or(
				inArray(schema.user.mobileNumber, phoneLookup),
				inArray(schema.user.email, placeholderEmails),
			),
		)
		.limit(1);

	let signedInUser = existingByPhone ?? null;
	let isFirstTimeSignIn = false;
	const isSignupFlow = purpose !== "login" && purpose !== "reset";

	if (isSignupFlow) {
		if (signedInUser) {
			return c.json(
				{
					success: false as const,
					error: PHONE_ALREADY_REGISTERED_ERROR,
				},
				409,
			);
		}

		isFirstTimeSignIn = true;
		const [newUser] = await db
			.insert(schema.user)
			.values({
				id: userId(),
				name: buildPhonePlaceholderName(phoneDigits),
				email: buildPhonePlaceholderEmail(phoneDigits),
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
	} else {
		const recoverableOrphan = await findRecoverablePhoneOrphan(db);

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
			return c.json(
				{
					success: false as const,
					error: "No account found for this phone number. Please sign up.",
				},
				404,
			);
		}

		if (signedInUser.mobileNumber !== phoneNumber) {
			const [updatedUser] = await db
				.update(schema.user)
				.set({ mobileNumber: phoneNumber })
				.where(eq(schema.user.id, signedInUser.id))
				.returning();
			if (updatedUser) {
				signedInUser = updatedUser;
			}
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

	if (isFirstTimeSignIn) {
		scheduleWebengageUserProfileSync(c.env, signedInUser.id, c.executionCtx);
	}

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
	try {
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
					error:
						"This account has no password yet. Use Forgot password to set one.",
				},
				401,
			);
		}

		let passwordOk = false;
		try {
			passwordOk = await verifyPassword({
				hash: credential.password,
				password,
			});
		} catch (error) {
			console.error("phone-auth/login password verify error", {
				userId: signedInUser.id,
				error,
			});
			return c.json(
				{ success: false as const, error: "Invalid phone number or password" },
				401,
			);
		}

		if (!passwordOk) {
			return c.json(
				{ success: false as const, error: "Invalid phone number or password" },
				401,
			);
		}

		const sessionData = await issuePhoneSession(c, db, signedInUser, false);
		return c.json({ success: true as const, data: sessionData }, 200);
	} catch (error) {
		if (isD1CapacityError(error)) {
			console.error("phone-auth/login D1 capacity error", error);
			return c.json(
				{
					success: false as const,
					error: "Service temporarily unavailable. Please try again shortly.",
				},
				503,
			);
		}
		throw error;
	}
});

phoneAuthRoute.openapi(setPasswordRoute, async (c) => {
	const auth = createAuth(c.env);
	const db = drizzle(c.env.DB, { schema });

	let userId = (
		await auth.api.getSession({
			headers: c.req.raw.headers,
		})
	)?.user?.id;

	// Phone clients may send the raw session token as Bearer when cookies do not stick.
	if (!userId) {
		const authHeader = c.req.header("authorization") || "";
		if (authHeader.toLowerCase().startsWith("bearer ")) {
			const rawToken = authHeader.slice(7).trim().split(".")[0];
			if (rawToken) {
				const [row] = await db
					.select({ userId: schema.session.userId })
					.from(schema.session)
					.where(
						and(
							eq(schema.session.token, rawToken),
							gt(schema.session.expiresAt, new Date()),
						),
					)
					.limit(1);
				userId = row?.userId;
			}
		}
	}

	if (!userId) {
		return c.json({ success: false as const, error: "Unauthorized" }, 401);
	}

	const { password } = c.req.valid("json");
	const [user] = await db
		.select()
		.from(schema.user)
		.where(eq(schema.user.id, userId))
		.limit(1);

	if (!user) {
		return c.json({ success: false as const, error: "Unauthorized" }, 401);
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
