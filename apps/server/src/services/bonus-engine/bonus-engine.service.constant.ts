
export const BONUS_ENGINE_DEFAULT_BASE_URL =
	"https://bonus-engine-api.iglobalsoft.com/api";

export const BONUS_ENGINE_DEFAULT_CURRENCY = "NGN";

export const BONUS_ENGINE_PATH = {
	ACCESS_TOKEN: "/access_token",
	LOGIN: "/login",
	LOYALTY_POINTS: "/loyalty/points",
	LOYALTY_REDEEM: "/loyalty/redeem",
	LOYALTY_HISTORY: "/loyalty/history",
	LOYALTY_LISTS: "/loyalty/lists",
	MISSION_LIST: "/mission/list",
	LIST_ACTIVE_CAMPAIGN: "/list_active_campaign",
	GETALL_USER_BONUS: "/getall_User_bonus",
	ACTIVATE_BONUS: "/activate_bonus",
	CANCEL_BONUS: "/cancel_bonus",
	DEPOSIT: "/deposit",
	BET: "/bet",
	BET_RESULT: "/betResult",
} as const;

export const BONUS_ENGINE_CALLBACK_PATH = {
	BALANCE: "/bonus-engine/callback/balance",
	UPDATE_BONUS: "/bonus-engine/callback/updateBonus",
	BONUS_ALLOCATION: "/bonus-engine/callback/bonusAllocation",
	LOYALTY_POINTS_UPDATE: "/gamification/callback/loyalty/points-update",
	LOYALTY_LEVEL_UP: "/gamification/callback/loyalty/level-up",
	MISSION_PROGRESS: "/gamification/callback/mission/progress-update",
	MISSION_COMPLETE: "/gamification/callback/mission/complete",
} as const;

export const BONUS_ENGINE_HEADER = {
	TOKEN: "Token",
	SIGNATURE: "Signature",
	CONTENT_TYPE: "Content-Type",
	
	SECURE_DATA: "X-Secure-Data",
} as const;

export const BONUS_ENGINE_REFERENCE_DATA_PATH = {
	GAME_PROVIDERS: "/bem/api/BonusEngine/bonus-engine/casino/game-providers",
	GAMES: "/bem/api/BonusEngine/bonus-engine/casino/games",
	SPORTS: "/bem/api/BonusEngine/bonus-engine/sportsbook/sports",
	CATEGORIES: "/bem/api/BonusEngine/bonus-engine/sportsbook/categories",
	CHAMPIONSHIP: "/bem/api/BonusEngine/bonus-engine/sportsbook/championship",
	EVENTS: "/bem/api/BonusEngine/bonus-engine/sportsbook/events",
	EVENT_MARKETS: "/bem/api/BonusEngine/bonus-engine/sportsbook/events/markets",
} as const;

export const BONUS_ENGINE_FALLBACK_CASINO_PROVIDER = {
	name: "Casino",
	uniqueId: "casino",
	isLiveGame: 0,
} as const;

export const BONUS_ENGINE_PRODUCT_TYPE = {
	CASINO: "casino",
	SPORTSBOOK: "sportsbook",
} as const;

export const BONUS_ENGINE_CAMPAIGN_TYPE = {
	WELCOME: "welcome",
	LOGIN: "login",
	MANUAL: "manual",
	DEPOSIT: "deposit",
	CODE: "code",
	CASHBACK: "cashback",
	FREESPIN: "freespin",
	FREEBET: "freebet",
} as const;

export const BONUS_ENGINE_CAMPAIGN_TYPE_VALUES = [
	BONUS_ENGINE_CAMPAIGN_TYPE.WELCOME,
	BONUS_ENGINE_CAMPAIGN_TYPE.LOGIN,
	BONUS_ENGINE_CAMPAIGN_TYPE.MANUAL,
	BONUS_ENGINE_CAMPAIGN_TYPE.DEPOSIT,
	BONUS_ENGINE_CAMPAIGN_TYPE.CODE,
	BONUS_ENGINE_CAMPAIGN_TYPE.CASHBACK,
	BONUS_ENGINE_CAMPAIGN_TYPE.FREESPIN,
	BONUS_ENGINE_CAMPAIGN_TYPE.FREEBET,
] as const;

export const BONUS_ENGINE_DEFAULT_CAMPAIGN_TYPE =
	BONUS_ENGINE_CAMPAIGN_TYPE.WELCOME;

export const BONUS_ENGINE_REWARD_TYPE = {
	REAL_CASH: "Real Cash",
} as const;

export const BONUS_ENGINE_WALLET_PAYMENT_METHOD = {
	MISSION_REAL_CASH: "bonus_engine_mission",
	BONUS_ACTIVATE: "bonus_engine_bonus",
	BONUS_STATUS: "bonus_engine_bonus_status",
} as const;

export const BONUS_ENGINE_MISSION_REWARD_REFERENCE_PREFIX = "be_mission_reward";

export const BONUS_ENGINE_BONUS_ACTIVATE_REFERENCE_PREFIX = "be_bonus_activate";

export const BONUS_ENGINE_BONUS_STATUS_REFERENCE_PREFIX = "be_bonus_status";

export const BONUS_ENGINE_USER_ACTION = {
	ACTIVATED: "ACTIVATED",
} as const;

export const BONUS_ENGINE_BONUS_STATUS = {
	ACTIVE: "ACTIVE",
	COMPLETED: "COMPLETED",
	EXPIRED: "EXPIRED",
	CANCELED: "CANCELED",
	CANCELLED: "CANCELLED",
	LOST: "LOST",
} as const;

export const BONUS_ENGINE_CALLBACK_MESSAGE = {
	MISSING_FIELDS: "Missing required fields",
	BONUS_STATUS_UPDATED: "Bonus status updated successfully",
	BALANCE_RETRIEVED: "Balance retrieved successfully",
	BONUS_ALLOCATION_UPDATED: "Bonus allocation updated successfully",
	INVALID_JSON: "Invalid JSON body",
} as const;

export const BONUS_ENGINE_UPSTREAM_ROUTE_MISSING =
	"Bonus Engine route not found. Check BONUS_ENGINE_BASE_URL.";

export const BONUS_ENGINE_CONTENT_TYPE_JSON = "application/json";

export const BONUS_ENGINE_INVALID_SIGNATURE_STATUS = 413;

export const BONUS_ENGINE_TOKEN_CACHE_KEY_PREFIX = "bonus-engine:access-token";

export const BONUS_ENGINE_TOKEN_CACHE_TTL_SECONDS = 50 * 60;

export const BONUS_ENGINE_CALLBACK_EVENT_TYPE = {
	LOYALTY_POINTS_UPDATE: "loyalty.points-update",
	LOYALTY_LEVEL_UP: "loyalty.level-up",
	MISSION_PROGRESS: "mission.progress-update",
	MISSION_COMPLETE: "mission.complete",
	BONUS_STATUS_UPDATE: "bonus.status-update",
	BONUS_ALLOCATION: "bonus.allocation",
} as const;

export const BONUS_ENGINE_LOYALTY_PATHS_WITH_QUERY_SIGNATURE = new Set<string>([
	BONUS_ENGINE_PATH.LOYALTY_POINTS,
	BONUS_ENGINE_PATH.LOYALTY_REDEEM,
	BONUS_ENGINE_PATH.LOYALTY_HISTORY,
]);

export const BONUS_ENGINE_BODY_FIELD = {
	CLIENT_ID: "client_id",
	PROJECT_ID: "project_id",
	USER_ID: "user_id",
	POINTS_TO_REDEEM: "points_to_redeem",
	LOYALTY_ID: "loyalty_id",
	BONUS_TYPE: "bonus_type",
	USERBONUS_ID: "userbonus_id",
	BONUS_ID: "bonus_id",
	BONUS_STATUS: "bonus_status",
	BONUS_DATA: "bonus_data",
	REAL_AMOUNT_CHANGE: "real_amount_change",
	BONUS_AMOUNT_CHANGE: "bonus_amount_change",
} as const;

export const BONUS_ENGINE_REPORT_RETRY_ATTEMPTS = 3;

export const BONUS_ENGINE_REPORT_RETRY_DELAYS_MS = [200, 800] as const;
