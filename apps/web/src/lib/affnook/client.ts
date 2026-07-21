import { apiRequest } from "@/lib/api";

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
			country: payload.country || "NG",
			city: payload.city,
		}),
	});
}
