import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { bearer, openAPI } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
	SECURE_SESSION_COOKIE_NAME,
	SESSION_COOKIE_NAME,
	SESSION_MAX_AGE_SECONDS,
} from "@/constants/session";
import * as schema from "@/db/schema";
import type { CloudflareBindings } from "../../worker-configuration";

const HMAC_ALGORITHM = { name: "HMAC", hash: "SHA-256" } as const;
const COOKIE_PREFIX = "ba";

type SessionCookieOptions = {
	nodeEnv?: string;
	authUrl?: string;
	cookieDomain?: string;
};

type AuthCookiePolicy = {
	/** True when Better Auth is served over localhost HTTP (e.g. wrangler --env staging locally). */
	isLocalHttp: boolean;
	useSecureCookies: boolean;
	cookieDomain?: string;
	sameSite: "lax" | "none";
};

/** localhost / 127.0.0.1 over http — Secure + Domain cookies will not stick. */
export function isLocalHttpAuthUrl(authUrl?: string): boolean {
	if (!authUrl) return false;
	try {
		const url = new URL(authUrl);
		return (
			url.protocol === "http:" &&
			(url.hostname === "localhost" || url.hostname === "127.0.0.1")
		);
	} catch {
		return false;
	}
}

/**
 * Cookie policy for Better Auth + phone OTP.
 * Prefer auth URL over NODE_ENV so `wrangler dev --env staging` on localhost
 * does not emit Secure/Domain=sportsdey.com cookies (OAuth state mismatch).
 */
export function getAuthCookiePolicy(
	opts: SessionCookieOptions = {},
): AuthCookiePolicy {
	const isLocalHttp = isLocalHttpAuthUrl(opts.authUrl);
	if (isLocalHttp || opts.nodeEnv === "development") {
		return {
			isLocalHttp: true,
			useSecureCookies: false,
			cookieDomain: undefined,
			sameSite: "lax",
		};
	}

	const useSecureCookies =
		opts.authUrl?.startsWith("https://") ||
		opts.nodeEnv === "production" ||
		opts.nodeEnv === "staging";

	const cookieDomain =
		useSecureCookies && opts.cookieDomain
			? opts.cookieDomain.replace(/^\./, "")
			: undefined;

	return {
		isLocalHttp: false,
		useSecureCookies,
		cookieDomain,
		sameSite: useSecureCookies ? "none" : "lax",
	};
}

/** Sign a session token the same way Better Auth / better-call does. */
export async function signSessionToken(
	token: string,
	secret: string,
): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		HMAC_ALGORITHM,
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		HMAC_ALGORITHM.name,
		key,
		new TextEncoder().encode(token),
	);
	const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
	return `${token}.${signatureB64}`;
}

/** Raw phone-OTP bearer tokens have no HMAC suffix (`token.signature`). */
export function isRawSessionBearer(token: string): boolean {
	return !token.includes(".");
}

export const createAuth = (env: CloudflareBindings) => {
	const db = drizzle(env.DB, { schema });
	const toOrigin = (value?: string) => {
		if (!value) return "";
		try {
			return new URL(value).origin;
		} catch {
			return "";
		}
	};
	const trustedOrigins = Array.from(
		new Set(
			[
				"http://localhost:8787",
				"http://localhost:3001",
				"https://stagingweb.sportsdey.com",
				"https://sportsdey.com",
				"https://binary.sportsdey.com",
				"sportsdey-mobile://",
				"exp://**",
				"https://admin.sportsdey.com",
				"https://staging-admin.sportsdey.com",
				toOrigin(env.BETTER_AUTH_URL),
				toOrigin(env.CORS_ORIGIN),
			].filter(Boolean),
		),
	);

	const cookiePolicy = getAuthCookiePolicy({
		nodeEnv: env.NODE_ENV,
		authUrl: env.BETTER_AUTH_URL,
		cookieDomain: env.BETTER_AUTH_URL
			? new URL(env.BETTER_AUTH_URL).hostname
			: undefined,
	});

	return betterAuth({
		basePath: "/auth",
		database: drizzleAdapter(db, { provider: "sqlite" }),
		emailAndPassword: { enabled: true },
		socialProviders: {
			google: {
				clientId: env.GOOGLE_CLIENT_ID || "",
				clientSecret: env.GOOGLE_CLIENT_SECRET || "",
			},
			facebook: {
				clientId: env.FACEBOOK_CLIENT_ID || "",
				clientSecret: env.FACEBOOK_CLIENT_SECRET || "",
			},
		},
		plugins: [expo(), openAPI(), bearer()],
		user: {
			changeEmail: {
				enabled: true,
			},
			additionalFields: {
				country: {
					type: "string",
					required: false,
				},
				mobileNumber: {
					type: "string",
					required: false,
					fieldName: "mobile_number",
					returned: true,
				},
				verificationStatus: {
					type: "string",
					required: false,
					fieldName: "verification_status",
					returned: true,
				},
				lastLoginIp: {
					type: "string",
					required: false,
					fieldName: "last_login_ip",
				},
			},
			deleteUser: {
				enabled: true,
			},
		},
		baseURL: env.BETTER_AUTH_URL,
		secret: env.BETTER_AUTH_SECRET,
		trustedOrigins,
		advanced: {
			cookiePrefix: COOKIE_PREFIX,
			useSecureCookies: cookiePolicy.useSecureCookies,
			crossSubDomainCookies: cookiePolicy.cookieDomain
				? {
						enabled: true,
						domain: cookiePolicy.cookieDomain,
					}
				: undefined,
			defaultCookieAttributes: {
				sameSite: cookiePolicy.sameSite,
				secure: cookiePolicy.useSecureCookies,
				path: "/",
			},
			ipAddress: {
				ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for", "x-real-ip"],
			},
		},
		hooks: {
			after: createAuthMiddleware(async (ctx) => {
				const userId = ctx.context.newSession?.user?.id;
				const ipAddress = ctx.context.newSession?.session?.ipAddress;
				if (userId && ipAddress) {
					await db
						.update(schema.user)
						.set({ lastLoginIp: ipAddress })
						.where(eq(schema.user.id, userId));
				}
			}),
		},
	});
};

/** Cookie name Better Auth expects for the session token. */
export function getSessionCookieName(nodeEnv?: string, authUrl?: string): string {
	const { useSecureCookies } = getAuthCookiePolicy({ nodeEnv, authUrl });
	return useSecureCookies ? SECURE_SESSION_COOKIE_NAME : SESSION_COOKIE_NAME;
}

/**
 * Build a Better Auth–compatible signed session cookie.
 * Phone auth must use this; unsigned cookies are ignored by getSession().
 */
export async function createSignedSessionCookieString(
	token: string,
	secret: string,
	opts: SessionCookieOptions = {},
): Promise<{ cookie: string; signedToken: string }> {
	const policy = getAuthCookiePolicy(opts);
	const name = getSessionCookieName(opts.nodeEnv, opts.authUrl);

	const signedToken = await signSessionToken(token, secret);
	const signedValue = encodeURIComponent(signedToken);
	const parts = [`${name}=${signedValue}`, "Path=/", "HttpOnly"];
	parts.push(`SameSite=${policy.sameSite === "none" ? "None" : "Lax"}`);
	if (policy.useSecureCookies) parts.push("Secure");
	if (policy.cookieDomain) parts.push(`Domain=${policy.cookieDomain}`);
	parts.push(`Max-Age=${SESSION_MAX_AGE_SECONDS}`);
	return { cookie: parts.join("; "), signedToken };
}

function stripSessionCookies(cookieHeader: string): string {
	return cookieHeader
		.split(";")
		.map((part) => part.trim())
		.filter(Boolean)
		.filter(
			(part) =>
				!part.startsWith(`${SESSION_COOKIE_NAME}=`) &&
				!part.startsWith(`${SECURE_SESSION_COOKIE_NAME}=`),
		)
		.join("; ");
}

/** Build headers with a signed session cookie — does not touch the request body. */
export async function withSignedSessionHeaders(
	request: Request,
	rawToken: string,
	secret: string,
	opts: Pick<SessionCookieOptions, "nodeEnv" | "authUrl"> = {},
): Promise<Headers> {
	const signedToken = await signSessionToken(rawToken, secret);
	const name = getSessionCookieName(opts.nodeEnv, opts.authUrl);
	const headers = new Headers(request.headers);
	const cleaned = stripSessionCookies(headers.get("cookie") || "");
	const nextCookie = cleaned
		? `${cleaned}; ${name}=${encodeURIComponent(signedToken)}`
		: `${name}=${encodeURIComponent(signedToken)}`;
	headers.set("cookie", nextCookie);
	return headers;
}

/**
 * Inject a signed session cookie into a request for Better Auth handlers.
 * Prefer {@link withSignedSessionHeaders} when you only need headers — cloning
 * a Request transfers/locks the body stream and breaks later JSON parsing.
 */
export async function withSignedSessionCookie(
	request: Request,
	rawToken: string,
	secret: string,
	opts: Pick<SessionCookieOptions, "nodeEnv" | "authUrl"> = {},
): Promise<Request> {
	const headers = await withSignedSessionHeaders(
		request,
		rawToken,
		secret,
		opts,
	);
	return new Request(request, { headers });
}

export function extractBearerToken(request: Request): string | null {
	const header = request.headers.get("authorization");
	if (!header) return null;
	const match = header.match(/^Bearer\s+(.+)$/i);
	return match?.[1]?.trim() || null;
}

export function createHashCookie(
	token: string,
	nodeEnv?: string,
	cookieDomain?: string,
	authUrl?: string,
): string {
	const policy = getAuthCookiePolicy({ nodeEnv, authUrl, cookieDomain });
	const prefix = policy.useSecureCookies ? "__Secure-ba" : COOKIE_PREFIX;
	const secureFlag = policy.useSecureCookies ? "; Secure" : "";
	const domain = policy.cookieDomain
		? `; Domain=${policy.cookieDomain}`
		: "";
	const sameSite = policy.sameSite === "none" ? "None" : "Lax";
	return `${prefix}.session_token_hash=${token}; Path=/${domain}; HttpOnly; SameSite=${sameSite}${secureFlag}; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
}
