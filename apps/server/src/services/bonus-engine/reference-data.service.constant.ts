/**
 * Sportsbook catalog for Bonus Engine Admin dropdowns.
 * Championships are the European top 6 — not individual fixtures.
 * Live Data.Bet tournament ids are preferred so `POST /bet` `league_id`
 * matches Admin Championship ID.
 */
export const BONUS_ENGINE_DATABET_FOOTBALL_SPORT = "football";

export const BONUS_ENGINE_DATABET_TOURNAMENTS_PATH =
	"/v2/tournaments/by-filters";

export type BonusEngineTopEuropeanChampionship = {
	sportId: number;
	categoryId: number;
	fallbackChampionshipId: number;
	name: string;
	searchName: string;
	aliases: readonly string[];
	excludedSubstrings: readonly string[];
};

export const BONUS_ENGINE_TOP_EUROPEAN_CHAMPIONSHIPS: readonly BonusEngineTopEuropeanChampionship[] =
	[
		{
			sportId: 1,
			categoryId: 10,
			fallbackChampionshipId: 100,
			name: "Premier League",
			searchName: "Premier League",
			aliases: ["premier league"],
			excludedSubstrings: ["premier league 2", "u21", "u18"],
		},
		{
			sportId: 1,
			categoryId: 11,
			fallbackChampionshipId: 101,
			name: "La Liga",
			searchName: "La Liga",
			aliases: ["la liga", "laliga"],
			excludedSubstrings: ["la liga 2", "laliga 2", "segunda"],
		},
		{
			sportId: 1,
			categoryId: 12,
			fallbackChampionshipId: 102,
			name: "Serie A",
			searchName: "Serie A",
			aliases: ["serie a"],
			excludedSubstrings: ["serie a2", "serie b", "women"],
		},
		{
			sportId: 1,
			categoryId: 13,
			fallbackChampionshipId: 103,
			name: "Bundesliga",
			searchName: "Bundesliga",
			aliases: ["bundesliga"],
			excludedSubstrings: ["2. bundesliga", "bundesliga 2", "3. liga"],
		},
		{
			sportId: 1,
			categoryId: 14,
			fallbackChampionshipId: 104,
			name: "Ligue 1",
			searchName: "Ligue 1",
			aliases: ["ligue 1"],
			excludedSubstrings: ["ligue 2"],
		},
		{
			sportId: 1,
			categoryId: 15,
			fallbackChampionshipId: 105,
			name: "UEFA Champions League",
			searchName: "Champions League",
			aliases: ["uefa champions league", "champions league"],
			excludedSubstrings: ["women", "youth", "europa"],
		},
	];

export const BONUS_ENGINE_SPORTSBOOK_CATALOG = {
	sports: [{ SportId: 1, Name: "Soccer" }],
	categories: [
		{ sportId: 1, categoryId: 10, name: "England" },
		{ sportId: 1, categoryId: 11, name: "Spain" },
		{ sportId: 1, categoryId: 12, name: "Italy" },
		{ sportId: 1, categoryId: 13, name: "Germany" },
		{ sportId: 1, categoryId: 14, name: "France" },
		{ sportId: 1, categoryId: 15, name: "International Clubs" },
	],
	championships: BONUS_ENGINE_TOP_EUROPEAN_CHAMPIONSHIPS.map(
		(championship) => ({
			sportId: championship.sportId,
			categoryId: championship.categoryId,
			championshipId: championship.fallbackChampionshipId,
			name: championship.name,
		}),
	),
} as const;

/** Legacy stub Event IDs — never report these as live `event_id`. */
export const BONUS_ENGINE_SPORTSBOOK_STUB_EVENT_IDS = new Set(["5000", "5001"]);

/**
 * Pick the top-6 European championship for a Data.Bet tournament name.
 * Exclusions run first so "Premier League 2" does not match Premier League.
 */
export function matchTopEuropeanChampionship(
	tournamentName: string,
): BonusEngineTopEuropeanChampionship | undefined {
	const normalized = tournamentName.toLowerCase().replace(/\s+/g, " ").trim();
	if (!normalized) return undefined;

	for (const championship of BONUS_ENGINE_TOP_EUROPEAN_CHAMPIONSHIPS) {
		if (
			championship.excludedSubstrings.some((part) =>
				normalized.includes(part),
			)
		) {
			continue;
		}
		if (championship.aliases.some((alias) => normalized.includes(alias))) {
			return championship;
		}
	}
	return undefined;
}
