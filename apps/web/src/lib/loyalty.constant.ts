export const LOYALTY_ROUTE = {
	POINTS: "loyalty/points",
	REDEEM: "loyalty/redeem",
	HISTORY: "loyalty/history",
	LISTS: "loyalty/lists",
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

export const LOYALTY_TIERS: readonly LoyaltyTierDefinition[] = [
	{
		id: LOYALTY_TIER_ID.IRON,
		label: "Iron",
		minPoints: 0,
		iconSrc: "/public/loyalty-icons/iron.svg",
	},
	{
		id: LOYALTY_TIER_ID.BRONZE,
		label: "Bronze",
		minPoints: 1_000,
		iconSrc: "/public/loyalty-icons/bronze.svg",
	},
	{
		id: LOYALTY_TIER_ID.SILVER,
		label: "Silver",
		minPoints: 3_000,
		iconSrc: "/public/loyalty-icons/silver.svg",
	},
	{
		id: LOYALTY_TIER_ID.GOLD,
		label: "Gold",
		minPoints: 10_000,
		iconSrc: "/public/loyalty-icons/gold.svg",
	},
	{
		id: LOYALTY_TIER_ID.PLATINUM,
		label: "Platinum",
		minPoints: 25_000,
		iconSrc: "/public/loyalty-icons/platinum.svg",
	},
	{
		id: LOYALTY_TIER_ID.DIAMOND,
		label: "Diamond",
		minPoints: 50_000,
		iconSrc: "/public/loyalty-icons/diamond.svg",
	},
] as const;
