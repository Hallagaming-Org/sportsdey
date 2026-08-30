import type { ExecutionContext } from "hono";
import type { CloudflareBindings } from "../../types";
import {
	BONUS_ENGINE_PATH,
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
		body: {
			client_id: config.clientId,
			project_id: config.projectId,
			user_id: bet.userId,
			bet_id: bet.betId,
			amount: bet.amount,
			product_type: bet.productType,
			currency: bet.currency ?? config.currency,
			provider_id: bet.providerId,
			game_id: bet.gameId,
		},
	});
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
