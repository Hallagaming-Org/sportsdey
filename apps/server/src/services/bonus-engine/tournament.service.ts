import type { CloudflareBindings } from "../../types";
import {
	BONUS_ENGINE_BODY_FIELD,
	BONUS_ENGINE_PATH,
	BONUS_ENGINE_TOURNAMENT_JOIN_MESSAGE,
} from "./bonus-engine.service.constant";
import type {
	BonusEngineApiResult,
	BonusEngineTournamentJoinBody,
	BonusEngineTournamentLeaderboardBody,
	BonusEngineTournamentLeaderboardItem,
	BonusEngineTournamentListBody,
	BonusEngineTournamentListItem,
} from "./bonus-engine.service.type";
import { getBonusEngineConfig } from "./config";
import { bonusEngineAuthedRequest } from "./token.service";

type BonusEngineEnvelope<T> = {
	success?: boolean;
	status?: number;
	message?: string;
	data?: T;
};

const LEADERBOARD_ROW_KEYS = [
	"leaderboard",
	"players",
	"rows",
	"list",
	"data",
] as const;

/**
 * Builds the signed Bonus Engine body for `POST /tournament/list`.
 * Project-scoped only — no `user_id`.
 */
export function buildBonusEngineTournamentListBody(payload: {
	clientId: string;
	projectId: string;
}): BonusEngineTournamentListBody {
	return {
		[BONUS_ENGINE_BODY_FIELD.CLIENT_ID]: payload.clientId,
		[BONUS_ENGINE_BODY_FIELD.PROJECT_ID]: payload.projectId,
	};
}

/**
 * Builds Bonus Engine `POST /tournament/join`.
 * Body is `{ project_id, client_id, tournamentId, user_id }`. Do not send
 * `status` — campaign `tournament_status` (`ACTIVE`) is not a valid
 * `player_tournament.status` enum value.
 */
export function buildBonusEngineTournamentJoinBody(payload: {
	clientId: string;
	projectId: string;
	tournamentId: string;
	userId: string;
}): BonusEngineTournamentJoinBody {
	return {
		[BONUS_ENGINE_BODY_FIELD.PROJECT_ID]: payload.projectId,
		[BONUS_ENGINE_BODY_FIELD.CLIENT_ID]: payload.clientId,
		[BONUS_ENGINE_BODY_FIELD.TOURNAMENT_ID]: payload.tournamentId,
		[BONUS_ENGINE_BODY_FIELD.USER_ID]: payload.userId,
	};
}

/**
 * Builds Bonus Engine `POST /tournament/leaderboard`.
 * Same camelCase `tournamentId` as join.
 */
export function buildBonusEngineTournamentLeaderboardBody(payload: {
	clientId: string;
	projectId: string;
	tournamentId: string;
}): BonusEngineTournamentLeaderboardBody {
	return {
		[BONUS_ENGINE_BODY_FIELD.CLIENT_ID]: payload.clientId,
		[BONUS_ENGINE_BODY_FIELD.PROJECT_ID]: payload.projectId,
		[BONUS_ENGINE_BODY_FIELD.TOURNAMENT_ID]: payload.tournamentId,
	};
}

/**
 * Pulls leaderboard rows out of Bonus Engine envelopes that wrap the list in
 * `data`, `leaderboard`, `players`, or similar.
 */
export function unwrapTournamentLeaderboardRows(
	payload: unknown,
): BonusEngineTournamentLeaderboardItem[] {
	if (Array.isArray(payload)) {
		return payload.filter(isRecord);
	}
	const root = asRecord(payload);
	if (!root) return [];
	const nested = asRecord(root.data) ?? root;
	for (const key of LEADERBOARD_ROW_KEYS) {
		const value = nested[key];
		if (Array.isArray(value)) return value.filter(isRecord);
	}
	return [];
}

/**
 * Proxies Bonus Engine `POST /tournament/list` with merchant `client_id` /
 * `project_id`.
 */
export async function listBonusEngineTournaments(payload: {
	env: CloudflareBindings;
}): Promise<
	BonusEngineApiResult<BonusEngineEnvelope<BonusEngineTournamentListItem[]>>
> {
	const config = getBonusEngineConfig(payload.env);
	return signedTournamentRequest({
		env: payload.env,
		path: BONUS_ENGINE_PATH.TOURNAMENT_LIST,
		body: buildBonusEngineTournamentListBody({
			clientId: config.clientId,
			projectId: config.projectId,
		}),
	});
}

/**
 * Opt the authenticated player into a tournament via Bonus Engine
 * `POST /tournament/join`.
 */
export async function joinBonusEngineTournament(payload: {
	env: CloudflareBindings;
	userId: string;
	tournamentId: string;
}): Promise<
	BonusEngineApiResult<BonusEngineEnvelope<Record<string, unknown>>>
> {
	const config = getBonusEngineConfig(payload.env);
	const result = await signedTournamentRequest<
		BonusEngineEnvelope<Record<string, unknown>>
	>({
		env: payload.env,
		path: BONUS_ENGINE_PATH.TOURNAMENT_JOIN,
		body: buildBonusEngineTournamentJoinBody({
			clientId: config.clientId,
			projectId: config.projectId,
			tournamentId: payload.tournamentId,
			userId: payload.userId,
		}),
	});
	if (!result.ok) {
		const error = mapBonusEngineTournamentJoinError(result.error);
		if (error !== result.error) {
			console.warn("Bonus Engine tournament join rejected", {
				userId: payload.userId,
				tournamentId: payload.tournamentId,
				error: result.error,
			});
		}
		return { ...result, error };
	}
	return result;
}

/**
 * Maps vendor Mongo unique-index failures on `player_tournaments.tournament_id`
 * to a client-safe message. That index is tournament-scoped, not player-scoped,
 * so a second account cannot join after the first.
 */
export function mapBonusEngineTournamentJoinError(
	error: string | undefined,
): string {
	const message = error?.trim() ?? "";
	if (
		/E11000 duplicate key/i.test(message) &&
		/player_tournaments/i.test(message) &&
		/tournament_id/i.test(message)
	) {
		return BONUS_ENGINE_TOURNAMENT_JOIN_MESSAGE.DUPLICATE_TOURNAMENT_SLOT;
	}
	return message || "Failed to join tournament";
}

export type TournamentPrizeKind = "cash" | "bonus" | "unsupported";

/**
 * How a tournament pays its winners, from its Admin config:
 * `tournament_win_type: bonus` prizes are bonus funds the engine allocates as
 * a player bonus (credited through the bonus flow, locked until wagered);
 * prizes made only of free bets / free spins cannot be granted by SportsDey;
 * everything else is cash. No config falls back to cash, which is what the
 * end callback contract describes.
 */
export function classifyTournamentPrize(
	tournament: BonusEngineTournamentListItem | null,
): TournamentPrizeKind {
	if (!tournament) return "cash";
	const winType = asTrimmedString(tournament.tournament_win_type).toLowerCase();
	if (winType === "bonus") return "bonus";
	if (winType && !CASH_WIN_TYPES.has(winType)) return "unsupported";

	const configs = Array.isArray(tournament.prize_configs)
		? tournament.prize_configs.filter(isRecord)
		: [];
	const amountTypes = configs.flatMap((config) =>
		(Array.isArray(config.price_amount_type)
			? config.price_amount_type
			: [config.price_amount_type]
		)
			.map((type) => asTrimmedString(type).toLowerCase())
			.filter(Boolean),
	);
	if (
		amountTypes.length > 0 &&
		amountTypes.every((type) => NON_CASH_PRIZE_TYPES.has(type))
	) {
		return "unsupported";
	}
	return "cash";
}

const CASH_WIN_TYPES = new Set(["real", "cash", "real_cash", "fix", "fixed"]);
const NON_CASH_PRIZE_TYPES = new Set(["free_bets", "free_spins"]);

/**
 * Loads one tournament's config from `POST /tournament/list`. `ok: false`
 * means the engine could not be asked (retry); `tournament: null` means it
 * is not listed.
 */
export async function findBonusEngineTournament(payload: {
	env: CloudflareBindings;
	tournamentId: string;
}): Promise<
	{ ok: true; tournament: BonusEngineTournamentListItem | null } | { ok: false }
> {
	const result = await listBonusEngineTournaments({ env: payload.env });
	if (!result.ok) return { ok: false };
	const rows = Array.isArray(result.data?.data) ? result.data.data : [];
	return {
		ok: true,
		tournament:
			rows.find((row) => asTrimmedString(row._id) === payload.tournamentId) ??
			null,
	};
}

/**
 * Proxies Bonus Engine `POST /tournament/leaderboard` for one tournament.
 * Always returns an array in `data`, even when the engine wraps rows.
 */
export async function getBonusEngineTournamentLeaderboard(payload: {
	env: CloudflareBindings;
	tournamentId: string;
}): Promise<
	BonusEngineApiResult<
		BonusEngineEnvelope<BonusEngineTournamentLeaderboardItem[]>
	>
> {
	const config = getBonusEngineConfig(payload.env);
	const result = await signedTournamentRequest<BonusEngineEnvelope<unknown>>({
		env: payload.env,
		path: BONUS_ENGINE_PATH.TOURNAMENT_LEADERBOARD,
		body: buildBonusEngineTournamentLeaderboardBody({
			clientId: config.clientId,
			projectId: config.projectId,
			tournamentId: payload.tournamentId,
		}),
	});
	if (!result.ok) {
		return {
			ok: false,
			status: result.status,
			error: result.error,
			message: result.message,
		};
	}

	const rows = unwrapTournamentLeaderboardRows(
		result.data?.data ?? result.data,
	);
	return {
		...result,
		data: {
			...result.data,
			data: rows,
		},
	};
}

function signedTournamentRequest<T>(payload: {
	env: CloudflareBindings;
	path: string;
	body: Record<string, unknown>;
}): Promise<BonusEngineApiResult<T>> {
	return bonusEngineAuthedRequest<T>(payload);
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

function asTrimmedString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}
