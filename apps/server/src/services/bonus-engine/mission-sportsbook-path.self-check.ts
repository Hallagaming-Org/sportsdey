import assert from "node:assert/strict";
import {
	attachMissionSportsbookPaths,
	resolveMissionSportsbookPath,
} from "./mission-sportsbook-path.ts";
import {
	BONUS_ENGINE_TOP_EUROPEAN_CHAMPIONSHIPS,
	pickCanonicalSportsbookTournament,
} from "./reference-data.service.constant.ts";
import type { BonusEngineChampionshipRow } from "./reference-data.service.type.ts";

const bundesliga = BONUS_ENGINE_TOP_EUROPEAN_CHAMPIONSHIPS.find(
	(championship) => championship.name === "Bundesliga",
);
assert.ok(bundesliga);
const pickedBundesliga = pickCanonicalSportsbookTournament(
	[
		{
			id: "betting:17:gin:dea34410-913d-4778-b6d8-db45147aab9a",
			name: "Germany. U19 Bundesliga. Season 2023/2024",
		},
		{
			id: "betting:21:gin:5e369174-da30-4681-aaed-1dd44ea9ee15",
			name: "Germany. Bundesliga. Season 2023/2024",
		},
		{
			id: "betting:24:gin:bef631c0-4f2c-4baa-879e-fa15c90fb911",
			name: "Germany. Bundesliga",
		},
	],
	bundesliga,
);
assert.equal(
	pickedBundesliga?.id,
	"betting:24:gin:bef631c0-4f2c-4baa-879e-fa15c90fb911",
);

const bundesligaGin =
	"betting:24:gin:bef631c0-4f2c-4baa-879e-fa15c90fb911";
const premierGin = "betting:24:gin:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const championships: BonusEngineChampionshipRow[] = [
	{
		sportId: 1,
		categoryId: 10,
		championshipId: premierGin,
		name: "Premier League",
	},
	{
		sportId: 1,
		categoryId: 13,
		championshipId: bundesligaGin,
		name: "Bundesliga",
	},
];

const germanyOnly = resolveMissionSportsbookPath(
	{
		sports_league_events: [
			{
				sports: { unique_id: 1, name: "Soccer" },
				category: { unique_id: 13, name: "Germany" },
				leagues: [{}],
			},
		],
	},
	championships,
);
assert.equal(
	germanyOnly,
	`sports/prematch/football/tournament/${bundesligaGin}`,
);

const premierStub = resolveMissionSportsbookPath(
	{
		sports_league_events: [
			{
				sports: { unique_id: 1, name: "Soccer" },
				category: { unique_id: 10, name: "England" },
				leagues: [
					{ league: { unique_id: 100, name: "Premier League" } },
				],
			},
		],
	},
	championships,
);
assert.equal(
	premierStub,
	`sports/prematch/football/tournament/${premierGin}`,
);

const attached = attachMissionSportsbookPaths({
	missions: [
		{
			_id: "m1",
			sports_league_events: [
				{
					category: { unique_id: 13, name: "Germany" },
					leagues: [{}],
				},
			],
		},
	],
	championships,
});
assert.equal(
	attached[0]?.sportsbook_path,
	`sports/prematch/football/tournament/${bundesligaGin}`,
);

const stubCatalog = resolveMissionSportsbookPath(
	{
		sports_league_events: [
			{
				category: { unique_id: 13, name: "Germany" },
				leagues: [{}],
			},
		],
	},
	[
		{
			sportId: 1,
			categoryId: 13,
			championshipId: 103,
			name: "Bundesliga",
		},
	],
);
assert.equal(stubCatalog, null);

console.log("bonus-engine mission-sportsbook-path.self-check: ok");
