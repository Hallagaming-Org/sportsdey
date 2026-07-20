import {
	clearAffnookAttribution,
	getAffnookAttribution,
} from "./attribution";

const resolveApiBaseUrl = () =>
	import.meta.env.DEV
		? "http://localhost:3000/"
		: import.meta.env.VITE_SERVER_URL ||
			import.meta.env.VITE_API_URL ||
			"https://staging-api.sportsdey.com/";

export type AffnookSyncEvent = "registration" | "login";

export async function syncAffnookAuthEvent(
	event: AffnookSyncEvent,
	options?: {
		country?: string;
		city?: string;
		clearAttributionOnSuccess?: boolean;
	},
): Promise<boolean> {
	const attribution = getAffnookAttribution();

	try {
		const response = await fetch(`${resolveApiBaseUrl()}affnook/sync`, {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				event,
				trackingToken: attribution?.trackingToken,
				promocode: attribution?.promocode,
				country: options?.country,
				city: options?.city,
			}),
		});

		if (!response.ok) {
			const text = await response.text().catch(() => "");
			console.error("Affnook sync failed:", response.status, text);
			return false;
		}

		if (options?.clearAttributionOnSuccess !== false && event === "registration") {
			clearAffnookAttribution();
		}

		return true;
	} catch (error) {
		console.error("Affnook sync error:", error);
		return false;
	}
}

/**
 * Prefer registration for brand-new accounts, otherwise login.
 * `createdAt` should be an ISO string or Date from the session user when available.
 */
export function resolveAffnookAuthEvent(
	createdAt?: string | Date | null,
	windowMs = 10 * 60 * 1000,
): AffnookSyncEvent {
	if (!createdAt) return "login";
	const created =
		typeof createdAt === "string" ? new Date(createdAt) : createdAt;
	if (Number.isNaN(created.getTime())) return "login";
	return Date.now() - created.getTime() <= windowMs ? "registration" : "login";
}
