const DEFAULT_DEV_SERVER_URL = "http://localhost:3001";
const DEFAULT_STAGING_SERVER_URL = "https://staging-api.sportsdey.com";

/** API / Better Auth origin used by the web app (no trailing slash). */
export function resolveServerUrl(): string {
	const configured =
		import.meta.env.VITE_SERVER_URL ||
		import.meta.env.VITE_API_URL ||
		(typeof window !== "undefined" ? window.location.origin : DEFAULT_DEV_SERVER_URL) ||
		DEFAULT_STAGING_SERVER_URL;

	return configured.replace(/\/$/, "");
}
