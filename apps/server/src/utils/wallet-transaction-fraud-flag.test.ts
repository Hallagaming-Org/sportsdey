import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	isWalletTransactionFlagged,
	parseWalletTransactionMetadata,
	readWalletFraudFlag,
	withWalletFraudFlag,
} from "./wallet-transaction-fraud-flag";

describe("wallet transaction fraud flag metadata", () => {
	it("round-trips a flag without dropping other metadata", () => {
		const meta = parseWalletTransactionMetadata(
			JSON.stringify({ ipAddress: "1.1.1.1", provider: "paystack" }),
		);
		const next = withWalletFraudFlag(meta, {
			flagged: true,
			flaggedAt: 1_700_000_000_000,
			flaggedByAdminId: "admin-1",
			flaggedByAdminName: "Ada",
			reason: "stolen card",
		});
		assert.equal(next.ipAddress, "1.1.1.1");
		const flag = readWalletFraudFlag(next);
		assert.equal(flag?.flaggedByAdminId, "admin-1");
		assert.equal(flag?.reason, "stolen card");
		assert.equal(isWalletTransactionFlagged(JSON.stringify(next)), true);
	});

	it("treats missing or invalid metadata as unflagged", () => {
		assert.equal(isWalletTransactionFlagged(null), false);
		assert.equal(isWalletTransactionFlagged("{"), false);
		assert.equal(readWalletFraudFlag({ fraudFlag: { flagged: false } }), null);
	});
});
