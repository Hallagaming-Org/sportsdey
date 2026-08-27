import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	CLASSIC_HIDDEN_FROM_ALL_CODES,
	CLASSIC_THUNDR_CODES,
} from "./classic-lobby-codes";

describe("classic lobby Plinko placement", () => {
	it("keeps Plinko out of PvP and off the All tab", () => {
		assert.equal(
			(CLASSIC_THUNDR_CODES as readonly string[]).includes("plinko"),
			false,
		);
		assert.equal(
			(CLASSIC_HIDDEN_FROM_ALL_CODES as readonly string[]).includes("plinko"),
			true,
		);
	});
});
