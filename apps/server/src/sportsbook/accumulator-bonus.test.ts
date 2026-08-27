import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	ACCUMULATOR_MAX_MULTIPLIER,
	ACCUMULATOR_MAX_STEPS,
	ACCUMULATOR_MULTIPLIER_PER_STEP,
	buildAccumulatorBoostPayload,
	buildAccumulatorStepsBoostPayload,
	boostCoversAccumulatorFold,
	boostCoversAccumulatorSport,
	getAccumulatorBonusPercent,
	getAccumulatorBonusTable,
	getAccumulatorMultiplier,
	listAccumulatorFoldBoostPayloads,
	listAccumulatorStepsBoostPayloads,
	planAccumulatorFoldGrants,
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

	it("builds one steps boost per sport that grows with extra selections", () => {
		const football = buildAccumulatorStepsBoostPayload("football");
		assert.equal(football.calculation_strategy.type, "steps");
		assert.equal(football.minSelections, 3);
		assert.equal(football.maxSelections, 10);
		assert.equal(ACCUMULATOR_MAX_MULTIPLIER, "1.40");
		assert.equal(ACCUMULATOR_MAX_STEPS, 8);
		assert.deepEqual(football.calculation_strategy.strategy.params, {
			selections_per_step: 1,
			multiplier_per_step: ACCUMULATOR_MULTIPLIER_PER_STEP,
			max_multiplier: ACCUMULATOR_MAX_MULTIPLIER,
		});
		const required = football.required_conditions[0] as {
			bet_details: Array<{
				data: { odds_count: { min: number; max: number }; sport: { sport_ids: string[] } };
			}>;
		};
		assert.equal(required.bet_details[0]?.data.odds_count.min, 3);
		assert.equal(required.bet_details[0]?.data.odds_count.max, 10);
		assert.deepEqual(required.bet_details[0]?.data.sport.sport_ids, ["football"]);

		const basketball = buildAccumulatorStepsBoostPayload("basketball");
		const tennisRequired = buildAccumulatorStepsBoostPayload("tennis")
			.required_conditions[0] as {
			bet_details: Array<{ data: { odds_count: { min: number } } }>;
		};
		assert.equal(basketball.minSelections, 2);
		assert.equal(basketball.maxSelections, 9);
		assert.equal(tennisRequired.bet_details[0]?.data.odds_count.min, 2);
		assert.equal(listAccumulatorStepsBoostPayloads().length, 3);
	});

	it("lists one static boost per spreadsheet fold, not a linear steps scale", () => {
		const payloads = listAccumulatorFoldBoostPayloads();
		assert.equal(payloads.length, 146);
		assert.equal(
			payloads.filter((p) => p.sport === "football").length,
			48,
		);
		assert.equal(
			payloads.filter((p) => p.sport === "basketball").length,
			49,
		);
		assert.equal(payloads.some((p) => p.sport === "football" && p.selections === 2), false);

		const football5 = payloads.find(
			(p) => p.sport === "football" && p.selections === 5,
		);
		assert.equal(football5?.calculation_strategy.type, "static");
		assert.equal(football5?.bonusPercent, 15);
		assert.equal(football5?.multiplier, "1.15");
		assert.equal(
			football5?.calculation_strategy.strategy.params.min_selections,
			5,
		);

		const football12 = payloads.find(
			(p) => p.sport === "football" && p.selections === 12,
		);
		const football13 = payloads.find(
			(p) => p.sport === "football" && p.selections === 13,
		);
		assert.equal(football12?.bonusPercent, 50);
		assert.equal(football13?.bonusPercent, 60);
		assert.equal(football12?.multiplier, "1.50");
		assert.equal(football13?.multiplier, "1.60");

		const basketball2 = payloads.find(
			(p) => p.sport === "basketball" && p.selections === 2,
		);
		const tennis50 = payloads.find(
			(p) => p.sport === "tennis" && p.selections === 50,
		);
		assert.equal(basketball2?.bonusPercent, 3);
		assert.equal(basketball2?.multiplier, "1.03");
		assert.equal(tennis50?.bonusPercent, 500);
		assert.equal(tennis50?.multiplier, "6.00");
	});

	it("detects an existing steps boost for a sport", () => {
		const payload = buildAccumulatorStepsBoostPayload("tennis");
		assert.equal(
			boostCoversAccumulatorSport(
				{
					calculation_strategy: payload.calculation_strategy,
					required_conditions: payload.required_conditions as never,
				},
				"tennis",
			),
			true,
		);
		assert.equal(
			boostCoversAccumulatorSport(
				{
					calculation_strategy: payload.calculation_strategy,
					required_conditions: payload.required_conditions as never,
				},
				"football",
			),
			false,
		);
	});

	it("detects an existing static boost for one sport × fold only", () => {
		const football5 = buildAccumulatorBoostPayload({
			sport: "football",
			selections: 5,
		});
		assert.ok(football5);
		assert.equal(
			boostCoversAccumulatorFold(
				{
					calculation_strategy: football5.calculation_strategy,
					required_conditions: football5.required_conditions as never,
				},
				"football",
				5,
			),
			true,
		);
		assert.equal(
			boostCoversAccumulatorFold(
				{
					calculation_strategy: football5.calculation_strategy,
					required_conditions: football5.required_conditions as never,
				},
				"football",
				6,
			),
			false,
		);
		assert.equal(
			boostCoversAccumulatorFold(
				{
					calculation_strategy: football5.calculation_strategy,
					required_conditions: football5.required_conditions as never,
				},
				"tennis",
				5,
			),
			false,
		);
	});

	it("blocks static grants while a legacy steps boost is still present", () => {
		const tennisSteps = buildAccumulatorStepsBoostPayload("tennis");
		const plan = planAccumulatorFoldGrants([
			{
				id: "legacy-tennis-steps",
				calculation_strategy: tennisSteps.calculation_strategy,
				required_conditions: tennisSteps.required_conditions as never,
			},
		]);
		assert.deepEqual(plan.blockedLegacySports, ["tennis"]);
		assert.deepEqual(plan.legacyStepsBoostIds, ["legacy-tennis-steps"]);
		assert.equal(
			plan.toCreate.some((preset) => preset.sport === "tennis"),
			false,
		);
		assert.equal(plan.toCreate.length, 48 + 49);
	});

	it("grants the full static table once legacy steps boosts are gone", () => {
		const plan = planAccumulatorFoldGrants([]);
		assert.deepEqual(plan.blockedLegacySports, []);
		assert.deepEqual(plan.legacyStepsBoostIds, []);
		assert.equal(plan.toCreate.length, 146);
		assert.equal(
			plan.toCreate.filter((preset) => preset.sport === "tennis").length,
			49,
		);
	});

	it("skips static folds the player already has and still grants the rest", () => {
		const football5 = buildAccumulatorBoostPayload({
			sport: "football",
			selections: 5,
		});
		assert.ok(football5);
		const plan = planAccumulatorFoldGrants([
			{
				calculation_strategy: football5.calculation_strategy,
				required_conditions: football5.required_conditions as never,
			},
		]);
		assert.deepEqual(plan.blockedLegacySports, []);
		assert.equal(plan.toCreate.length, 145);
		assert.equal(
			plan.toCreate.some(
				(preset) => preset.sport === "football" && preset.selections === 5,
			),
			false,
		);
	});
});
