import type { CloudflareBindings } from "../../types";
import { BONUS_ENGINE_PATH } from "./bonus-engine.service.constant";
import type {
	BonusEngineApiResult,
	BonusEngineLoyaltyHistoryItem,
	BonusEngineLoyaltyPointsData,
	BonusEngineLoyaltyRedeemData,
} from "./bonus-engine.service.type";
import { bonusEngineRequest } from "./client";
import { getBonusEngineConfig } from "./config";
import { getBonusEngineAccessToken } from "./token.service";

type BonusEngineEnvelope<T> = {
	success?: boolean;
	status?: number;
	message?: string;
	data?: T;
};

/**
 * Fetches current loyalty points and VIP level for a player from Bonus Engine.
 */
export async function getBonusEngineLoyaltyPoints(payload: {
	env: CloudflareBindings;
	userId: string;
}): Promise<BonusEngineApiResult<BonusEngineEnvelope<BonusEngineLoyaltyPointsData>>> {
	return signedLoyaltyRequest({
		env: payload.env,
		path: BONUS_ENGINE_PATH.LOYALTY_POINTS,
		userId: payload.userId,
	});
}

/**
 * Redeems loyalty points for configured rewards on Bonus Engine.
 */
export async function redeemBonusEngineLoyaltyPoints(payload: {
	env: CloudflareBindings;
	userId: string;
	pointsToRedeem: number;
}): Promise<BonusEngineApiResult<BonusEngineEnvelope<BonusEngineLoyaltyRedeemData>>> {
	return signedLoyaltyRequest({
		env: payload.env,
		path: BONUS_ENGINE_PATH.LOYALTY_REDEEM,
		userId: payload.userId,
		extraBody: { points_to_redeem: payload.pointsToRedeem },
	});
}

/**
 * Fetches loyalty earn/redeem history for a player from Bonus Engine.
 */
export async function getBonusEngineLoyaltyHistory(payload: {
	env: CloudflareBindings;
	userId: string;
}): Promise<
	BonusEngineApiResult<BonusEngineEnvelope<BonusEngineLoyaltyHistoryItem[]>>
> {
	return signedLoyaltyRequest({
		env: payload.env,
		path: BONUS_ENGINE_PATH.LOYALTY_HISTORY,
		userId: payload.userId,
	});
}

async function signedLoyaltyRequest<T>(payload: {
	env: CloudflareBindings;
	path: string;
	userId: string;
	extraBody?: Record<string, unknown>;
}): Promise<BonusEngineApiResult<T>> {
	const tokenResult = await getBonusEngineAccessToken(payload.env);
	if (!tokenResult.ok || !tokenResult.data) {
		return {
			ok: false,
			status: tokenResult.status,
			error: tokenResult.error ?? "Failed to obtain Bonus Engine access token",
		};
	}

	const config = getBonusEngineConfig(payload.env);
	return bonusEngineRequest<T>({
		env: payload.env,
		path: payload.path,
		accessToken: tokenResult.data,
		body: {
			client_id: config.clientId,
			project_id: config.projectId,
			user_id: payload.userId,
			...(payload.extraBody ?? {}),
		},
	});
}
