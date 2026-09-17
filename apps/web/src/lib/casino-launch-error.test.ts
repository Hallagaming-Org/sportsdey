import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	friendlyCasinoLaunchError,
	isPlayerInsufficientFundsError,
} from "./casino-launch-error";

describe("isPlayerInsufficientFundsError", () => {
	it("treats real player-funds errors as insufficient", () => {
		assert.equal(isPlayerInsufficientFundsError("Insufficient balance"), true);
		assert.equal(isPlayerInsufficientFundsError("INSUFFICIENT_FUNDS"), true);
		assert.equal(isPlayerInsufficientFundsError("Not enough funds"), true);
		assert.equal(
			isPlayerInsufficientFundsError("Player has insufficient money"),
			true,
		);
	});

	it("does not treat provider/session errors that mention balance as the player being broke", () => {
		assert.equal(
			isPlayerInsufficientFundsError("Error while getting player balance"),
			false,
		);
		assert.equal(isPlayerInsufficientFundsError("BALANCE_NOT_ENOUGH"), false);
		assert.equal(isPlayerInsufficientFundsError("POINT_NOT_ENOUGH"), false);
		assert.equal(
			isPlayerInsufficientFundsError("Operator deposit balance empty"),
			false,
		);
		assert.equal(
			isPlayerInsufficientFundsError("Failed to launch game"),
			false,
		);
	});
});

describe("friendlyCasinoLaunchError", () => {
	it("maps GIS contract and Scorpio operator failures to playable copy", () => {
		assert.match(
			friendlyCasinoLaunchError("immediate_exit"),
			/not playable yet/i,
		);
		assert.match(
			friendlyCasinoLaunchError("BALANCE_NOT_ENOUGH"),
			/temporarily unavailable/i,
		);
		assert.match(
			friendlyCasinoLaunchError("Error while getting player balance"),
			/could not start/i,
		);
		assert.equal(
			friendlyCasinoLaunchError("Game/provider does not support demo mode"),
			"Demo is not available for this game. Try Play Now.",
		);
	});
});
