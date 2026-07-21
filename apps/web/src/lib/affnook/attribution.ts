const ATTRIBUTION_KEY = "affnook_attribution";
const ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type AffnookAttribution = {
	trackingToken?: string;
	promocode?: string;
	capturedAt: number;
};

function readRaw(): AffnookAttribution | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(ATTRIBUTION_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as AffnookAttribution;
		if (!parsed?.capturedAt) return null;
		if (Date.now() - parsed.capturedAt > ATTRIBUTION_TTL_MS) {
			window.localStorage.removeItem(ATTRIBUTION_KEY);
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

function writeRaw(value: AffnookAttribution) {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(value));
}

/** Capture Affnook tracking params from the current URL and persist them. */
export function captureAffnookAttributionFromUrl(
	search: URLSearchParams | Record<string, unknown> = new URLSearchParams(
		typeof window !== "undefined" ? window.location.search : "",
	),
): AffnookAttribution | null {
	const get = (key: string) => {
		if (search instanceof URLSearchParams) {
			return search.get(key) || undefined;
		}
		const value = search[key];
		return typeof value === "string" && value.length > 0 ? value : undefined;
	};

	const trackingToken =
		get("trackingToken") ||
		get("tracking_token") ||
		get("click_id") ||
		get("clickId") ||
		get("token");

	const promocode = get("promocode") || get("promo_code") || get("promo");

	if (!trackingToken && !promocode) return readRaw();

	const next: AffnookAttribution = {
		trackingToken,
		promocode,
		capturedAt: Date.now(),
	};
	writeRaw(next);
	return next;
}

export function getAffnookAttribution(): AffnookAttribution | null {
	return readRaw();
}

export function clearAffnookAttribution() {
	if (typeof window === "undefined") return;
	window.localStorage.removeItem(ATTRIBUTION_KEY);
}
