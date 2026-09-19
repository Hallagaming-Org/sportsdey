
import assert from "node:assert/strict";
import {
	isActiveEngineMission,
	normalizeMissionRecord,
	resolveMissionAction,
} from "./missions-normalize.ts";
import { MISSION_STATUS } from "./missions.constant.ts";

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
assert.equal(wagerMission.missionStatus, MISSION_STATUS.ACTIVE);
assert.equal(isActiveEngineMission(wagerMission), true);
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
assert.equal(
	sportsWager.href,
	"/sportsbetting/sports/prematch/football",
);

const placeholderWager = resolveMissionAction({
	triggerTypes: ["Bet X and Get X"],
	providers: [{ uniqueId: "provider_id", name: "provider_name" }],
	games: [{ uniqueId: "game_id", name: "Game", providerName: "provider_name" }],
});
assert.equal(placeholderWager.kind, "sports");
assert.equal(
	placeholderWager.href,
	"/sportsbetting/sports/prematch/football",
);

const leagueMission = normalizeMissionRecord({
	_id: "6a97384b90c3b87c2011ced9",
	mission_name: "TestySports",
	mission_triggers: [
		{
			type: "Bet X and Get X",
			parameters: {
				amount: "1000",
				rewards: [{ type: "Points", amount: 5000 }],
			},
		},
	],
	provider_games: [{ game: [] }],
	product: "sport",
	sports_league_events: [
		{
			sports: { unique_id: 1, name: "Soccer" },
			category: { unique_id: 10, name: "England" },
			leagues: [
				{ league: { unique_id: 100, name: "Premier League" } },
			],
		},
	],
	sportsbook_path:
		"sports/prematch/football/tournament/betting:24:gin:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
	mission_status: "ACTIVE",
	status: 1,
});
assert.equal(leagueMission.actionKind, "sports");
assert.equal(leagueMission.actionLabel, "Play Premier League");
assert.equal(
	leagueMission.actionHref,
	"/sportsbetting/sports/prematch/football/tournament/betting:24:gin:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
);
assert.equal(leagueMission.leagues[0]?.name, "Premier League");

const germanyCategory = normalizeMissionRecord({
	_id: "6a9698b190c3b87c20108712",
	mission_name: "newSept",
	mission_triggers: [
		{
			type: "Wager X and Get X",
			parameters: { amount: "100" },
		},
	],
	provider_games: [{ game: [] }],
	product: "sport",
	sports_league_events: [
		{
			sports: { unique_id: 1, name: "Soccer" },
			category: { unique_id: 13, name: "Germany" },
			leagues: [{}],
		},
	],
	sportsbook_path:
		"sports/prematch/football/tournament/betting:24:gin:bef631c0-4f2c-4baa-879e-fa15c90fb911",
	mission_status: "ACTIVE",
	status: 1,
});
assert.equal(germanyCategory.actionLabel, "Play Germany");
assert.equal(
	germanyCategory.actionHref,
	"/sportsbetting/sports/prematch/football/tournament/betting:24:gin:bef631c0-4f2c-4baa-879e-fa15c90fb911",
);
assert.equal(germanyCategory.categories[0]?.name, "Germany");

const completedMission = normalizeMissionRecord({
	_id: "completed-mission",
	mission_name: "Done",
	mission_status: "COMPLETED",
	status: 1,
});
assert.equal(completedMission.missionStatus, MISSION_STATUS.COMPLETED);
assert.equal(isActiveEngineMission(completedMission), false);

const emptyLeagueSport = resolveMissionAction({
	triggerTypes: ["Wager X and Get X"],
	providers: [],
	games: [],
	leagues: [],
});
assert.equal(
	emptyLeagueSport.href,
	"/sportsbetting/sports/prematch/football",
);

const invite = resolveMissionAction({
	triggerTypes: ["Refer a friend"],
	providers: [],
	games: [],
});
assert.equal(invite.kind, "invite");
assert.equal(invite.href, "/account#account-referral-id");

console.log("missions.self-check: ok");
