import {
	TOURNAMENT_DEFAULT_IMAGE,
	TOURNAMENT_DEFAULT_TITLE,
	TOURNAMENT_ENGINE_STATUS,
	TOURNAMENT_PRODUCT,
	TOURNAMENT_SPORT,
	TOURNAMENT_SPORT_IMAGE,
	TOURNAMENT_STATUS,
} from "./tournaments.constant";

export type TournamentStatus =
	(typeof TOURNAMENT_STATUS)[keyof typeof TOURNAMENT_STATUS];

export type TournamentSport =
	(typeof TOURNAMENT_SPORT)[keyof typeof TOURNAMENT_SPORT];

export type TournamentCard = {
	id: string;
	title: string;
	prize: number;
	image: string;
	players: number;
	remaining: string;
	status: TournamentStatus;
	sport: TournamentSport;
};

export type LeaderboardEntry = {
	id: string;
	userId: string;
	rank: number;
	username: string;
	tournament: string;
	points: number;
	prize: number;
};

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Maps a Bonus Engine tournament list row onto a Tournaments card.
 * `tournament_name` is often blank in Admin, so the title falls back to
 * `tournament_code`, then the first configured game name.
 */
export function normalizeTournamentRecord(
	record: Record<string, unknown>,
	index = 0,
	now = new Date(),
): TournamentCard {
	const id =
		asString(record._id ?? record.tournamentId ?? record.id) ||
		`tournament-${index}`;
	const sport = resolveSport(asString(record.product));
	const startAt = asDateString(record.start_date_time ?? record.start_date);
	const endAt = asDateString(record.end_date_time ?? record.end_date);
	const status = resolveTournamentStatus({
		engineStatus: asString(record.tournament_status).toUpperCase(),
		startAt,
		endAt,
		now,
	});
	return {
		id,
		title: resolveTournamentTitle(record),
		prize: resolvePrize(record),
		image: TOURNAMENT_SPORT_IMAGE[sport] ?? TOURNAMENT_DEFAULT_IMAGE,
		players: 0,
		remaining: formatRemaining({
			status,
			startAt,
			endAt,
			now,
		}),
		status,
		sport,
	};
}

/**
 * Maps a Bonus Engine leaderboard row. Username lives on nested
 * `player_id.username` in the live payload; flat `username` is still accepted.
 */
export function normalizeLeaderboardRecord(
	record: Record<string, unknown>,
	index: number,
	tournamentTitle: string,
): LeaderboardEntry {
	const rank = Math.max(
		1,
		Math.trunc(
			asNumber(record.rank ?? record.position ?? record.ranking) || index + 1,
		),
	);
	const nestedPlayer = asRecord(record.player_id);
	const username =
		resolveLeaderboardUsername({ record, nestedPlayer }) || `Player ${rank}`;
	const userId = asString(nestedPlayer?.user_id ?? record.user_id);
	return {
		id:
			asString(
				record._id ??
					record.id ??
					nestedPlayer?._id ??
					userId,
			) || `${tournamentTitle}-${rank}`,
		userId,
		rank,
		username,
		tournament:
			asString(record.tournament ?? record.tournament_code ?? record.tournament_name) ||
			tournamentTitle,
		points: asNumber(
			record.points ??
				record.score ??
				record.total_points ??
				record.bet_amount ??
				record.total_bet,
		),
		prize: asNumber(
			record.prize ?? record.price ?? record.amount ?? record.winning,
		),
	};
}

/**
 * Reads the display name from nested `player_id` first, then flat row keys.
 */
function resolveLeaderboardUsername(payload: {
	record: Record<string, unknown>;
	nestedPlayer: Record<string, unknown> | null;
}): string {
	const nestedName = asString(
		payload.nestedPlayer?.username ??
			payload.nestedPlayer?.user_name ??
			payload.nestedPlayer?.name,
	);
	if (nestedName) return nestedName;
	return asString(
		payload.record.username ??
			payload.record.user_name ??
			payload.record.player_name ??
			payload.record.player ??
			payload.record.nickname ??
			payload.record.name,
	);
}

/**
 * True when the signed-in SportsDey user already appears on a tournament
 * leaderboard (`player_id.user_id`).
 */
export function isLeaderboardOptedIn(payload: {
	entries: LeaderboardEntry[];
	userId: string;
}): boolean {
	if (!payload.userId) return false;
	return payload.entries.some((entry) => entry.userId === payload.userId);
}

/**
 * Picks the featured tournament: highest-prize active, else first upcoming,
 * else first row.
 */
export function pickFeaturedTournament(
	tournaments: TournamentCard[],
): TournamentCard | undefined {
	const active = tournaments.filter(
		(tournament) => tournament.status === TOURNAMENT_STATUS.ACTIVE,
	);
	if (active.length > 0) {
		return [...active].sort((left, right) => right.prize - left.prize)[0];
	}
	return (
		tournaments.find(
			(tournament) => tournament.status === TOURNAMENT_STATUS.UPCOMING,
		) ?? tournaments[0]
	);
}

export function unwrapLeaderboardRows(
	payload: unknown,
): Record<string, unknown>[] {
	if (Array.isArray(payload)) {
		return payload.filter(isRecord);
	}
	const root = asRecord(payload);
	if (!root) return [];
	for (const key of ["leaderboard", "players", "rows", "list", "data"] as const) {
		const value = root[key];
		if (Array.isArray(value)) return value.filter(isRecord);
	}
	return [];
}

function resolveTournamentTitle(record: Record<string, unknown>): string {
	const name = asString(record.tournament_name);
	if (name) return name;
	const code = asString(record.tournament_code);
	if (code) return code;
	const gameName = firstGameName(record.provider_games);
	if (gameName) return gameName;
	return TOURNAMENT_DEFAULT_TITLE;
}

function resolvePrize(record: Record<string, unknown>): number {
	const budget = asNumber(record.total_budget);
	if (budget > 0) return budget;
	const listed = asNumber(record.tournament_price);
	if (listed > 0) return listed;
	const configs = Array.isArray(record.prize_configs) ? record.prize_configs : [];
	for (const entry of configs) {
		const amount = asNumber(asRecord(entry)?.price_amount);
		if (amount > 0) return amount;
	}
	return 0;
}

function resolveSport(product: string): TournamentSport {
	const value = product.trim().toLowerCase();
	if (
		value === TOURNAMENT_PRODUCT.SPORT ||
		value === TOURNAMENT_PRODUCT.SPORTS ||
		value === TOURNAMENT_PRODUCT.SPORTSBOOK
	) {
		return TOURNAMENT_SPORT.SPORT;
	}
	if (value === TOURNAMENT_PRODUCT.VIRTUAL) {
		return TOURNAMENT_SPORT.VIRTUAL;
	}
	return TOURNAMENT_SPORT.CASINO;
}

function resolveTournamentStatus(payload: {
	engineStatus: string;
	startAt: string | null;
	endAt: string | null;
	now: Date;
}): TournamentStatus {
	if (
		payload.engineStatus === TOURNAMENT_ENGINE_STATUS.COMPLETED ||
		payload.engineStatus === TOURNAMENT_ENGINE_STATUS.INACTIVE
	) {
		return TOURNAMENT_STATUS.RESULTS;
	}
	const nowMs = payload.now.getTime();
	const startMs = payload.startAt ? Date.parse(payload.startAt) : Number.NaN;
	const endMs = payload.endAt ? Date.parse(payload.endAt) : Number.NaN;
	if (Number.isFinite(endMs) && endMs <= nowMs) {
		return TOURNAMENT_STATUS.RESULTS;
	}
	if (Number.isFinite(startMs) && startMs > nowMs) {
		return TOURNAMENT_STATUS.UPCOMING;
	}
	return TOURNAMENT_STATUS.ACTIVE;
}

function formatRemaining(payload: {
	status: TournamentStatus;
	startAt: string | null;
	endAt: string | null;
	now: Date;
}): string {
	if (payload.status === TOURNAMENT_STATUS.RESULTS) return "Ended";
	const target =
		payload.status === TOURNAMENT_STATUS.UPCOMING
			? payload.startAt
			: payload.endAt;
	if (!target) return "";
	const endMs = Date.parse(target);
	if (!Number.isFinite(endMs)) return "";
	const remainingMs = endMs - payload.now.getTime();
	if (remainingMs <= 0) return "Ended";
	const days = Math.floor(remainingMs / MS_PER_DAY);
	const hours = Math.floor((remainingMs % MS_PER_DAY) / MS_PER_HOUR);
	const minutes = Math.floor((remainingMs % MS_PER_HOUR) / MS_PER_MINUTE);
	return `${days}D:${hours}H:${String(minutes).padStart(2, "0")}M`;
}

function firstGameName(providerGames: unknown): string {
	if (!Array.isArray(providerGames)) return "";
	for (const entry of providerGames) {
		const games = asRecord(entry)?.game;
		if (!Array.isArray(games)) continue;
		for (const game of games) {
			const name = asString(asRecord(game)?.name);
			if (name) return name;
		}
	}
	return "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return null;
	}
	return value as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return asRecord(value) !== null;
}

function asString(value: unknown): string {
	if (typeof value !== "string") return "";
	return value.trim();
}

function asNumber(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim()) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
}

function asDateString(value: unknown): string | null {
	const text = asString(value);
	if (!text) return null;
	return Number.isFinite(Date.parse(text)) ? text : null;
}
