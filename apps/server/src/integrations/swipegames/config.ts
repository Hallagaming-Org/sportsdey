export const SWIPEGAMES_STAGING_BASE_URL =
	"https://staging.platform.0.swipegames.io/api/v1";
export const SWIPEGAMES_PRODUCTION_BASE_URL =
	"https://prod.platform.1.swipegames.io/api/v1";

export type SwipeGamesEnvName = "staging" | "production";

export type SwipeGamesConfig = {
	cid: string;
	extCid: string;
	apiKey: string;
	integrationApiKey: string;
	env: SwipeGamesEnvName;
	baseUrl: string;
};

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
};

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
