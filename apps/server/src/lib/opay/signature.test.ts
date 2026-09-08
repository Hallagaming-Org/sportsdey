import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hmac } from "@noble/hashes/hmac";
import { sha3_512 } from "@noble/hashes/sha3";
import { verifyCallbackSignature } from "./signature";

function sign(value: string, key: string): string {
	return Array.from(
		hmac(sha3_512, new TextEncoder().encode(key), new TextEncoder().encode(value)),
	)
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

describe("OPay callback signature", () => {
	it("accepts OPay's canonical HMAC-SHA3-512 callback format", async () => {
		const privateKey = "opay-test-private-key";
		const payload = {
			amount: "10000",
			currency: "NGN",
			reference: "opay_test_reference",
			refunded: false,
			status: "SUCCESS",
			timestamp: "2026-09-08T13:49:06Z",
			token: "260908145665865039733",
			transactionId: "260908145665865039733",
		};
		const signed = `{Amount:"10000",Currency:"NGN",Reference:"opay_test_reference",Refunded:f,Status:"SUCCESS",Timestamp:"2026-09-08T13:49:06Z",Token:"260908145665865039733",TransactionID:"260908145665865039733"}`;
		const result = await verifyCallbackSignature(
			JSON.stringify({ payload, sha512: sign(signed, privateKey) }),
			privateKey,
		);
		assert.equal(result.valid, true);
		assert.equal(result.payload?.reference, payload.reference);
	});

	it("rejects a signature for an altered callback", async () => {
		const privateKey = "opay-test-private-key";
		const payload = {
			amount: "10000", currency: "NGN", reference: "opay_test_reference",
			refunded: false, status: "SUCCESS", timestamp: "2026-09-08T13:49:06Z",
			token: "token", transactionId: "txn",
		};
		const signed = `{Amount:"10000",Currency:"NGN",Reference:"opay_test_reference",Refunded:f,Status:"SUCCESS",Timestamp:"2026-09-08T13:49:06Z",Token:"token",TransactionID:"txn"}`;
		const result = await verifyCallbackSignature(
			JSON.stringify({ payload: { ...payload, status: "FAILED" }, sha512: sign(signed, privateKey) }),
			privateKey,
		);
		assert.equal(result.valid, false);
	});
});
