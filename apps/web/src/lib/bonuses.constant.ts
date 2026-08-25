export const BONUS_API_ROUTE = {
	CAMPAIGNS: "bonus/campaigns",
	LIST: "bonus/list",
	ACTIVATE: "bonus/activate",
	CANCEL: "bonus/cancel",
} as const;

export const BONUS_PLAY_ROUTE = {
	SPORTS: "/sportsbetting",
	CASINO: "/games",
	WALLET: "/wallet",
} as const;

export const BONUS_PLAY_SEARCH_KEY = "play" as const;

export const BONUS_KIND = {
	ASSIGNMENT: "assignment",
	CAMPAIGN: "campaign",
} as const;

export const BONUS_STATUS = {
	AVAILABLE: "available",
	READY: "ready",
	ACTIVE: "active",
	COMPLETED: "completed",
	CANCELLED: "cancelled",
	EXPIRED: "expired",
} as const;

export const BONUS_STATUS_LABEL = {
	AVAILABLE: "Offer",
	READY: "Ready to activate",
	ACTIVE: "Active",
	COMPLETED: "Completed",
	CANCELLED: "Cancelled",
	EXPIRED: "Expired",
} as const;

export const BONUS_ACTION_LABEL = {
	ACTIVATE: "Activate",
	CANCEL: "Cancel bonus",
	SPORTS: "Go to Sports",
	CASINO: "Go to Casino",
	DEPOSIT: "Deposit Now",
	PLAY: "Play Now",
} as const;

export const BONUS_USER_ACTION = {
	ACTIVATED: "ACTIVATED",
	CANCELLED: "CANCELLED",
} as const;

export const BONUS_ENGINE_STATUS = {
	ACTIVE: "ACTIVE",
	COMPLETED: "COMPLETED",
	CANCELLED: "CANCELLED",
	EXPIRED: "EXPIRED",
} as const;

export const BONUS_PRODUCT_TYPE = {
	CASINO: "casino",
	SPORTSBOOK: "sportsbook",
} as const;

export const BONUS_TYPE = {
	DEPOSIT: "deposit",
	LOGIN: "login",
} as const;

export const BONUS_PLACEHOLDER_IDS = new Set([
	"provider_id",
	"game_id",
	"provider_name",
]);

export const BONUS_QUERY_KEY = {
	LIST: ["bonuses", "list"] as const,
	CAMPAIGNS: ["bonuses", "campaigns"] as const,
};
