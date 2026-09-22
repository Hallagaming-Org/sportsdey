import type { CloudflareBindings } from "../../types";
import {
	BONUS_ENGINE_BODY_FIELD,
	BONUS_ENGINE_LOYALTY_MESSAGE,
	BONUS_ENGINE_PATH,
} from "./bonus-engine.service.constant";
import type {
	BonusEngineApiResult,
	BonusEngineLoyaltyCampaignItem,
	BonusEngineLoyaltyHistoryItem,
	BonusEngineLoyaltyPointsData,
	BonusEngineLoyaltyProjectBody,
	BonusEngineLoyaltyRedeemBody,
	BonusEngineLoyaltyRedeemData,
	BonusEngineLoyaltyScopedBody,
} from "./bonus-engine.service.type";
import { bonusEngineRequest, isBonusEngineJsonNotFound, isBonusEngineUnhandledException } from "./client";
import { getBonusEngineConfig } from "./config";
import { getBonusEngineAccessToken } from "./token.service";

type BonusEngineEnvelope<T> = {
	success?: boolean;
	status?: number;
	message?: string;
	data?: T;
};

export function buildBonusEngineLoyaltyScopedBody(payload: {
	clientId: string;
	projectId: string;
	userId: string;
}): BonusEngineLoyaltyScopedBody {
	return {
		[BONUS_ENGINE_BODY_FIELD.CLIENT_ID]: payload.clientId,
		[BONUS_ENGINE_BODY_FIELD.PROJECT_ID]: payload.projectId,
		[BONUS_ENGINE_BODY_FIELD.USER_ID]: payload.userId,
	};
}

export function buildBonusEngineLoyaltyProjectBody(payload: {
	clientId: string;
	projectId: string;
}): BonusEngineLoyaltyProjectBody {
	return {
		[BONUS_ENGINE_BODY_FIELD.CLIENT_ID]: payload.clientId,
		[BONUS_ENGINE_BODY_FIELD.PROJECT_ID]: payload.projectId,
	};
}

export function buildBonusEngineLoyaltyRedeemBody(payload: {
	clientId: string;
	projectId: string;
	userId: string;
	pointsToRedeem: number;
	loyaltyId?: string;
}): BonusEngineLoyaltyRedeemBody {
	return {
		...buildBonusEngineLoyaltyScopedBody(payload),
		[BONUS_ENGINE_BODY_FIELD.POINTS_TO_REDEEM]: payload.pointsToRedeem,
		...(payload.loyaltyId
			? { [BONUS_ENGINE_BODY_FIELD.LOYALTY_ID]: payload.loyaltyId }
			: {}),
	};
}

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

export async function redeemBonusEngineLoyaltyPoints(payload: {
	env: CloudflareBindings;
	userId: string;
	pointsToRedeem: number;
	loyaltyId?: string;
}): Promise<BonusEngineApiResult<BonusEngineEnvelope<BonusEngineLoyaltyRedeemData>>> {
	return signedLoyaltyRequest({
		env: payload.env,
		path: BONUS_ENGINE_PATH.LOYALTY_REDEEM,
		userId: payload.userId,
		pointsToRedeem: payload.pointsToRedeem,
		loyaltyId: payload.loyaltyId,
	});
}

export async function getBonusEngineLoyaltyHistory(payload: {
	env: CloudflareBindings;
	userId: string;
}): Promise<
	BonusEngineApiResult<BonusEngineEnvelope<BonusEngineLoyaltyHistoryItem[]>>
> {
	const tokenResult = await getBonusEngineAccessToken(payload.env);
	if (!tokenResult.ok || !tokenResult.data) {
		return {
			ok: false,
			status: tokenResult.status,
			error: tokenResult.error ?? "Failed to obtain Bonus Engine access token",
		};
	}

	const config = getBonusEngineConfig(payload.env);
	return bonusEngineRequest({
		env: payload.env,
		path: BONUS_ENGINE_PATH.LOYALTY_HISTORY,
		accessToken: tokenResult.data,
		body: buildBonusEngineLoyaltyScopedBody({
			clientId: config.clientId,
			projectId: config.projectId,
			userId: payload.userId,
		}),
	});
}

/**
 * True when Bonus Engine failed a history read in a way that means "no rows"
 * (JSON 404, null crash, or their generic fetch error) rather than a
 * misconfigured host. The BFF maps these to an empty list.
 */
export function shouldTreatLoyaltyHistoryAsEmpty(
	result: BonusEngineApiResult<unknown>,
): boolean {
	if (result.ok) return false;
	if (isBonusEngineJsonNotFound(result)) return true;
	if (isBonusEngineUnhandledException(result.error)) return true;
	return isLoyaltyHistoryEmptyEngineError(result.error);
}

function isLoyaltyHistoryEmptyEngineError(error?: string): boolean {
	const message = error?.trim().toLowerCase() ?? "";
	if (!message) return false;
	return (
		message ===
			BONUS_ENGINE_LOYALTY_MESSAGE.HISTORY_ENGINE_FETCH_FAILED.toLowerCase() ||
		message.includes("fetching loyalty history") ||
		message.includes("no loyalty history") ||
		message.includes("history not found")
	);
}

export async function getBonusEngineLoyaltyLists(payload: {
	env: CloudflareBindings;
}): Promise<
	BonusEngineApiResult<BonusEngineEnvelope<BonusEngineLoyaltyCampaignItem[]>>
> {
	const tokenResult = await getBonusEngineAccessToken(payload.env);
	if (!tokenResult.ok || !tokenResult.data) {
		return {
			ok: false,
			status: tokenResult.status,
			error: tokenResult.error ?? "Failed to obtain Bonus Engine access token",
		};
	}

	const config = getBonusEngineConfig(payload.env);
	return bonusEngineRequest({
		env: payload.env,
		path: BONUS_ENGINE_PATH.LOYALTY_LISTS,
		accessToken: tokenResult.data,
		body: buildBonusEngineLoyaltyProjectBody({
			clientId: config.clientId,
			projectId: config.projectId,
		}),
	});
}

async function signedLoyaltyRequest<T>(payload: {
	env: CloudflareBindings;
	path: string;
	userId: string;
	pointsToRedeem?: number;
	loyaltyId?: string;
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
	const body =
		payload.pointsToRedeem === undefined
			? buildBonusEngineLoyaltyScopedBody({
					clientId: config.clientId,
					projectId: config.projectId,
					userId: payload.userId,
				})
			: buildBonusEngineLoyaltyRedeemBody({
					clientId: config.clientId,
					projectId: config.projectId,
					userId: payload.userId,
					pointsToRedeem: payload.pointsToRedeem,
					...(payload.loyaltyId ? { loyaltyId: payload.loyaltyId } : {}),
				});

	return bonusEngineRequest<T>({
		env: payload.env,
		path: payload.path,
		accessToken: tokenResult.data,
		body,
	});
}
