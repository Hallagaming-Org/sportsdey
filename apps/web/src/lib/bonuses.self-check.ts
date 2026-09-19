import assert from "node:assert/strict";
import {
	activeAssignedBonuses,
	normalizeBonusCampaign,
	normalizeUserBonus,
	promotionsAssignedBonuses,
	resolveBonusAction,
} from "./bonuses-normalize.ts";
import {
	BONUS_API_ROUTE,
	BONUS_TYPE_DEFAULT,
	isBonusCampaignType,
} from "./bonuses.constant.ts";

const assignment = normalizeUserBonus({
	_id: "68358c5d14dfca8ca571b41e",
	bonus_type: "login",
	product_type: "casino",
	campaign_code: "BONUSLOGIN",
	bonus_amount: 100,
	cash_amount: 0,
	wagering_amount: 10,
	required_wagering_amount: 1000,
	user_action: "ACTIVATED",
	status: "ACTIVE",
	wagering_games: [
		{
			provider: { id: "08dc29aa-edbf-6e09-0a58-a9feac020000", name: "Pragmatic" },
			games: [
				{
					id: "08dc29aa-edcb-0acd-0a58-a9feac020000",
					name: "Speed Baccarat 1",
					percent: 10,
				},
			],
		},
	],
	wagering_sports: [
		{
			sport: { id: 68, name: "Tennis" },
		},
	],
});

assert.equal(assignment.id, "68358c5d14dfca8ca571b41e");
assert.equal(assignment.kind, "assignment");
assert.equal(assignment.status, "active");
assert.equal(assignment.canActivate, false);
assert.equal(assignment.canCancel, true);
assert.equal(assignment.bonusAmount, 100);
assert.equal(assignment.actionKind, "casino");
assert.equal(assignment.actionHref, "/games");
assert.equal(
	assignment.actionSearch?.play,
	"08dc29aa-edcb-0acd-0a58-a9feac020000",
);
assert.notEqual(assignment.actionHref, "/sportsbetting");

const ready = normalizeUserBonus({
	_id: "ready-1",
	bonus_type: "login",
	product_type: "casino",
	user_action: "ASSIGNED",
	status: "INACTIVE",
});
assert.equal(ready.status, "ready");
assert.equal(ready.canActivate, true);

const depositCampaign = normalizeBonusCampaign({
	_id: "camp-1",
	type: "deposit",
	product: "casino",
	campaign_code: "DEP100",
	bonus_reward_amount: 50,
	cash_reward_amount: 0,
	wagering_count: 10,
});
assert.equal(depositCampaign.kind, "campaign");
assert.equal(depositCampaign.canActivate, false);
assert.equal(depositCampaign.actionKind, "deposit");
assert.equal(depositCampaign.actionHref, "/wallet");
assert.equal(depositCampaign.rewardLabel, "₦50 bonus");

const sportsOnly = resolveBonusAction({
	bonusType: "login",
	productType: "sportsbook",
	games: [],
	hasSportsTargets: true,
});
assert.equal(sportsOnly.kind, "sports");
assert.equal(
	sportsOnly.href,
	"/sportsbetting/sports/prematch/football",
);

const placeholderGames = resolveBonusAction({
	bonusType: "login",
	productType: "casino",
	games: [],
	hasSportsTargets: false,
});
assert.equal(placeholderGames.href, "/games");

const englandCampaign = normalizeBonusCampaign({
	_id: "6a96c81990c3b87c2010e7ea",
	type: "login",
	product: "sport",
	campaign_code: "MANUSUCKS",
	sports_league_events: [
		{
			sports: { unique_id: 1, name: "Soccer" },
			category: { unique_id: 10, name: "England" },
			leagues: [{}],
		},
		{
			sports: { unique_id: 1, name: "Soccer" },
			category: { unique_id: 11, name: "Spain" },
			leagues: [{}],
		},
	],
	sportsbook_path:
		"sports/prematch/football/tournament/betting:24:gin:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
});
assert.equal(englandCampaign.actionKind, "sports");
assert.equal(englandCampaign.actionLabel, "Play England");
assert.equal(
	englandCampaign.actionHref,
	"/sportsbetting/sports/prematch/football/tournament/betting:24:gin:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
);

assert.equal(BONUS_TYPE_DEFAULT, "welcome");
assert.equal(isBonusCampaignType("welcome"), true);
assert.equal(isBonusCampaignType("unknown"), false);
assert.equal(BONUS_API_ROUTE.GETALL_USER_BONUS, "bonus/getall_User_bonus");

assert.equal(promotionsAssignedBonuses([assignment, ready]).length, 2);
assert.equal(activeAssignedBonuses([assignment, ready]).length, 1);
assert.equal(promotionsAssignedBonuses([depositCampaign]).length, 0);

console.log("bonuses.self-check: ok");
