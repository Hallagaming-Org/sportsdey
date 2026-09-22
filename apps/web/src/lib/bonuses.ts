import { apiRequest } from "@/lib/api";
import {
	BONUS_API_ROUTE,
	BONUS_OFFER_DISMISSED_STORAGE_PREFIX,
	BONUS_OFFER_SESSION_CHECKED_PREFIX,
	BONUS_OFFER_TRIGGER_EVENT,
	BONUS_QUERY_KEY,
	BONUS_TYPE_QUERY_PARAM,
	type BonusOfferTrigger,
} from "@/lib/bonuses.constant";
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
	pickReadyBonusOffer,
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

type BonusOfferTriggerDetail = {
	trigger: BonusOfferTrigger;
};

/**
 * Tells the root bonus modal which condition just happened (sign-in vs deposit).
 */
export function dispatchBonusOfferTrigger(trigger: BonusOfferTrigger): void {
	if (typeof window === "undefined") return;
	window.dispatchEvent(
		new CustomEvent<BonusOfferTriggerDetail>(BONUS_OFFER_TRIGGER_EVENT, {
			detail: { trigger },
		}),
	);
}

export function readBonusOfferDismissedIds(userId: string): Set<string> {
	const raw = readSessionValue(`${BONUS_OFFER_DISMISSED_STORAGE_PREFIX}:${userId}`);
	if (!raw) return new Set();
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return new Set();
		return new Set(
			parsed.filter((id): id is string => typeof id === "string" && id.length > 0),
		);
	} catch {
		return new Set();
	}
}

export function writeBonusOfferDismissedIds(payload: {
	userId: string;
	dismissedIds: ReadonlySet<string>;
}): void {
	writeSessionValue(
		`${BONUS_OFFER_DISMISSED_STORAGE_PREFIX}:${payload.userId}`,
		JSON.stringify([...payload.dismissedIds]),
	);
}

export function hasBonusOfferSessionChecked(userId: string): boolean {
	return (
		readSessionValue(`${BONUS_OFFER_SESSION_CHECKED_PREFIX}:${userId}`) === "1"
	);
}

export function markBonusOfferSessionChecked(userId: string): void {
	writeSessionValue(`${BONUS_OFFER_SESSION_CHECKED_PREFIX}:${userId}`, "1");
}

/** Clears per-tab offer state so the next sign-in can prompt again. */
export function clearBonusOfferSession(userId: string): void {
	removeSessionValue(`${BONUS_OFFER_DISMISSED_STORAGE_PREFIX}:${userId}`);
	removeSessionValue(`${BONUS_OFFER_SESSION_CHECKED_PREFIX}:${userId}`);
}

function readSessionValue(key: string): string | null {
	if (typeof window === "undefined") return null;
	try {
		return window.sessionStorage.getItem(key);
	} catch {
		return null;
	}
}

function writeSessionValue(key: string, value: string): void {
	if (typeof window === "undefined") return;
	try {
		window.sessionStorage.setItem(key, value);
	} catch {
		// private mode / quota
	}
}

function removeSessionValue(key: string): void {
	if (typeof window === "undefined") return;
	try {
		window.sessionStorage.removeItem(key);
	} catch {
		// private mode / quota
	}
}
