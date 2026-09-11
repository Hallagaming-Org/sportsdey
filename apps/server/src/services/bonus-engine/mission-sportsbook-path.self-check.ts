import assert from "node:assert/strict";
import {
	attachMissionSportsbookPaths,
	resolveMissionSportsbookPath,
} from "./mission-sportsbook-path";
import {
	BONUS_ENGINE_SPORTSBOOK_CATALOG,
	BONUS_ENGINE_TOP_EUROPEAN_CHAMPIONSHIPS,
	pickCanonicalSportsbookTournament,
} from "./reference-data.service.constant";
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

const europa = BONUS_ENGINE_TOP_EUROPEAN_CHAMPIONSHIPS.find(
	(championship) => championship.name === "UEFA Europa League",
);
assert.ok(europa);
const pickedEuropa = pickCanonicalSportsbookTournament(
	[
		{
			id: "betting:24:gin:cccccccccccccccc-cccc-cccc-cccc-cccccccccccc",
			name: "UEFA Europa Conference League",
		},
		{
			id: "betting:17:gin:dddddddd-dddd-dddd-dddd-dddddddddddd",
			name: "UEFA Europa League. Season 2023/2024",
		},
		{
			id: "betting:24:gin:eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
			name: "UEFA Europa League",
		},
	],
	europa,
);
assert.equal(
	pickedEuropa?.id,
	"betting:24:gin:eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
);

const bundesligaGin =
	"betting:24:gin:bef631c0-4f2c-4baa-879e-fa15c90fb911";
const premierGin = "betting:24:gin:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

assert.equal(BONUS_ENGINE_TOP_EUROPEAN_CHAMPIONSHIPS.length, 7);

const liveGins: Record<string, string> = {
	"Premier League": premierGin,
	"La Liga": "betting:24:gin:11111111-1111-1111-1111-111111111111",
	"Serie A": "betting:24:gin:22222222-2222-2222-2222-222222222222",
	Bundesliga: bundesligaGin,
	"Ligue 1": "betting:24:gin:44444444-4444-4444-4444-444444444444",
	"UEFA Champions League":
		"betting:24:gin:55555555-5555-5555-5555-555555555555",
	"UEFA Europa League":
		"betting:24:gin:66666666-6666-6666-6666-666666666666",
};

const championships: BonusEngineChampionshipRow[] =
	BONUS_ENGINE_TOP_EUROPEAN_CHAMPIONSHIPS.map((championship) => {
		const gin = liveGins[championship.name];
		assert.ok(gin, `missing live GIN for ${championship.name}`);
		return {
			sportId: championship.sportId,
			categoryId: championship.categoryId,
			championshipId: gin,
			name: championship.name,
		};
	});

const flagshipByCategory = new Map<number, string>();
for (const championship of BONUS_ENGINE_TOP_EUROPEAN_CHAMPIONSHIPS) {
	if (!flagshipByCategory.has(championship.categoryId)) {
		flagshipByCategory.set(championship.categoryId, championship.name);
	}
}

for (const championship of BONUS_ENGINE_TOP_EUROPEAN_CHAMPIONSHIPS) {
	const gin = liveGins[championship.name];
	assert.ok(gin);
	const expected = `sports/prematch/football/tournament/${gin}`;
	const category = BONUS_ENGINE_SPORTSBOOK_CATALOG.categories.find(
		(row) => row.categoryId === championship.categoryId,
	);
	assert.ok(category);

	if (flagshipByCategory.get(championship.categoryId) === championship.name) {
		assert.equal(
			resolveMissionSportsbookPath(
				{
					sports_league_events: [
						{
							sports: { unique_id: 1, name: "Soccer" },
							category: {
								unique_id: championship.categoryId,
								name: category.name,
							},
							leagues: [{}],
						},
					],
				},
				championships,
			),
			expected,
			`${championship.name} should resolve from category ${category.name}`,
		);
	}

	assert.equal(
		resolveMissionSportsbookPath(
			{
				sports_league_events: [
					{
						sports: { unique_id: 1, name: "Soccer" },
						category: {
							unique_id: championship.categoryId,
							name: category.name,
						},
						leagues: [
							{
								league: {
									unique_id: championship.fallbackChampionshipId,
									name: championship.name,
								},
							},
						],
					},
				],
			},
			championships,
		),
		expected,
		`${championship.name} should resolve from league name / stub id`,
	);
}

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

const englandCategoryOnly = resolveMissionSportsbookPath(
	{
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
	},
	championships,
);
assert.equal(
	englandCategoryOnly,
	`sports/prematch/football/tournament/${premierGin}`,
);

const namedLeagueWins = resolveMissionSportsbookPath(
	{
		sports_league_events: [
			{
				sports: { unique_id: 1, name: "Soccer" },
				category: { unique_id: 10, name: "England" },
				leagues: [{}],
			},
			{
				sports: { unique_id: 1, name: "Soccer" },
				category: { unique_id: 12, name: "Italy" },
				leagues: [{ league: { unique_id: 102, name: "Serie A" } }],
			},
		],
	},
	championships,
);
assert.equal(
	namedLeagueWins,
	`sports/prematch/football/tournament/${liveGins["Serie A"]}`,
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
