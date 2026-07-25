import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	isUniqueConstraintError,
	koboToScorpioBalance,
	scorpioAmountToKobo,
} from "./scorpio-callback";

describe("scorpio callback helpers", () => {
	it("converts major currency units to kobo", () => {
		assert.equal(scorpioAmountToKobo(10.5), 1050);
		assert.equal(koboToScorpioBalance(1050), 10.5);
	});

	it("detects sqlite unique constraint errors", () => {
		assert.equal(
			isUniqueConstraintError(
				new Error(
					"UNIQUE constraint failed: scorpio_transactions.transaction_id",
				),
			),
			true,
		);
		assert.equal(
			isUniqueConstraintError(new Error("D1_ERROR: UNIQUE constraint failed")),
			true,
		);
		assert.equal(isUniqueConstraintError(new Error("network down")), false);
	});
});
