import type { CloudflareBindings } from "../../types";
import { listBonusEngineChampionshipRows } from "./reference-data.service";
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

/**
 * Resolves Data.Bet tournament GINs for any Bonus Engine row that carries
 * `sports_league_events` (missions, campaigns, player assignments).
 */
export async function attachLiveSportsbookPaths<
	T extends Record<string, unknown>,
>(payload: { env: CloudflareBindings; records: T[] }): Promise<T[]> {
	if (!payload.records.some(missionHasSportsLeagueEvents)) {
		return payload.records;
	}
	const championships = await listBonusEngineChampionshipRows(payload.env);
	return attachMissionSportsbookPaths({
		missions: payload.records,
		championships,
	}) as T[];
}

export function parseMissionSportsTarget(
	value: unknown,
): MissionSportsTarget | null {
	if (!Array.isArray(value)) return null;

	const targets: MissionSportsTarget[] = [];
	for (const entry of value) {
		const target = parseOneSportsTarget(entry);
		if (target) targets.push(target);
	}

	return (
		targets.find((row) => row.leagueId || row.leagueName) ??
		targets[0] ??
		null
	);
}

function parseOneSportsTarget(entry: unknown): MissionSportsTarget | null {
	if (typeof entry !== "object" || entry === null) return null;
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

	if (!leagueId && !leagueName && !categoryId && !categoryName) return null;
	return { leagueId, leagueName, categoryId, categoryName };
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
		const fromStub = ginFromRow(championshipRowByName(championships, stub?.name));
		if (fromStub) return fromStub;
	}

	if (target.leagueName) {
		const matched = matchTopEuropeanChampionship(target.leagueName);
		const fromName = ginFromRow(
			championshipRowByName(championships, matched?.name),
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

function championshipRowByName(
	championships: BonusEngineChampionshipRow[],
	name: string | undefined,
): BonusEngineChampionshipRow | undefined {
	if (!name) return undefined;
	return championships.find((row) => row.name === name);
}

function asString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function asIdString(value: unknown): string {
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return asString(value);
}
