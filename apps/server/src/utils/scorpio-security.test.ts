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
		assert.deepEqual(getAllowedIps(settings), ["203.0.113.1", "203.0.113.2"]);
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
	it("normalizes malformed https:/ callback URLs from Scorpio", async () => {
		const { normalizeScorpioCallbackUrl } = await import(
			"./scorpio-config"
		);
		assert.equal(
			normalizeScorpioCallbackUrl(
				"https:/staging-api.sportsdey.com/scorpio/callback",
			),
			"https://staging-api.sportsdey.com/scorpio/callback",
		);
		assert.equal(
			normalizeScorpioCallbackUrl(
				"https://api.sportsdey.com/scorpio/callback/",
			),
			"https://api.sportsdey.com/scorpio/callback",
		);
	});

	it("accepts a valid callback signature", () => {
		const signature = computeScorpioSignature({ ...balanceBody }, API_TOKEN);
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
		assert.doesNotThrow(() => assertScorpioCallbackIp("203.0.113.1", settings));
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

	it("coerces string providerId and amount from Scorpio NGN callbacks", () => {
		const parsed = ScorpioCallbackRequestSchema.safeParse({
			command: "cancel",
			transactionId: "SPTRX18",
			referenceId: "SPTRX17",
			playerId: "a7f73560-77fe-4de2-9cda-49de12539c79",
			roundId: "690963047103974309",
			providerId: "2",
			providerName: "",
			gameCode: "vswaysdogs",
			gameName: "The Dog House",
			currency: "NGN",
			amount: "10.5",
			timestamp: "1700000000000",
		});
		assert.equal(parsed.success, true);
		if (!parsed.success) return;
		assert.equal(parsed.data.command, "cancel");
		assert.equal(parsed.data.providerId, 2);
		assert.equal(parsed.data.amount, 10.5);
		assert.equal(parsed.data.timestamp, 1_700_000_000_000);
	});

	it("accepts Scorpio NGN cancel JSON without command or timestamp", () => {
		const parsed = ScorpioCallbackRequestSchema.safeParse({
			transactionId: "SPTRX18",
			playerId: "a7f73560-77fe-4de2-9cda-49de12539c79",
			roundId: "690963047103974309",
			providerId: "2",
			providerName: "EGT Digital",
			gameCode: "TNBCSlot",
			gameName: "10 Burning Clover",
			currency: "NGN",
			amount: 80,
			referenceId: "SPTRX17",
		});
		assert.equal(parsed.success, true);
		if (!parsed.success) return;
		assert.equal(parsed.data.command, "cancel");
		assert.equal(parsed.data.providerId, 2);
		assert.equal(parsed.data.amount, 80);
	});

	it("accepts Scorpio NGN bet JSON without command or timestamp", () => {
		const parsed = ScorpioCallbackRequestSchema.safeParse({
			transactionId: "SPTRX17",
			playerId: "a7f73560-77fe-4de2-9cda-49de12539c79",
			roundId: "690963047103974309",
			providerId: "2",
			providerName: "EGT Digital",
			gameCode: "TNBCSlot",
			gameName: "10 Burning Clover",
			currency: "NGN",
			amount: 80,
			isCall: false,
			isRoundFinished: true,
		});
		assert.equal(parsed.success, true);
		if (!parsed.success) return;
		assert.equal(parsed.data.command, "bet");
		assert.equal(parsed.data.providerId, 2);
	});

	it("accepts a bet without isCall/isRoundFinished and coerces 0/1 flags", () => {
		const parsed = ScorpioCallbackRequestSchema.safeParse({
			command: "BET",
			transactionId: "SPTRX21",
			playerId: "2c4KYV5MF8JemO0qS4E5ZrfZcV8EEHaC",
			roundId: "690963047103974309",
			providerId: 2,
			providerName: "Pragmatic Play",
			gameCode: "vs10dmreels",
			gameName: "Happy Dragon",
			currency: "NGN",
			amount: 40,
		});
		assert.equal(parsed.success, true);
		if (!parsed.success) return;
		assert.equal(parsed.data.command, "bet");
		assert.equal(parsed.data.isCall, false);
		assert.equal(parsed.data.isRoundFinished, true);

		const flagged = ScorpioCallbackRequestSchema.safeParse({
			command: "bet",
			transactionId: "SPTRX22",
			playerId: 1101,
			roundId: "1",
			providerId: 2,
			providerName: "Pragmatic Play",
			gameCode: "vs10dmreels",
			gameName: "Happy Dragon",
			currency: "NGN",
			amount: 40,
			isCall: 0,
			isRoundFinished: 1,
		});
		assert.equal(flagged.success, true);
		if (!flagged.success) return;
		assert.equal(flagged.data.playerId, "1101");
		assert.equal(flagged.data.isCall, false);
		assert.equal(flagged.data.isRoundFinished, true);
	});

	it("accepts a cancel that only includes referenceId", () => {
		const parsed = ScorpioCallbackRequestSchema.safeParse({
			command: "cancel",
			playerId: "2c4KYV5MF8JemO0qS4E5ZrfZcV8EEHaC",
			roundId: "690963047103974309",
			providerId: 2,
			providerName: "Pragmatic Play",
			gameCode: "vs10dmreels",
			gameName: "Happy Dragon",
			currency: "NGN",
			amount: 40,
			referenceId: "SPTRX21",
		});
		assert.equal(parsed.success, true);
		if (!parsed.success) return;
		assert.equal(parsed.data.command, "cancel");
		assert.equal(parsed.data.referenceId, "SPTRX21");
		assert.equal(parsed.data.transactionId, "SPTRX21:cancel");
	});

	it("accepts the live Scorpio NGN cancel/bet shape from the error log", () => {
		const cancel = ScorpioCallbackRequestSchema.safeParse({
			command: "cancel",
			transactionId: "SPTRX22",
			playerId: "2c4KYV5MF8JemOoQS4E5ZrFZcV8EEHaC",
			roundId: "3733875814153",
			providerId: "1",
			providerName: "Pragmatic Play",
			gameCode: "vs10dmreels",
			gameName: "Happy Dragon",
			currency: "NGN",
			amount: 40,
		});
		assert.equal(cancel.success, true);
		if (!cancel.success) return;
		assert.equal(cancel.data.providerId, 1);
		assert.equal(cancel.data.referenceId, "SPTRX22");
		assert.equal(cancel.data.transactionId, "SPTRX22:cancel");

		const bet = ScorpioCallbackRequestSchema.safeParse({
			command: "bet",
			transactionId: "SPTRX21",
			playerId: "2c4KYV5MF8JemOoQS4E5ZrFZcV8EEHaC",
			roundId: 3735185698153,
			providerId: "1",
			providerName: "Pragmatic Play",
			gameCode: "vs10dmreels",
			gameName: "Happy Dragon",
			currency: "NGN",
			amount: 40,
		});
		assert.equal(bet.success, true);
		if (!bet.success) return;
		assert.equal(bet.data.providerId, 1);
		assert.equal(bet.data.roundId, "3735185698153");
		assert.equal(bet.data.isCall, false);
	});
});
