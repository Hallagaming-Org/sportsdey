import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import {
	quidaxRampEventName,
	verifyRampWebhookSignature,
} from "./quidax-ramp-webhook";

describe("Quidax Ramp webhook signature", () => {
	it("accepts HMAC-SHA256 of the raw body", () => {
		const body = '{"event":"buy_transaction.successful"}';
		const secret = "sk_test";
		const sig = createHmac("sha256", secret).update(body).digest("hex");
		assert.equal(verifyRampWebhookSignature(body, sig, secret), true);
	});

	it("rejects a mismatched or missing signature", () => {
		const body = '{"event":"buy_transaction.successful"}';
		assert.equal(verifyRampWebhookSignature(body, "deadbeef", "sk_test"), false);
		assert.equal(verifyRampWebhookSignature(body, null, "sk_test"), false);
	});

	it("reads the event name without crediting a wallet", () => {
		assert.equal(
			quidaxRampEventName({ event: "buy_transaction.processing" }),
			"buy_transaction.processing",
		);
		assert.equal(quidaxRampEventName({}), null);
	});
});
