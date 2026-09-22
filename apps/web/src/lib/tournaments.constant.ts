export const TOURNAMENT_API_ROUTE = {
	LIST: "tournament/list",
	JOIN: "tournament/join",
	LEADERBOARD: "tournament/leaderboard",
} as const;

export const TOURNAMENT_ID_FIELD = "tournamentId" as const;

export const TOURNAMENT_QUERY_KEY = {
	LIST: ["tournaments", "list"] as const,
	LEADERBOARD: ["tournaments", "leaderboard"] as const,
	leaderboard: (tournamentId: string) =>
		["tournaments", "leaderboard", tournamentId] as const,
};

export const TOURNAMENT_ENGINE_STATUS = {
	ACTIVE: "ACTIVE",
	COMPLETED: "COMPLETED",
	UPCOMING: "UPCOMING",
	INACTIVE: "INACTIVE",
} as const;

export const TOURNAMENT_PRODUCT = {
	SPORT: "sport",
	SPORTS: "sports",
	SPORTSBOOK: "sportsbook",
	CASINO: "casino",
	LIVE_CASINO: "live_casino",
	VIRTUAL: "virtual",
} as const;

export const TOURNAMENT_SPORT = {
	SPORT: "sport",
	CASINO: "casino",
	VIRTUAL: "virtual",
} as const;

export const TOURNAMENT_STATUS = {
	ACTIVE: "active",
	UPCOMING: "upcoming",
	RESULTS: "results",
} as const;

export const TOURNAMENT_SPORT_IMAGE = {
	sport: "/tournaments/football.png",
	casino: "/tournaments/casino-rush.png",
	virtual: "/tournaments/virtual.png",
} as const;

export const TOURNAMENT_DEFAULT_IMAGE = TOURNAMENT_SPORT_IMAGE.casino;

export const TOURNAMENT_DEFAULT_TITLE = "Tournament";

export const TOURNAMENT_JOIN_ALREADY_OPTED_IN = "User already Opted In";

export const TOURNAMENT_NO_PLAYERS_YET = "No players yet";

/**
 * Joined-player label from leaderboard row count.
 * `undefined` means the leaderboard has not arrived yet.
 */
export function formatTournamentPlayerCount(count: number | undefined): string {
	if (count === undefined) return "";
	if (count <= 0) return TOURNAMENT_NO_PLAYERS_YET;
	return `${count.toLocaleString("en-NG")} Players`;
}
