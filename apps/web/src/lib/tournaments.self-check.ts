import assert from "node:assert/strict";
import {
	formatTournamentPlayerCount,
	TOURNAMENT_API_ROUTE,
	TOURNAMENT_ID_FIELD,
	TOURNAMENT_NO_PLAYERS_YET,
	TOURNAMENT_QUERY_KEY,
} from "./tournaments.constant.ts";
import {
	isLeaderboardOptedIn,
	normalizeLeaderboardRecord,
	normalizeTournamentRecord,
	pickFeaturedTournament,
	unwrapLeaderboardRows,
} from "./tournaments-normalize.ts";

assert.equal(TOURNAMENT_API_ROUTE.LIST, "tournament/list");
assert.equal(TOURNAMENT_API_ROUTE.JOIN, "tournament/join");
assert.equal(TOURNAMENT_API_ROUTE.LEADERBOARD, "tournament/leaderboard");
assert.equal(TOURNAMENT_ID_FIELD, "tournamentId");
assert.deepEqual(TOURNAMENT_QUERY_KEY.LIST, ["tournaments", "list"]);
assert.deepEqual(TOURNAMENT_QUERY_KEY.leaderboard("abc"), [
	"tournaments",
	"leaderboard",
	"abc",
]);

const now = new Date("2026-09-22T08:00:00.000Z");

const tornado = normalizeTournamentRecord(
	{
		_id: "6a6b4dfbb1acec12b58ecaf4",
		tournament_name: "",
		tournament_code: "Tornado",
		product: "sport",
		total_budget: 5_000_000,
		start_date_time: "2026-07-30T13:28:00.000Z",
		end_date_time: "2026-09-30T13:10:00.000Z",
		tournament_status: "ACTIVE",
		provider_games: [{ game: [] }],
	},
	0,
	now,
);
assert.equal(tornado.title, "Tornado");
assert.equal(tornado.status, "active");
assert.equal(tornado.sport, "sport");
assert.equal(tornado.prize, 5_000_000);
assert.equal(tornado.image, "/tournaments/football.png");
assert.equal(tornado.remaining, "8D:5H:10M");

const completed = normalizeTournamentRecord(
	{
		_id: "69b14ef0870350861d9a4db3",
		tournament_name: "",
		tournament_code: "dfe34",
		product: "casino",
		total_budget: 23,
		start_date_time: "2026-03-10T11:15:00.000Z",
		end_date_time: "2026-03-11T11:15:00.000Z",
		tournament_status: "COMPLETED",
	},
	1,
	now,
);
assert.equal(completed.status, "results");
assert.equal(completed.remaining, "Ended");
assert.equal(completed.sport, "casino");

const unnamed = normalizeTournamentRecord(
	{
		_id: "game-only",
		tournament_name: "",
		tournament_code: "",
		product: "live_casino",
		provider_games: [
			{
				provider: { name: "Casino" },
				game: [{ unique_id: "1", name: "Twenty One" }],
			},
		],
		tournament_status: "ACTIVE",
		start_date_time: "2026-09-18T12:05:00.000Z",
		end_date_time: "2026-10-01T12:05:00.000Z",
	},
	2,
	now,
);
assert.equal(unnamed.title, "Twenty One");
assert.equal(unnamed.sport, "casino");

const upcoming = normalizeTournamentRecord(
	{
		_id: "upcoming-1",
		tournament_code: "Later Cup",
		product: "sport",
		total_budget: 100,
		tournament_status: "ACTIVE",
		start_date_time: "2026-10-01T00:00:00.000Z",
		end_date_time: "2026-10-08T00:00:00.000Z",
	},
	3,
	now,
);
assert.equal(upcoming.status, "upcoming");

const featured = pickFeaturedTournament([completed, tornado, upcoming]);
assert.equal(featured?.id, tornado.id);

const leaderboard = normalizeLeaderboardRecord(
	{ rank: 1, username: "DotunFC", points: "8520", prize: 150000 },
	0,
	"Tornado",
);
assert.equal(leaderboard.username, "DotunFC");
assert.equal(leaderboard.points, 8520);
assert.equal(leaderboard.tournament, "Tornado");

const nestedLeaderboard = normalizeLeaderboardRecord(
	{
		_id: "6ab26c9576da5b82cf7512f0",
		player_id: {
			_id: "6ab2286e7fca741815f6aa3a",
			user_id: "JC7AqY0FQ5f8CFRIcCJABTvxYX0Lkhl1",
			username: "nathaniel essien",
		},
		total_points: 0,
		rank: 1,
	},
	0,
	"Tornado",
);
assert.equal(nestedLeaderboard.username, "nathaniel essien");
assert.equal(nestedLeaderboard.userId, "JC7AqY0FQ5f8CFRIcCJABTvxYX0Lkhl1");
assert.equal(nestedLeaderboard.id, "6ab26c9576da5b82cf7512f0");
assert.equal(nestedLeaderboard.points, 0);
assert.equal(
	isLeaderboardOptedIn({
		entries: [nestedLeaderboard],
		userId: "JC7AqY0FQ5f8CFRIcCJABTvxYX0Lkhl1",
	}),
	true,
);
assert.equal(
	isLeaderboardOptedIn({
		entries: [nestedLeaderboard],
		userId: "someone-else",
	}),
	false,
);
assert.equal(unwrapLeaderboardRows({ players: [{ rank: 1 }] }).length, 1);
assert.equal(formatTournamentPlayerCount(undefined), "");
assert.equal(formatTournamentPlayerCount(0), TOURNAMENT_NO_PLAYERS_YET);
assert.equal(formatTournamentPlayerCount(12), "12 Players");

console.log("tournaments.self-check: ok");
