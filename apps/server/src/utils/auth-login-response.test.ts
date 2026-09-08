import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildAuthLoginResponse,
	buildAuthLoginUser,
	buildAuthSession,
} from "./auth-login-response";

describe("buildAuthLoginUser", () => {
	it("maps OAuth/Better Auth user fields including emailVerified", () => {
		const createdAt = new Date("2026-01-15T12:00:00.000Z");
		const updatedAt = new Date("2026-01-16T12:00:00.000Z");
		assert.deepEqual(
			buildAuthLoginUser({
				id: "u1",
				name: "Ada",
				email: "ada@example.com",
				emailVerified: true,
				image: null,
				createdAt,
				updatedAt,
				mobileNumber: "+2348012345678",
				dob: "1990-01-01",
				verificationStatus: "approved",
				country: "NG",
			}),
			{
				id: "u1",
				name: "Ada",
				email: "ada@example.com",
				emailVerified: true,
				image: null,
				createdAt: "2026-01-15T12:00:00.000Z",
				updatedAt: "2026-01-16T12:00:00.000Z",
				mobileNumber: "+2348012345678",
				dob: "1990-01-01",
				verificationStatus: "approved",
				country: "NG",
			},
		);
	});
});

describe("buildAuthSession", () => {
	it("maps session id + token like Better Auth", () => {
		const session = buildAuthSession({
			id: "sess_1",
			token: "tok_abc",
			userId: "u1",
			expiresAt: new Date("2026-02-01T00:00:00.000Z"),
			createdAt: new Date("2026-01-15T12:00:00.000Z"),
			updatedAt: new Date("2026-01-15T12:00:00.000Z"),
			ipAddress: "1.2.3.4",
			userAgent: "test",
		});
		assert.equal(session.id, "sess_1");
		assert.equal(session.token, "tok_abc");
		assert.equal(session.userId, "u1");
		assert.equal(session.expiresAt, "2026-02-01T00:00:00.000Z");
	});
});

describe("buildAuthLoginResponse", () => {
	it("returns OAuth get-session carbon copy with token alias", () => {
		const data = buildAuthLoginResponse({
			session: {
				id: "sess_1",
				token: "tok_abc",
				userId: "u1",
				expiresAt: new Date("2026-02-01T00:00:00.000Z"),
				createdAt: new Date("2026-01-15T12:00:00.000Z"),
				ipAddress: null,
				userAgent: null,
			},
			user: {
				id: "u1",
				name: "Ada",
				email: "ada@example.com",
				emailVerified: false,
				image: null,
				createdAt: new Date("2026-01-15T12:00:00.000Z"),
				updatedAt: new Date("2026-01-15T12:00:00.000Z"),
				mobileNumber: null,
			},
			isFirstTimeSignIn: true,
		});
		assert.equal(data.token, "tok_abc");
		assert.equal(data.session.token, "tok_abc");
		assert.equal(data.session.id, "sess_1");
		assert.equal(data.user.emailVerified, false);
		assert.equal(data.isFirstTimeSignIn, true);
		assert.equal(data.needsProfileCompletion, true);
	});
});
