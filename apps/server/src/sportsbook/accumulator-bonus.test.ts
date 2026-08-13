import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildAccumulatorBoostPayload,
	getAccumulatorBonusPercent,
	getAccumulatorBonusTable,
	getAccumulatorMultiplier,
} from "./accumulator-bonus";

describe("accumulator bonus table", () => {
	it("has no football Doubles bonus", () => {
		assert.equal(getAccumulatorBonusPercent("football", 2), null);
		assert.equal(getAccumulatorMultiplier("football", 2), null);
		assert.equal(buildAccumulatorBoostPayload({ sport: "football", selections: 2 }), null);
	});

	it("starts basketball and tennis Doubles at 3%", () => {
		assert.equal(getAccumulatorBonusPercent("basketball", 2), 3);
		assert.equal(getAccumulatorBonusPercent("tennis", 2), 3);
		assert.equal(getAccumulatorMultiplier("basketball", 2), "1.03");
	});

	it("matches the shared 3–11 fold scale", () => {
		assert.equal(getAccumulatorBonusPercent("football", 3), 5);
		assert.equal(getAccumulatorBonusPercent("basketball", 4), 10);
		assert.equal(getAccumulatorBonusPercent("tennis", 11), 45);
		assert.equal(getAccumulatorMultiplier("football", 3), "1.05");
		assert.equal(getAccumulatorMultiplier("football", 11), "1.45");
	});

	it("matches irregular high-fold jumps", () => {
		assert.equal(getAccumulatorBonusPercent("football", 12), 50);
		assert.equal(getAccumulatorBonusPercent("football", 13), 60);
		assert.equal(getAccumulatorBonusPercent("football", 15), 75);
		assert.equal(getAccumulatorBonusPercent("football", 16), 80);
		assert.equal(getAccumulatorBonusPercent("football", 27), 200);
		assert.equal(getAccumulatorBonusPercent("football", 38), 315);
		assert.equal(getAccumulatorBonusPercent("football", 50), 500);
		assert.equal(getAccumulatorMultiplier("tennis", 18), "2.00");
		assert.equal(getAccumulatorMultiplier("basketball", 50), "6.00");
	});

	it("rejects folds outside 2–50", () => {
		assert.equal(getAccumulatorBonusPercent("football", 1), null);
		assert.equal(getAccumulatorBonusPercent("football", 51), null);
	});

	it("exposes 49 rows (2-fold through 50-fold)", () => {
		const table = getAccumulatorBonusTable();
		assert.equal(table.length, 49);
		assert.equal(table[0]?.label, "Doubles");
		assert.equal(table[0]?.football, null);
		assert.equal(table[48]?.selections, 50);
		assert.equal(table[48]?.football, 500);
	});

	it("builds a DataBet static express payload for a qualifying fold", () => {
		const payload = buildAccumulatorBoostPayload({
			sport: "football",
			selections: 5,
		});
		assert.ok(payload);
		assert.equal(payload.bonusPercent, 15);
		assert.equal(payload.multiplier, "1.15");
		assert.equal(payload.calculation_strategy.type, "static");
		assert.equal(
			payload.calculation_strategy.strategy.params.min_selections,
			5,
		);
		const required = payload.required_conditions[0] as {
			bet_details: Array<{ type: string; data: { odds_count: { min: number } } }>;
		};
		assert.equal(required.bet_details[0]?.type, "express");
		assert.equal(required.bet_details[0]?.data.odds_count.min, 5);
	});
});
