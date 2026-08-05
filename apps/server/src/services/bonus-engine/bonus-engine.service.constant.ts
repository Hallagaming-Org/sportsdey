/** Default Bonus Engine API base (includes `/api` prefix from vendor OpenAPI). */
export const BONUS_ENGINE_DEFAULT_BASE_URL =
	"https://bonus-engine-api.iglobalsoft.com/api";

export const BONUS_ENGINE_DEFAULT_CURRENCY = "NGN";

/** Outbound API path segments relative to `BONUS_ENGINE_BASE_URL`. */
export const BONUS_ENGINE_PATH = {
	ACCESS_TOKEN: "/access_token",
	LOGIN: "/login",
	LOYALTY_POINTS: "/loyalty/points",
	LOYALTY_REDEEM: "/loyalty/redeem",
	LOYALTY_HISTORY: "/loyalty/history",
	MISSION_LIST: "/mission/list",
	DEPOSIT: "/deposit",
	BET: "/bet",
	BET_RESULT: "/betResult",
} as const;

/** Merchant-hosted callback paths (exact Swagger paths). */
export const BONUS_ENGINE_CALLBACK_PATH = {
	BALANCE: "/bonus-engine/callback/balance",
	LOYALTY_POINTS_UPDATE: "/gamification/callback/loyalty/points-update",
	LOYALTY_LEVEL_UP: "/gamification/callback/loyalty/level-up",
	MISSION_PROGRESS: "/gamification/callback/mission/progress-update",
	MISSION_COMPLETE: "/gamification/callback/mission/complete",
} as const;

export const BONUS_ENGINE_HEADER = {
	TOKEN: "Token",
	SIGNATURE: "Signature",
	CONTENT_TYPE: "Content-Type",
	/** Reference-data GETs: RSA-SHA256 over this exact header name string. */
	SECURE_DATA: "X-Secure-Data",
} as const;

/**
 * Merchant-hosted reference-data paths (Admin dropdown catalog).
 * Mounted at the SportsDey API origin configured as the project Callback URL.
 */
export const BONUS_ENGINE_REFERENCE_DATA_PATH = {
	GAME_PROVIDERS: "/bem/api/BonusEngine/bonus-engine/casino/game-providers",
	GAMES: "/bem/api/BonusEngine/bonus-engine/casino/games",
	SPORTS: "/bem/api/BonusEngine/bonus-engine/sportsbook/sports",
	CATEGORIES: "/bem/api/BonusEngine/bonus-engine/sportsbook/categories",
	CHAMPIONSHIP: "/bem/api/BonusEngine/bonus-engine/sportsbook/championship",
	EVENTS: "/bem/api/BonusEngine/bonus-engine/sportsbook/events",
	EVENT_MARKETS: "/bem/api/BonusEngine/bonus-engine/sportsbook/events/markets",
} as const;

/** Fallback casino provider when games have not been re-synced with provider metadata. */
export const BONUS_ENGINE_FALLBACK_CASINO_PROVIDER = {
	name: "Casino",
	uniqueId: "casino",
	isLiveGame: 0,
} as const;

export const BONUS_ENGINE_CONTENT_TYPE_JSON = "application/json";

/** Docs: reject invalid inbound signatures with HTTP 413. */
export const BONUS_ENGINE_INVALID_SIGNATURE_STATUS = 413;

export const BONUS_ENGINE_TOKEN_CACHE_KEY_PREFIX = "bonus-engine:access-token";

/** Access tokens are short-lived; refresh slightly early. */
export const BONUS_ENGINE_TOKEN_CACHE_TTL_SECONDS = 50 * 60;

export const BONUS_ENGINE_CALLBACK_EVENT_TYPE = {
	LOYALTY_POINTS_UPDATE: "loyalty.points-update",
	LOYALTY_LEVEL_UP: "loyalty.level-up",
	MISSION_PROGRESS: "mission.progress-update",
	MISSION_COMPLETE: "mission.complete",
} as const;

/** Loyalty OpenAPI historically documents signature as a query param. */
export const BONUS_ENGINE_LOYALTY_PATHS_WITH_QUERY_SIGNATURE = new Set<string>([
	BONUS_ENGINE_PATH.LOYALTY_POINTS,
	BONUS_ENGINE_PATH.LOYALTY_REDEEM,
	BONUS_ENGINE_PATH.LOYALTY_HISTORY,
]);
