import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CloudflareBindings } from "../../worker-configuration";
import { createAuth, isEmailPasswordResetRequest } from "./index";

const API_URL = "http://localhost:8787";
const WEB_URL = "http://localhost:3001";

const minimalEnv = {
	CORS_ORIGIN: WEB_URL,
	BETTER_AUTH_URL: API_URL,
	BETTER_AUTH_SECRET: "test-secret-at-least-thirty-two-characters",
	DB: {},
} as unknown as CloudflareBindings;

describe("disabled Better Auth email password reset", () => {
	it("identifies every email-reset HTTP endpoint before Better Auth handles it", () => {
		assert.equal(
			isEmailPasswordResetRequest("POST", "/auth/request-password-reset"),
			true,
		);
		assert.equal(
			isEmailPasswordResetRequest("GET", "/auth/reset-password/token"),
			true,
		);
		assert.equal(
			isEmailPasswordResetRequest("POST", "/auth/reset-password"),
			true,
		);
		assert.equal(
			isEmailPasswordResetRequest("POST", "/phone-auth/request-otp"),
			false,
		);
		assert.equal(
			isEmailPasswordResetRequest("POST", "/phone-auth/set-password"),
			false,
		);
	});

	it("also fails safely inside Better Auth when called without the HTTP guard", async () => {
		const auth = createAuth(minimalEnv);
		const response = await auth.handler(
			new Request(`${API_URL}/auth/request-password-reset`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Origin: WEB_URL,
				},
				body: JSON.stringify({
					email: "player@example.com",
					redirectTo: `${WEB_URL}/auth/reset-password`,
				}),
			}),
		);

		assert.equal(response.status, 400);
		const body = (await response.json()) as {
			code?: string;
			message?: string;
		};
		assert.equal(body.code, "RESET_PASSWORD_DISABLED");
		assert.equal(body.message, "Reset password isn't enabled");
	});
});
