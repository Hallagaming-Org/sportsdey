import type { CloudflareBindings } from "../../types";
import {
	BONUS_ENGINE_BODY_FIELD,
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
import { bonusEngineRequest } from "./client";
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
}): BonusEngineLoyaltyRedeemBody {
	return {
		...buildBonusEngineLoyaltyScopedBody(payload),
		[BONUS_ENGINE_BODY_FIELD.POINTS_TO_REDEEM]: payload.pointsToRedeem,
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
}): Promise<BonusEngineApiResult<BonusEngineEnvelope<BonusEngineLoyaltyRedeemData>>> {
	return signedLoyaltyRequest({
		env: payload.env,
		path: BONUS_ENGINE_PATH.LOYALTY_REDEEM,
		userId: payload.userId,
		pointsToRedeem: payload.pointsToRedeem,
	});
}

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
				});

	return bonusEngineRequest<T>({
		env: payload.env,
		path: payload.path,
		accessToken: tokenResult.data,
		body,
	});
}
