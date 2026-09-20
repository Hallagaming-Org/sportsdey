import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildHashcodexLaunchUrl,
	isHashcodexGameCode,
} from "./hashcodex-launch";

describe("buildHashcodexLaunchUrl", () => {
	it("passes playerId, gameCode, and wallet callback URLs", () => {
		const url = new URL(
			buildHashcodexLaunchUrl({
				playerId: "user-1",
				gameCode: "spin_and_win",
				apiUrl: "https://staging-api.sportsdey.com/",
			}),
		);
		assert.equal(url.searchParams.get("type"), "casino");
		assert.equal(url.searchParams.get("playerId"), "user-1");
		assert.equal(url.searchParams.get("gameCode"), "spin_and_win");
		assert.equal(
			url.searchParams.get("apiUrl"),
			"https://staging-api.sportsdey.com",
		);
		assert.equal(
			url.searchParams.get("walletUrl"),
			"https://staging-api.sportsdey.com/hashcodex/wallet",
		);
		assert.equal(
			url.searchParams.get("balanceUrl"),
			"https://staging-api.sportsdey.com/hashcodex/balance",
		);
	});

	it("recognizes Hashcodex lobby codes", () => {
		assert.equal(isHashcodexGameCode("sportsdey-crash"), true);
		assert.equal(isHashcodexGameCode("LAGOSRUSH"), false);
	});
});
