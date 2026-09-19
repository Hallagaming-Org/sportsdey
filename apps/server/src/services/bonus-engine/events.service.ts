import type { ExecutionContext } from "hono";
import type { CloudflareBindings } from "../../types";
import {
	BONUS_ENGINE_BET_TYPE,
	BONUS_ENGINE_BODY_FIELD,
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
import { bonusEngineRequest } from "./client";
import { getBonusEngineConfig } from "./config";
import { refreshBonusEngineMissionProgressForUser } from "./mission.service";
import { getBonusEngineWalletBalances } from "./persistence.service";
import { getBonusEngineAccessToken } from "./token.service";

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

export async function reportBonusEngineDeposit(payload: {
	env: CloudflareBindings;
	deposit: BonusEngineReportDepositInput;
}): Promise<BonusEngineApiResult<unknown>> {
	return withBonusEngineReportRetries(() =>
		sendBonusEngineDeposit(payload),
	);
}

export async function reportBonusEngineBet(payload: {
	env: CloudflareBindings;
	bet: BonusEngineReportBetInput;
}): Promise<BonusEngineApiResult<unknown>> {
	return withBonusEngineReportRetries(() => sendBonusEngineBet(payload));
}

export async function reportBonusEngineBetResult(payload: {
	env: CloudflareBindings;
	result: BonusEngineReportBetResultInput;
}): Promise<BonusEngineApiResult<unknown>> {
	return withBonusEngineReportRetries(() => sendBonusEngineBetResult(payload));
}

async function sendBonusEngineDeposit(payload: {
	env: CloudflareBindings;
	deposit: BonusEngineReportDepositInput;
}): Promise<BonusEngineApiResult<unknown>> {
	const tokenResult = await getBonusEngineAccessToken(payload.env);
	if (!tokenResult.ok || !tokenResult.data) {
		return {
			ok: false,
			status: tokenResult.status,
			error: tokenResult.error ?? "Failed to obtain Bonus Engine access token",
		};
	}

	const config = getBonusEngineConfig(payload.env);
	const deposit = payload.deposit;

	return bonusEngineRequest({
		env: payload.env,
		path: BONUS_ENGINE_PATH.DEPOSIT,
		accessToken: tokenResult.data,
		body: {
			client_id: config.clientId,
			project_id: config.projectId,
			user_id: deposit.userId,
			amount: deposit.amount,
			transaction_id: deposit.transactionId,
			currency: deposit.currency ?? config.currency,
		},
	});
}

async function sendBonusEngineBet(payload: {
	env: CloudflareBindings;
	bet: BonusEngineReportBetInput;
}): Promise<BonusEngineApiResult<unknown>> {
	const tokenResult = await getBonusEngineAccessToken(payload.env);
	if (!tokenResult.ok || !tokenResult.data) {
		return {
			ok: false,
			status: tokenResult.status,
			error: tokenResult.error ?? "Failed to obtain Bonus Engine access token",
		};
	}

	const config = getBonusEngineConfig(payload.env);
	const bet = await withWalletBalances(payload.env, payload.bet);

	const result = await bonusEngineRequest({
		env: payload.env,
		path: BONUS_ENGINE_PATH.BET,
		accessToken: tokenResult.data,
		body: buildBonusEngineBetReportBody({
			clientId: config.clientId,
			projectId: config.projectId,
			currency: bet.currency ?? config.currency,
			bet,
		}),
	});
	if (result.ok) {
		await refreshBonusEngineMissionProgressForUser({
			env: payload.env,
			userId: bet.userId,
		});
	}
	return result;
}

async function sendBonusEngineBetResult(payload: {
	env: CloudflareBindings;
	result: BonusEngineReportBetResultInput;
}): Promise<BonusEngineApiResult<unknown>> {
	const tokenResult = await getBonusEngineAccessToken(payload.env);
	if (!tokenResult.ok || !tokenResult.data) {
		return {
			ok: false,
			status: tokenResult.status,
			error: tokenResult.error ?? "Failed to obtain Bonus Engine access token",
		};
	}

	const config = getBonusEngineConfig(payload.env);
	const betResult = await withResultWalletBalances(
		payload.env,
		payload.result,
	);

	const result = await bonusEngineRequest({
		env: payload.env,
		path: BONUS_ENGINE_PATH.BET_RESULT,
		accessToken: tokenResult.data,
		body: buildBonusEngineBetResultBody({
			clientId: config.clientId,
			projectId: config.projectId,
			result: betResult,
		}),
	});
	if (result.ok) {
		await refreshBonusEngineMissionProgressForUser({
			env: payload.env,
			userId: betResult.userId,
		});
	}
	return result;
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
		[field.RESULT_TIME]:
			payload.result.resultTime ?? new Date().toISOString(),
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
			bonusWalletBalance:
				bet.bonusWalletBalance ?? balances.bonusWalletBalance,
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
			realWalletBalance:
				result.realWalletBalance ?? balances.realWalletBalance,
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
	for (let attempt = 0; attempt < BONUS_ENGINE_REPORT_RETRY_ATTEMPTS; attempt++) {
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
