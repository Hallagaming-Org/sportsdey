import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	collapseCasinoLedgerRows,
	deriveStatusFromCasino,
} from "./bet-history";

describe("deriveStatusFromCasino", () => {
	it("treats a credited win as success only when amount is positive", () => {
		assert.equal(deriveStatusFromCasino("WIN", 15_000), "success");
		assert.equal(deriveStatusFromCasino("CREDIT", 1), "success");
	});

	it("treats a zero-amount win as a loss", () => {
		assert.equal(deriveStatusFromCasino("WIN", 0), "failed");
		assert.equal(deriveStatusFromCasino("win", 0), "failed");
	});

	it("treats a standalone bet as a settled loss, not pending", () => {
		assert.equal(deriveStatusFromCasino("BET", 35_000), "failed");
		assert.equal(deriveStatusFromCasino("DEBIT", 35_000), "failed");
	});
});

describe("collapseCasinoLedgerRows", () => {
	const now = new Date("2026-09-08T13:35:00.000Z");

	it("hides rejected plays that only have a ₦0 win callback", () => {
		const items = collapseCasinoLedgerRows([
			{
				id: "win-zero",
				type: "WIN",
				amount: 0,
				createdAt: now,
				roundId: "round-empty",
				gameLabel: "3 Kings Scratch",
			},
		]);
		assert.deepEqual(items, []);
	});

	it("marks a bet-only scratch round as lost", () => {
		const items = collapseCasinoLedgerRows([
			{
				id: "bet-1",
				type: "BET",
				amount: 35_000,
				createdAt: now,
				roundId: "round-lost",
				gameLabel: "3 Kings Scratch",
			},
		]);
		assert.equal(items.length, 1);
		assert.equal(items[0]?.status, "failed");
		assert.equal(items[0]?.amount, 350);
		assert.equal(items[0]?.payout, 0);
	});

	it("collapses a bet plus win into one won ticket with the stake amount", () => {
		const items = collapseCasinoLedgerRows([
			{
				id: "bet-2",
				type: "BET",
				amount: 35_000,
				createdAt: now,
				roundId: "round-win",
				gameLabel: "3 Kings Scratch",
			},
			{
				id: "win-2",
				type: "WIN",
				amount: 70_000,
				createdAt: new Date(now.getTime() + 1_000),
				roundId: "round-win",
				gameLabel: "3 Kings Scratch",
			},
		]);
		assert.equal(items.length, 1);
		assert.equal(items[0]?.id, "bet-2");
		assert.equal(items[0]?.status, "success");
		assert.equal(items[0]?.amount, 350);
		assert.equal(items[0]?.payout, 700);
	});

	it("treats a bet plus ₦0 win as a loss, not a win", () => {
		const items = collapseCasinoLedgerRows([
			{
				id: "bet-3",
				type: "BET",
				amount: 35_000,
				createdAt: now,
				roundId: "round-zero-win",
				gameLabel: "3 Kings Scratch",
			},
			{
				id: "win-3",
				type: "WIN",
				amount: 0,
				createdAt: new Date(now.getTime() + 1_000),
				roundId: "round-zero-win",
				gameLabel: "3 Kings Scratch",
			},
		]);
		assert.equal(items.length, 1);
		assert.equal(items[0]?.status, "failed");
		assert.equal(items[0]?.amount, 350);
	});
});
