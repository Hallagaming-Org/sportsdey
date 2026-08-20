import {
	LOYALTY_TIERS,
	type LoyaltyDisplayTier,
	type LoyaltyTierDefinition,
} from "./loyalty.constant";

export type LoyaltyPointsSummary = {
	playerId: string;
	totalPoints: number;
	loyaltyLevel: string;
	currentTier: LoyaltyDisplayTier;
	nextTier: LoyaltyDisplayTier | null;
	pointsToNextTier: number;
	progressPercent: number;
	progressCurrent: number;
	progressTarget: number;
};

export type LoyaltyHistoryEntry = {
	id: string;
	activity: string;
	xpDelta: number;
	pointsBalance: number | null;
	occurredAt: string | null;
	transactionType: string;
};

export type LoyaltyRedeemResult = {
	playerId: string;
	totalPoints: number;
	redeemedPoints: number;
	loyaltyLevel: string;
};

export type LoyaltyCampaignLevel = {
	id: string;
	level: string;
	levelPoints: number;
};

export type LoyaltyCampaignCard = {
	id: string;
	name: string;
	currency: string;
	device: string;
	loyaltyStatus: string;
	pointAccumulateBy: string;
	amountOfPointType: string;
	amountOfPointValue: number;
	redeemLevelsType: string;
	redeemLevelsValue: number;
	pointValueType: string;
	pointValue: number;
	applicableGameType: string;
	levels: LoyaltyCampaignLevel[];
	startsAt: string | null;
	endsAt: string | null;
};

export type LoyaltyRedeemOffer = {
	id: string;
	campaignId: string;
	campaignName: string;
	categoryLabel: string;
	rewardLabel: string;
	pointsCost: number;
	earnByLabel: string;
	earnRateLabel: string;
	gamesScopeLabel: string;
	howToUnlockLabel: string;
};

export function normalizeLoyaltyPoints(
	record: Record<string, unknown>,
): LoyaltyPointsSummary {
	const totalPoints = Math.max(0, asNumber(record.total_points));
	const loyaltyLevel = asString(record.loyalty_level) || "Iron";
	return buildLoyaltyPointsSummary({
		playerId: asString(record.player_id),
		totalPoints,
		loyaltyLevel,
		tiers: [...LOYALTY_TIERS],
	});
}

export function applyCampaignLevelsToPointsSummary(payload: {
	summary: LoyaltyPointsSummary;
	levels: LoyaltyCampaignLevel[];
}): LoyaltyPointsSummary {
	const tiers = buildDisplayTiersFromCampaignLevels(payload.levels);
	if (tiers.length === 0) return payload.summary;
	return buildLoyaltyPointsSummary({
		playerId: payload.summary.playerId,
		totalPoints: payload.summary.totalPoints,
		loyaltyLevel: payload.summary.loyaltyLevel,
		tiers,
	});
}

export function pickPrimaryCampaignLevels(
	campaigns: LoyaltyCampaignCard[],
): LoyaltyCampaignLevel[] {
	const withLevels = campaigns.filter((campaign) => campaign.levels.length > 0);
	if (withLevels.length === 0) return [];
	const active = withLevels.find((campaign) => {
		const status = campaign.loyaltyStatus.trim().toUpperCase();
		return status === "ACTIVE" || status === "LIVE";
	});
	return (active ?? withLevels[0])?.levels ?? [];
}

export function buildDisplayTiersFromCampaignLevels(
	levels: LoyaltyCampaignLevel[],
): LoyaltyDisplayTier[] {
	const ascending = [...levels].sort(
		(left, right) => left.levelPoints - right.levelPoints,
	);
	return ascending.map((level, index) => {
		const iconSrc = resolveLevelIconSrc({
			levelName: level.level,
			rankIndex: index,
		});
		return {
			id: level.id,
			label: level.level,
			minPoints: level.levelPoints,
			iconSrc,
		};
	});
}

export function buildLoyaltyRedeemOffers(
	campaigns: LoyaltyCampaignCard[],
): LoyaltyRedeemOffer[] {
	const offers: LoyaltyRedeemOffer[] = [];
	for (const campaign of campaigns) {
		if (campaign.redeemLevelsValue <= 0) continue;
		const earnByLabel = formatEarnByLabel(campaign.pointAccumulateBy);
		const earnRateLabel = formatEarnRateLabel({
			type: campaign.amountOfPointType,
			value: campaign.amountOfPointValue,
			earnBy: campaign.pointAccumulateBy,
		});
		const gameScopeLabel = formatGameScopeLabel(campaign.applicableGameType);
		offers.push({
			id: campaign.id,
			campaignId: campaign.id,
			campaignName: campaign.name,
			categoryLabel: formatRedeemCategoryLabel(campaign.redeemLevelsType),
			rewardLabel: formatRedeemRewardLabel({
				type: campaign.pointValueType,
				value: campaign.pointValue,
				currency: campaign.currency,
				fallbackType: campaign.redeemLevelsType,
				fallbackValue: campaign.redeemLevelsValue,
			}),
			pointsCost: campaign.redeemLevelsValue,
			earnByLabel,
			earnRateLabel,
			gamesScopeLabel: gameScopeLabel,
			howToUnlockLabel: buildHowToUnlockLabel({
				earnByLabel,
				earnRateLabel,
				gameScopeLabel,
				pointsCost: campaign.redeemLevelsValue,
			}),
		});
	}
	return offers;
}

function formatEarnByLabel(accumulateBy: string): string {
	const normalized = accumulateBy.trim().toLowerCase();
	if (normalized === "bet" || normalized === "bets") return "betting";
	if (normalized === "deposit" || normalized === "deposits") return "depositing";
	if (normalized === "login") return "logging in";
	if (!normalized) return "playing";
	return normalized.replace(/[_-]+/g, " ");
}

function formatEarnRateLabel(payload: {
	type: string;
	value: number;
	earnBy: string;
}): string {
	if (payload.value <= 0) return "";
	const amount = formatLoyaltyAmountLabel({
		type: payload.type,
		value: payload.value,
	});
	const earnBy = payload.earnBy.trim().toLowerCase();
	if (earnBy === "bet" || earnBy === "bets") {
		return `${amount} of each bet`;
	}
	if (earnBy === "deposit" || earnBy === "deposits") {
		return `${amount} of each deposit`;
	}
	return `${amount} per activity`;
}

function formatGameScopeLabel(gameType: string): string {
	const normalized = gameType.trim().toLowerCase();
	if (normalized === "all") return "all games";
	if (normalized === "casino") return "casino games";
	if (normalized === "sports" || normalized === "sport") return "sports bets";
	if (!normalized) return "";
	return `${normalized.replace(/[_-]+/g, " ")} games`;
}

function buildHowToUnlockLabel(payload: {
	earnByLabel: string;
	earnRateLabel: string;
	gameScopeLabel: string;
	pointsCost: number;
}): string {
	const cost = payload.pointsCost.toLocaleString();
	const earnBits: string[] = [];
	if (payload.earnByLabel) earnBits.push(`by ${payload.earnByLabel}`);
	if (payload.earnRateLabel) earnBits.push(`(${payload.earnRateLabel})`);
	if (payload.gameScopeLabel) earnBits.push(`on ${payload.gameScopeLabel}`);
	const earnSuffix =
		earnBits.length > 0 ? ` Earn points ${earnBits.join(" ")}.` : "";
	return `You need ${cost} points to redeem.${earnSuffix}`;
}

export function buildLoyaltyHowItWorksSteps(
	campaigns: LoyaltyCampaignCard[],
): string[] {
	const campaign = pickPrimaryLoyaltyCampaign(campaigns);
	if (!campaign) {
		return [
			"Place bets and keep playing to earn loyalty points.",
			"As your points grow, you unlock higher loyalty levels.",
			"Hit each reward’s point cost to redeem it from Recommended For You.",
			"Use Recent Activity to track points you’ve earned or spent.",
		];
	}

	const earnByLabel = formatEarnByLabel(campaign.pointAccumulateBy);
	const earnRateLabel = formatEarnRateLabel({
		type: campaign.amountOfPointType,
		value: campaign.amountOfPointValue,
		earnBy: campaign.pointAccumulateBy,
	});
	const gameScopeLabel = formatGameScopeLabel(campaign.applicableGameType);

	const earnParts: string[] = [`Earn loyalty points by ${earnByLabel}`];
	if (earnRateLabel) earnParts.push(`at ${earnRateLabel}`);
	if (gameScopeLabel) earnParts.push(`on ${gameScopeLabel}`);
	const earnStep = `${earnParts.join(" ")}.`;

	const levels = [...campaign.levels].sort(
		(left, right) => left.levelPoints - right.levelPoints,
	);
	const levelsStep =
		levels.length > 0
			? `Climb levels as your balance grows: ${levels
					.map(
						(level) =>
							`${level.level} (${level.levelPoints.toLocaleString()} pts)`,
					)
					.join(", ")}.`
			: "Climb loyalty levels as your point balance grows.";

	const redeemStep =
		campaign.redeemLevelsValue > 0
			? `Redeem a ${formatRedeemCategoryLabel(campaign.redeemLevelsType)} (${formatRedeemRewardLabel(
					{
						type: campaign.pointValueType,
						value: campaign.pointValue,
						currency: campaign.currency,
						fallbackType: campaign.redeemLevelsType,
						fallbackValue: campaign.redeemLevelsValue,
					},
				)}) once you reach ${campaign.redeemLevelsValue.toLocaleString()} points.`
			: "Redeem rewards from Recommended For You once you reach each offer’s point cost.";

	return [
		earnStep,
		levelsStep,
		redeemStep,
		"Check Recent Activity anytime to see points you’ve earned or redeemed.",
	];
}

function pickPrimaryLoyaltyCampaign(
	campaigns: LoyaltyCampaignCard[],
): LoyaltyCampaignCard | null {
	if (campaigns.length === 0) return null;
	const active = campaigns.find((campaign) => {
		const status = campaign.loyaltyStatus.trim().toUpperCase();
		return status === "ACTIVE" || status === "LIVE";
	});
	return active ?? campaigns[0] ?? null;
}

function formatRedeemCategoryLabel(type: string): string {
	const normalized = type.trim().toLowerCase();
	if (normalized === "cash") return "Cash Bonus";
	if (normalized === "freebet" || normalized === "free_bet") return "Freebet";
	if (normalized === "odds_boost" || normalized === "oddsboost") {
		return "Odds Boost";
	}
	if (normalized === "reload" || normalized === "reload_bonus") {
		return "Reload Bonus";
	}
	if (!normalized) return "Reward";
	return normalized
		.replace(/[_-]+/g, " ")
		.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatRedeemRewardLabel(payload: {
	type: string;
	value: number;
	currency: string;
	fallbackType: string;
	fallbackValue: number;
}): string {
	if (payload.value > 0) {
		return formatLoyaltyAmountLabel({
			type: payload.type,
			value: payload.value,
			currency: payload.currency,
		});
	}
	return formatLoyaltyAmountLabel({
		type: payload.fallbackType,
		value: payload.fallbackValue,
		currency: payload.currency,
	});
}

export function formatLoyaltyAmountLabel(payload: {
	type: string;
	value: number;
	currency?: string;
}): string {
	const value = payload.value;
	const type = payload.type.trim().toLowerCase();
	const formatted = value.toLocaleString();
	if (type === "percentage") return `${formatted}%`;
	if (type === "cash") {
		const symbol = currencySymbol(payload.currency ?? "");
		return symbol ? `${symbol}${formatted}` : formatted;
	}
	if (!type) return formatted;
	return `${formatted} (${type})`;
}

function currencySymbol(currency: string): string {
	const code = currency.trim().toUpperCase();
	if (code === "NGN") return "₦";
	if (code === "USD") return "$";
	if (code === "EUR") return "€";
	if (code === "GBP") return "£";
	return code ? `${code} ` : "";
}

export function normalizeLoyaltyRedeem(
	record: Record<string, unknown>,
): LoyaltyRedeemResult {
	return {
		playerId: asString(record.player_id),
		totalPoints: Math.max(0, asNumber(record.total_points)),
		redeemedPoints: Math.max(0, asNumber(record.redeemed_points)),
		loyaltyLevel: asString(record.loyalty_level),
	};
}

export function normalizeLoyaltyHistoryItem(
	record: Record<string, unknown>,
	index: number,
): LoyaltyHistoryEntry {
	const earned = asNumber(record.points_earned);
	const redeemed = asNumber(record.points_redeemed);
	const xpDelta = earned > 0 ? earned : redeemed > 0 ? -redeemed : 0;
	const reason = asString(record.reason);
	const transactionType = asString(record.transaction_type);
	const activity =
		reason ||
		humanizeTransactionType(transactionType) ||
		(xpDelta >= 0 ? "Points earned" : "Points redeemed");

	return {
		id:
			asString(record.transaction_date) ||
			`${transactionType}-${index}-${xpDelta}`,
		activity,
		xpDelta,
		pointsBalance:
			record.points_balance === undefined || record.points_balance === null
				? null
				: asNumber(record.points_balance),
		occurredAt: asDateString(record.transaction_date),
		transactionType,
	};
}

export function normalizeLoyaltyCampaign(
	record: Record<string, unknown>,
	index: number,
): LoyaltyCampaignCard {
	const levels = normalizeCampaignLevels(record.levels_criteria);

	return {
		id: asString(record._id) || asString(record.id) || `campaign-${index}`,
		name: asString(record.name) || `Loyalty campaign ${index + 1}`,
		currency: asString(record.currency),
		device: asString(record.device),
		loyaltyStatus: asString(record.loyalty_status),
		pointAccumulateBy: asString(record.point_accumulate_by),
		amountOfPointType: asString(record.amount_of_point_type),
		amountOfPointValue: asNumber(record.amount_of_point_value),
		redeemLevelsType: asString(record.redeem_levels_type),
		redeemLevelsValue: asNumber(record.redeem_levels_value),
		pointValueType: asString(record.point_value_type),
		pointValue: asNumber(record.point_value),
		applicableGameType: asString(record.applicable_game_type),
		levels,
		startsAt: asDateString(record.start_date_time),
		endsAt: asDateString(record.end_date_time),
	};
}

function normalizeCampaignLevels(value: unknown): LoyaltyCampaignLevel[] {
	if (!Array.isArray(value)) return [];
	const levels: LoyaltyCampaignLevel[] = [];
	for (const [index, item] of value.entries()) {
		if (typeof item !== "object" || item === null) continue;
		const row = item as Record<string, unknown>;
		const level = asString(row.level);
		if (!level) continue;
		levels.push({
			id: asString(row._id) || `${level}-${index}`,
			level,
			levelPoints: asNumber(row.level_points),
		});
	}
	return levels.sort((left, right) => left.levelPoints - right.levelPoints);
}

function buildLoyaltyPointsSummary(payload: {
	playerId: string;
	totalPoints: number;
	loyaltyLevel: string;
	tiers: LoyaltyDisplayTier[];
}): LoyaltyPointsSummary {
	const tiers = payload.tiers;
	const currentTier = resolveTierAgainstLadder({
		loyaltyLevel: payload.loyaltyLevel,
		totalPoints: payload.totalPoints,
		tiers,
	});
	const currentIndex = tiers.findIndex((tier) => tier.id === currentTier.id);
	const nextTier =
		currentIndex >= 0 && currentIndex < tiers.length - 1
			? (tiers[currentIndex + 1] ?? null)
			: null;

	const bandStart = currentTier.minPoints;
	const bandEnd = nextTier?.minPoints ?? currentTier.minPoints;
	const progressCurrent = payload.totalPoints;
	const progressTarget = nextTier
		? bandEnd
		: Math.max(payload.totalPoints, bandStart);
	const span = Math.max(1, bandEnd - bandStart);
	const progressPercent = nextTier
		? clampPercent(((payload.totalPoints - bandStart) / span) * 100)
		: 100;
	const pointsToNextTier = nextTier
		? Math.max(0, nextTier.minPoints - payload.totalPoints)
		: 0;

	return {
		playerId: payload.playerId,
		totalPoints: payload.totalPoints,
		loyaltyLevel: payload.loyaltyLevel,
		currentTier,
		nextTier,
		pointsToNextTier,
		progressPercent,
		progressCurrent,
		progressTarget,
	};
}

export function resolveTier(payload: {
	loyaltyLevel: string;
	totalPoints: number;
}): LoyaltyTierDefinition {
	const matched = resolveTierAgainstLadder({
		loyaltyLevel: payload.loyaltyLevel,
		totalPoints: payload.totalPoints,
		tiers: [...LOYALTY_TIERS],
	});
	const byId = LOYALTY_TIERS.find((tier) => tier.id === matched.id);
	return byId ?? LOYALTY_TIERS[0]!;
}

function resolveTierAgainstLadder(payload: {
	loyaltyLevel: string;
	totalPoints: number;
	tiers: LoyaltyDisplayTier[];
}): LoyaltyDisplayTier {
	const tiers = payload.tiers;
	if (tiers.length === 0) {
		return LOYALTY_TIERS[0]!;
	}

	const normalized = payload.loyaltyLevel.trim().toLowerCase();
	const byName = tiers.find(
		(tier) =>
			tier.id.toLowerCase() === normalized ||
			tier.label.toLowerCase() === normalized,
	);
	if (byName) return byName;

	let matched = tiers[0]!;
	for (const tier of tiers) {
		if (payload.totalPoints >= tier.minPoints) matched = tier;
	}
	return matched;
}

function resolveLevelIconSrc(payload: {
	levelName: string;
	rankIndex: number;
}): string {
	const normalized = payload.levelName.trim().toLowerCase();
	const byName = LOYALTY_TIERS.find(
		(tier) => tier.id === normalized || tier.label.toLowerCase() === normalized,
	);
	if (byName) return byName.iconSrc;
	const byRank =
		LOYALTY_TIERS[Math.min(payload.rankIndex, LOYALTY_TIERS.length - 1)];
	return byRank?.iconSrc ?? LOYALTY_TIERS[0]!.iconSrc;
}

function humanizeTransactionType(value: string): string {
	if (!value) return "";
	return value
		.replace(/[_-]+/g, " ")
		.replace(/\b\w/g, (char) => char.toUpperCase());
}

function asString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim()) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
}

function asDateString(value: unknown): string | null {
	const text = asString(value);
	if (!text) return null;
	const parsed = Date.parse(text);
	return Number.isFinite(parsed) ? new Date(parsed).toISOString() : text;
}

function clampPercent(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(100, value));
}
