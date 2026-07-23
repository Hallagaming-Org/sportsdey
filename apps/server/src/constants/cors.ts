const DEFAULT_CORS_ORIGIN = "https://sportsdey.com";

const STATIC_ALLOWED_ORIGINS = [
	"http://localhost:3001",
	"http://localhost:3002",
	"http://localhost:8787",
	"sportsdey-mobile://",
	"exp://172.20.10.9:8081",
	"https://admin.sportsdey.com",
	"https://staging-admin.sportsdey.com",
	"https://binary.sportsdey.com",
	"https://stagingweb.sportsdey.com",
] as const;

export const CORS_ALLOW_METHODS = "GET, POST, PATCH, OPTIONS, DELETE";
export const CORS_ALLOW_HEADERS = "Authorization, Content-Type";

/** Build the allowlist for browser + native app origins. */
export function getAllowedCorsOrigins(corsOriginEnv?: string): Set<string> {
	return new Set([
		corsOriginEnv || DEFAULT_CORS_ORIGIN,
		...STATIC_ALLOWED_ORIGINS,
	]);
}
