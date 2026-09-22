import assert from "node:assert/strict";
import {
	BONUS_ENGINE_PATH,
	BONUS_ENGINE_TOURNAMENT_JOIN_MESSAGE,
} from "./bonus-engine.service.constant";
import {
	buildBonusEngineTournamentJoinBody,
	buildBonusEngineTournamentLeaderboardBody,
	buildBonusEngineTournamentListBody,
	mapBonusEngineTournamentJoinError,
	unwrapTournamentLeaderboardRows,
} from "./tournament.service";

assert.equal(BONUS_ENGINE_PATH.TOURNAMENT_LIST, "/tournament/list");
assert.equal(BONUS_ENGINE_PATH.TOURNAMENT_JOIN, "/tournament/join");
assert.equal(BONUS_ENGINE_PATH.TOURNAMENT_LEADERBOARD, "/tournament/leaderboard");

assert.deepEqual(
	buildBonusEngineTournamentListBody({
		clientId: "shiv",
		projectId: "main",
	}),
	{
		client_id: "shiv",
		project_id: "main",
	},
);

const joinBody = buildBonusEngineTournamentJoinBody({
	clientId: "shiv",
	projectId: "main",
	tournamentId: "674eaeaf32e1f178bafd6a6c",
	userId: "hari114",
});
assert.deepEqual(joinBody, {
	project_id: "main",
	client_id: "shiv",
	tournamentId: "674eaeaf32e1f178bafd6a6c",
	user_id: "hari114",
});
assert.deepEqual(Object.keys(joinBody), [
	"project_id",
	"client_id",
	"tournamentId",
	"user_id",
]);

assert.deepEqual(
	buildBonusEngineTournamentLeaderboardBody({
		clientId: "shiv",
		projectId: "main",
		tournamentId: "6a6b4dfbb1acec12b58ecaf4",
	}),
	{
		client_id: "shiv",
		project_id: "main",
		tournamentId: "6a6b4dfbb1acec12b58ecaf4",
	},
);

assert.deepEqual(
	unwrapTournamentLeaderboardRows([
		{ rank: 1, username: "DotunFC" },
		{ rank: 2, username: "Mighty guard" },
	]),
	[
		{ rank: 1, username: "DotunFC" },
		{ rank: 2, username: "Mighty guard" },
	],
);
assert.equal(
	unwrapTournamentLeaderboardRows({
		data: { leaderboard: [{ rank: 1, player: "A" }] },
	}).length,
	1,
);
assert.deepEqual(unwrapTournamentLeaderboardRows(null), []);

assert.equal(
	mapBonusEngineTournamentJoinError(
		"E11000 duplicate key error collection: Bonus_Engine_db.player_tournaments index: tournament_id_1 dup key: { tournament_id: ObjectId('6a6b4dfbb1acec12b58ecaf4') }",
	),
	BONUS_ENGINE_TOURNAMENT_JOIN_MESSAGE.DUPLICATE_TOURNAMENT_SLOT,
);
assert.equal(
	mapBonusEngineTournamentJoinError("User already Opted In"),
	"User already Opted In",
);

console.log("bonus-engine tournament.self-check: ok");
