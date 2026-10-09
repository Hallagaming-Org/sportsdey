import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveLoyaltyRedeemReward } from "./loyalty.service";
import { missionRewardDefinitions } from "./mission.service";
import { parseMissionRewards } from "./rewards.service";
import { isBonusEngineTokenRejected } from "./token.service";
import { classifyTournamentPrize } from "./tournament.service";

describe("loyalty redemption pricing", () => {
	const campaign = {
		redeem_levels_type: "cash",
		redeem_levels_value: 1_000,
		point_value_type: "cash",
		point_value: 50,
	};

	it("pays point_value naira per redeem_levels_value points", () => {
		assert.deepEqual(
			resolveLoyaltyRedeemReward({ campaign, pointsToRedeem: 1_000 }),
			{ type: "cash", amountKobo: 5_000, kind: "cash" },
		);
		assert.equal(
			resolveLoyaltyRedeemReward({ campaign, pointsToRedeem: 2_000 })
				.amountKobo,
			10_000,
		);
	});

	it("treats a `fix` point value like a fixed cash amount", () => {
		assert.equal(
			resolveLoyaltyRedeemReward({
				campaign: { ...campaign, point_value_type: "fix", point_value: 30 },
				pointsToRedeem: 1_000,
			}).amountKobo,
			3_000,
		);
	});

	it("pays a percentage of the points redeemed (one point = ₦1)", () => {
		const reward = resolveLoyaltyRedeemReward({
			campaign: { ...campaign, point_value_type: "percentage", point_value: 5 },
			pointsToRedeem: 1_000,
		});
		assert.deepEqual(reward, { type: "cash", amountKobo: 5_000, kind: "cash" });
	});

	it("leaves non-cash rewards to the engine and flags unpriceable cash", () => {
		assert.equal(
			resolveLoyaltyRedeemReward({
				campaign: { ...campaign, redeem_levels_type: "freebet" },
				pointsToRedeem: 1_000,
			}).kind,
			"engine",
		);
		assert.equal(
			resolveLoyaltyRedeemReward({
				campaign: { ...campaign, point_value: 0 },
				pointsToRedeem: 1_000,
			}).kind,
			"unknown",
		);
	});
});

describe("mission rewards", () => {
	it("classifies cash, points and rewards SportsDey cannot grant", () => {
		assert.deepEqual(
			parseMissionRewards([
				{ type: "Real Cash", value: 20 },
				{ type: "points", amount: "100" },
				{ type: "Badges", amount: "Gold Boot" },
				{ type: "Free Spins", value: 10 },
				{ type: "Real Cash", value: 0 },
			]).map((entry) => [entry.kind, entry.amountMajor]),
			[
				["real_cash", 20],
				["engine", 100],
				["engine", 0],
				["unsupported", 10],
			],
		);
	});

	it("reads reward definitions from mission triggers", () => {
		assert.deepEqual(
			missionRewardDefinitions({
				mission_triggers: [
					{ parameters: { rewards: [{ type: "Real Cash", amount: 50 }] } },
					{ parameters: {} },
				],
			}),
			[{ type: "Real Cash", amount: 50 }],
		);
	});
});

describe("token rejection", () => {
	it("refreshes on auth failures, not on signature or business errors", () => {
		assert.equal(isBonusEngineTokenRejected({ ok: false, status: 401 }), true);
		assert.equal(
			isBonusEngineTokenRejected({
				ok: false,
				status: 400,
				error: "jwt expired",
			}),
			true,
		);
		assert.equal(
			isBonusEngineTokenRejected({
				ok: false,
				status: 413,
				error: "INVALID_SIGNATURE",
			}),
			false,
		);
		assert.equal(
			isBonusEngineTokenRejected({
				ok: false,
				status: 400,
				error: "Not enough loyalty points",
			}),
			false,
		);
		assert.equal(isBonusEngineTokenRejected({ ok: true, status: 200 }), false);
	});
});

describe("tournament prizes", () => {
	it("pays cash, defers bonus prizes, and flags free bets / spins", () => {
		assert.equal(classifyTournamentPrize(null), "cash");
		assert.equal(
			classifyTournamentPrize({
				tournament_win_type: "real",
				prize_configs: [{ price_amount_type: ["fix", "free_spins"] }],
			}),
			"cash",
		);
		assert.equal(
			classifyTournamentPrize({
				tournament_win_type: "bonus",
				prize_configs: [{ price_amount_type: ["free_bets"] }],
			}),
			"bonus",
		);
		assert.equal(
			classifyTournamentPrize({
				prize_configs: [
					{ price_amount_type: ["free_bets"] },
					{ price_amount_type: "free_spins" },
				],
			}),
			"unsupported",
		);
	});
});
