import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeSmsPhoneNumber } from "./africastalking";
import { WebEngageSmsRequestSchema } from "../schemas/webengage-sms";

describe("normalizeSmsPhoneNumber", () => {
	it("normalizes Nigerian local and international formats", () => {
		assert.equal(normalizeSmsPhoneNumber("08012345678"), "+2348012345678");
		assert.equal(normalizeSmsPhoneNumber("2348012345678"), "+2348012345678");
		assert.equal(normalizeSmsPhoneNumber("+2348012345678"), "+2348012345678");
		assert.equal(normalizeSmsPhoneNumber("234 801 234 5678"), "+2348012345678");
	});

	it("rejects empty or invalid values", () => {
		assert.equal(normalizeSmsPhoneNumber(""), null);
		assert.equal(normalizeSmsPhoneNumber("abc"), null);
		assert.equal(normalizeSmsPhoneNumber("123"), null);
	});
});

describe("WebEngageSmsRequestSchema", () => {
	it("accepts WebEngage SSP v1 payload", () => {
		const parsed = WebEngageSmsRequestSchema.parse({
			version: "1.0",
			smsData: {
				toNumber: "2348012345678",
				fromNumber: "SPORTSDEY",
				body: "Hello from WebEngage",
			},
			metadata: {
				campaignType: "TRANSACTIONAL",
				messageId: "we-msg-1",
				timestamp: "2018-01-25T10:24:16+0000",
			},
		});
		assert.equal(parsed.smsData.body, "Hello from WebEngage");
		assert.equal(parsed.metadata?.messageId, "we-msg-1");
	});
});
