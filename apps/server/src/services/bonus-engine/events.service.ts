import type { ExecutionContext } from "hono";
import type { CloudflareBindings } from "../../types";
import {
	BONUS_ENGINE_BODY_FIELD,
	BONUS_ENGINE_PATH,
	BONUS_ENGINE_PRODUCT_TYPE,
	BONUS_ENGINE_REPORT_RETRY_ATTEMPTS,
	BONUS_ENGINE_REPORT_RETRY_DELAYS_MS,
} from "./bonus-engine.service.constant";
import type {
	BonusEngineApiResult,
	BonusEngineReportBetInput,
	BonusEngineReportDepositInput,
} from "./bonus-engine.service.type";
import { bonusEngineRequest } from "./client";
import { getBonusEngineConfig } from "./config";
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
	const bet = payload.bet;

	return bonusEngineRequest({
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
}

/**
 * Build `POST /bet` JSON for Bonus Engine.
 * Casino uses `provider_id` + `game_id`.
 * Sports uses `sport_id`, `event_id`, `league_id` — never `category_id`.
 * Sport, Category, and League Admin rules all match from `sport_id` + `league_id`.
 */
export function buildBonusEngineBetReportBody(payload: {
	clientId: string;
	projectId: string;
	currency: string;
	bet: BonusEngineReportBetInput;
}): Record<string, unknown> {
	const field = BONUS_ENGINE_BODY_FIELD;
	const body: Record<string, unknown> = {
		[field.CLIENT_ID]: payload.clientId,
		[field.PROJECT_ID]: payload.projectId,
		[field.USER_ID]: payload.bet.userId,
		[field.BET_ID]: payload.bet.betId,
		[field.AMOUNT]: payload.bet.amount,
		[field.PRODUCT_TYPE]: payload.bet.productType,
		[field.CURRENCY]: payload.currency,
	};

	if (payload.bet.productType === BONUS_ENGINE_PRODUCT_TYPE.SPORTSBOOK) {
		if (payload.bet.sportId) body[field.SPORT_ID] = payload.bet.sportId;
		if (payload.bet.eventId) body[field.EVENT_ID] = payload.bet.eventId;
		if (payload.bet.leagueId) body[field.LEAGUE_ID] = payload.bet.leagueId;
		return body;
	}

	if (payload.bet.providerId) body[field.PROVIDER_ID] = payload.bet.providerId;
	if (payload.bet.gameId) body[field.GAME_ID] = payload.bet.gameId;
	return body;
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
