import type { CloudflareBindings } from "../../types";
import {
	BONUS_ENGINE_BODY_FIELD,
	BONUS_ENGINE_LOYALTY_CASH_REWARD_TYPES,
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
import {
	isBonusEngineJsonNotFound,
	isBonusEngineUnhandledException,
} from "./client";
import { getBonusEngineConfig } from "./config";
import { creditLoyaltyRedemption, majorToKobo } from "./rewards.service";
import { bonusEngineAuthedRequest } from "./token.service";

type BonusEngineEnvelope<T> = {
	success?: boolean;
	status?: number;
	message?: string;
	data?: T;
};

export type LoyaltyRedemptionStatus =
	| "pending"
	| "redeemed"
	| "credited"
	| "engine_fulfilled"
	| "manual_review"
	| "failed";

export type LoyaltyRedeemReward = {
	redemption_id: string;
	type: string;
	amount: number;
	status: Exclude<LoyaltyRedemptionStatus, "pending" | "failed">;
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
}): Promise<
	BonusEngineApiResult<BonusEngineEnvelope<BonusEngineLoyaltyPointsData>>
> {
	const config = getBonusEngineConfig(payload.env);
	return bonusEngineAuthedRequest({
		env: payload.env,
		path: BONUS_ENGINE_PATH.LOYALTY_POINTS,
		body: buildBonusEngineLoyaltyScopedBody({
			clientId: config.clientId,
			projectId: config.projectId,
			userId: payload.userId,
		}),
	});
}

/**
 * What a redemption pays out, from the campaign's Admin mapping:
 * `redeem_levels_value` points buy `point_value` — a naira amount
 * (`point_value_type: cash` / `fix`) or a percentage of the points redeemed, taken
 * one point = ₦1 (`percentage`). Only cash rewards are fulfilled here; other
 * reward kinds (freebet, odds boost, reload) are left to the engine.
 */
export function resolveLoyaltyRedeemReward(payload: {
	campaign: BonusEngineLoyaltyCampaignItem;
	pointsToRedeem: number;
}): { type: string; amountKobo: number; kind: "cash" | "engine" | "unknown" } {
	const campaign = payload.campaign;
	const type = asTrimmedString(campaign.redeem_levels_type).toLowerCase();
	if (!BONUS_ENGINE_LOYALTY_CASH_REWARD_TYPES.has(type)) {
		return { type: type || "unknown", amountKobo: 0, kind: "engine" };
	}

	const valueType = asTrimmedString(campaign.point_value_type).toLowerCase();
	const value = asPositiveNumber(campaign.point_value);
	const cost = asPositiveNumber(campaign.redeem_levels_value);
	let amountMajor = 0;
	if (
		(valueType === "cash" || valueType === "fix" || valueType === "fixed") &&
		value > 0
	) {
		amountMajor = cost > 0 ? (value * payload.pointsToRedeem) / cost : value;
	} else if (valueType === "percentage" && value > 0) {
		amountMajor = (payload.pointsToRedeem * value) / 100;
	}
	const amountKobo = majorToKobo(amountMajor);
	return { type, amountKobo, kind: amountKobo > 0 ? "cash" : "unknown" };
}

/**
 * Redeems loyalty points and fulfils cash rewards into the main wallet.
 *
 * The reward is resolved from the campaign *before* the engine spends any
 * points, and a redemption row is written first, so a crash between the
 * engine debiting points and SportsDey crediting cash is retried by the cron
 * (`reconcileLoyaltyRedemptions`) instead of being lost. The wallet credit is
 * keyed by redemption id, so retries pay once.
 */
export async function redeemBonusEngineLoyaltyPoints(payload: {
	env: CloudflareBindings;
	userId: string;
	pointsToRedeem: number;
	loyaltyId?: string;
}): Promise<
	BonusEngineApiResult<BonusEngineEnvelope<BonusEngineLoyaltyRedeemData>> & {
		reward?: LoyaltyRedeemReward;
	}
> {
	const campaignResult = await findLoyaltyCampaign({
		env: payload.env,
		loyaltyId: payload.loyaltyId,
	});
	if (!campaignResult.ok) {
		return {
			ok: false,
			status: campaignResult.status,
			error: campaignResult.error,
		};
	}

	const reward = resolveLoyaltyRedeemReward({
		campaign: campaignResult.campaign,
		pointsToRedeem: payload.pointsToRedeem,
	});
	const redemptionId = crypto.randomUUID();
	const loyaltyId =
		payload.loyaltyId ?? asTrimmedString(campaignResult.campaign._id) ?? null;
	await payload.env.DB.prepare(
		`INSERT INTO bonus_engine_loyalty_redemption
		 (id, user_id, loyalty_id, points, reward_type, reward_kobo, status)
		 VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
	)
		.bind(
			redemptionId,
			payload.userId,
			loyaltyId || null,
			Math.round(payload.pointsToRedeem),
			reward.type,
			reward.amountKobo,
		)
		.run();

	const config = getBonusEngineConfig(payload.env);
	const result = await bonusEngineAuthedRequest<
		BonusEngineEnvelope<BonusEngineLoyaltyRedeemData>
	>({
		env: payload.env,
		path: BONUS_ENGINE_PATH.LOYALTY_REDEEM,
		body: buildBonusEngineLoyaltyRedeemBody({
			clientId: config.clientId,
			projectId: config.projectId,
			userId: payload.userId,
			pointsToRedeem: payload.pointsToRedeem,
			...(payload.loyaltyId ? { loyaltyId: payload.loyaltyId } : {}),
		}),
	});
	if (!result.ok) {
		await setRedemptionStatus(
			payload.env,
			redemptionId,
			"failed",
			result.error,
		);
		return result;
	}

	await setRedemptionStatus(payload.env, redemptionId, "redeemed");
	const status = await fulfilLoyaltyRedemption({
		env: payload.env,
		redemptionId,
		userId: payload.userId,
		reward,
		loyaltyId: loyaltyId || null,
		points: payload.pointsToRedeem,
	});

	return {
		...result,
		reward: {
			redemption_id: redemptionId,
			type: reward.type,
			amount: status === "credited" ? reward.amountKobo / 100 : 0,
			status,
		},
	};
}

async function fulfilLoyaltyRedemption(payload: {
	env: CloudflareBindings;
	redemptionId: string;
	userId: string;
	reward: {
		type: string;
		amountKobo: number;
		kind: "cash" | "engine" | "unknown";
	};
	loyaltyId: string | null;
	points: number;
}): Promise<Exclude<LoyaltyRedemptionStatus, "pending" | "failed">> {
	if (payload.reward.kind === "engine") {
		await setRedemptionStatus(
			payload.env,
			payload.redemptionId,
			"engine_fulfilled",
		);
		return "engine_fulfilled";
	}
	if (payload.reward.kind === "unknown") {
		console.error(
			JSON.stringify({
				tag: "bonus_engine_reward_unfulfilled",
				source: "loyalty",
				userId: payload.userId,
				redemptionId: payload.redemptionId,
				loyaltyId: payload.loyaltyId,
				rewardType: payload.reward.type,
			}),
		);
		await setRedemptionStatus(
			payload.env,
			payload.redemptionId,
			"manual_review",
		);
		return "manual_review";
	}

	try {
		const credit = await creditLoyaltyRedemption({
			env: payload.env,
			userId: payload.userId,
			redemptionId: payload.redemptionId,
			amountKobo: payload.reward.amountKobo,
			metadata: {
				loyaltyId: payload.loyaltyId,
				points: payload.points,
				rewardType: payload.reward.type,
			},
		});
		if (credit.status === "credited" || credit.status === "already_credited") {
			await setRedemptionStatus(payload.env, payload.redemptionId, "credited");
			return "credited";
		}
		console.error("Loyalty redemption credit blocked", {
			redemptionId: payload.redemptionId,
			status: credit.status,
		});
	} catch (error) {
		console.error("Loyalty redemption credit failed; cron will retry", {
			redemptionId: payload.redemptionId,
			error,
		});
	}
	return "redeemed";
}

/**
 * Retries the wallet credit for redemptions the engine accepted but whose
 * credit did not complete (hourly cron). Credit is keyed by redemption id.
 */
export async function reconcileLoyaltyRedemptions(
	env: CloudflareBindings,
	options?: { now?: Date; limit?: number },
): Promise<{ credited: number }> {
	const now = options?.now ?? new Date();
	const { results } = await env.DB.prepare(
		`SELECT id, user_id, loyalty_id, points, reward_type, reward_kobo
		 FROM bonus_engine_loyalty_redemption
		 WHERE status = 'redeemed' AND updated_at <= ?
		 ORDER BY updated_at LIMIT ?`,
	)
		.bind(now.getTime() - 60_000, options?.limit ?? 50)
		.all<{
			id: string;
			user_id: string;
			loyalty_id: string | null;
			points: number;
			reward_type: string;
			reward_kobo: number;
		}>();

	let credited = 0;
	for (const row of results ?? []) {
		const status = await fulfilLoyaltyRedemption({
			env,
			redemptionId: row.id,
			userId: row.user_id,
			reward: {
				type: row.reward_type,
				amountKobo: Number(row.reward_kobo),
				kind: Number(row.reward_kobo) > 0 ? "cash" : "unknown",
			},
			loyaltyId: row.loyalty_id,
			points: Number(row.points),
		});
		if (status === "credited") credited += 1;
	}
	return { credited };
}

async function setRedemptionStatus(
	env: CloudflareBindings,
	redemptionId: string,
	status: LoyaltyRedemptionStatus,
	error?: string,
): Promise<void> {
	await env.DB.prepare(
		`UPDATE bonus_engine_loyalty_redemption
		 SET status = ?, error = ?, updated_at = cast(unixepoch('subsecond') * 1000 as integer)
		 WHERE id = ?`,
	)
		.bind(status, error ?? null, redemptionId)
		.run();
}

/**
 * The campaign a redemption is priced from: by `loyalty_id`, otherwise the
 * one live campaign (ACTIVE / LIVE and inside its dates).
 */
async function findLoyaltyCampaign(payload: {
	env: CloudflareBindings;
	loyaltyId?: string;
}): Promise<
	| { ok: true; campaign: BonusEngineLoyaltyCampaignItem }
	| { ok: false; status: number; error: string }
> {
	const lists = await getBonusEngineLoyaltyLists({ env: payload.env });
	if (!lists.ok) {
		return {
			ok: false,
			status: lists.status >= 500 ? lists.status : 502,
			error: "Could not load the loyalty reward to redeem. Please try again.",
		};
	}
	const campaigns = Array.isArray(lists.data?.data) ? lists.data.data : [];
	const wanted = payload.loyaltyId?.trim();
	const campaign = wanted
		? campaigns.find((row) => asTrimmedString(row._id) === wanted)
		: campaigns.find(isLiveLoyaltyCampaign);
	if (!campaign) {
		return {
			ok: false,
			status: 400,
			error: "This loyalty reward is not available.",
		};
	}
	return { ok: true, campaign };
}

function isLiveLoyaltyCampaign(row: BonusEngineLoyaltyCampaignItem): boolean {
	const status = asTrimmedString(row.loyalty_status).toUpperCase();
	if (status !== "ACTIVE" && status !== "LIVE") return false;
	const now = Date.now();
	const start = Date.parse(asTrimmedString(row.start_date_time));
	const end = Date.parse(asTrimmedString(row.end_date_time));
	return (
		(Number.isNaN(start) || start <= now) && (Number.isNaN(end) || now <= end)
	);
}

export async function getBonusEngineLoyaltyHistory(payload: {
	env: CloudflareBindings;
	userId: string;
}): Promise<
	BonusEngineApiResult<BonusEngineEnvelope<BonusEngineLoyaltyHistoryItem[]>>
> {
	const config = getBonusEngineConfig(payload.env);
	return bonusEngineAuthedRequest({
		env: payload.env,
		path: BONUS_ENGINE_PATH.LOYALTY_HISTORY,
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
	const config = getBonusEngineConfig(payload.env);
	return bonusEngineAuthedRequest({
		env: payload.env,
		path: BONUS_ENGINE_PATH.LOYALTY_LISTS,
		body: buildBonusEngineLoyaltyProjectBody({
			clientId: config.clientId,
			projectId: config.projectId,
		}),
	});
}

function asTrimmedString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function asPositiveNumber(value: unknown): number {
	const parsed =
		typeof value === "number"
			? value
			: typeof value === "string" && value.trim()
				? Number(value)
				: Number.NaN;
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
