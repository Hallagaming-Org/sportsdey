import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import type { Database } from "./schema";

const db = new Kysely<Database>({
	dialect: new D1Dialect({
		wrangler: {
			async fetch(url, init) {
				const response = await fetch(url, init);
				return response;
			},
		},
	}),
});

export const auth = betterAuth({
	database: drizzleAdapter(db, { provider: "sqlite" }),
	emailAndPassword: { enabled: true },
	user: {
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
			dob: {
				type: "string",
				required: false,
			},
		},
	},
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID || "",
			clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
		},
		apple: {
			clientId: process.env.APPLE_CLIENT_ID || "",
			clientSecret: process.env.APPLE_CLIENT_SECRET || "",
		},
	},
	baseURL: process.env.BETTER_AUTH_URL || "http://localhost:8787",
	secret:
		process.env.BETTER_AUTH_SECRET || "development-secret-change-in-production",
	trustedOrigins:
		process.env.NODE_ENV === "development"
			? ["http://localhost:8787", "http://localhost:3001"]
			: [process.env.BETTER_AUTH_URL || ""],
});
