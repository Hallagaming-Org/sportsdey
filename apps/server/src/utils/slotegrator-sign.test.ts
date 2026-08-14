import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import {
	buildSlotegratorSign,
	mapSlotegratorUpstreamError,
} from "./slotegrator";

describe("buildSlotegratorSign", () => {
	it("matches HMAC-SHA1 of sorted URL-encoded params including auth headers", async () => {
		const requestParams = {
			game_uuid: "abc-123",
			device: "desktop",
		};
		const auth = {
			merchantId: "merchant-1",
			timestamp: "1710000000",
			nonce: "nonce-fixed",
		};
		const merchantKey = "test-merchant-key";

		const sign = await buildSlotegratorSign(requestParams, auth, merchantKey);

		const allParams: Record<string, string> = {
			...requestParams,
			"X-Merchant-Id": auth.merchantId,
			"X-Timestamp": auth.timestamp,
			"X-Nonce": auth.nonce,
		};
		const sortedKeys = Object.keys(allParams).sort();
		const params = new URLSearchParams();
		for (const key of sortedKeys) {
			params.set(key, allParams[key] ?? "");
		}
		const expected = createHmac("sha1", merchantKey)
			.update(params.toString())
			.digest("hex");

		assert.equal(sign, expected);
	});

	it("is deterministic for the same inputs", async () => {
		const requestParams = { game_uuid: "game-1" };
		const auth = {
			merchantId: "m",
			timestamp: "100",
			nonce: "n",
		};
		const a = await buildSlotegratorSign(requestParams, auth, "key");
		const b = await buildSlotegratorSign(requestParams, auth, "key");
		assert.equal(a, b);
	});
});

describe("mapSlotegratorUpstreamError", () => {
	it("maps demo-unsupported body to 422 with clear message", () => {
		const err = mapSlotegratorUpstreamError(400, {
			message: "Demo mode is not supported for this game",
		});
		assert.equal(err.status, 422);
		assert.match(err.message, /does not support demo mode/i);
	});

	it("maps 401 to 502 merchant auth failure", () => {
		const err = mapSlotegratorUpstreamError(401, { error: "Invalid sign" });
		assert.equal(err.status, 502);
		assert.match(err.message, /Invalid sign|authentication/i);
	});

	it("maps 429 to 503", () => {
		const err = mapSlotegratorUpstreamError(429, null);
		assert.equal(err.status, 503);
	});
});
