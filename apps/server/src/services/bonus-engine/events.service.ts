import type { ExecutionContext } from "hono";
import type { CloudflareBindings } from "../../types";
import {
	BONUS_ENGINE_BET_TYPE,
	BONUS_ENGINE_BODY_FIELD,
	BONUS_ENGINE_MISSION_REFRESH_DEBOUNCE_SECONDS,
	BONUS_ENGINE_MISSION_REFRESH_KEY_PREFIX,
	BONUS_ENGINE_OUTBOX_BATCH_SIZE,
	BONUS_ENGINE_OUTBOX_KIND,
	BONUS_ENGINE_OUTBOX_MAX_ATTEMPTS,
	BONUS_ENGINE_PATH,
	BONUS_ENGINE_PRODUCT_TYPE,
	BONUS_ENGINE_REPORT_RETRY_ATTEMPTS,
	BONUS_ENGINE_REPORT_RETRY_DELAYS_MS,
} from "./bonus-engine.service.constant";
import type {
	BonusEngineApiResult,
	BonusEngineReportBetInput,
	BonusEngineReportBetResultInput,
	BonusEngineReportDepositInput,
} from "./bonus-engine.service.type";
import { getBonusEngineConfig, isBonusEngineConfigured } from "./config";
import { refreshBonusEngineMissionProgressForUser } from "./mission.service";
import { getBonusEngineWalletBalances } from "./persistence.service";
import { bonusEngineAuthedRequest, getBonusEngineKv } from "./token.service";

export async function runBonusEngineBackground(
	executionCtx: ExecutionContext | undefined,
	work: Promise<unknown>,
): Promise<void> {
	if (typeof executionCtx?.waitUntil === "function") {
		executionCtx.waitUntil(work);
		return;
	}
	await work;
}

/**
 * Reports a deposit (campaign triggers, deposit bonuses, mission/tournament
 * deposit rules). Retries inline, then parks the report in the outbox.
 */
export async function reportBonusEngineDeposit(payload: {
	env: CloudflareBindings;
	deposit: BonusEngineReportDepositInput;
}): Promise<BonusEngineApiResult<unknown>> {
	const result = await withBonusEngineReportRetries(() =>
		sendBonusEngineDeposit(payload),
	);
	await parkFailedReport(payload.env, result, {
		kind: BONUS_ENGINE_OUTBOX_KIND.DEPOSIT,
		dedupeKey: `deposit:${payload.deposit.transactionId}`,
		input: payload.deposit,
	});
	return result;
}

export async function reportBonusEngineBet(payload: {
	env: CloudflareBindings;
	bet: BonusEngineReportBetInput;
}): Promise<BonusEngineApiResult<unknown>> {
	const result = await withBonusEngineReportRetries(() =>
		sendBonusEngineBet(payload),
	);
	await parkFailedReport(payload.env, result, {
		kind: BONUS_ENGINE_OUTBOX_KIND.BET,
		dedupeKey: `bet:${payload.bet.betId}`,
		input: payload.bet,
	});
	return result;
}

export async function reportBonusEngineBetResult(payload: {
	env: CloudflareBindings;
	result: BonusEngineReportBetResultInput;
}): Promise<BonusEngineApiResult<unknown>> {
	const result = await withBonusEngineReportRetries(() =>
		sendBonusEngineBetResult(payload),
	);
	const flags = `${payload.result.isRollback ?? 0}${payload.result.isResettle ?? 0}${payload.result.isUnsettle ?? 0}`;
	await parkFailedReport(payload.env, result, {
		kind: BONUS_ENGINE_OUTBOX_KIND.BET_RESULT,
		dedupeKey: `bet_result:${payload.result.betId}:${flags}`,
		input: payload.result,
	});
	return result;
}

/**
 * Re-sends reports parked in the outbox (hourly cron). Delivered or
 * permanently rejected rows leave the queue; transient failures back off and
 * are marked `dead` after BONUS_ENGINE_OUTBOX_MAX_ATTEMPTS for ops to review.
 */
export async function drainBonusEngineOutbox(
	env: CloudflareBindings,
	options?: { now?: Date; limit?: number },
): Promise<{ delivered: number; retried: number; dead: number }> {
	const stats = { delivered: 0, retried: 0, dead: 0 };
	if (!isBonusEngineConfigured(env)) return stats;

	const now = options?.now ?? new Date();
	const { results } = await env.DB.prepare(
		`SELECT id, kind, payload_json, attempts FROM bonus_engine_outbox
		 WHERE status = 'pending' AND next_attempt_at <= ?
		 ORDER BY next_attempt_at LIMIT ?`,
	)
		.bind(now.getTime(), options?.limit ?? BONUS_ENGINE_OUTBOX_BATCH_SIZE)
		.all<{
			id: string;
			kind: string;
			payload_json: string;
			attempts: number;
		}>();

	for (const row of results ?? []) {
		let result: BonusEngineApiResult<unknown>;
		try {
			result = await sendOutboxRow(env, row.kind, row.payload_json);
		} catch (error) {
			result = {
				ok: false,
				status: 500,
				error: error instanceof Error ? error.message : String(error),
			};
		}

		if (result.ok || !isRetryableReportFailure(result)) {
			await env.DB.prepare(
				result.ok
					? "DELETE FROM bonus_engine_outbox WHERE id = ?"
					: "UPDATE bonus_engine_outbox SET status = 'dead', last_error = ? WHERE id = ?",
			)
				.bind(...(result.ok ? [row.id] : [result.error ?? "rejected", row.id]))
				.run();
			if (result.ok) stats.delivered += 1;
			else stats.dead += 1;
			continue;
		}

		const attempts = Number(row.attempts) + 1;
		const dead = attempts >= BONUS_ENGINE_OUTBOX_MAX_ATTEMPTS;
		await env.DB.prepare(
			`UPDATE bonus_engine_outbox
			 SET attempts = ?, last_error = ?, status = ?, next_attempt_at = ?
			 WHERE id = ?`,
		)
			.bind(
				attempts,
				result.error ?? `status ${result.status}`,
				dead ? "dead" : "pending",
				now.getTime() + outboxBackoffMs(attempts),
				row.id,
			)
			.run();
		if (dead) stats.dead += 1;
		else stats.retried += 1;
	}

	if (stats.dead > 0) {
		console.error(
			JSON.stringify({ tag: "bonus_engine_outbox_dead_letters", ...stats }),
		);
	}
	return stats;
}

function sendOutboxRow(
	env: CloudflareBindings,
	kind: string,
	payloadJson: string,
): Promise<BonusEngineApiResult<unknown>> {
	const input = JSON.parse(payloadJson) as unknown;
	switch (kind) {
		case BONUS_ENGINE_OUTBOX_KIND.BET:
			return sendBonusEngineBet({
				env,
				bet: input as BonusEngineReportBetInput,
			});
		case BONUS_ENGINE_OUTBOX_KIND.BET_RESULT:
			return sendBonusEngineBetResult({
				env,
				result: input as BonusEngineReportBetResultInput,
			});
		case BONUS_ENGINE_OUTBOX_KIND.DEPOSIT:
			return sendBonusEngineDeposit({
				env,
				deposit: input as BonusEngineReportDepositInput,
			});
		default:
			return Promise.resolve({
				ok: false,
				status: 400,
				error: `Unknown outbox kind: ${kind}`,
			});
	}
}

/** 5 min, 10 min, 20 min … capped at 6 h. */
function outboxBackoffMs(attempts: number): number {
	return Math.min(6 * 60 * 60 * 1000, 5 * 60 * 1000 * 2 ** (attempts - 1));
}

/**
 * Parks a report that exhausted its inline retries on a transient failure, so
 * mission / wagering progress is delayed instead of lost. Never throws.
 */
async function parkFailedReport(
	env: CloudflareBindings,
	result: BonusEngineApiResult<unknown>,
	entry: { kind: string; dedupeKey: string; input: unknown },
): Promise<void> {
	if (result.ok || !isRetryableReportFailure(result)) return;
	if (!isBonusEngineConfigured(env)) return;
	try {
		await env.DB.prepare(
			`INSERT OR IGNORE INTO bonus_engine_outbox
			 (id, kind, dedupe_key, payload_json, status, attempts, last_error, next_attempt_at)
			 VALUES (?, ?, ?, ?, 'pending', 0, ?, ?)`,
		)
			.bind(
				crypto.randomUUID(),
				entry.kind,
				entry.dedupeKey,
				JSON.stringify(entry.input),
				result.error ?? `status ${result.status}`,
				Date.now() + outboxBackoffMs(1),
			)
			.run();
	} catch (error) {
		console.error("Bonus Engine outbox enqueue failed", {
			dedupeKey: entry.dedupeKey,
			error,
		});
	}
}

function isRetryableReportFailure(result: BonusEngineApiResult<unknown>) {
	return (
		result.status === 429 ||
		result.status >= 500 ||
		result.status === 0 ||
		result.status === 401 ||
		result.status === 403
	);
}

/**
 * Posts `POST /deposit`. Amount is `deposit` in major units, and the balances
 * are the wallet after this credit. `campaign_code` is included only when the
 * player entered one; a blank code is the same as a missing field to the engine.
 */
async function sendBonusEngineDeposit(payload: {
	env: CloudflareBindings;
	deposit: BonusEngineReportDepositInput;
}): Promise<BonusEngineApiResult<unknown>> {
	const config = getBonusEngineConfig(payload.env);
	const deposit = payload.deposit;
	const balances = await getBonusEngineWalletBalances({
		env: payload.env,
		userId: deposit.userId,
	});
	const campaignCode = deposit.campaignCode?.trim();

	return bonusEngineAuthedRequest({
		env: payload.env,
		path: BONUS_ENGINE_PATH.DEPOSIT,
		body: {
			client_id: config.clientId,
			project_id: config.projectId,
			payment_provider: deposit.paymentProvider || "all",
			currency: deposit.currency ?? config.currency,
			user_id: deposit.userId,
			deposit: deposit.amount,
			...(campaignCode ? { campaign_code: campaignCode } : {}),
			real_wallet_balance: balances.realWalletBalance,
			bonus_wallet_balance: balances.bonusWalletBalance,
			transaction_id: deposit.transactionId,
		},
	});
}

async function sendBonusEngineBet(payload: {
	env: CloudflareBindings;
	bet: BonusEngineReportBetInput;
}): Promise<BonusEngineApiResult<unknown>> {
	const config = getBonusEngineConfig(payload.env);
	const bet = await withWalletBalances(payload.env, payload.bet);

	const result = await bonusEngineAuthedRequest({
		env: payload.env,
		path: BONUS_ENGINE_PATH.BET,
		body: buildBonusEngineBetReportBody({
			clientId: config.clientId,
			projectId: config.projectId,
			currency: bet.currency ?? config.currency,
			bet,
		}),
	});
	if (result.ok) {
		await refreshMissionProgressDebounced(payload.env, bet.userId);
	}
	return result;
}

async function sendBonusEngineBetResult(payload: {
	env: CloudflareBindings;
	result: BonusEngineReportBetResultInput;
}): Promise<BonusEngineApiResult<unknown>> {
	const config = getBonusEngineConfig(payload.env);
	const betResult = await withResultWalletBalances(payload.env, payload.result);

	const result = await bonusEngineAuthedRequest({
		env: payload.env,
		path: BONUS_ENGINE_PATH.BET_RESULT,
		body: buildBonusEngineBetResultBody({
			clientId: config.clientId,
			projectId: config.projectId,
			result: betResult,
		}),
	});
	if (result.ok) {
		await refreshMissionProgressDebounced(payload.env, betResult.userId);
	}
	return result;
}

/** Per D1 binding, so isolated databases (tests, envs) never share windows. */
const recentMissionRefreshesByDb = new WeakMap<object, Map<string, number>>();

/**
 * Bet callbacks are the hot path, and a refresh costs `/mission/list` plus one
 * `/mission/progress` per mission. The engine also pushes progress callbacks,
 * so refresh at most once per player per window.
 */
async function refreshMissionProgressDebounced(
	env: CloudflareBindings,
	userId: string,
): Promise<void> {
	const windowMs = BONUS_ENGINE_MISSION_REFRESH_DEBOUNCE_SECONDS * 1000;
	const now = Date.now();
	let recentMissionRefreshes = recentMissionRefreshesByDb.get(env.DB);
	if (!recentMissionRefreshes) {
		recentMissionRefreshes = new Map();
		recentMissionRefreshesByDb.set(env.DB, recentMissionRefreshes);
	}
	const last = recentMissionRefreshes.get(userId);
	if (last !== undefined && now - last < windowMs) return;
	recentMissionRefreshes.set(userId, now);
	if (recentMissionRefreshes.size > 5_000) {
		for (const [key, at] of recentMissionRefreshes) {
			if (now - at >= windowMs) recentMissionRefreshes.delete(key);
		}
	}

	const kv = getBonusEngineKv(env);
	if (kv) {
		const key = `${BONUS_ENGINE_MISSION_REFRESH_KEY_PREFIX}:${userId}`;
		try {
			if (await kv.get(key)) return;
			await kv.put(key, "1", {
				expirationTtl: BONUS_ENGINE_MISSION_REFRESH_DEBOUNCE_SECONDS,
			});
		} catch (error) {
			console.error("Mission refresh debounce KV failed", { userId, error });
		}
	}

	await refreshBonusEngineMissionProgressForUser({ env, userId });
}

/**
 * Build `POST /bet` JSON for Bonus Engine.
 * Casino uses `provider_id` + `game_id`.
 * Sports uses `sport_id`, `event_id`, `league_id` — never `category_id`.
 */
export function buildBonusEngineBetReportBody(payload: {
	clientId: string;
	projectId: string;
	currency: string;
	bet: BonusEngineReportBetInput;
}): Record<string, unknown> {
	const field = BONUS_ENGINE_BODY_FIELD;
	const realBetAmount =
		payload.bet.realBetAmount ??
		(Number.isFinite(payload.bet.amount) ? payload.bet.amount : 0);
	const bonusBetAmount = payload.bet.bonusBetAmount ?? 0;
	const body: Record<string, unknown> = {
		[field.CLIENT_ID]: payload.clientId,
		[field.PROJECT_ID]: payload.projectId,
		[field.USER_ID]: payload.bet.userId,
		[field.BET_ID]: payload.bet.betId,
		[field.INTERNAL_BET_ID]: payload.bet.internalBetId ?? payload.bet.betId,
		[field.PRODUCT_TYPE]: payload.bet.productType,
		[field.BET_TYPE]: payload.bet.betType ?? BONUS_ENGINE_BET_TYPE.NORMAL,
		[field.REAL_BET_AMOUNT]: realBetAmount,
		[field.BONUS_BET_AMOUNT]: bonusBetAmount,
		[field.CURRENCY]: payload.currency,
	};

	if (payload.bet.realWalletBalance !== undefined) {
		body[field.REAL_WALLET_BALANCE] = payload.bet.realWalletBalance;
	}
	if (payload.bet.bonusWalletBalance !== undefined) {
		body[field.BONUS_WALLET_BALANCE] = payload.bet.bonusWalletBalance;
	}

	if (payload.bet.productType === BONUS_ENGINE_PRODUCT_TYPE.SPORTSBOOK) {
		if (payload.bet.sportId) body[field.SPORT_ID] = payload.bet.sportId;
		if (payload.bet.eventId) body[field.EVENT_ID] = payload.bet.eventId;
		if (payload.bet.leagueId) body[field.LEAGUE_ID] = payload.bet.leagueId;
		if (payload.bet.marketId) body[field.MARKET_ID] = payload.bet.marketId;
		if (payload.bet.odds) body[field.ODDS] = payload.bet.odds;
		if (payload.bet.ticket) body[field.TICKET] = payload.bet.ticket;
		return body;
	}

	if (payload.bet.providerId) body[field.PROVIDER_ID] = payload.bet.providerId;
	if (payload.bet.gameId) body[field.GAME_ID] = payload.bet.gameId;
	return body;
}

export function buildBonusEngineBetResultBody(payload: {
	clientId: string;
	projectId: string;
	result: BonusEngineReportBetResultInput;
}): Record<string, unknown> {
	const field = BONUS_ENGINE_BODY_FIELD;
	const totalWinAmount = payload.result.totalWinAmount;
	const realWinAmount = payload.result.realWinAmount ?? totalWinAmount;
	const bonusWinAmount = payload.result.bonusWinAmount ?? 0;
	const body: Record<string, unknown> = {
		[field.CLIENT_ID]: payload.clientId,
		[field.PROJECT_ID]: payload.projectId,
		[field.USER_ID]: payload.result.userId,
		[field.BET_ID]: payload.result.betId,
		[field.INTERNAL_BET_ID]:
			payload.result.internalBetId ?? payload.result.betId,
		[field.TOTAL_WIN_AMOUNT]: totalWinAmount,
		[field.REAL_WIN_AMOUNT]: realWinAmount,
		[field.BONUS_WIN_AMOUNT]: bonusWinAmount,
		[field.IS_WIN]: payload.result.isWin,
		[field.IS_RESETTLE]: payload.result.isResettle ?? 0,
		[field.IS_UNSETTLE]: payload.result.isUnsettle ?? 0,
		[field.IS_ROLLBACK]: payload.result.isRollback ?? 0,
		[field.RESULT_TIME]: payload.result.resultTime ?? new Date().toISOString(),
	};
	if (payload.result.realWalletBalance !== undefined) {
		body[field.REAL_WALLET_BALANCE] = payload.result.realWalletBalance;
	}
	if (payload.result.bonusWalletBalance !== undefined) {
		body[field.BONUS_WALLET_BALANCE] = payload.result.bonusWalletBalance;
	}
	return body;
}

async function withWalletBalances(
	env: CloudflareBindings,
	bet: BonusEngineReportBetInput,
): Promise<BonusEngineReportBetInput> {
	if (
		bet.realWalletBalance !== undefined &&
		bet.bonusWalletBalance !== undefined
	) {
		return bet;
	}
	try {
		const balances = await getBonusEngineWalletBalances({
			env,
			userId: bet.userId,
		});
		return {
			...bet,
			realWalletBalance: bet.realWalletBalance ?? balances.realWalletBalance,
			bonusWalletBalance: bet.bonusWalletBalance ?? balances.bonusWalletBalance,
		};
	} catch {
		return bet;
	}
}

async function withResultWalletBalances(
	env: CloudflareBindings,
	result: BonusEngineReportBetResultInput,
): Promise<BonusEngineReportBetResultInput> {
	if (
		result.realWalletBalance !== undefined &&
		result.bonusWalletBalance !== undefined
	) {
		return result;
	}
	try {
		const balances = await getBonusEngineWalletBalances({
			env,
			userId: result.userId,
		});
		return {
			...result,
			realWalletBalance: result.realWalletBalance ?? balances.realWalletBalance,
			bonusWalletBalance:
				result.bonusWalletBalance ?? balances.bonusWalletBalance,
		};
	} catch {
		return result;
	}
}

async function withBonusEngineReportRetries(
	send: () => Promise<BonusEngineApiResult<unknown>>,
): Promise<BonusEngineApiResult<unknown>> {
	let last: BonusEngineApiResult<unknown> | undefined;
	for (
		let attempt = 0;
		attempt < BONUS_ENGINE_REPORT_RETRY_ATTEMPTS;
		attempt++
	) {
		last = await send();
		if (last.ok) return last;
		const isRetryable =
			last.status === 429 || last.status >= 500 || last.status === 0;
		if (!isRetryable) return last;
		const delayMs = BONUS_ENGINE_REPORT_RETRY_DELAYS_MS[attempt];
		if (delayMs === undefined) break;
		await sleep(delayMs);
	}
	return (
		last ?? {
			ok: false,
			status: 502,
			error: "Bonus Engine report failed",
		}
	);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}
