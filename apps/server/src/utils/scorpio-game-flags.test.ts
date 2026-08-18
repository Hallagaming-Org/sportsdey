import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	overlayScorpioEnabled,
	scorpioGameCode,
} from "./scorpio-game-flags";

describe("scorpio game flags", () => {
	it("builds the local overlay code", () => {
		assert.equal(scorpioGameCode(1, "vswaysdogs"), "scorpio:1:vswaysdogs");
	});

	it("marks catalog games disabled only when the overlay code matches", () => {
		const overlaid = overlayScorpioEnabled(
			[
				{ gameID: "vswaysdogs", gameName: "The Dog House" },
				{ gameID: "vs20olympgate", gameName: "Gates of Olympus" },
			],
			1,
			new Set(["scorpio:1:vswaysdogs"]),
		);

		assert.equal(overlaid[0]?.enabled, false);
		assert.equal(overlaid[1]?.enabled, true);
	});
});
