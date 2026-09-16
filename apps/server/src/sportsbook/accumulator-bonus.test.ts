import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	ACCUMULATOR_MAX_BONUS_PERCENT,
	ACCUMULATOR_MAX_MULTIPLIER,
	ACCUMULATOR_MAX_STEPS,
	ACCUMULATOR_MULTIPLIER_PER_STEP,
	buildAccumulatorBoostPayload,
	buildAccumulatorStepsBoostPayload,
	boostCoversAccumulatorFold,
	boostCoversAccumulatorProgram,
	boostCoversAccumulatorSport,
	boostHasLooseApplicableConditions,
	boostHasStaleMultiplier,
	betBoostListIncludesApplicable,
	getAccumulatorBonusPercent,
	getAccumulatorBonusTable,
	getAccumulatorMultiplier,
	isExactFoldAccumulatorBoost,
	listAccumulatorFoldBoostPayloads,
	listAccumulatorStepsBoostPayloads,
	planAccumulatorFoldGrants,
	planAccumulatorFoldRepairs,
} from "./accumulator-bonus";

/** Product of decimal selection odds (what Databet shows before boost). */
function accumulatorOddsProduct(odds: number[]): number {
	return odds.reduce((total, odd) => total * odd, 1);
}

/** Databet static boost applies multiplier on top of product odds. */
function boostedAccumulatorOdds(productOdds: number, multiplier: string): number {
	return productOdds * Number.parseFloat(multiplier);
}

function exactFoldBoost(
	sport: "football" | "basketball" | "tennis",
	selections: number,
	multiplier = "1.20",
) {
	const detail = {
		type: "express",
		data: {
			sport: {
				type: "sport",
				match_all_odds: true,
				sport_ids: [sport],
			},
			odds_count: {
				type: "odds_count",
				min: selections,
				max: selections,
			},
		},
	};
	const conditions = [{ type: "bet_details", bet_details: [detail] }];
	return {
		id: `${sport}-${selections}`,
		calculation_strategy: {
			type: "static" as const,
			strategy: {
				conditions: [],
				params: { multiplier, min_selections: selections },
			},
		},
		required_conditions: conditions as never,
		applicable_conditions: conditions as never,
	};
}

describe("accumulator bonus table", () => {
	it("applies 20% (1.20×) from Doubles through 50-fold for every listed sport", () => {
		assert.equal(ACCUMULATOR_MAX_BONUS_PERCENT, 20);
		assert.equal(getAccumulatorBonusPercent("football", 2), 20);
		assert.equal(getAccumulatorBonusPercent("basketball", 2), 20);
		assert.equal(getAccumulatorBonusPercent("tennis", 2), 20);
		assert.equal(getAccumulatorMultiplier("football", 2), "1.20");
		assert.equal(getAccumulatorMultiplier("basketball", 2), "1.20");
		assert.equal(getAccumulatorBonusPercent("football", 3), 20);
		assert.equal(getAccumulatorBonusPercent("basketball", 4), 20);
		assert.equal(getAccumulatorBonusPercent("tennis", 9), 20);
		assert.equal(getAccumulatorMultiplier("football", 3), "1.20");
		assert.equal(getAccumulatorMultiplier("football", 9), "1.20");
		assert.equal(getAccumulatorBonusPercent("football", 10), 20);
		assert.equal(getAccumulatorBonusPercent("football", 50), 20);
		assert.equal(getAccumulatorMultiplier("football", 10), "1.20");
		assert.equal(getAccumulatorMultiplier("football", 50), "1.20");
		assert.equal(getAccumulatorMultiplier("tennis", 18), "1.20");
		assert.equal(getAccumulatorMultiplier("basketball", 50), "1.20");
		assert.ok(buildAccumulatorBoostPayload({ sport: "football", selections: 2 }));
	});

	it("rejects folds outside 2–50", () => {
		assert.equal(getAccumulatorBonusPercent("football", 1), null);
		assert.equal(getAccumulatorBonusPercent("football", 51), null);
	});

	it("exposes 49 rows (2-fold through 50-fold)", () => {
		const table = getAccumulatorBonusTable();
		assert.equal(table.length, 49);
		assert.equal(table[0]?.label, "Doubles");
		assert.equal(table[0]?.football, 20);
		assert.equal(table[48]?.selections, 50);
		assert.equal(table[48]?.football, 20);
	});

	it("builds a DataBet static express payload covering 3–50 at 1.20×", () => {
		const payload = buildAccumulatorBoostPayload({
			sport: "football",
			selections: 5,
		});
		assert.ok(payload);
		assert.equal(payload.bonusPercent, 20);
		assert.equal(payload.multiplier, "1.20");
		assert.equal(payload.calculation_strategy.type, "static");
		assert.equal(
			payload.calculation_strategy.strategy.params.min_selections,
			3,
		);
		const required = payload.required_conditions[0] as {
			bet_details: Array<{
				type: string;
				data: { odds_count: { min: number; max: number } };
			}>;
		};
		assert.equal(required.bet_details[0]?.type, "express");
		assert.equal(required.bet_details[0]?.data.odds_count.min, 3);
		assert.equal(required.bet_details[0]?.data.odds_count.max, 50);
	});

	it("mirrors required_conditions in applicable_conditions with 3–50 odds_count", () => {
		const payload = buildAccumulatorBoostPayload({
			sport: "football",
			selections: 3,
		});
		assert.ok(payload);
		assert.deepEqual(
			payload.applicable_conditions,
			payload.required_conditions,
		);
		const applicable = payload.applicable_conditions[0] as {
			bet_details: Array<{ data: { odds_count: { min: number; max: number } } }>;
		};
		assert.equal(applicable.bet_details[0]?.data.odds_count.min, 3);
		assert.equal(applicable.bet_details[0]?.data.odds_count.max, 50);
	});

	it("detects leftover exact-fold cards and does not try to repair them", () => {
		const leftover = exactFoldBoost("football", 8, "1.15");
		assert.equal(isExactFoldAccumulatorBoost(leftover), true);
		assert.equal(boostHasStaleMultiplier(leftover), false);
		assert.equal(boostHasLooseApplicableConditions(leftover), false);
		assert.equal(planAccumulatorFoldRepairs([leftover]).length, 0);
		const plan = planAccumulatorFoldGrants([leftover]);
		assert.deepEqual(plan.staleFoldBoostIds, ["football-8"]);
	});

	it("detects legacy sport-only applicable rules that need repair", () => {
		const payload = buildAccumulatorBoostPayload({
			sport: "football",
		});
		assert.ok(payload);
		const looseBoost = {
			id: "boost-wide",
			calculation_strategy: payload.calculation_strategy,
			required_conditions: payload.required_conditions as never,
			applicable_conditions: [
				{
					type: "bet_details",
					bet_details: [
						{
							type: "express",
							data: {
								sport: {
									type: "sport",
									match_all_odds: true,
									sport_ids: ["football"],
								},
							},
						},
					],
				},
			],
		};
		assert.equal(boostHasLooseApplicableConditions(looseBoost), true);
		assert.equal(boostHasLooseApplicableConditions(payload as never), false);
		const repairs = planAccumulatorFoldRepairs([looseBoost]);
		assert.equal(repairs.length, 1);
		assert.equal(repairs[0]?.boostId, "boost-wide");
		assert.deepEqual(
			repairs[0]?.applicable_conditions,
			payload.applicable_conditions,
		);
	});

	it("flags static boosts whose multiplier is still the old table", () => {
		const payload = buildAccumulatorBoostPayload({
			sport: "football",
		});
		assert.ok(payload);
		const staleBoost = {
			id: "boost-wide",
			calculation_strategy: {
				type: "static" as const,
				strategy: {
					conditions: [],
					params: { multiplier: "1.05", min_selections: 3 },
				},
			},
			required_conditions: payload.required_conditions as never,
			applicable_conditions: payload.applicable_conditions as never,
		};
		assert.equal(boostHasStaleMultiplier(staleBoost), true);
		assert.equal(boostHasStaleMultiplier(payload as never), false);
		const repairs = planAccumulatorFoldRepairs([staleBoost]);
		assert.equal(repairs.length, 1);
		assert.equal(repairs[0]?.calculation_strategy.strategy.params.multiplier, "1.20");
	});

	it("flags wide boosts still above the 1.20 cap as stale", () => {
		const payload = buildAccumulatorBoostPayload({
			sport: "football",
		});
		assert.ok(payload);
		const staleBoost = {
			id: "boost-wide",
			calculation_strategy: {
				type: "static" as const,
				strategy: {
					conditions: [],
					params: { multiplier: "2.00", min_selections: 3 },
				},
			},
			required_conditions: payload.required_conditions as never,
			applicable_conditions: payload.applicable_conditions as never,
		};
		assert.equal(boostHasStaleMultiplier(staleBoost), true);
		const repairs = planAccumulatorFoldRepairs([staleBoost]);
		assert.equal(repairs.length, 1);
		assert.equal(repairs[0]?.calculation_strategy.strategy.params.multiplier, "1.20");
	});

	it("does not flag repair when list payload omits applicable_conditions", () => {
		const payload = buildAccumulatorBoostPayload({
			sport: "football",
		});
		assert.ok(payload);
		const listRow = {
			id: "boost-wide",
			calculation_strategy: payload.calculation_strategy,
			required_conditions: payload.required_conditions as never,
		};
		assert.equal(boostHasLooseApplicableConditions(listRow), false);
		assert.equal(planAccumulatorFoldRepairs([listRow]).length, 0);
	});

	it("skips boosts already marked repaired in KV planning", () => {
		const payload = buildAccumulatorBoostPayload({
			sport: "football",
		});
		assert.ok(payload);
		const looseBoost = {
			id: "boost-wide",
			calculation_strategy: payload.calculation_strategy,
			required_conditions: payload.required_conditions as never,
			applicable_conditions: [
				{
					type: "bet_details",
					bet_details: [
						{
							type: "express",
							data: {
								sport: {
									type: "sport",
									match_all_odds: true,
									sport_ids: ["football"],
								},
							},
						},
					],
				},
			],
		};
		const repairs = planAccumulatorFoldRepairs([looseBoost], {
			skipBoostIds: new Set(["boost-wide"]),
		});
		assert.equal(repairs.length, 0);
	});

	it("detects when list responses include applicable_conditions", () => {
		assert.equal(
			betBoostListIncludesApplicable([
				{ id: "a", required_conditions: [] },
				{ id: "b", applicable_conditions: [] },
			]),
			true,
		);
		assert.equal(
			betBoostListIncludesApplicable([{ id: "a", required_conditions: [] }]),
			false,
		);
	});

	it("applies the 1.20× 3–50 boost to a 3-leg ~30x acca", () => {
		const legOdds = [2, 3, 5];
		const product = accumulatorOddsProduct(legOdds);
		assert.equal(product, 30);

		const programBoost = buildAccumulatorBoostPayload({
			sport: "football",
		});
		assert.ok(programBoost);
		assert.equal(programBoost.multiplier, "1.20");
		const applicable = (
			programBoost.applicable_conditions[0] as {
				bet_details: Array<{
					data: { odds_count: { min: number; max: number } };
				}>;
			}
		).bet_details[0]?.data.odds_count;
		assert.equal(applicable?.min, 3);
		assert.equal(applicable?.max, 50);

		assert.ok(
			Math.abs(boostedAccumulatorOdds(product, programBoost.multiplier) - 36) <
				1e-9,
		);
	});

	it("builds one steps boost per sport that grows with extra selections", () => {
		const football = buildAccumulatorStepsBoostPayload("football");
		assert.equal(football.calculation_strategy.type, "steps");
		assert.equal(football.minSelections, 2);
		assert.equal(football.maxSelections, 9);
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
		assert.equal(required.bet_details[0]?.data.odds_count.min, 2);
		assert.equal(required.bet_details[0]?.data.odds_count.max, 9);
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

	it("lists one static 1.20× boost per sport covering 3–50, not a card per fold", () => {
		const payloads = listAccumulatorFoldBoostPayloads();
		assert.equal(payloads.length, 3);
		assert.deepEqual(
			payloads.map((p) => p.sport),
			["football", "basketball", "tennis"],
		);

		for (const payload of payloads) {
			assert.equal(payload.calculation_strategy.type, "static");
			assert.equal(payload.bonusPercent, 20);
			assert.equal(payload.multiplier, "1.20");
			assert.equal(payload.selections, 3);
			assert.equal(
				payload.calculation_strategy.strategy.params.min_selections,
				3,
			);
			const required = payload.required_conditions[0] as {
				bet_details: Array<{
					data: { odds_count: { min: number; max: number } };
				}>;
			};
			assert.equal(required.bet_details[0]?.data.odds_count.min, 3);
			assert.equal(required.bet_details[0]?.data.odds_count.max, 50);
		}
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
		const leftover = exactFoldBoost("football", 5);
		assert.equal(
			boostCoversAccumulatorFold(leftover, "football", 5),
			true,
		);
		assert.equal(
			boostCoversAccumulatorFold(leftover, "football", 6),
			false,
		);
		assert.equal(
			boostCoversAccumulatorFold(leftover, "tennis", 5),
			false,
		);
		assert.equal(boostCoversAccumulatorProgram(leftover, "football"), false);
	});

	it("treats a 1.20× 3–50 card as covering that sport's program", () => {
		const payload = buildAccumulatorBoostPayload({ sport: "football" });
		assert.ok(payload);
		assert.equal(
			boostCoversAccumulatorProgram(
				{
					calculation_strategy: payload.calculation_strategy,
					required_conditions: payload.required_conditions as never,
				},
				"football",
			),
			true,
		);
		assert.equal(
			boostCoversAccumulatorProgram(
				{
					calculation_strategy: payload.calculation_strategy,
					required_conditions: payload.required_conditions as never,
				},
				"tennis",
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
		assert.equal(plan.toCreate.length, 2);
	});

	it("grants one 1.20× card per sport when none exist", () => {
		const plan = planAccumulatorFoldGrants([]);
		assert.deepEqual(plan.blockedLegacySports, []);
		assert.deepEqual(plan.legacyStepsBoostIds, []);
		assert.deepEqual(plan.staleFoldBoostIds, []);
		assert.equal(plan.toCreate.length, 3);
		assert.deepEqual(
			plan.toCreate.map((preset) => preset.sport),
			["football", "basketball", "tennis"],
		);
	});

	it("keeps an existing 1.20× 3–50 football card and removes leftover fold cards", () => {
		const footballWide = buildAccumulatorBoostPayload({ sport: "football" });
		assert.ok(footballWide);
		const leftovers = [
			exactFoldBoost("football", 3),
			exactFoldBoost("football", 8),
			exactFoldBoost("basketball", 3),
		];
		const plan = planAccumulatorFoldGrants([
			{
				id: "football-wide",
				calculation_strategy: footballWide.calculation_strategy,
				required_conditions: footballWide.required_conditions as never,
			},
			...leftovers,
		]);
		assert.deepEqual(plan.staleFoldBoostIds, [
			"football-3",
			"football-8",
			"basketball-3",
		]);
		assert.equal(
			plan.toCreate.some((preset) => preset.sport === "football"),
			false,
		);
		assert.equal(plan.toCreate.length, 2);
		assert.deepEqual(
			plan.toCreate.map((preset) => preset.sport),
			["basketball", "tennis"],
		);
	});
});
