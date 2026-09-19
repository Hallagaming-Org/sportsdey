import { apiRequest } from "@/lib/api";
import { BONUS_API_ROUTE, BONUS_QUERY_KEY, BONUS_TYPE_QUERY_PARAM } from "@/lib/bonuses.constant";
import type { QueryClient } from "@tanstack/react-query";
import {
	normalizeBonusCampaign,
	normalizeUserBonus,
	type BonusCard,
} from "@/lib/bonuses-normalize";

export type { BonusActionKind, BonusCard, BonusKind, BonusStatus } from "@/lib/bonuses-normalize";
export {
	activeAssignedBonuses,
	normalizeBonusCampaign,
	normalizeUserBonus,
	promotionsAssignedBonuses,
	resolveBonusAction,
} from "@/lib/bonuses-normalize";

export async function fetchPlayerBonuses(): Promise<BonusCard[]> {
	const data = await apiRequest<Record<string, unknown>[]>(BONUS_API_ROUTE.LIST, {
		method: "GET",
		credentials: "include",
	});
	const rows = Array.isArray(data) ? data : [];
	return rows
		.filter((row) => row && typeof row === "object")
		.map((row, index) => normalizeUserBonus(row, index));
}


export async function fetchAllUserBonuses(): Promise<Record<string, unknown>[]> {
	try {
		const data = await apiRequest<Record<string, unknown>[]>(
			BONUS_API_ROUTE.GETALL_USER_BONUS,
			{
				method: "GET",
				credentials: "include",
			},
		);
		//console.log("getall_User_bonus", data); this is what we will use to show the bonus balance in the balances section
		return Array.isArray(data) ? data : [];
	} catch (error) {
		console.error("getall_User_bonus failed", error);
		throw error;
	}
}

export async function fetchBonusCampaigns(payload: {
	bonusType: string;
}): Promise<BonusCard[]> {
	const search = new URLSearchParams({
		[BONUS_TYPE_QUERY_PARAM]: payload.bonusType,
	});
	const data = await apiRequest<Record<string, unknown>[]>(
		`${BONUS_API_ROUTE.CAMPAIGNS}?${search.toString()}`,
		{
			method: "GET",
			credentials: "include",
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

export async function invalidateBonusAndWallet(
	queryClient: QueryClient,
): Promise<void> {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: BONUS_QUERY_KEY.LIST }),
		queryClient.invalidateQueries({ queryKey: BONUS_QUERY_KEY.GETALL_USER_BONUS }),
		queryClient.invalidateQueries({ queryKey: BONUS_QUERY_KEY.CAMPAIGNS }),
		queryClient.invalidateQueries({ queryKey: ["wallet"] }),
	]);
}
