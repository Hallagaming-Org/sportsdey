import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	rawSessionTokenFromBearer,
	signedBearerSessionToken,
	signSessionToken,
} from "./index";

describe("signedBearerSessionToken", () => {
	it("turns a raw phone/Openfort session token into a Better Auth bearer", async () => {
		const secret = "test-better-auth-secret";
		const raw = "phone_session_tok_abc";
		const signed = await signSessionToken(raw, secret);
		assert.equal(rawSessionTokenFromBearer(signed), raw);
		assert.equal(await signedBearerSessionToken(raw, secret), signed);
		assert.equal(await signedBearerSessionToken(signed, secret), signed);
	});
});
