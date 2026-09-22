export const BONUS_ENGINE_DATABET_FOOTBALL_SPORT = "football";

export const BONUS_ENGINE_DATABET_TOURNAMENTS_PATH =
	"/v2/tournaments/by-filters";

export type BonusEngineTopEuropeanChampionship = {
	sportId: number;
	categoryId: number;
	fallbackChampionshipId: number;
	name: string;
	searchName: string;
	canonicalName: string;
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
			searchName: "England. Premier League",
			canonicalName: "england. premier league",
			aliases: ["premier league"],
			excludedSubstrings: [
				"premier league 2",
				"u21",
				"u18",
				"u19",
				"u23",
				"women",
				"cup",
			],
		},
		{
			sportId: 1,
			categoryId: 11,
			fallbackChampionshipId: 101,
			name: "La Liga",
			searchName: "Spain. La Liga",
			canonicalName: "spain. la liga",
			aliases: ["la liga", "laliga"],
			excludedSubstrings: ["la liga 2", "laliga 2", "segunda", "women"],
		},
		{
			sportId: 1,
			categoryId: 12,
			fallbackChampionshipId: 102,
			name: "Serie A",
			searchName: "Italy. Serie A",
			canonicalName: "italy. serie a",
			aliases: ["serie a"],
			excludedSubstrings: ["serie a2", "serie b", "women"],
		},
		{
			sportId: 1,
			categoryId: 13,
			fallbackChampionshipId: 103,
			name: "Bundesliga",
			searchName: "Germany. Bundesliga",
			canonicalName: "germany. bundesliga",
			aliases: ["bundesliga"],
			excludedSubstrings: [
				"2. bundesliga",
				"bundesliga 2",
				"3. liga",
				"u19",
				"women",
				"austria",
			],
		},
		{
			sportId: 1,
			categoryId: 14,
			fallbackChampionshipId: 104,
			name: "Ligue 1",
			searchName: "France. Ligue 1",
			canonicalName: "france. ligue 1",
			aliases: ["ligue 1"],
			excludedSubstrings: ["ligue 2", "women"],
		},
		{
			sportId: 1,
			categoryId: 15,
			fallbackChampionshipId: 105,
			name: "UEFA Champions League",
			searchName: "UEFA Champions League",
			canonicalName: "uefa champions league",
			aliases: ["uefa champions league", "champions league"],
			excludedSubstrings: ["women", "youth", "europa", "playoffs", "srl"],
		},
		{
			sportId: 1,
			categoryId: 15,
			fallbackChampionshipId: 106,
			name: "UEFA Europa League",
			searchName: "UEFA Europa League",
			canonicalName: "uefa europa league",
			aliases: ["uefa europa league", "europa league"],
			excludedSubstrings: [
				"women",
				"youth",
				"conference",
				"champions",
				"playoffs",
			],
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
 * Pick the catalogued European championship for a Data.Bet tournament name.
 * Exclusions run first so "Premier League 2" does not match Premier League
 * and Europa League does not match Champions League.
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

/**
 * Pick the sportsbook tournament row the SPA can open.
 * Data.Bet `/tournament/{id}` uses `betting:24:gin:...` (current web tournament),
 * not season archives (`17`) or youth/women variants.
 */
export function pickCanonicalSportsbookTournament(
	tournaments: Array<{ id: string; name: string }>,
	championship: BonusEngineTopEuropeanChampionship,
): { id: string; name: string } | undefined {
	let best: { id: string; name: string; score: number } | undefined;
	for (const tournament of tournaments) {
		const score = scoreSportsbookTournament(tournament, championship);
		if (score < 0) continue;
		if (!best || score > best.score) {
			best = { ...tournament, score };
		}
	}
	return best ? { id: best.id, name: best.name } : undefined;
}

function scoreSportsbookTournament(
	tournament: { id: string; name: string },
	championship: BonusEngineTopEuropeanChampionship,
): number {
	const normalized = tournament.name.toLowerCase().replace(/\s+/g, " ").trim();
	if (!normalized) return -1;
	if (
		championship.excludedSubstrings.some((part) => normalized.includes(part))
	) {
		return -1;
	}
	if (!championship.aliases.some((alias) => normalized.includes(alias))) {
		return -1;
	}

	let score = 0;
	if (normalized === championship.canonicalName) score += 100;
	const ginType = Number(tournament.id.match(/^betting:(\d+):/)?.[1]);
	if (ginType === 24) score += 150;
	else if (ginType === 21) score += 30;
	else if (ginType === 17) score -= 40;
	if (/\b(season|playoffs|u19|u21|u23|women)\b/i.test(normalized)) score -= 50;
	return score;
}
