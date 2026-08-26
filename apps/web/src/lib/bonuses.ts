import { apiRequest } from "@/lib/api";
import { BONUS_API_ROUTE } from "@/lib/bonuses.constant";
import {
	normalizeBonusCampaign,
	normalizeUserBonus,
	type BonusCard,
} from "@/lib/bonuses-normalize";

export type { BonusActionKind, BonusCard, BonusKind, BonusStatus } from "@/lib/bonuses-normalize";
export { normalizeBonusCampaign, normalizeUserBonus, resolveBonusAction } from "@/lib/bonuses-normalize";

export async function fetchPlayerBonuses(): Promise<BonusCard[]> {
	const data = await apiRequest<Record<string, unknown>[]>(BONUS_API_ROUTE.LIST, {
		method: "POST",
		credentials: "include",
		body: JSON.stringify({}),
	});
	const rows = Array.isArray(data) ? data : [];
	return rows
		.filter((row) => row && typeof row === "object")
		.map((row, index) => normalizeUserBonus(row, index));
}

export async function fetchBonusCampaigns(payload: {
	bonusType: string;
}): Promise<BonusCard[]> {
	const data = await apiRequest<Record<string, unknown>[]>(
		BONUS_API_ROUTE.CAMPAIGNS,
		{
			method: "POST",
			credentials: "include",
			body: JSON.stringify({ bonus_type: payload.bonusType }),
		},
	);
	const rows = Array.isArray(data) ? data : [];
	return rows
		.filter((row) => row && typeof row === "object")
		.map((row, index) => normalizeBonusCampaign(row, index));
}

export async function activatePlayerBonus(payload: {
	userbonusId: string;
}): Promise<Record<string, unknown>> {
	return apiRequest<Record<string, unknown>>(BONUS_API_ROUTE.ACTIVATE, {
		method: "POST",
		credentials: "include",
		body: JSON.stringify({ userbonus_id: payload.userbonusId }),
	});
}

export async function cancelPlayerBonus(payload: {
	userbonusId: string;
}): Promise<Record<string, unknown>> {
	return apiRequest<Record<string, unknown>>(BONUS_API_ROUTE.CANCEL, {
		method: "POST",
		credentials: "include",
		body: JSON.stringify({ userbonus_id: payload.userbonusId }),
	});
}
