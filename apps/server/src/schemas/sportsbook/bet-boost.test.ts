import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	AccumulatorProgramGrantSchema,
	BetBoostCreateSchema,
	BetBoostUpdateSchema,
} from "./bet-boost";

const createBody = {
	boostName: "Weekend Acca Boost",
	description: "Boost qualifying accumulator bets",
	boostPercentage: 10,
	eligibleUsers: "All Users",
	eligibleSports: ["Football" as const],
	minimumSelections: 2,
	maximumSelections: 10,
	competitionIDs: ["premier-league"],
	eligibleEventsID: [],
	minimumOddsPerSelection: 1.2,
	endDateTime: "2026-12-31T23:59:59.000Z",
};

describe("BetBoostCreateSchema", () => {
	it("accepts the admin bet boost payload", () => {
		const parsed = BetBoostCreateSchema.safeParse(createBody);
		assert.equal(parsed.success, true);
		if (!parsed.success) return;
		assert.equal(parsed.data.boostPercentage, 10);
		assert.deepEqual(parsed.data.eligibleSports, ["Football"]);
	});

	it("defaults optional competition and event ids to empty arrays", () => {
		const { competitionIDs, eligibleEventsID, ...body } = createBody;
		const parsed = BetBoostCreateSchema.safeParse(body);
		assert.equal(parsed.success, true);
		if (!parsed.success) return;
		assert.deepEqual(parsed.data.competitionIDs, []);
		assert.deepEqual(parsed.data.eligibleEventsID, []);
	});

	it("rejects unsupported sport names", () => {
		const parsed = BetBoostCreateSchema.safeParse({
			...createBody,
			eligibleSports: ["Cricket"],
		});
		assert.equal(parsed.success, false);
	});
});

describe("AccumulatorProgramGrantSchema", () => {
	it("accepts accumulator program grant with defaults", () => {
		const parsed = AccumulatorProgramGrantSchema.safeParse({
			player_id: "test-player-uuid",
		});
		assert.equal(parsed.success, true);
		if (!parsed.success) return;
		assert.equal(parsed.data.currency, "NGN");
	});
});

describe("BetBoostUpdateSchema", () => {
	it("accepts a DataBet calculation strategy", () => {
		const parsed = BetBoostUpdateSchema.safeParse({
			player_id: "test-player-uuid",
			boost_id: "test-boost-id",
			calculation_strategy: {
				type: "steps",
				strategy: {
					conditions: [],
					params: {
						selections_per_step: 1,
						multiplier_per_step: "0.1",
						max_multiplier: "1.5",
					},
				},
			},
		});
		assert.equal(parsed.success, true);
	});
});
