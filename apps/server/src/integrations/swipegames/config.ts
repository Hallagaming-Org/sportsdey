export const SWIPEGAMES_STAGING_BASE_URL =
	"https://staging.platform.0.swipegames.io/api/v1";
export const SWIPEGAMES_PRODUCTION_BASE_URL =
	"https://prod.platform.1.swipegames.io/api/v1";

/** Reverse-call source IPs from Swipe Games Integration Adapter docs. */
export const SWIPEGAMES_STAGING_CALLBACK_IPS = ["18.185.156.20"] as const;
export const SWIPEGAMES_PRODUCTION_CALLBACK_IPS = ["3.65.138.8"] as const;

export type SwipeGamesEnvName = "staging" | "production";

export type SwipeGamesConfig = {
	cid: string;
	extCid: string;
	apiKey: string;
	integrationApiKey: string;
	env: SwipeGamesEnvName;
	baseUrl: string;
	allowedIps: string[];
	/** When non-empty, reverse-call IPs must match. */
	ipRestrictionEnabled: boolean;
	proxyUrl?: string;
	proxySecret?: string;
};

export class SwipeGamesIpForbiddenError extends Error {
	constructor(message = "Swipe Games callback IP is not allowed") {
		super(message);
		this.name = "SwipeGamesIpForbiddenError";
	}
}

export class SwipeGamesConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SwipeGamesConfigError";
	}
}

type SwipeGamesEnvSource = {
	SWIPEGAMES_CID?: string;
	SWIPEGAMES_EXT_CID?: string;
	SWIPEGAMES_API_KEY?: string;
	SWIPEGAMES_INTEGRATION_API_KEY?: string;
	SWIPEGAMES_ENV?: string;
	SWIPEGAMES_ALLOWED_IPS?: string;
	PROXY_URL?: string;
	/** DNS-only / origin URL. Prefer this over orange-clouded PROXY_URL so gzip reaches Swipe Games. */
	PROXY_ORIGIN_URL?: string;
	PROXY_SECRET?: string;
};

/**
 * Workers get 403 hitting the nginx origin over plain HTTP. Prefer an https
 * PROXY_URL (proxy.sportsdey.com) unless PROXY_ORIGIN_URL is already https.
 */
export function pickSwipeGamesProxyUrl(
	originUrl?: string,
	proxyUrl?: string,
): string {
	const origin = originUrl?.trim().replace(/\/$/, "") || "";
	const fallback = proxyUrl?.trim().replace(/\/$/, "") || "";
	if (origin.startsWith("https://")) return origin;
	if (fallback.startsWith("https://")) return fallback;
	return origin || fallback;
}

function parseAllowedIps(raw?: string): string[] {
	if (!raw?.trim()) return [];
	return raw
		.split(",")
		.map((ip) => ip.trim())
		.filter(Boolean);
}

function publishedCallbackIps(name: SwipeGamesEnvName): string[] {
	return name === "production"
		? [...SWIPEGAMES_PRODUCTION_CALLBACK_IPS]
		: [...SWIPEGAMES_STAGING_CALLBACK_IPS];
}

/**
 * Empty `SWIPEGAMES_ALLOWED_IPS` uses the published staging/prod IPs.
 * Set `off` or `*` to skip the check (local tests).
 */
export function resolveSwipeGamesAllowedIps(
	name: SwipeGamesEnvName,
	raw?: string,
): string[] {
	const trimmed = raw?.trim();
	if (trimmed === "off" || trimmed === "*") return [];
	if (trimmed) return parseAllowedIps(trimmed);
	return publishedCallbackIps(name);
}

export function isSwipeGamesCallbackIpAllowed(
	clientIp: string,
	config: Pick<SwipeGamesConfig, "allowedIps" | "ipRestrictionEnabled">,
): boolean {
	if (!config.ipRestrictionEnabled) return true;
	if (!clientIp) return false;
	return config.allowedIps.includes(clientIp);
}

export function assertSwipeGamesCallbackIp(
	clientIp: string,
	config: Pick<SwipeGamesConfig, "allowedIps" | "ipRestrictionEnabled">,
): void {
	if (!isSwipeGamesCallbackIpAllowed(clientIp, config)) {
		throw new SwipeGamesIpForbiddenError();
	}
}

export function getSwipeGamesConfig(
	env: SwipeGamesEnvSource,
): SwipeGamesConfig | null {
	const cid = env.SWIPEGAMES_CID?.trim() ?? "";
	const extCid = env.SWIPEGAMES_EXT_CID?.trim() ?? "";
	const apiKey = env.SWIPEGAMES_API_KEY?.trim() ?? "";
	const integrationApiKey = env.SWIPEGAMES_INTEGRATION_API_KEY?.trim() ?? "";
	if (!cid || !extCid || !apiKey || !integrationApiKey) {
		return null;
	}
	const name =
		env.SWIPEGAMES_ENV?.trim().toLowerCase() === "production"
			? "production"
			: "staging";
	const allowedIps = resolveSwipeGamesAllowedIps(
		name,
		env.SWIPEGAMES_ALLOWED_IPS,
	);
	const proxyUrl = pickSwipeGamesProxyUrl(
		env.PROXY_ORIGIN_URL,
		env.PROXY_URL,
	);
	const proxySecret = env.PROXY_SECRET?.trim() ?? "";
	return {
		cid,
		extCid,
		apiKey,
		integrationApiKey,
		env: name,
		baseUrl:
			name === "production"
				? SWIPEGAMES_PRODUCTION_BASE_URL
				: SWIPEGAMES_STAGING_BASE_URL,
		allowedIps,
		ipRestrictionEnabled: allowedIps.length > 0,
		proxyUrl: proxyUrl || undefined,
		proxySecret: proxySecret || undefined,
	};
}

export function requireSwipeGamesConfig(
	env: SwipeGamesEnvSource,
): SwipeGamesConfig {
	const config = getSwipeGamesConfig(env);
	if (!config) {
		throw new SwipeGamesConfigError(
			"Swipe Games is not configured (SWIPEGAMES_CID, SWIPEGAMES_EXT_CID, SWIPEGAMES_API_KEY, SWIPEGAMES_INTEGRATION_API_KEY)",
		);
	}
	return config;
}

export function isSwipeGamesConfigured(env: SwipeGamesEnvSource): boolean {
	return getSwipeGamesConfig(env) !== null;
}
