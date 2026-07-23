import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ScorpioCallbackRequestSchema } from "../schemas/scorpio";
import {
	assertScorpioSettings,
	getAllowedIps,
	getConfiguredServerIp,
	loadScorpioSettings,
	ScorpioConfigError,
} from "./scorpio-config";
import {
	assertScorpioCallbackIp,
	buildScorpioSignaturePayload,
	computeScorpioSignature,
	isIpAllowed,
	ScorpioIpForbiddenError,
	ScorpioSignatureError,
	verifyScorpioSignature,
} from "./scorpio-security";

const API_TOKEN = "test-scorpio-api-token";

const balanceBody = {
	command: "balance",
	playerId: "user-123",
	currency: "NGN",
	timestamp: 1_700_000_000_000,
} as const;

describe("scorpio config", () => {
	it("loads configuration from env including aliases", () => {
		const settings = loadScorpioSettings({
			SCORPIO_BASE_URL: "https://scorpio.example.com/",
			SCORPIO_API_TOKEN: "token",
			SCORPIO_CALLBACK_URL: "https://api.example.com/scorpio/callback",
			SCORPIO_SERVER_IP: "203.0.113.10",
			SCORPIO_ALLOWED_IPS: "203.0.113.1, 203.0.113.2",
		});

		assert.equal(settings.apiUrl, "https://scorpio.example.com");
		assert.equal(settings.apiToken, "token");
		assert.equal(
			settings.callbackUrl,
			"https://api.example.com/scorpio/callback",
		);
		assert.equal(getConfiguredServerIp(settings), "203.0.113.10");
		assert.deepEqual(getAllowedIps(settings), [
			"203.0.113.1",
			"203.0.113.2",
		]);
		assert.equal(settings.ipRestrictionEnabled, true);
	});

	it("fails validation when required values are missing", () => {
		const settings = loadScorpioSettings({});
		assert.throws(
			() => assertScorpioSettings(settings),
			(error: unknown) =>
				error instanceof ScorpioConfigError &&
				error.message.includes("SCORPIO_API_URL"),
		);

		const withUrl = loadScorpioSettings({
			SCORPIO_API_URL: "https://scorpio.example.com",
		});
		assert.throws(
			() => assertScorpioSettings(withUrl),
			(error: unknown) =>
				error instanceof ScorpioConfigError &&
				error.message.includes("SCORPIO_API_TOKEN"),
		);

		const withToken = loadScorpioSettings({
			SCORPIO_API_URL: "https://scorpio.example.com",
			SCORPIO_API_TOKEN: "token",
		});
		assert.throws(
			() => assertScorpioSettings(withToken, { requireCallbackUrl: true }),
			(error: unknown) =>
				error instanceof ScorpioConfigError &&
				error.message.includes("SCORPIO_CALLBACK_URL"),
		);
	});
});

describe("scorpio signature", () => {
	it("accepts a valid callback signature", () => {
		const signature = computeScorpioSignature(
			{ ...balanceBody },
			API_TOKEN,
		);
		assert.doesNotThrow(() =>
			verifyScorpioSignature({ ...balanceBody }, signature, API_TOKEN),
		);
	});

	it("rejects an invalid signature", () => {
		assert.throws(
			() =>
				verifyScorpioSignature(
					{ ...balanceBody },
					"not-a-valid-signature",
					API_TOKEN,
				),
			ScorpioSignatureError,
		);
	});

	it("rejects missing signature header", () => {
		assert.throws(
			() => verifyScorpioSignature({ ...balanceBody }, undefined, API_TOKEN),
			ScorpioSignatureError,
		);
	});

	it("builds payload with sorted keys", () => {
		const payload = buildScorpioSignaturePayload({
			timestamp: 2,
			command: "balance",
			playerId: "a",
			currency: "NGN",
		});
		assert.equal(payload, "balance,NGN,a,2");
	});
});

describe("scorpio IP restriction", () => {
	it("allows any IP when restriction is disabled", () => {
		assert.equal(
			isIpAllowed("198.51.100.1", {
				allowedIps: [],
				ipRestrictionEnabled: false,
			}),
			true,
		);
	});

	it("rejects unauthorized IPs when restriction is enabled", () => {
		const settings = {
			allowedIps: ["203.0.113.1"],
			ipRestrictionEnabled: true,
		};
		assert.equal(isIpAllowed("198.51.100.9", settings), false);
		assert.throws(
			() => assertScorpioCallbackIp("198.51.100.9", settings),
			ScorpioIpForbiddenError,
		);
		assert.doesNotThrow(() =>
			assertScorpioCallbackIp("203.0.113.1", settings),
		);
	});
});

describe("scorpio callback payload schema", () => {
	it("accepts a valid balance callback", () => {
		const parsed = ScorpioCallbackRequestSchema.safeParse(balanceBody);
		assert.equal(parsed.success, true);
	});

	it("rejects a malformed payload", () => {
		const parsed = ScorpioCallbackRequestSchema.safeParse({
			command: "bet",
			playerId: "user-123",
		});
		assert.equal(parsed.success, false);
	});

	it("rejects an unknown command", () => {
		const parsed = ScorpioCallbackRequestSchema.safeParse({
			command: "deposit",
			playerId: "user-123",
			currency: "NGN",
			timestamp: 1,
		});
		assert.equal(parsed.success, false);
	});
});
