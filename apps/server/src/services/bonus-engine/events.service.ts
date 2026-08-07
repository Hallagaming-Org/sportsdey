import type { CloudflareBindings } from "../../types";
import { BONUS_ENGINE_PATH } from "./bonus-engine.service.constant";
import type {
	BonusEngineApiResult,
	BonusEngineReportBetInput,
	BonusEngineReportDepositInput,
} from "./bonus-engine.service.type";
import { bonusEngineRequest } from "./client";
import { getBonusEngineConfig } from "./config";
import { getBonusEngineAccessToken } from "./token.service";

/**
 * Reports a deposit event to Bonus Engine (feeds loyalty earning rules).
 * Called fire-and-forget from the Paystack success path in wallet routes.
 */
export async function reportBonusEngineDeposit(payload: {
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

/**
 * Reports a bet event to Bonus Engine (feeds missions and loyalty accrual).
 * Called fire-and-forget from Slotegrator `action=bet` after a successful debit.
 */
export async function reportBonusEngineBet(payload: {
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
