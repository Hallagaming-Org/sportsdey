import { apiRequest, ApiError } from "@/lib/api";
import {
	TOURNAMENT_API_ROUTE,
	TOURNAMENT_ID_FIELD,
	TOURNAMENT_JOIN_ALREADY_OPTED_IN,
	TOURNAMENT_QUERY_KEY,
} from "./tournaments.constant";
import {
	normalizeLeaderboardRecord,
	normalizeTournamentRecord,
	unwrapLeaderboardRows,
	type LeaderboardEntry,
	type TournamentCard,
} from "./tournaments-normalize";

export type {
	LeaderboardEntry,
	TournamentCard,
	TournamentSport,
	TournamentStatus,
} from "./tournaments-normalize";
export {
	isLeaderboardOptedIn,
	normalizeLeaderboardRecord,
	normalizeTournamentRecord,
	pickFeaturedTournament,
	unwrapLeaderboardRows,
} from "./tournaments-normalize";

/**
 * Fetches Bonus Engine tournaments via SportsDey `GET /tournament/list`
 * and maps each row onto a card.
 */
export async function fetchTournamentList(): Promise<TournamentCard[]> {
	const data = await apiRequest<Record<string, unknown>[]>(
		TOURNAMENT_API_ROUTE.LIST,
		{
			method: "GET",
			credentials: "include",
		},
	);
	const rows = Array.isArray(data) ? data : [];
	return rows
		.filter((row) => row && typeof row === "object")
		.map((row, index) => normalizeTournamentRecord(row, index));
}

/**
 * Opt the signed-in player into a tournament via `POST /tournament/join`.
 */
export async function joinTournament(payload: {
	tournamentId: string;
}): Promise<Record<string, unknown>> {
	return apiRequest<Record<string, unknown>>(TOURNAMENT_API_ROUTE.JOIN, {
		method: "POST",
		credentials: "include",
		body: JSON.stringify({
			[TOURNAMENT_ID_FIELD]: payload.tournamentId,
		}),
	});
}

/**
 * Fetches Bonus Engine leaderboard rows for one tournament.
 */
export async function fetchTournamentLeaderboard(payload: {
	tournamentId: string;
	tournamentTitle: string;
}): Promise<LeaderboardEntry[]> {
	const search = new URLSearchParams({
		[TOURNAMENT_ID_FIELD]: payload.tournamentId,
	});
	const data = await apiRequest<unknown>(
		`${TOURNAMENT_API_ROUTE.LEADERBOARD}?${search.toString()}`,
		{
			method: "GET",
			credentials: "include",
		},
	);
	return unwrapLeaderboardRows(data).map((row, index) =>
		normalizeLeaderboardRecord(row, index, payload.tournamentTitle),
	);
}

/**
 * Bonus Engine join is idempotent for the player; this 400 is a successful opt-in.
 */
export function isTournamentAlreadyOptedInError(error: unknown): boolean {
	if (!(error instanceof ApiError)) return false;
	return error.message
		.toLowerCase()
		.includes(TOURNAMENT_JOIN_ALREADY_OPTED_IN.toLowerCase());
}

export { TOURNAMENT_QUERY_KEY };
