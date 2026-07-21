import crypto from "node:crypto";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq, gt, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { createHashCookie, getCookiePrefix } from "@/auth";
import * as schema from "@/db/schema";
import { sendOtpWithAfricaTalking } from "@/utils/africastalking";
import type { CloudflareBindings } from "../types";

const phoneAuthRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_REQUEST_WINDOW_MS = 10 * 60 * 1000;
const OTP_MAX_REQUESTS_PER_WINDOW = 5;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
		expiresAt: z.string(),
		user: z.object({
			id: z.string(),
			name: z.string(),
			email: z.string(),
			mobileNumber: z.string().nullable(),
		}),
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
	},
});

phoneAuthRoute.openapi(requestOtpRoute, async (c) => {
	const parsed = RequestOtpSchema.safeParse(await c.req.json());
	if (!parsed.success)
		return c.json(
			{ success: false as const, error: "Invalid request body" },
			400,
		);

	const phoneNumber = normalizePhone(parsed.data.phoneNumber);
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
	const parsed = VerifyOtpSchema.safeParse(await c.req.json());
	if (!parsed.success)
		return c.json(
			{ success: false as const, error: "Invalid request body" },
			400,
		);

	const phoneNumber = normalizePhone(parsed.data.phoneNumber);
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

	const incomingHash = hashOtp(parsed.data.otp);
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

	const [existingUser] = await db
		.select()
		.from(schema.user)
		.where(eq(schema.user.mobileNumber, phoneNumber))
		.limit(1);

	let signedInUser = existingUser;
	let firstSignIn = null;
	if (!signedInUser) {
		const phoneDigits = phoneNumber.replace(/\D/g, "");
		const generatedEmail = `phone_${phoneDigits}@sportsdey.local`;
		firstSignIn = true;

		const [newUser] = await db
			.insert(schema.user)
			.values({
				id: userId(),
				name: `User ${phoneDigits.slice(-4)}`,
				email: generatedEmail,
				emailVerified: false,
				mobileNumber: phoneNumber,
				verificationStatus: "pending_verification",
			})
			.returning();
		signedInUser = newUser;
	}

	if (!signedInUser) {
		return c.json(
			{ success: false as const, error: "Failed to create or load user" },
			500,
		);
	}

	const token = createSessionToken();
	const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
	const loginIp = c.req.header("cf-connecting-ip") || null;

	await db.insert(schema.session).values({
		id: `${crypto.randomUUID()}`,
		token,
		expiresAt,
		userId: signedInUser.id,
		ipAddress: loginIp,
		userAgent: c.req.header("user-agent") || null,
	});

	await db
		.update(schema.user)
		.set({ lastLoginIp: loginIp })
		.where(eq(schema.user.id, signedInUser.id));

	const prefix = getCookiePrefix();
	const secure =
		c.env.NODE_ENV === "production" || c.env.NODE_ENV === "staging";
	const secureFlag = secure ? "; Secure" : "";
	const sameSite = c.env.NODE_ENV === "development" ? "Lax" : "None";
	const cookieSuffix = `; Path=/; HttpOnly; SameSite=${sameSite}${secureFlag}; Max-Age=${7 * 24 * 60 * 60}`;

	c.header("Set-Cookie", `${prefix}.session_token=${token}${cookieSuffix}`, {
		append: true,
	});

	const hashCookie = createHashCookie(token, c.env.NODE_ENV);
	c.header("Set-Cookie", hashCookie, {
		append: true,
	});

	return c.json(
		{
			success: true as const,
			data: {
				message: "Phone number verified. Sign-in successful.",
				user: {
					id: signedInUser.id,
					name: signedInUser.name,
					email: signedInUser.email,
					mobileNumber: signedInUser.mobileNumber,
				},
				...(firstSignIn ? { isFirstTimeSignIn: true } : null),
			},
		},
		200,
	);
});

export default phoneAuthRoute;
