import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BetBoostCreateSchema } from "./bet-boost";

/** Minimal static boost shaped like Databet docs (NGN staging). */
const staticCreateBody = {
	player_id: "test-player-uuid",
	currency: "NGN",
	initial_quantity: 1,
	expires_at: "2026-12-31T23:59:59.000Z",
	calculation_strategy: {
		type: "static" as const,
		strategy: {
			conditions: [] as unknown[],
			params: {
				multiplier: "1.10",
				min_selections: 2,
			},
		},
	},
	required_conditions: [
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
						odds_count: {
							type: "odds_count",
							min: 2,
							max: 10,
						},
						odd_value: {
							type: "odd_value",
							min: "1.20",
							match_all_odds: true,
						},
						stake_amount_range: {
							type: "stake_amount_range",
							min: "100.00",
							max: "50000.00",
						},
					},
				},
			],
		},
	],
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

describe("BetBoostCreateSchema", () => {
	it("accepts Databet static strategy payloads (docs shape)", () => {
		const parsed = BetBoostCreateSchema.safeParse(staticCreateBody);
		assert.equal(parsed.success, true);
		if (!parsed.success) return;
		assert.equal(parsed.data.calculation_strategy?.type, "static");
		assert.deepEqual(parsed.data.calculation_strategy?.strategy.params, {
			multiplier: "1.10",
			min_selections: 2,
		});
		assert.equal(
			parsed.data.required_conditions[0]?.bet_details[0]?.type,
			"express",
		);
	});

	it("keeps steps strategy params (does not strip them)", () => {
		const body = {
			...staticCreateBody,
			calculation_strategy: {
				type: "steps" as const,
				strategy: {
					conditions: [],
					params: {
						selections_per_step: 1,
						multiplier_per_step: "0.25",
						max_multiplier: "2.0",
					},
				},
			},
		};
		const parsed = BetBoostCreateSchema.safeParse(body);
		assert.equal(parsed.success, true);
		if (!parsed.success) return;
		assert.deepEqual(parsed.data.calculation_strategy?.strategy.params, {
			selections_per_step: 1,
			multiplier_per_step: "0.25",
			max_multiplier: "2.0",
		});
	});

	it("accepts accumulator preset without manual conditions", () => {
		const parsed = BetBoostCreateSchema.safeParse({
			player_id: "test-player-uuid",
			currency: "NGN",
			initial_quantity: 1,
			expires_at: "2026-12-31T23:59:59.000Z",
			accumulator: { sport: "football", selections: 5 },
		});
		assert.equal(parsed.success, true);
		if (!parsed.success) return;
		assert.equal(parsed.data.accumulator?.sport, "football");
		assert.equal(parsed.data.accumulator?.selections, 5);
	});

	it("rejects legacy bet_type-only condition details", () => {
		const body = {
			...staticCreateBody,
			required_conditions: [
				{
					type: "bet_details",
					bet_details: [{ bet_type: 2, data: {} }],
				},
			],
		};
		const parsed = BetBoostCreateSchema.safeParse(body);
		assert.equal(parsed.success, false);
	});
});
