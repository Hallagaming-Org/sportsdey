/** Local API (Wrangler), not the Vite web port. */
const DEFAULT_DEV_SERVER_URL = "http://localhost:8787";
const PRODUCTION_API_URL = "https://api.sportsdey.com";
const STAGING_API_URL = "https://staging-api.sportsdey.com";

function apiOriginFromHostname(hostname: string): string | null {
	if (hostname === "sportsdey.com" || hostname === "www.sportsdey.com") {
		return PRODUCTION_API_URL;
	}
	if (hostname === "stagingweb.sportsdey.com") {
		return STAGING_API_URL;
	}
	return null;
}

/**
 * API / Better Auth origin used by the web app (no trailing slash).
 * Never fall back to window.location.origin — web and API are different hosts
 * (e.g. stagingweb vs staging-api); that sends /scorpio/* to the frontend and 404s.
 */
export function resolveServerUrl(): string {
	if (typeof window !== "undefined") {
		const fromHost = apiOriginFromHostname(window.location.hostname);
		if (fromHost) return fromHost;
	}

	const configured =
		import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_API_URL;
	if (configured) {
		return configured.replace(/\/$/, "");
	}

	if (import.meta.env.DEV) {
		return DEFAULT_DEV_SERVER_URL;
	}
	if (import.meta.env.MODE === "production") {
		return PRODUCTION_API_URL;
	}
	return STAGING_API_URL;
}

/** Site origin with no trailing slash (web app, not API). */
export function resolvePublicWebUrl(): string {
	if (typeof window !== "undefined") {
		const hostname = window.location.hostname;
		if (hostname === "sportsdey.com" || hostname === "www.sportsdey.com") {
			return "https://sportsdey.com";
		}
		if (hostname === "stagingweb.sportsdey.com") {
			return "https://stagingweb.sportsdey.com";
		}
	}

	const configured = (import.meta.env.VITE_PUBLIC_URL || "").trim();
	return configured.replace(/\/+$/, "");
}

/** Join a public web path, even if VITE_PUBLIC_URL omitted the trailing slash. */
export function publicWebPath(path: string, search = ""): string {
	const base = resolvePublicWebUrl();
	const suffix = path.startsWith("/") ? path : `/${path}`;
	return `${base}${suffix}${search}`;
}
