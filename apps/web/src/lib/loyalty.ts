import { apiRequest } from "@/lib/api";
import { LOYALTY_ROUTE } from "@/lib/loyalty.constant";
import {
	normalizeLoyaltyCampaign,
	normalizeLoyaltyHistoryItem,
	normalizeLoyaltyPoints,
	normalizeLoyaltyRedeem,
	type LoyaltyCampaignCard,
	type LoyaltyHistoryEntry,
	type LoyaltyPointsSummary,
	type LoyaltyRedeemResult,
} from "@/lib/loyalty-normalize";

export type {
	LoyaltyCampaignCard,
	LoyaltyHistoryEntry,
	LoyaltyPointsSummary,
	LoyaltyRedeemOffer,
	LoyaltyRedeemResult,
} from "@/lib/loyalty-normalize";
export {
	applyCampaignLevelsToPointsSummary,
	buildDisplayTiersFromCampaignLevels,
	buildLoyaltyHowItWorksSteps,
	buildLoyaltyRedeemOffers,
	normalizeLoyaltyCampaign,
	normalizeLoyaltyHistoryItem,
	normalizeLoyaltyPoints,
	normalizeLoyaltyRedeem,
	pickPrimaryCampaignLevels,
	resolveTier,
} from "@/lib/loyalty-normalize";

export async function fetchLoyaltyPoints(): Promise<LoyaltyPointsSummary> {
	const data = await apiRequest<Record<string, unknown>>(LOYALTY_ROUTE.POINTS, {
		method: "POST",
		credentials: "include",
		body: JSON.stringify({}),
	});
	return normalizeLoyaltyPoints(data);
}

export async function redeemLoyaltyPoints(payload: {
	pointsToRedeem: number;
}): Promise<LoyaltyRedeemResult> {
	const data = await apiRequest<Record<string, unknown>>(LOYALTY_ROUTE.REDEEM, {
		method: "POST",
		credentials: "include",
		body: JSON.stringify({ points_to_redeem: payload.pointsToRedeem }),
	});
	return normalizeLoyaltyRedeem(data);
}

export async function fetchLoyaltyHistory(): Promise<LoyaltyHistoryEntry[]> {
	const data = await apiRequest<Record<string, unknown>[]>(
		LOYALTY_ROUTE.HISTORY,
		{
			method: "POST",
			credentials: "include",
			body: JSON.stringify({}),
		},
	);
	const rows = Array.isArray(data) ? data : [];
	return rows.map((row, index) => normalizeLoyaltyHistoryItem(row, index));
}

export async function fetchLoyaltyLists(): Promise<LoyaltyCampaignCard[]> {
	const data = await apiRequest<Record<string, unknown>[]>(LOYALTY_ROUTE.LISTS, {
		method: "POST",
		credentials: "include",
		body: JSON.stringify({}),
	});
	const rows = Array.isArray(data) ? data : [];
	return rows
		.filter((row) => row && typeof row === "object")
		.map((row, index) => normalizeLoyaltyCampaign(row, index));
}
