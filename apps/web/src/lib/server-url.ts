/** Local API (Wrangler), not the Vite web port. */
const DEFAULT_DEV_SERVER_URL = "http://localhost:8787";
const DEFAULT_STAGING_SERVER_URL = "https://staging-api.sportsdey.com";

/**
 * API / Better Auth origin used by the web app (no trailing slash).
 * Never fall back to window.location.origin — web and API are different hosts
 * (e.g. stagingweb vs staging-api); that sends /scorpio/* to the frontend and 404s.
 */
export function resolveServerUrl(): string {
	const configured =
		import.meta.env.VITE_SERVER_URL ||
		import.meta.env.VITE_API_URL ||
		(import.meta.env.DEV
			? DEFAULT_DEV_SERVER_URL
			: DEFAULT_STAGING_SERVER_URL);

	return configured.replace(/\/$/, "");
}
