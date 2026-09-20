import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nativeCasinoGameName, nativeCasinoProvider } from "./native-casino-games";

describe("native casino game labels", () => {
	it("labels Spin and Win and SportsDey Crash without requiring a catalog row", () => {
		assert.equal(nativeCasinoGameName("spin_and_win"), "Spin and Win");
		assert.equal(nativeCasinoGameName(" sportsdey-crash "), "SportsDey Crash");
		assert.equal(nativeCasinoProvider("spin_and_win"), "SportsDey");
	});

	it("does not relabel unrelated provider games", () => {
		assert.equal(nativeCasinoGameName("XCAPEHB"), null);
		assert.equal(nativeCasinoProvider("XCAPEHB"), null);
	});
});
