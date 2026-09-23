import type {
	LeaderboardEntry,
	TournamentCard as Tournament,
	TournamentSport,
	TournamentStatus,
} from "@/lib/tournaments";
import { TOURNAMENT_SPORT, TOURNAMENT_STATUS } from "@/lib/tournaments.constant";

export {
	formatTournamentPlayerCount,
	TOURNAMENT_NO_PLAYERS_YET,
} from "@/lib/tournaments.constant";

export type { LeaderboardEntry, Tournament, TournamentSport, TournamentStatus };

export const TOURNAMENT_STATUS_TABS = [
	{ id: TOURNAMENT_STATUS.ACTIVE, label: "Active" },
	{ id: TOURNAMENT_STATUS.UPCOMING, label: "Upcoming" },
	{ id: TOURNAMENT_STATUS.RESULTS, label: "Results" },
] as const satisfies ReadonlyArray<{ id: TournamentStatus; label: string }>;

export const TOURNAMENT_SPORT_FILTER_ALL = "all" as const;

export const TOURNAMENT_SPORT_FILTERS = [
	{ id: TOURNAMENT_SPORT_FILTER_ALL, label: "All" },
	{ id: TOURNAMENT_SPORT.SPORT, label: "Sports" },
	{ id: TOURNAMENT_SPORT.CASINO, label: "Casino" },
] as const;

export function formatTournamentPrize(
	amount: number,
	withDecimals = false,
): string {
	return `₦${amount.toLocaleString("en-NG", {
		minimumFractionDigits: withDecimals ? 2 : 0,
		maximumFractionDigits: withDecimals ? 2 : 0,
	})}`;
}

export function playerInitials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	if (parts.length === 1) {
		const [only] = parts;
		return only ? only.slice(0, 2).toUpperCase() : "?";
	}
	const [first, second] = parts;
	return `${first?.[0] ?? ""}${second?.[0] ?? ""}`.toUpperCase();
}
