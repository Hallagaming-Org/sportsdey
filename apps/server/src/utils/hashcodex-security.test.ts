import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import {
	computeHashcodexSignature,
	HASHCODEX_SIGNATURE_HEADER,
	HashcodexSignatureError,
	verifyHashcodexSignature,
} from "./hashcodex-security";

const SECRET = "hashcodex-test-secret";
const BODY =
	'{"playerId":"u1","action":"debit","amount":10,"transactionId":"t1"}';

describe("hashcodex HMAC", () => {
	it("accepts a valid sha256 hex signature of the raw body", () => {
		const signature = computeHashcodexSignature(BODY, SECRET);
		assert.equal(
			signature,
			createHmac("sha256", SECRET).update(BODY, "utf8").digest("hex"),
		);
		verifyHashcodexSignature(BODY, signature, SECRET);
	});

	it("is case-insensitive for the hex header", () => {
		const signature = computeHashcodexSignature(BODY, SECRET).toUpperCase();
		verifyHashcodexSignature(BODY, signature, SECRET);
	});

	it("rejects a tampered body", () => {
		const signature = computeHashcodexSignature(BODY, SECRET);
		assert.throws(
			() => verifyHashcodexSignature(`${BODY} `, signature, SECRET),
			HashcodexSignatureError,
		);
	});

	it("rejects a missing header and missing secret", () => {
		assert.throws(
			() => verifyHashcodexSignature(BODY, undefined, SECRET),
			(error: unknown) =>
				error instanceof HashcodexSignatureError &&
				error.message.includes(HASHCODEX_SIGNATURE_HEADER),
		);
		assert.throws(
			() => verifyHashcodexSignature(BODY, "abc", undefined),
			(error: unknown) =>
				error instanceof HashcodexSignatureError &&
				error.message.includes("not configured"),
		);
	});
});
