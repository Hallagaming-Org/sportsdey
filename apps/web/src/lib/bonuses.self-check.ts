import assert from "node:assert/strict";
import {
	normalizeBonusCampaign,
	normalizeUserBonus,
	resolveBonusAction,
} from "./bonuses-normalize.ts";

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
assert.equal(sportsOnly.href, "/sportsbetting");

const placeholderGames = resolveBonusAction({
	bonusType: "login",
	productType: "casino",
	games: [],
	hasSportsTargets: false,
});
assert.equal(placeholderGames.href, "/games");

console.log("bonuses.self-check: ok");
