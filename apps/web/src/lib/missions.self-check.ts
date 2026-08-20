
import assert from "node:assert/strict";
import {
	normalizeMissionRecord,
	resolveMissionAction,
} from "./missions-normalize.ts";

const wagerMission = normalizeMissionRecord({
	_id: "6a759deaae8a0edf2509e7e9",
	mission_name: "August Missions",
	mission_triggers: [
		{
			type: "Wager X and Get X",
			parameters: {
				amount: "1000",
				rewards: [{ type: "Points", amount: 50 }],
			},
		},
	],
	provider_games: [
		{
			provider: { unique_id: "provider_id", name: "provider_name" },
			game: [
				{
					unique_id: "9a3ca32d53754e149fd5962f0685e88b",
					name: "Football Golden Cup",
				},
			],
		},
	],
	mission_status: "ACTIVE",
	status: 1,
});

assert.equal(wagerMission.actionKind, "casino");
assert.equal(wagerMission.actionHref, "/games");
assert.equal(
	wagerMission.actionSearch?.play,
	"9a3ca32d53754e149fd5962f0685e88b",
);
assert.equal(wagerMission.actionLabel, "Play Football Golden Cup");
assert.equal(wagerMission.rewardPoints, 50);
assert.equal(wagerMission.rewardLabel, "50 Points");
assert.equal(wagerMission.progressTarget, 1000);

const loginBetMission = normalizeMissionRecord({
	_id: "6a759ee7ae8a0edf2509e9af",
	mission_name: "August Mission",
	mission_triggers: [
		{
			type: "Login > 5 consecutive days and bet > X on specific condition",
			parameters: {
				days: "7",
				min_bet: "100",
				rewards: [{ type: "Real Cash", amount: 200 }],
			},
		},
	],
	provider_games: [
		{
			provider: { unique_id: "provider_id", name: "provider_name" },
			game: [
				{
					unique_id: "5abf4e6f5e6d47199da5a68f18b92cd8",
					name: "Basketball",
				},
			],
		},
	],
	mission_status: "ACTIVE",
	status: 1,
});

assert.equal(loginBetMission.actionKind, "casino");
assert.notEqual(loginBetMission.actionHref, "/sportsbetting");
assert.equal(
	loginBetMission.actionSearch?.play,
	"5abf4e6f5e6d47199da5a68f18b92cd8",
);
assert.equal(loginBetMission.actionLabel, "Play Basketball");

const depositOnly = resolveMissionAction({
	triggerTypes: ["Deposit X and Get X"],
	providers: [],
	games: [],
});
assert.equal(depositOnly.kind, "deposit");
assert.equal(depositOnly.href, "/wallet");

const sportsWager = resolveMissionAction({
	triggerTypes: ["Wager X and Get X"],
	providers: [],
	games: [],
});
assert.equal(sportsWager.kind, "sports");
assert.equal(sportsWager.href, "/sportsbetting");

const placeholderWager = resolveMissionAction({
	triggerTypes: ["Bet X and Get X"],
	providers: [{ uniqueId: "provider_id", name: "provider_name" }],
	games: [{ uniqueId: "game_id", name: "Game", providerName: "provider_name" }],
});
assert.equal(placeholderWager.kind, "sports");

const invite = resolveMissionAction({
	triggerTypes: ["Refer a friend"],
	providers: [],
	games: [],
});
assert.equal(invite.kind, "invite");
assert.equal(invite.href, "/account#account-referral-id");

console.log("missions.self-check: ok");
