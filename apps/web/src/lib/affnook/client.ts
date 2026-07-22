import { apiRequest } from "@/lib/api";

export const DEFAULT_AFFNOOK_COUNTRY = "NG";

export type AffnookSyncEvent = "registration" | "login";

export type AffnookSyncPayload = {
	event: AffnookSyncEvent;
	promocode?: string;
	trackingToken?: string;
	country?: string;
	city?: string;
};

export type AffnookSyncResult = {
	event: AffnookSyncEvent;
	synced: boolean;
	message: string;
};

/** Sync registration/login attribution to Affnook via our server. */
export async function syncAffnookCustomer(payload: AffnookSyncPayload) {
	return apiRequest<AffnookSyncResult>("affnook/sync", {
		method: "POST",
		credentials: "include",
		body: JSON.stringify({
			event: payload.event,
			promocode: payload.promocode?.trim() || undefined,
			trackingToken: payload.trackingToken?.trim() || undefined,
			country: payload.country || DEFAULT_AFFNOOK_COUNTRY,
			city: payload.city,
		}),
	});
}

/** Registration referral sync used after profile completion / account update. */
export async function syncAffnookRegistrationReferral({
	promocode,
	country = DEFAULT_AFFNOOK_COUNTRY,
}: {
	promocode: string;
	country?: string;
}) {
	const trimmed = promocode.trim();
	if (!trimmed) {
		throw new Error("Referral code is required");
	}
	return syncAffnookCustomer({
		event: "registration",
		promocode: trimmed,
		country,
	});
}
