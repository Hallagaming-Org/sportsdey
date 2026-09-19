export const LOYALTY_ROUTE = {
	POINTS: "loyalty/points",
	REDEEM: "loyalty/redeem",
	HISTORY: "loyalty/history",
	LISTS: "loyalty/lists",
} as const;

export const LOYALTY_ERROR_MESSAGE = {
	HISTORY: "Could not load loyalty history.",
} as const;

export const LOYALTY_TIER_ID = {
	IRON: "iron",
	BRONZE: "bronze",
	SILVER: "silver",
	GOLD: "gold",
	PLATINUM: "platinum",
	DIAMOND: "diamond",
} as const;

export type LoyaltyTierId =
	(typeof LOYALTY_TIER_ID)[keyof typeof LOYALTY_TIER_ID];

export type LoyaltyDisplayTier = {
	id: string;
	label: string;
	minPoints: number;
	iconSrc: string;
};

export type LoyaltyTierDefinition = LoyaltyDisplayTier & {
	id: LoyaltyTierId;
};

const ironIcon = new URL(
	"../logos/loyalty-icons/iron.svg",
	import.meta.url,
).href;
const bronzeIcon = new URL(
	"../logos/loyalty-icons/bronze.svg",
	import.meta.url,
).href;
const silverIcon = new URL(
	"../logos/loyalty-icons/silver.svg",
	import.meta.url,
).href;
const goldIcon = new URL(
	"../logos/loyalty-icons/gold.svg",
	import.meta.url,
).href;
const platinumIcon = new URL(
	"../logos/loyalty-icons/platinum.svg",
	import.meta.url,
).href;
const diamondIcon = new URL(
	"../logos/loyalty-icons/diamond.svg",
	import.meta.url,
).href;

export const LOYALTY_TIERS: readonly LoyaltyTierDefinition[] = [
	{
		id: LOYALTY_TIER_ID.IRON,
		label: "Iron",
		minPoints: 0,
		iconSrc: ironIcon,
	},
	{
		id: LOYALTY_TIER_ID.BRONZE,
		label: "Bronze",
		minPoints: 1_000,
		iconSrc: bronzeIcon,
	},
	{
		id: LOYALTY_TIER_ID.SILVER,
		label: "Silver",
		minPoints: 3_000,
		iconSrc: silverIcon,
	},
	{
		id: LOYALTY_TIER_ID.GOLD,
		label: "Gold",
		minPoints: 10_000,
		iconSrc: goldIcon,
	},
	{
		id: LOYALTY_TIER_ID.PLATINUM,
		label: "Platinum",
		minPoints: 25_000,
		iconSrc: platinumIcon,
	},
	{
		id: LOYALTY_TIER_ID.DIAMOND,
		label: "Diamond",
		minPoints: 50_000,
		iconSrc: diamondIcon,
	},
] as const;
