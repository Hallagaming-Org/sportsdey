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
			crossSubDomainCookies: {
				enabled: env.NODE_ENV === "production" || env.NODE_ENV === "staging",
			},
			cookiePrefix: "ba",
			cookieOptions: {
				sameSite: "lax",
				secure: env.NODE_ENV !== "development",
				path: "/",
			},
		},
	});
};
