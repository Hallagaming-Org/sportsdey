import {
	MISSION_ACTION_LABEL,
	MISSION_PLACEHOLDER_UNIQUE_IDS,
	MISSION_PLAY_SEARCH_KEY,
	MISSION_REWARD_TYPE,
	MISSION_ROUTE,
	MISSION_SPORTSBOOK_FOOTBALL_PREMATCH,
	MISSION_SPORTSBOOK_PATH_FIELD,
	MISSION_STATUS,
	MISSION_CURRENCY_SYMBOL,
	MISSION_TRIGGER_DAYS_SLOT,
	MISSION_TRIGGER_KEYWORD,
	MISSION_TRIGGER_PLACEHOLDER,
	isDatabetTournamentGin,
	sportsbookHrefFromSplat,
	sportsbookTournamentSplat,
} from "./missions.constant";

export type MissionCadence = "daily" | "weekly" | "monthly";

export type MissionPeriod = "all" | MissionCadence;

export type MissionActionKind =
	| "sports"
	| "casino"
	| "virtuals"
	| "deposit"
	| "invite"
	| "generic";

export type MissionCard = {
	id: string;
	level: string;
	title: string;
	description: string;
	period: MissionCadence;
	progressCurrent: number;
	progressTarget: number;
	progressLabel: string;
	rewardPoints: number;
	rewardLabel: string;
	status: "active" | "completed" | "locked" | "upcoming" | "ended";
	missionStatus: string;
	lockedMessage: string | null;
	actionLabel: string;
	actionHref: string;
	actionSearch?: { play?: string; category?: string };
	actionKind: MissionActionKind;
	providers: Array<{ uniqueId: string; name: string }>;
	games: Array<{ uniqueId: string; name: string; providerName: string }>;
	leagues: Array<{ uniqueId: string; name: string }>;
	categories: Array<{ uniqueId: string; name: string }>;
	startAt: string | null;
	endAt: string | null;
	completedAt: string | null;
};

type MissionRecord = Record<string, unknown>;

type ParsedMissionTriggers = {
	types: string[];
	progressTarget: number;
	rewardPoints: number;
	rewardLabel: string | null;
	description: string | null;
};

type ResolvedMissionAction = {
	kind: MissionActionKind;
	label: string;
	href: string;
	search?: { play?: string; category?: string };
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAILY_MAX_MS = 1.5 * MS_PER_DAY;
const WEEKLY_MAX_MS = 8 * MS_PER_DAY;

export function normalizeMissionRecord(
	record: MissionRecord,
	index = 0,
): MissionCard {
	const id =
		asString(record._id ?? record.mission_id ?? record.id) || `mission-${index}`;
	const level = asString(record.mission_level ?? record.level) || "Mission";
	const { providers, games } = parseProviderGames(record.provider_games);
	const { leagues, categories } = parseSportsTargets(
		record.sports_league_events,
	);
	const sportsbookPath = asString(record[MISSION_SPORTSBOOK_PATH_FIELD]);
	const triggers = parseMissionTriggers(record.mission_triggers);
	const rewardPoints =
		sumMissionPoints(record.missions_points) || triggers.rewardPoints;
	const progressTarget = resolveProgressTarget({
		record,
		triggerTarget: triggers.progressTarget,
	});
	const progressPercentage = clampPercent(
		asNumber(
			record.progress_percentage ??
				record.progress ??
				record.completion_percentage,
		),
	);
	const startAt = asDateString(record.start_date_time ?? record.start_date);
	const endAt = asDateString(record.end_date_time ?? record.end_date);
	const missionStatus = asString(
		record.mission_status ?? record.missionStatus,
	).toUpperCase();
	const numericStatus = asNumber(record.status);
	const status = resolveMissionStatus({
		missionStatus,
		numericStatus,
		progressPercentage,
		progressTarget,
		startAt,
		endAt,
	});
	const progressCurrent = resolveProgressCurrent({
		status,
		progressPercentage,
		progressTarget,
		record,
	});
	const action = resolveMissionAction({
		triggerTypes: triggers.types,
		providers,
		games,
		leagues,
		categories,
		sportsbookPath,
	});
	const title =
		asString(record.title ?? record.name ?? record.mission_name) ||
		fallbackTitle({
			level,
			actionKind: action.kind,
			providers,
			games,
			leagues,
			categories,
		});
	const rawDescription = asString(
		record.description ?? record.details ?? record.objective,
	);
	const description =
		triggers.description ||
		(rawDescription && !hasTriggerPlaceholder(rawDescription)
			? rawDescription
			: "") ||
		fallbackDescription({
			actionKind: action.kind,
			providers,
			games,
			leagues,
			categories,
			progressTarget,
			triggerTypes: triggers.types,
		});
	const rewardLabel =
		triggers.rewardLabel ??
		(rewardPoints > 0 ? `${rewardPoints} XP` : "Reward TBD");

	return {
		id,
		level,
		title,
		description,
		period: resolvePeriod({ startAt, endAt }),
		progressCurrent,
		progressTarget,
		progressLabel: resolveProgressLabel({
			status,
			actionKind: action.kind,
			providers,
			games,
			leagues,
			categories,
		}),
		rewardPoints,
		rewardLabel,
		status,
		missionStatus,
		lockedMessage: null,
		actionLabel:
			status === "completed" ? MISSION_ACTION_LABEL.COMPLETED : action.label,
		actionHref: action.href,
		...(action.search ? { actionSearch: action.search } : {}),
		actionKind: action.kind,
		providers,
		games,
		leagues,
		categories,
		startAt,
		endAt,
		completedAt:
			status === "completed"
				? asDateString(record.completed_at ?? record.updatedAt) || endAt
				: null,
	};
}

export function applyMissionLevelLocks(cards: MissionCard[]): MissionCard[] {
	const levelRank = (level: string): number => {
		const match = level.match(/(\d+)/);
		if (match?.[1]) return Number(match[1]);
		const named: Record<string, number> = {
			bronze: 1,
			silver: 2,
			gold: 3,
			platinum: 4,
		};
		return named[level.toLowerCase()] ?? 1;
	};

	const completedRanks = new Set(
		cards
			.filter((card) => card.status === "completed")
			.map((card) => levelRank(card.level)),
	);
	const maxCompletedRank =
		completedRanks.size > 0 ? Math.max(...completedRanks) : 0;

	return cards.map((card) => {
		const rank = levelRank(card.level);
		if (card.status === "completed" || card.status === "ended") return card;
		if (rank <= 1 || rank <= maxCompletedRank + 1) return card;

		const remaining = Math.max(1, rank - maxCompletedRank - 1);
		return {
			...card,
			status: "locked",
			lockedMessage: `Locked. Complete ${remaining} more mission${remaining === 1 ? "" : "s"} to unlock this mission.`,
			actionLabel: MISSION_ACTION_LABEL.LOCKED,
		};
	});
}

/**
 * True when Bonus Engine still lists the mission as ACTIVE.
 * Period tabs and the mission grid ignore completed, inactive, and other engine statuses.
 */
export function isActiveEngineMission(
	mission: Pick<MissionCard, "missionStatus">,
): boolean {
	return mission.missionStatus === MISSION_STATUS.ACTIVE;
}

export function resolveMissionAction(payload: {
	triggerTypes: string[];
	providers: MissionCard["providers"];
	games: MissionCard["games"];
	leagues?: MissionCard["leagues"];
	categories?: MissionCard["categories"];
	sportsbookPath?: string;
}): ResolvedMissionAction {
	const triggerHaystack = payload.triggerTypes.join(" ");
	const league = firstPlayableLeague(payload.leagues ?? []);
	const category = firstNamedTarget(payload.categories ?? []);
	const sportsbookPath = payload.sportsbookPath?.trim() || "";
	const hasSportsTarget = Boolean(league || category || sportsbookPath);

	if (MISSION_TRIGGER_KEYWORD.INVITE.test(triggerHaystack)) {
		return {
			kind: "invite",
			label: MISSION_ACTION_LABEL.INVITE,
			href: MISSION_ROUTE.INVITE,
		};
	}
	if (MISSION_TRIGGER_KEYWORD.DEPOSIT.test(triggerHaystack)) {
		return {
			kind: "deposit",
			label: MISSION_ACTION_LABEL.DEPOSIT,
			href: MISSION_ROUTE.WALLET,
		};
	}
	if (MISSION_TRIGGER_KEYWORD.VIRTUAL.test(triggerHaystack)) {
		return {
			kind: "virtuals",
			label: MISSION_ACTION_LABEL.VIRTUALS,
			href: MISSION_ROUTE.CASINO,
			search: { category: "virtuals" },
		};
	}
	if (MISSION_TRIGGER_KEYWORD.SPORTS.test(triggerHaystack) || hasSportsTarget) {
		return sportsbookAction({ league, category, sportsbookPath });
	}

	const playGame = firstPlayableGame(payload.games);
	if (playGame) {
		return {
			kind: "casino",
			label: `Play ${playGame.name}`,
			href: MISSION_ROUTE.CASINO,
			search: { [MISSION_PLAY_SEARCH_KEY]: playGame.uniqueId },
		};
	}

	const realProviders = payload.providers.filter(
		(provider) => !isPlaceholderUniqueId(provider.uniqueId),
	);
	if (
		MISSION_TRIGGER_KEYWORD.WAGER_OR_BET.test(triggerHaystack) &&
		realProviders.length === 0
	) {
		return sportsbookAction({ league, category, sportsbookPath });
	}

	if (realProviders.length > 0) {
		return {
			kind: "casino",
			label: MISSION_ACTION_LABEL.CASINO,
			href: MISSION_ROUTE.CASINO,
		};
	}

	return {
		kind: "generic",
		label: MISSION_ACTION_LABEL.PLAY,
		href: MISSION_ROUTE.CASINO,
	};
}

function sportsbookAction(payload: {
	league: MissionCard["leagues"][number] | null;
	category: MissionCard["categories"][number] | null;
	sportsbookPath: string;
}): ResolvedMissionAction {
	const splat =
		payload.sportsbookPath ||
		(payload.league && isDatabetTournamentGin(payload.league.uniqueId)
			? sportsbookTournamentSplat(payload.league.uniqueId)
			: MISSION_SPORTSBOOK_FOOTBALL_PREMATCH);
	const targetName =
		payload.league && payload.league.name !== "League"
			? payload.league.name
			: payload.category?.name;
	return {
		kind: "sports",
		label: targetName ? `Play ${targetName}` : MISSION_ACTION_LABEL.SPORTS,
		href: sportsbookHrefFromSplat(splat),
	};
}

function parseProviderGames(value: unknown): {
	providers: MissionCard["providers"];
	games: MissionCard["games"];
} {
	if (!Array.isArray(value)) return { providers: [], games: [] };

	const providers: MissionCard["providers"] = [];
	const games: MissionCard["games"] = [];
	const seenProviders = new Set<string>();

	for (const entry of value) {
		if (typeof entry !== "object" || entry === null) continue;
		const row = entry as Record<string, unknown>;
		const provider =
			typeof row.provider === "object" && row.provider !== null
				? (row.provider as Record<string, unknown>)
				: null;
		const providerName = asString(provider?.name);
		const providerId = asString(provider?.unique_id);
		if (providerName || providerId) {
			const key = providerId || providerName;
			if (!seenProviders.has(key)) {
				seenProviders.add(key);
				providers.push({
					uniqueId: providerId,
					name: providerName || "Provider",
				});
			}
		}

		const gameList = Array.isArray(row.game) ? row.game : [];
		for (const game of gameList) {
			if (typeof game !== "object" || game === null) continue;
			const gameRow = game as Record<string, unknown>;
			const name = asString(gameRow.name);
			const uniqueId = asString(gameRow.unique_id);
			if (!name && !uniqueId) continue;
			games.push({
				uniqueId,
				name: name || "Game",
				providerName: providerName || "Provider",
			});
		}
	}

	return { providers, games };
}

function parseSportsTargets(value: unknown): {
	leagues: MissionCard["leagues"];
	categories: MissionCard["categories"];
} {
	if (!Array.isArray(value)) return { leagues: [], categories: [] };

	const leagues: MissionCard["leagues"] = [];
	const categories: MissionCard["categories"] = [];
	const seenLeagues = new Set<string>();
	const seenCategories = new Set<string>();

	for (const entry of value) {
		if (typeof entry !== "object" || entry === null) continue;
		const row = entry as Record<string, unknown>;
		const category =
			typeof row.category === "object" && row.category !== null
				? (row.category as Record<string, unknown>)
				: null;
		const categoryId = asIdString(category?.unique_id ?? category?.id);
		const categoryName = asString(category?.name);
		if (categoryId || categoryName) {
			const key = categoryId || categoryName.toLowerCase();
			if (!seenCategories.has(key)) {
				seenCategories.add(key);
				categories.push({
					uniqueId: categoryId,
					name: categoryName || "Category",
				});
			}
		}

		const leagueList = Array.isArray(row.leagues) ? row.leagues : [];
		for (const leagueEntry of leagueList) {
			if (typeof leagueEntry !== "object" || leagueEntry === null) continue;
			const wrapped = leagueEntry as Record<string, unknown>;
			const leagueRow =
				typeof wrapped.league === "object" && wrapped.league !== null
					? (wrapped.league as Record<string, unknown>)
					: wrapped;
			const uniqueId = asIdString(leagueRow.unique_id ?? leagueRow.id);
			const name = asString(leagueRow.name);
			if (!uniqueId && !name) continue;
			const key = uniqueId || name.toLowerCase();
			if (seenLeagues.has(key)) continue;
			seenLeagues.add(key);
			leagues.push({
				uniqueId,
				name: name || "League",
			});
		}
	}

	return { leagues, categories };
}

function parseMissionTriggers(value: unknown): ParsedMissionTriggers {
	if (!Array.isArray(value)) {
		return {
			types: [],
			progressTarget: 0,
			rewardPoints: 0,
			rewardLabel: null,
			description: null,
		};
	}

	const types: string[] = [];
	let progressTarget = 0;
	let rewardPoints = 0;
	let rewardLabel: string | null = null;
	let description: string | null = null;

	for (const entry of value) {
		if (typeof entry === "string") {
			types.push(entry);
			continue;
		}
		if (typeof entry !== "object" || entry === null) continue;
		const row = entry as Record<string, unknown>;
		const type = asString(row.type ?? row.name ?? row.trigger ?? row.event);
		if (type) types.push(type);

		const parameters =
			typeof row.parameters === "object" && row.parameters !== null
				? (row.parameters as Record<string, unknown>)
				: null;
		if (!parameters) continue;

		const betAmount = asNumber(parameters.amount);
		progressTarget = Math.max(
			progressTarget,
			betAmount,
			asNumber(parameters.min_bet),
			asNumber(parameters.days),
		);

		const rewards = Array.isArray(parameters.rewards) ? parameters.rewards : [];
		for (const reward of rewards) {
			if (typeof reward !== "object" || reward === null) continue;
			const rewardRow = reward as Record<string, unknown>;
			const amount = asNumber(rewardRow.amount);
			const rewardType = asString(rewardRow.type) || MISSION_REWARD_TYPE.POINTS;
			if (amount <= 0) continue;
			if (
				rewardType.toLowerCase() === MISSION_REWARD_TYPE.POINTS.toLowerCase()
			) {
				rewardPoints += amount;
			}
			if (!rewardLabel) {
				rewardLabel = formatMissionReward({
					amount,
					type: rewardType,
				});
			}
		}

		if (!description && type) {
			description = fillTriggerPlaceholders({
				template: type,
				parameters,
				rewardLabel,
			});
		}
	}

	return { types, progressTarget, rewardPoints, rewardLabel, description };
}

/**
 * Transposes Admin `parameters` into the trigger type so the card copy
 * matches the configured rule instead of generic fallback text.
 * `days` fills the days clause even when Admin baked a number instead of `X`.
 * Remaining `X` tokens take stake (`amount` / `min_bet`, including 0) then reward.
 */
function fillTriggerPlaceholders(payload: {
	template: string;
	parameters: Record<string, unknown>;
	rewardLabel: string | null;
}): string | null {
	const withDays = fillDaysInTriggerType({
		template: payload.template,
		days: parameterDisplay(payload.parameters.days),
	});
	const stake =
		parameterDisplay(payload.parameters.amount) ??
		parameterDisplay(payload.parameters.min_bet);
	const values: string[] = [];
	if (stake != null) {
		values.push(stake);
		if (payload.rewardLabel) values.push(payload.rewardLabel);
	}

	let index = 0;
	const filled = withDays.replace(
		new RegExp(`\\b${MISSION_TRIGGER_PLACEHOLDER}\\b`, "g"),
		() => {
			const value = values[index];
			index += 1;
			return value ?? MISSION_TRIGGER_PLACEHOLDER;
		},
	);
	if (hasTriggerPlaceholder(filled)) return null;
	if (filled !== payload.template) return filled;
	return null;
}

/**
 * Replaces the number or `X` immediately before `day` / `days` with `parameters.days`.
 */
function fillDaysInTriggerType(payload: {
	template: string;
	days: string | null;
}): string {
	if (payload.days == null) return payload.template;
	return payload.template.replace(MISSION_TRIGGER_DAYS_SLOT, `${payload.days}$2`);
}

/**
 * Raw Admin parameter as display text. `0` is kept; missing/blank is not.
 */
function parameterDisplay(value: unknown): string | null {
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	if (typeof value === "string" && value.trim() !== "") return value.trim();
	return null;
}

/**
 * Points stay `{amount} {type}`. Real Cash is naira only — no type label.
 */
function formatMissionReward(payload: { amount: number; type: string }): string {
	if (payload.type.toLowerCase() === MISSION_REWARD_TYPE.REAL_CASH.toLowerCase()) {
		return `${MISSION_CURRENCY_SYMBOL}${payload.amount.toLocaleString("en-NG")}`;
	}
	return `${payload.amount} ${payload.type}`;
}

function hasTriggerPlaceholder(text: string): boolean {
	return new RegExp(`\\b${MISSION_TRIGGER_PLACEHOLDER}\\b`).test(text);
}

function firstPlayableGame(
	games: MissionCard["games"],
): MissionCard["games"][number] | null {
	return (
		games.find(
			(game) =>
				Boolean(game.uniqueId) && !isPlaceholderUniqueId(game.uniqueId),
		) ?? null
	);
}

function firstNamedTarget(
	targets: Array<{ uniqueId: string; name: string }>,
): { uniqueId: string; name: string } | null {
	return (
		targets.find((target) => {
			const hasName =
				Boolean(target.name) &&
				target.name !== "League" &&
				target.name !== "Category";
			const hasId =
				Boolean(target.uniqueId) && !isPlaceholderUniqueId(target.uniqueId);
			return hasName || hasId;
		}) ?? null
	);
}

function firstPlayableLeague(
	leagues: MissionCard["leagues"],
): MissionCard["leagues"][number] | null {
	return firstNamedTarget(leagues);
}

function isPlaceholderUniqueId(value: string): boolean {
	const normalized = value.trim().toLowerCase();
	return !normalized || MISSION_PLACEHOLDER_UNIQUE_IDS.has(normalized);
}

function sumMissionPoints(value: unknown): number {
	if (!Array.isArray(value)) return 0;
	return value.reduce((total, entry) => {
		if (typeof entry !== "object" || entry === null) return total;
		return total + asNumber((entry as Record<string, unknown>).points);
	}, 0);
}

function resolveProgressTarget(payload: {
	record: MissionRecord;
	triggerTarget: number;
}): number {
	const points = payload.record.missions_points;
	if (Array.isArray(points) && points.length > 0) {
		const maxMission = points.reduce((max, entry) => {
			if (typeof entry !== "object" || entry === null) return max;
			return Math.max(
				max,
				asNumber((entry as Record<string, unknown>).mission),
			);
		}, 0);
		return Math.max(1, maxMission, points.length);
	}
	const explicit = asNumber(
		payload.record.target ??
			payload.record.goal ??
			payload.record.required_count,
	);
	if (explicit > 0) return explicit;
	if (payload.triggerTarget > 0) return payload.triggerTarget;
	return 1;
}

function resolveProgressCurrent(payload: {
	status: MissionCard["status"];
	progressPercentage: number;
	progressTarget: number;
	record: MissionRecord;
}): number {
	if (payload.status === "completed") return payload.progressTarget;
	const explicit = asNumber(
		payload.record.progress_current ??
			payload.record.current ??
			payload.record.completed_count,
	);
	if (explicit > 0) return Math.min(explicit, payload.progressTarget);
	if (payload.progressPercentage > 0) {
		return Math.min(
			payload.progressTarget,
			Math.round((payload.progressPercentage / 100) * payload.progressTarget),
		);
	}
	return 0;
}

function resolvePeriod(payload: {
	startAt: string | null;
	endAt: string | null;
}): MissionCadence {
	if (!payload.startAt || !payload.endAt) return "monthly";
	const start = Date.parse(payload.startAt);
	const end = Date.parse(payload.endAt);
	if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
		return "monthly";
	}
	const span = end - start;
	if (span <= DAILY_MAX_MS) return "daily";
	if (span <= WEEKLY_MAX_MS) return "weekly";
	return "monthly";
}

function resolveMissionStatus(payload: {
	missionStatus: string;
	numericStatus: number;
	progressPercentage: number;
	progressTarget: number;
	startAt: string | null;
	endAt: string | null;
}): MissionCard["status"] {
	if (
		payload.missionStatus === MISSION_STATUS.COMPLETED ||
		payload.missionStatus === MISSION_STATUS.COMPLETE ||
		payload.progressPercentage >= 100
	) {
		return "completed";
	}
	if (
		payload.missionStatus === MISSION_STATUS.INACTIVE ||
		payload.numericStatus === 0
	) {
		return "ended";
	}

	const now = Date.now();
	if (payload.startAt) {
		const start = Date.parse(payload.startAt);
		if (Number.isFinite(start) && start > now) return "upcoming";
	}
	if (payload.endAt) {
		const end = Date.parse(payload.endAt);
		if (Number.isFinite(end) && end < now) return "ended";
	}
	return "active";
}

function resolveProgressLabel(payload: {
	status: MissionCard["status"];
	actionKind: MissionActionKind;
	providers: MissionCard["providers"];
	games: MissionCard["games"];
	leagues: MissionCard["leagues"];
	categories: MissionCard["categories"];
}): string {
	if (payload.status === "completed") return "Completed";
	if (payload.actionKind === "invite") return "Referral";
	if (payload.games[0]?.name) return payload.games[0].name;
	if (payload.leagues[0]?.name) return payload.leagues[0].name;
	if (payload.categories[0]?.name) return payload.categories[0].name;
	if (payload.providers[0]?.name) return payload.providers[0].name;
	return "Progress";
}

function fallbackTitle(payload: {
	level: string;
	actionKind: MissionActionKind;
	providers: MissionCard["providers"];
	games: MissionCard["games"];
	leagues?: MissionCard["leagues"];
	categories?: MissionCard["categories"];
}): string {
	if (payload.games[0]?.name) return `Play ${payload.games[0].name}`;
	if (payload.leagues?.[0]?.name) return `Play ${payload.leagues[0].name}`;
	if (payload.categories?.[0]?.name) return `Play ${payload.categories[0].name}`;
	if (payload.providers[0]?.name) {
		return `Play ${payload.providers[0].name}`;
	}
	const byKind: Record<MissionActionKind, string> = {
		sports: "Sports Mission",
		casino: "Casino Mission",
		virtuals: "Virtuals Mission",
		deposit: "Deposit Funds",
		invite: "Refer a Friend",
		generic: `${payload.level} Mission`,
	};
	return byKind[payload.actionKind];
}

function fallbackDescription(payload: {
	actionKind: MissionActionKind;
	providers: MissionCard["providers"];
	games: MissionCard["games"];
	leagues: MissionCard["leagues"];
	categories: MissionCard["categories"];
	progressTarget: number;
	triggerTypes: string[];
}): string {
	if (
		payload.triggerTypes[0] &&
		!hasTriggerPlaceholder(payload.triggerTypes[0])
	) {
		return payload.triggerTypes[0];
	}
	if (payload.games.length > 0) {
		const names = payload.games
			.slice(0, 2)
			.map((game) => game.name)
			.join(", ");
		return `Complete play on ${names}${payload.games.length > 2 ? " and more" : ""}.`;
	}
	if (payload.leagues.length > 0) {
		const names = payload.leagues
			.slice(0, 2)
			.map((league) => league.name)
			.join(", ");
		return `Place a qualifying bet on ${names}${payload.leagues.length > 2 ? " and more" : ""}.`;
	}
	if (payload.categories.length > 0) {
		return `Place a qualifying bet on ${payload.categories[0].name}.`;
	}
	if (payload.providers.length > 0) {
		return `Complete the required play on ${payload.providers.map((provider) => provider.name).join(", ")}.`;
	}
	if (payload.triggerTypes[0]) {
		return payload.triggerTypes[0];
	}
	const byKind: Record<MissionActionKind, string> = {
		sports: `Place ${payload.progressTarget} qualifying sports bet${payload.progressTarget === 1 ? "" : "s"}.`,
		casino: "Play eligible casino games to earn XP.",
		virtuals: `Play ${payload.progressTarget} virtual sports game${payload.progressTarget === 1 ? "" : "s"}.`,
		deposit: "Make a deposit to complete this mission.",
		invite: "Invite a friend to SportsDey.",
		generic: "Complete the required play to earn rewards.",
	};
	return byKind[payload.actionKind];
}

function asString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function asIdString(value: unknown): string {
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return asString(value);
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
	return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function clampPercent(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(100, value));
}
