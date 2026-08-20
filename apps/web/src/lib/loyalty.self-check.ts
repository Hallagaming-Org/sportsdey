import assert from "node:assert/strict";
import {
	applyCampaignLevelsToPointsSummary,
	buildDisplayTiersFromCampaignLevels,
	buildLoyaltyHowItWorksSteps,
	buildLoyaltyRedeemOffers,
	normalizeLoyaltyCampaign,
	normalizeLoyaltyHistoryItem,
	normalizeLoyaltyPoints,
	pickPrimaryCampaignLevels,
	resolveTier,
} from "./loyalty-normalize.ts";

const summary = normalizeLoyaltyPoints({
	player_id: "u1",
	total_points: 12_000,
	loyalty_level: "Gold",
});
assert.equal(summary.currentTier.id, "gold");
assert.equal(summary.nextTier?.id, "platinum");
assert.equal(summary.pointsToNextTier, 13_000);
assert.ok(summary.progressPercent > 0 && summary.progressPercent < 100);

assert.equal(
	resolveTier({ loyaltyLevel: "diamond", totalPoints: 0 }).id,
	"diamond",
);

const earned = normalizeLoyaltyHistoryItem(
	{
		points_earned: 50,
		points_redeemed: 0,
		reason: "Daily Login Bonus",
		transaction_date: "2026-08-14T10:00:00.000Z",
	},
	0,
);
assert.equal(earned.xpDelta, 50);
assert.equal(earned.activity, "Daily Login Bonus");

const redeemed = normalizeLoyaltyHistoryItem(
	{
		points_earned: 0,
		points_redeemed: 200,
		transaction_type: "redeem",
	},
	1,
);
assert.equal(redeemed.xpDelta, -200);

const campaign = normalizeLoyaltyCampaign(
	{
		_id: "6a7f5b0c804916b11d6bbc08",
		name: "Loyalty1",
		currency: "NGN",
		device: "mobile",
		point_accumulate_by: "bet",
		start_date_time: "2026-08-14T16:50:00.000Z",
		end_date_time: "2026-08-15T16:50:00.000Z",
		amount_of_point_type: "percentage",
		amount_of_point_value: 10,
		redeem_levels_type: "cash",
		redeem_levels_value: 10,
		point_value_type: "cash",
		point_value: 10,
		levels_criteria: [
			{ level: "Gold", level_points: 50, _id: "g" },
			{ level: "Silver", level_points: 30, _id: "s" },
			{ level: "Bronze", level_points: 15, _id: "b" },
		],
		applicable_game_type: "all",
		loyalty_status: "UPCOMING",
	},
	0,
);
assert.equal(campaign.id, "6a7f5b0c804916b11d6bbc08");
assert.equal(campaign.name, "Loyalty1");
assert.equal(campaign.loyaltyStatus, "UPCOMING");
assert.equal(campaign.amountOfPointType, "percentage");
assert.equal(campaign.amountOfPointValue, 10);
assert.equal(campaign.levels.length, 3);
assert.equal(campaign.levels[0]?.level, "Bronze");
assert.equal(campaign.levels[0]?.levelPoints, 15);
assert.equal(campaign.levels[2]?.level, "Gold");
assert.ok(campaign.startsAt);
assert.ok(campaign.endsAt);

const pilots = normalizeLoyaltyCampaign(
	{
		_id: "6a842eae5d0289444d77db74",
		name: "Sportsdey Pilots",
		loyalty_status: "UPCOMING",
		levels_criteria: [
			{ level: "Early Flyers", level_points: 1000, _id: "a" },
			{ level: "Senior Men", level_points: 5000, _id: "b" },
		],
	},
	0,
);
const stripTiers = buildDisplayTiersFromCampaignLevels(pilots.levels);
assert.equal(stripTiers.length, 2);
assert.equal(stripTiers[0]?.label, "Early Flyers");
assert.equal(stripTiers[0]?.minPoints, 1000);
assert.equal(stripTiers[1]?.label, "Senior Men");
assert.equal(stripTiers[1]?.minPoints, 5000);
assert.ok(stripTiers[0]?.iconSrc.includes("iron"));
assert.ok(stripTiers[1]?.iconSrc.includes("bronze"));

const primary = pickPrimaryCampaignLevels([pilots]);
assert.equal(primary.length, 2);

const campaignSummary = applyCampaignLevelsToPointsSummary({
	summary,
	levels: pilots.levels,
});
assert.equal(campaignSummary.currentTier.label, "Senior Men");
assert.equal(campaignSummary.nextTier, null);

const pilotsFull = normalizeLoyaltyCampaign(
	{
		_id: "6a842eae5d0289444d77db74",
		name: "Sportsdey Pilots",
		currency: "NGN",
		point_accumulate_by: "bet",
		amount_of_point_type: "percentage",
		amount_of_point_value: 10,
		applicable_game_type: "all",
		redeem_levels_type: "cash",
		redeem_levels_value: 1000,
		point_value_type: "percentage",
		point_value: 5,
		levels_criteria: pilots.levels.map((level) => ({
			level: level.level,
			level_points: level.levelPoints,
			_id: level.id,
		})),
		loyalty_status: "UPCOMING",
	},
	0,
);
const offers = buildLoyaltyRedeemOffers([pilotsFull]);
assert.equal(offers.length, 1);
assert.equal(offers[0]?.categoryLabel, "Cash Bonus");
assert.equal(offers[0]?.rewardLabel, "5%");
assert.equal(offers[0]?.pointsCost, 1000);
assert.equal(offers[0]?.earnByLabel, "betting");
assert.ok(offers[0]?.earnRateLabel.includes("10%"));
assert.ok(offers[0]?.howToUnlockLabel.includes("1,000"));
assert.ok(offers[0]?.howToUnlockLabel.includes("betting"));

const howItWorks = buildLoyaltyHowItWorksSteps([pilotsFull]);
assert.equal(howItWorks.length, 4);
assert.ok(howItWorks[0]?.includes("betting"));
assert.ok(howItWorks[0]?.includes("10%"));
assert.ok(howItWorks[1]?.includes("Early Flyers"));
assert.ok(howItWorks[2]?.includes("1,000"));
assert.ok(howItWorks[3]?.toLowerCase().includes("recent activity"));

console.log("loyalty.self-check: ok");
