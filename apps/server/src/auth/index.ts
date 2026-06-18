import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, openAPI } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import type { CloudflareBindings } from "../../worker-configuration";

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

	return betterAuth({
		basePath: "/auth",
		database: drizzleAdapter(db, { provider: "sqlite" }),
		emailAndPassword: { enabled: true },
		// plugins: [expo()],
		socialProviders: {
			google: {
				clientId: env.GOOGLE_CLIENT_ID || "",
				clientSecret: env.GOOGLE_CLIENT_SECRET || "",
			},
			facebook: {
				clientId: env.FACEBOOK_CLIENT_ID || "",
				clientSecret: env.FACEBOOK_CLIENT_SECRET || "",
			},
			apple: {
				clientId: env.APPLE_CLIENT_ID || "",
				clientSecret: env.APPLE_CLIENT_SECRET || "",
				teamId: env.APPLE_TEAM_ID || "",
				keyId: env.APPLE_KEY_ID || "",
				privateKey: env.APPLE_PRIVATE_KEY || "",
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
				},
				verificationStatus: {
					type: "string",
					required: false,
					fieldName: "verification_status",
				},
			},
			deleteUser: {
				enabled: true,
			},
			facebook: {
				clientId: env.FACEBOOK_CLIENT_ID,
				clientSecret: env.FACEBOOK_CLIENT_SECRET,
			},
		},
		baseURL: env.BETTER_AUTH_URL,
		secret: env.BETTER_AUTH_SECRET,
		trustedOrigins,
		advanced: {
			cookiePrefix: "ba",
			cookieOptions: {
				sameSite: env.NODE_ENV === "development" ? "lax" : "none",
				secure: env.NODE_ENV !== "development",
				path: "/",
			},
		},
	});
};

export function getCookiePrefix(): string {
	return "ba";
}

function secureEnv(nodeEnv?: string): boolean {
	return nodeEnv === "production" || nodeEnv === "staging";
}

export function createSessionCookieString(
	token: string,
	nodeEnv?: string,
): string {
	const secure = secureEnv(nodeEnv);
	const prefix = secure ? "__Secure-ba" : "ba";
	const secureFlag = secure ? "; Secure" : "";
	const sameSite = nodeEnv === "development" ? "Lax" : "None";
	return `${prefix}.session_token=${token}; Path=/; HttpOnly; SameSite=${sameSite}${secureFlag}; Max-Age=${7 * 24 * 60 * 60}`;
}

export function createHashCookie(
	token: string,
	nodeEnv?: string,
): string {
	const secure = secureEnv(nodeEnv);
	const prefix = secure ? "__Secure-ba" : "ba";
	const secureFlag = secure ? "; Secure" : "";
	return `${prefix}.session_token_hash=${token}; Path=/; HttpOnly; SameSite=None${secureFlag}; Domain=.sportsdey.com; Max-Age=${7 * 24 * 60 * 60}`;
}
