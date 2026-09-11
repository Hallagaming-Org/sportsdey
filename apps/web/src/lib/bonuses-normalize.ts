import {
	BONUS_ACTION_LABEL,
	BONUS_ENGINE_STATUS,
	BONUS_KIND,
	BONUS_PLACEHOLDER_IDS,
	BONUS_PLAY_ROUTE,
	BONUS_PLAY_SEARCH_KEY,
	BONUS_PRODUCT_TYPE,
	BONUS_SPORTSBOOK_FOOTBALL_PREMATCH,
	BONUS_SPORTSBOOK_PATH_FIELD,
	BONUS_STATUS,
	BONUS_STATUS_LABEL,
	BONUS_TYPE,
	BONUS_USER_ACTION,
	isSportsBonusProduct,
	sportsbookHrefFromSplat,
} from "./bonuses.constant";

export type BonusKind = (typeof BONUS_KIND)[keyof typeof BONUS_KIND];

export type BonusStatus = (typeof BONUS_STATUS)[keyof typeof BONUS_STATUS];

export type BonusActionKind = "sports" | "casino" | "deposit" | "generic";

export type BonusCard = {
	id: string;
	kind: BonusKind;
	title: string;
	description: string;
	bonusType: string;
	productType: string;
	status: BonusStatus;
	statusLabel: string;
	canActivate: boolean;
	canCancel: boolean;
	bonusAmount: number;
	cashAmount: number;
	rewardLabel: string;
	wageringCurrent: number;
	wageringRequired: number;
	wageringLabel: string;
	startAt: string | null;
	endAt: string | null;
	actionKind: BonusActionKind;
	actionLabel: string;
	actionHref: string;
	actionSearch?: { play?: string };
};

type BonusRecord = Record<string, unknown>;

type PlayableGame = {
	id: string;
	name: string;
};

/**
 * Maps a Bonus Engine player assignment (`getall_User_bonus` row) into a
 * Bonuses UI card. Activate/cancel come from `user_action` / `status`; the
 * play CTA uses product type and allow-listed game ids, never game titles.
 */
export function normalizeUserBonus(
	record: BonusRecord,
	index = 0,
): BonusCard {
	const id =
		asString(record._id ?? record.userbonus_id ?? record.id) ||
		`bonus-${index}`;
	const bonusType = asString(record.bonus_type ?? record.type) || "bonus";
	const productType = asString(
		record.product_type ?? record.product,
	).toLowerCase();
	const games = parseBonusGames(record);
	const sportsTarget = parseBonusSportsTarget(record);
	const sportsbookPath = asString(record[BONUS_SPORTSBOOK_PATH_FIELD]);
	const hasSportsTargets =
		hasSportsAllowList(record) || Boolean(sportsTarget.name || sportsbookPath);
	const action = resolveBonusAction({
		bonusType,
		productType,
		games,
		hasSportsTargets,
		sportsbookPath,
		sportsTargetName: sportsTarget.name,
	});
	const status = resolveAssignmentStatus(record);
	const bonusAmount = asAmount(
		record.bonus_amount ?? record.bonus_reward_amount,
	);
	const cashAmount = asAmount(record.cash_amount ?? record.cash_reward_amount);
	const wageringCurrent = asAmount(record.wagering_amount ?? record.wagering);
	const wageringRequired = asAmount(record.required_wagering_amount);
	const campaignCode = asString(record.campaign_code);
	const title = campaignCode || fallbackTitle(bonusType);
	const startAt = asDateString(
		record.campaign_start_date ?? record.activation_time,
	);
	const endAt = asDateString(
		record.completion_time ?? record.campaign_end_date,
	);

	return {
		id,
		kind: BONUS_KIND.ASSIGNMENT,
		title,
		description: fallbackDescription({
			bonusType,
			productType,
			actionKind: action.kind,
			games,
		}),
		bonusType,
		productType,
		status,
		statusLabel: statusLabelFor(status),
		canActivate: status === BONUS_STATUS.READY,
		canCancel: status === BONUS_STATUS.ACTIVE,
		bonusAmount,
		cashAmount,
		rewardLabel: formatRewardLabel({ bonusAmount, cashAmount }),
		wageringCurrent,
		wageringRequired,
		wageringLabel: formatWageringLabel({
			current: wageringCurrent,
			required: wageringRequired,
		}),
		startAt,
		endAt,
		actionKind: action.kind,
		actionLabel: action.label,
		actionHref: action.href,
		...(action.search ? { actionSearch: action.search } : {}),
	};
}

/**
 * Maps a Bonus Engine campaign (`list_active_campaign` row) into a read-only
 * offer card. Campaigns cannot be activated from this payload — that needs a
 * player assignment `userbonus_id`.
 */
export function normalizeBonusCampaign(
	record: BonusRecord,
	index = 0,
): BonusCard {
	const id = asString(record._id ?? record.id) || `campaign-${index}`;
	const bonusType = asString(record.type ?? record.bonus_type) || "bonus";
	const productType = asString(record.product).toLowerCase();
	const games = parseBonusGames(record);
	const sportsTarget = parseBonusSportsTarget(record);
	const sportsbookPath = asString(record[BONUS_SPORTSBOOK_PATH_FIELD]);
	const hasSportsTargets =
		hasSportsAllowList(record) || Boolean(sportsTarget.name || sportsbookPath);
	const action = resolveBonusAction({
		bonusType,
		productType,
		games,
		hasSportsTargets,
		sportsbookPath,
		sportsTargetName: sportsTarget.name,
	});
	const bonusAmount = asAmount(record.bonus_reward_amount ?? record.bonus_amount);
	const cashAmount = asAmount(record.cash_reward_amount ?? record.cash_amount);
	const campaignCode = asString(record.campaign_code);
	const title = campaignCode || fallbackTitle(bonusType);

	return {
		id,
		kind: BONUS_KIND.CAMPAIGN,
		title,
		description: fallbackDescription({
			bonusType,
			productType,
			actionKind: action.kind,
			games,
		}),
		bonusType,
		productType,
		status: BONUS_STATUS.AVAILABLE,
		statusLabel: BONUS_STATUS_LABEL.AVAILABLE,
		canActivate: false,
		canCancel: false,
		bonusAmount,
		cashAmount,
		rewardLabel: formatRewardLabel({ bonusAmount, cashAmount }),
		wageringCurrent: 0,
		wageringRequired: asAmount(record.wagering_count),
		wageringLabel: formatWageringLabel({
			current: 0,
			required: asAmount(record.wagering_count),
		}),
		startAt: asDateString(record.campaign_start_date),
		endAt: asDateString(record.campaign_end_date),
		actionKind: action.kind,
		actionLabel: action.label,
		actionHref: action.href,
		...(action.search ? { actionSearch: action.search } : {}),
	};
}

/**
 * Picks the player CTA. Deposit bonuses go to wallet. A real game id deep-links
 * `/games?play=`. Sports product or sports allow-lists go to sportsbook. Game
 * titles are never classified as sports.
 */
export function resolveBonusAction(payload: {
	bonusType: string;
	productType: string;
	games: PlayableGame[];
	hasSportsTargets: boolean;
	sportsbookPath?: string;
	sportsTargetName?: string;
}): {
	kind: BonusActionKind;
	label: string;
	href: string;
	search?: { play?: string };
} {
	if (payload.bonusType.toLowerCase() === BONUS_TYPE.DEPOSIT) {
		return {
			kind: "deposit",
			label: BONUS_ACTION_LABEL.DEPOSIT,
			href: BONUS_PLAY_ROUTE.WALLET,
		};
	}

	const playGame = payload.games[0];
	if (playGame) {
		return {
			kind: "casino",
			label: `Play ${playGame.name}`,
			href: BONUS_PLAY_ROUTE.CASINO,
			search: { [BONUS_PLAY_SEARCH_KEY]: playGame.id },
		};
	}

	if (
		isSportsBonusProduct(payload.productType) ||
		payload.hasSportsTargets ||
		payload.sportsbookPath
	) {
		const splat =
			payload.sportsbookPath?.trim() || BONUS_SPORTSBOOK_FOOTBALL_PREMATCH;
		const targetName = payload.sportsTargetName?.trim();
		return {
			kind: "sports",
			label: targetName ? `Play ${targetName}` : BONUS_ACTION_LABEL.SPORTS,
			href: sportsbookHrefFromSplat(splat),
		};
	}

	if (payload.productType === BONUS_PRODUCT_TYPE.CASINO) {
		return {
			kind: "casino",
			label: BONUS_ACTION_LABEL.CASINO,
			href: BONUS_PLAY_ROUTE.CASINO,
		};
	}

	return {
		kind: "generic",
		label: BONUS_ACTION_LABEL.PLAY,
		href: BONUS_PLAY_ROUTE.CASINO,
	};
}

function resolveAssignmentStatus(record: BonusRecord): BonusStatus {
	const userAction = asString(record.user_action).toUpperCase();
	const status = asString(record.status).toUpperCase();

	if (
		userAction === BONUS_USER_ACTION.CANCELLED ||
		status === BONUS_ENGINE_STATUS.CANCELLED
	) {
		return BONUS_STATUS.CANCELLED;
	}
	if (status === BONUS_ENGINE_STATUS.COMPLETED) {
		return BONUS_STATUS.COMPLETED;
	}
	if (status === BONUS_ENGINE_STATUS.EXPIRED) {
		return BONUS_STATUS.EXPIRED;
	}
	if (
		userAction === BONUS_USER_ACTION.ACTIVATED ||
		status === BONUS_ENGINE_STATUS.ACTIVE
	) {
		return BONUS_STATUS.ACTIVE;
	}
	return BONUS_STATUS.READY;
}

function parseBonusGames(record: BonusRecord): PlayableGame[] {
	const buckets = [
		record.wagering_games,
		record.provider_games,
		record.bet_spin_hand_games,
		record.free_spins_provider_games,
	];
	const games: PlayableGame[] = [];
	const seen = new Set<string>();

	for (const bucket of buckets) {
		if (!Array.isArray(bucket)) continue;
		for (const entry of bucket) {
			if (typeof entry !== "object" || entry === null) continue;
			const row = entry as Record<string, unknown>;
			const gameList = Array.isArray(row.games)
				? row.games
				: Array.isArray(row.game)
					? row.game
					: [];
			for (const game of gameList) {
				if (typeof game !== "object" || game === null) continue;
				const gameRow = game as Record<string, unknown>;
				const id = asString(gameRow.id ?? gameRow.unique_id);
				if (!id || BONUS_PLACEHOLDER_IDS.has(id) || seen.has(id)) continue;
				seen.add(id);
				const name = asString(gameRow.name) || "Game";
				games.push({ id, name });
			}
		}
	}

	return games;
}

function hasSportsAllowList(record: BonusRecord): boolean {
	const buckets = [
		record.sports_league_events,
		record.wagering_sports,
		record.sports_leagues_event,
		record.freebet_sports_leagues_event,
	];
	return buckets.some((bucket) => Array.isArray(bucket) && bucket.length > 0);
}

function parseBonusSportsTarget(record: BonusRecord): { name: string } {
	const events = record.sports_league_events;
	if (!Array.isArray(events)) return { name: "" };

	for (const entry of events) {
		if (typeof entry !== "object" || entry === null) continue;
		const row = entry as Record<string, unknown>;
		const leagues = Array.isArray(row.leagues) ? row.leagues : [];
		for (const leagueEntry of leagues) {
			if (typeof leagueEntry !== "object" || leagueEntry === null) continue;
			const wrapped = leagueEntry as Record<string, unknown>;
			const leagueRow =
				typeof wrapped.league === "object" && wrapped.league !== null
					? (wrapped.league as Record<string, unknown>)
					: wrapped;
			const leagueName = asString(leagueRow.name);
			if (leagueName) return { name: leagueName };
		}
		const category =
			typeof row.category === "object" && row.category !== null
				? (row.category as Record<string, unknown>)
				: null;
		const categoryName = asString(category?.name);
		if (categoryName) return { name: categoryName };
	}

	return { name: "" };
}

function fallbackTitle(bonusType: string): string {
	const trimmed = bonusType.trim();
	if (!trimmed) return "Bonus";
	return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)} bonus`;
}

function fallbackDescription(payload: {
	bonusType: string;
	productType: string;
	actionKind: BonusActionKind;
	games: PlayableGame[];
}): string {
	if (payload.games[0]) {
		return `Play ${payload.games[0].name} to work this bonus.`;
	}
	if (payload.actionKind === "deposit") {
		return "Deposit to unlock this bonus.";
	}
	if (payload.actionKind === "sports") {
		return "Place a sports bet that matches this bonus.";
	}
	if (payload.productType === BONUS_PRODUCT_TYPE.CASINO) {
		return "Play casino games that match this bonus.";
	}
	return `${fallbackTitle(payload.bonusType)} from Bonus Engine.`;
}

function formatRewardLabel(payload: {
	bonusAmount: number;
	cashAmount: number;
}): string {
	const parts: string[] = [];
	if (payload.bonusAmount > 0) {
		parts.push(`${formatNaira(payload.bonusAmount)} bonus`);
	}
	if (payload.cashAmount > 0) {
		parts.push(`${formatNaira(payload.cashAmount)} cash`);
	}
	return parts.length > 0 ? parts.join(" + ") : "Reward TBD";
}

function formatWageringLabel(payload: {
	current: number;
	required: number;
}): string {
	if (payload.required <= 0) return "No wagering listed";
	return `Wagered ${formatNaira(payload.current)} / ${formatNaira(payload.required)}`;
}

function formatNaira(amount: number): string {
	return `₦${amount.toLocaleString("en-NG")}`;
}

function statusLabelFor(status: BonusStatus): string {
	switch (status) {
		case BONUS_STATUS.AVAILABLE:
			return BONUS_STATUS_LABEL.AVAILABLE;
		case BONUS_STATUS.READY:
			return BONUS_STATUS_LABEL.READY;
		case BONUS_STATUS.ACTIVE:
			return BONUS_STATUS_LABEL.ACTIVE;
		case BONUS_STATUS.COMPLETED:
			return BONUS_STATUS_LABEL.COMPLETED;
		case BONUS_STATUS.CANCELLED:
			return BONUS_STATUS_LABEL.CANCELLED;
		case BONUS_STATUS.EXPIRED:
			return BONUS_STATUS_LABEL.EXPIRED;
	}
}

function asString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function asAmount(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
		return value;
	}
	if (typeof value === "string" && value.trim()) {
		const parsed = Number(value);
		if (Number.isFinite(parsed) && parsed >= 0) return parsed;
	}
	return 0;
}

function asDateString(value: unknown): string | null {
	if (typeof value !== "string" || !value.trim()) return null;
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? value : null;
}
