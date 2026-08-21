import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	isUniqueConstraintError,
	rollbackLedgerTxId,
} from "./casino-provider";

describe("LuckyWorld ledger ids", () => {
	it("namespaces rollback ids so they cannot collide with the original bet", () => {
		assert.equal(rollbackLedgerTxId("abc"), "rollback_abc");
		assert.notEqual(rollbackLedgerTxId("abc"), "abc");
	});

	it("detects D1 unique violations", () => {
		assert.equal(
			isUniqueConstraintError(
				new Error(
					"UNIQUE constraint failed: game_transactions.provider_tx_id",
				),
			),
			true,
		);
		assert.equal(
			isUniqueConstraintError(new Error("D1_ERROR: UNIQUE constraint failed")),
			true,
		);
		assert.equal(isUniqueConstraintError(new Error("timeout")), false);
	});

	it("detects unique violations wrapped by DrizzleQueryError.cause", () => {
		const wrapped = new Error(
			`Failed query: insert into "game_transactions"`,
		);
		wrapped.cause = new Error(
			"UNIQUE constraint failed: game_transactions.provider_tx_id",
		);
		assert.equal(isUniqueConstraintError(wrapped), true);
	});
});
