export const BONUS_API_ROUTE = {
	CAMPAIGNS: "bonus/campaigns",
	LIST: "bonus/list",
	GETALL_USER_BONUS: "bonus/getall_User_bonus",
	ACTIVATE: "bonus/activate",
	CANCEL: "bonus/cancel",
} as const;

export const BONUS_PLAY_ROUTE = {
	SPORTS: "/sportsbetting/sports/prematch",
	CASINO: "/games",
	WALLET: "/wallet",
} as const;

export {
	MISSION_SPORTSBOOK_FOOTBALL_PREMATCH as BONUS_SPORTSBOOK_FOOTBALL_PREMATCH,
	MISSION_SPORTSBOOK_PATH_FIELD as BONUS_SPORTSBOOK_PATH_FIELD,
	sportsbookHrefFromSplat,
	sportsbookSplatFromHref,
} from "./missions.constant";

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
	SPORT: "sport",
	SPORTS: "sports",
} as const;

/** True when Bonus Engine `product` / `product_type` means sportsbook. */
export function isSportsBonusProduct(productType: string): boolean {
	return (
		productType === BONUS_PRODUCT_TYPE.SPORTSBOOK ||
		productType === BONUS_PRODUCT_TYPE.SPORT ||
		productType === BONUS_PRODUCT_TYPE.SPORTS
	);
}

export const BONUS_TYPE = {
	WELCOME: "welcome",
	LOGIN: "login",
	MANUAL: "manual",
	DEPOSIT: "deposit",
	CODE: "code",
	CASHBACK: "cashback",
	FREESPIN: "freespin",
	FREEBET: "freebet",
} as const;

export const BONUS_TYPE_VALUES = [
	BONUS_TYPE.WELCOME,
	BONUS_TYPE.LOGIN,
	BONUS_TYPE.MANUAL,
	BONUS_TYPE.DEPOSIT,
	BONUS_TYPE.CODE,
	BONUS_TYPE.CASHBACK,
	BONUS_TYPE.FREESPIN,
	BONUS_TYPE.FREEBET,
] as const;

export type BonusCampaignType = (typeof BONUS_TYPE_VALUES)[number];

export const BONUS_TYPE_DEFAULT = BONUS_TYPE.WELCOME;

export const BONUS_TYPE_LABEL: Record<BonusCampaignType, string> = {
	[BONUS_TYPE.WELCOME]: "Welcome",
	[BONUS_TYPE.LOGIN]: "Login",
	[BONUS_TYPE.MANUAL]: "Manual",
	[BONUS_TYPE.DEPOSIT]: "Deposit",
	[BONUS_TYPE.CODE]: "Code",
	[BONUS_TYPE.CASHBACK]: "Cashback",
	[BONUS_TYPE.FREESPIN]: "Free spin",
	[BONUS_TYPE.FREEBET]: "Free bet",
};

const BONUS_TYPE_VALUE_SET = new Set<string>(BONUS_TYPE_VALUES);

/** True when `value` is a Bonus Engine Admin campaign type. */
export function isBonusCampaignType(value: string): value is BonusCampaignType {
	return BONUS_TYPE_VALUE_SET.has(value);
}

export const BONUS_PLACEHOLDER_IDS = new Set([
	"provider_id",
	"game_id",
	"provider_name",
]);

export const BONUS_QUERY_KEY = {
	LIST: ["bonuses", "list"] as const,
	GETALL_USER_BONUS: ["bonuses", "getall_User_bonus"] as const,
	CAMPAIGNS: ["bonuses", "campaigns"] as const,
	campaigns: (bonusType: string) =>
		["bonuses", "campaigns", bonusType] as const,
};
