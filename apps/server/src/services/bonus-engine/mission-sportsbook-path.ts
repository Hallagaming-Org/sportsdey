import {
	BONUS_ENGINE_SPORTSBOOK_CATALOG,
	BONUS_ENGINE_TOP_EUROPEAN_CHAMPIONSHIPS,
	matchTopEuropeanChampionship,
} from "./reference-data.service.constant";
import type { BonusEngineChampionshipRow } from "./reference-data.service.type";

export const MISSION_SPORTSBOOK_PATH_FIELD = "sportsbook_path";
export const MISSION_SPORTSBOOK_FOOTBALL_PREMATCH =
	"sports/prematch/football";

type MissionSportsTarget = {
	leagueId: string;
	leagueName: string;
	categoryId: string;
	categoryName: string;
};

export function isDatabetTournamentGin(id: string): boolean {
	const value = id.trim();
	return /:gin:/i.test(value) || /^betting:\d+:/i.test(value);
}

export function sportsbookTournamentPath(tournamentId: string): string {
	return `${MISSION_SPORTSBOOK_FOOTBALL_PREMATCH}/tournament/${tournamentId.trim()}`;
}

export function missionHasSportsLeagueEvents(
	record: Record<string, unknown>,
): boolean {
	return Array.isArray(record.sports_league_events);
}

export function resolveMissionSportsbookPath(
	record: Record<string, unknown>,
	championships: BonusEngineChampionshipRow[],
): string | null {
	const target = parseMissionSportsTarget(record.sports_league_events);
	if (!target) return null;
	const tournamentId = resolveTournamentGin(target, championships);
	if (!tournamentId) return null;
	return sportsbookTournamentPath(tournamentId);
}

export function attachMissionSportsbookPaths(payload: {
	missions: Array<Record<string, unknown>>;
	championships: BonusEngineChampionshipRow[];
}): Array<Record<string, unknown>> {
	if (payload.championships.length === 0) return payload.missions;
	return payload.missions.map((mission) => {
		const path = resolveMissionSportsbookPath(mission, payload.championships);
		if (!path) return mission;
		return { ...mission, [MISSION_SPORTSBOOK_PATH_FIELD]: path };
	});
}

export function parseMissionSportsTarget(
	value: unknown,
): MissionSportsTarget | null {
	if (!Array.isArray(value)) return null;

	for (const entry of value) {
		if (typeof entry !== "object" || entry === null) continue;
		const row = entry as Record<string, unknown>;
		const category =
			typeof row.category === "object" && row.category !== null
				? (row.category as Record<string, unknown>)
				: null;
		const categoryId = asIdString(category?.unique_id ?? category?.id);
		const categoryName = asString(category?.name);
		const leagues = Array.isArray(row.leagues) ? row.leagues : [];

		let leagueId = "";
		let leagueName = "";
		for (const leagueEntry of leagues) {
			if (typeof leagueEntry !== "object" || leagueEntry === null) continue;
			const wrapped = leagueEntry as Record<string, unknown>;
			const leagueRow =
				typeof wrapped.league === "object" && wrapped.league !== null
					? (wrapped.league as Record<string, unknown>)
					: wrapped;
			leagueId = asIdString(leagueRow.unique_id ?? leagueRow.id);
			leagueName = asString(leagueRow.name);
			if (leagueId || leagueName) break;
		}

		if (leagueId || leagueName || categoryId || categoryName) {
			return { leagueId, leagueName, categoryId, categoryName };
		}
	}

	return null;
}

function resolveTournamentGin(
	target: MissionSportsTarget,
	championships: BonusEngineChampionshipRow[],
): string | null {
	if (isDatabetTournamentGin(target.leagueId)) return target.leagueId.trim();

	const ginFromRow = (row: BonusEngineChampionshipRow | undefined) => {
		if (!row) return null;
		const id = String(row.championshipId).trim();
		return isDatabetTournamentGin(id) ? id : null;
	};

	const byLiveId = championships.find(
		(row) => String(row.championshipId) === target.leagueId,
	);
	const fromLiveId = ginFromRow(byLiveId);
	if (fromLiveId) return fromLiveId;

	if (target.leagueId) {
		const stub = BONUS_ENGINE_TOP_EUROPEAN_CHAMPIONSHIPS.find(
			(championship) =>
				String(championship.fallbackChampionshipId) === target.leagueId,
		);
		const fromStub = ginFromRow(
			championships.find(
				(row) =>
					row.name === stub?.name || row.categoryId === stub?.categoryId,
			),
		);
		if (fromStub) return fromStub;
	}

	if (target.leagueName) {
		const matched = matchTopEuropeanChampionship(target.leagueName);
		const fromName = ginFromRow(
			championships.find(
				(row) =>
					row.name === matched?.name ||
					row.categoryId === matched?.categoryId,
			),
		);
		if (fromName) return fromName;
	}

	const categoryId = Number(target.categoryId);
	if (Number.isInteger(categoryId)) {
		const fromCategoryId = ginFromRow(
			championships.find((row) => row.categoryId === categoryId),
		);
		if (fromCategoryId) return fromCategoryId;
	}

	if (target.categoryName) {
		const category = BONUS_ENGINE_SPORTSBOOK_CATALOG.categories.find(
			(row) =>
				row.name.toLowerCase() === target.categoryName.trim().toLowerCase(),
		);
		const fromCategoryName = ginFromRow(
			championships.find((row) => row.categoryId === category?.categoryId),
		);
		if (fromCategoryName) return fromCategoryName;
	}

	return null;
}

function asString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function asIdString(value: unknown): string {
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return asString(value);
}
