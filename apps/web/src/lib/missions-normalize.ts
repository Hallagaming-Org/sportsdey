import {
	MISSION_ACTION_LABEL,
	MISSION_PLAY_SEARCH_KEY,
	MISSION_REWARD_TYPE,
	MISSION_ROUTE,
	MISSION_TRIGGER_KEYWORD,
} from "./missions.constant";

export type MissionCadence = "daily" | "weekly" | "monthly";

export type MissionPeriod = "all" | MissionCadence;

/** Where the CTA should send the player for this mission. */
export type MissionActionKind =
	| "sports"
	| "casino"
	| "virtuals"
	| "deposit"
	| "invite"
	| "generic";

/** Normalized mission card model for the Missions UI. */
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
	lockedMessage: string | null;
	actionLabel: string;
	/** Path only (no query string) — use `actionSearch` for play deep-links. */
	actionHref: string;
	/** Optional TanStack search params (e.g. `{ play: gameUniqueId }`). */
	actionSearch?: { play?: string };
	actionKind: MissionActionKind;
	/** Providers that qualify bets toward this mission (from provider_games). */
	providers: Array<{ uniqueId: string; name: string }>;
	/** Specific games under those providers, when Admin configured them. */
	games: Array<{ uniqueId: string; name: string; providerName: string }>;
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
};

type ResolvedMissionAction = {
	kind: MissionActionKind;
	label: string;
	href: string;
	search?: { play?: string };
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAILY_MAX_MS = 1.5 * MS_PER_DAY;
const WEEKLY_MAX_MS = 8 * MS_PER_DAY;

/**
 * Maps opaque Bonus Engine mission payloads into a stable UI model.
 * List items are campaign definitions; progress % is not always present until
 * gamification callbacks land — we derive a sensible current/target pair.
 */
export function normalizeMissionRecord(
	record: MissionRecord,
	index = 0,
): MissionCard {
	const id =
		asString(record._id ?? record.mission_id ?? record.id) || `mission-${index}`;
	const level = asString(record.mission_level ?? record.level) || "Mission";
	const { providers, games } = parseProviderGames(record.provider_games);
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
	});
	const title =
		asString(record.title ?? record.name ?? record.mission_name) ||
		fallbackTitle({ level, actionKind: action.kind, providers, games });
	const description =
		asString(record.description ?? record.details ?? record.objective) ||
		fallbackDescription({
			actionKind: action.kind,
			providers,
			games,
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
		}),
		rewardPoints,
		rewardLabel,
		status,
		lockedMessage: null,
		actionLabel:
			status === "completed" ? MISSION_ACTION_LABEL.COMPLETED : action.label,
		actionHref: action.href,
		...(action.search ? { actionSearch: action.search } : {}),
		actionKind: action.kind,
		providers,
		games,
		startAt,
		endAt,
		completedAt:
			status === "completed"
				? asDateString(record.completed_at ?? record.updatedAt) || endAt
				: null,
	};
}

/**
 * Higher mission levels stay locked until earlier levels are completed.
 * Matches the design's "Complete N more missions to unlock" state.
 */
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
 * Resolves CTA destination from Admin trigger types + configured provider_games.
 * Never keyword-matches casino game titles (e.g. "Football Golden Cup") into Sports.
 */
export function resolveMissionAction(payload: {
	triggerTypes: string[];
	providers: MissionCard["providers"];
	games: MissionCard["games"];
}): ResolvedMissionAction {
	const triggerHaystack = payload.triggerTypes.join(" ");

	if (MISSION_TRIGGER_KEYWORD.INVITE.test(triggerHaystack)) {
		return {
			kind: "invite",
			label: MISSION_ACTION_LABEL.INVITE,
			href: MISSION_ROUTE.ACCOUNT,
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
		};
	}
	if (MISSION_TRIGGER_KEYWORD.SPORTS.test(triggerHaystack)) {
		return {
			kind: "sports",
			label: MISSION_ACTION_LABEL.SPORTS,
			href: MISSION_ROUTE.SPORTS,
		};
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

	if (
		payload.providers.length > 0 ||
		MISSION_TRIGGER_KEYWORD.WAGER_OR_BET.test(triggerHaystack)
	) {
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

/**
 * Sample missions used when the live API is unavailable so the redesigned UI can be previewed.
 */
export const MISSIONS_PREVIEW_CARDS: MissionCard[] = applyMissionLevelLocks([
	{
		id: "preview-place-3",
		level: "Level1",
		title: "Place 3 Bets",
		description: "Place 3 bets on any sports",
		period: "daily",
		progressCurrent: 2,
		progressTarget: 3,
		progressLabel: "Prize Pool",
		rewardPoints: 200,
		rewardLabel: "200 XP",
		status: "active",
		lockedMessage: null,
		actionLabel: MISSION_ACTION_LABEL.SPORTS,
		actionHref: MISSION_ROUTE.SPORTS,
		actionKind: "sports",
		providers: [],
		games: [],
		startAt: new Date().toISOString(),
		endAt: new Date(Date.now() + MS_PER_DAY).toISOString(),
		completedAt: null,
	},
	{
		id: "preview-different-sports",
		level: "Level1",
		title: "Bet on 2 Different Sports",
		description: "Place bets on 2 unique sports",
		period: "daily",
		progressCurrent: 1,
		progressTarget: 2,
		progressLabel: "Prize Pool",
		rewardPoints: 150,
		rewardLabel: "150 XP",
		status: "active",
		lockedMessage: null,
		actionLabel: MISSION_ACTION_LABEL.SPORTS,
		actionHref: MISSION_ROUTE.SPORTS,
		actionKind: "sports",
		providers: [],
		games: [],
		startAt: new Date().toISOString(),
		endAt: new Date(Date.now() + MS_PER_DAY).toISOString(),
		completedAt: null,
	},
	{
		id: "preview-win-bet",
		level: "Level1",
		title: "Win a Bet",
		description: "Win any sports bet today",
		period: "daily",
		progressCurrent: 0,
		progressTarget: 1,
		progressLabel: "Prize Pool",
		rewardPoints: 300,
		rewardLabel: "300 XP",
		status: "active",
		lockedMessage: null,
		actionLabel: MISSION_ACTION_LABEL.SPORTS,
		actionHref: MISSION_ROUTE.SPORTS,
		actionKind: "sports",
		providers: [],
		games: [],
		startAt: new Date().toISOString(),
		endAt: new Date(Date.now() + MS_PER_DAY).toISOString(),
		completedAt: null,
	},
	{
		id: "preview-deposit",
		level: "Level1",
		title: "Deposit Funds",
		description: "Make a Deposit",
		period: "daily",
		progressCurrent: 1,
		progressTarget: 1,
		progressLabel: "Completed",
		rewardPoints: 200,
		rewardLabel: "200 XP",
		status: "completed",
		lockedMessage: null,
		actionLabel: MISSION_ACTION_LABEL.COMPLETED,
		actionHref: MISSION_ROUTE.WALLET,
		actionKind: "deposit",
		providers: [],
		games: [],
		startAt: new Date(Date.now() - MS_PER_DAY).toISOString(),
		endAt: new Date(Date.now() + MS_PER_DAY).toISOString(),
		completedAt: new Date().toISOString(),
	},
	{
		id: "preview-refer",
		level: "Level1",
		title: "Refer a Friend",
		description: "Invite a friend to SportsDey",
		period: "weekly",
		progressCurrent: 0,
		progressTarget: 1,
		progressLabel: "Referral",
		rewardPoints: 500,
		rewardLabel: "500 XP",
		status: "active",
		lockedMessage: null,
		actionLabel: MISSION_ACTION_LABEL.INVITE,
		actionHref: MISSION_ROUTE.ACCOUNT,
		actionKind: "invite",
		providers: [],
		games: [],
		startAt: new Date().toISOString(),
		endAt: new Date(Date.now() + 7 * MS_PER_DAY).toISOString(),
		completedAt: null,
	},
	{
		id: "preview-virtuals",
		level: "Level1",
		title: "Play Virtuals",
		description: "Play 2 virtual sports games",
		period: "daily",
		progressCurrent: 0,
		progressTarget: 2,
		progressLabel: "Prize Pool",
		rewardPoints: 150,
		rewardLabel: "150 XP",
		status: "active",
		lockedMessage: null,
		actionLabel: MISSION_ACTION_LABEL.VIRTUALS,
		actionHref: MISSION_ROUTE.CASINO,
		actionKind: "virtuals",
		providers: [],
		games: [],
		startAt: new Date().toISOString(),
		endAt: new Date(Date.now() + MS_PER_DAY).toISOString(),
		completedAt: null,
	},
	{
		id: "preview-casino",
		level: "Level1",
		title: "Play Casino Games",
		description: "Play any casino game",
		period: "weekly",
		progressCurrent: 1,
		progressTarget: 1,
		progressLabel: "Completed",
		rewardPoints: 100,
		rewardLabel: "100 XP",
		status: "completed",
		lockedMessage: null,
		actionLabel: MISSION_ACTION_LABEL.COMPLETED,
		actionHref: MISSION_ROUTE.CASINO,
		actionKind: "casino",
		providers: [{ uniqueId: "pragmatic", name: "Pragmatic" }],
		games: [],
		startAt: new Date(Date.now() - 2 * MS_PER_DAY).toISOString(),
		endAt: new Date(Date.now() + 5 * MS_PER_DAY).toISOString(),
		completedAt: new Date(Date.now() - MS_PER_DAY).toISOString(),
	},
	{
		id: "preview-watch",
		level: "Level2",
		title: "Watch & Earn",
		description: "Watch 2 videos to earn XP",
		period: "daily",
		progressCurrent: 0,
		progressTarget: 2,
		progressLabel: "Prize Pool",
		rewardPoints: 80,
		rewardLabel: "80 XP",
		status: "active",
		lockedMessage: null,
		actionLabel: MISSION_ACTION_LABEL.PLAY,
		actionHref: MISSION_ROUTE.VIDEOS,
		actionKind: "generic",
		providers: [],
		games: [],
		startAt: new Date().toISOString(),
		endAt: new Date(Date.now() + MS_PER_DAY).toISOString(),
		completedAt: null,
	},
	{
		id: "preview-login-done",
		level: "Level1",
		title: "Login to SportsDey",
		description: "Log in to your account",
		period: "daily",
		progressCurrent: 1,
		progressTarget: 1,
		progressLabel: "Completed",
		rewardPoints: 50,
		rewardLabel: "50 XP",
		status: "completed",
		lockedMessage: null,
		actionLabel: MISSION_ACTION_LABEL.COMPLETED,
		actionHref: MISSION_ROUTE.ACCOUNT,
		actionKind: "generic",
		providers: [],
		games: [],
		startAt: new Date(Date.now() - 20 * MS_PER_DAY).toISOString(),
		endAt: new Date(Date.now() - 19 * MS_PER_DAY).toISOString(),
		completedAt: "2026-05-10T08:15:00.000Z",
	},
]);

/**
 * Parses Bonus Engine `provider_games` into flat provider and game lists.
 * Empty provider/game entries mean "no game filter configured yet" — any bet
 * may still count once Admin fills them in and `/bet` reporting is wired.
 */
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

/**
 * Reads Admin `mission_triggers` for CTA classification, progress targets,
 * and rewards (`parameters.rewards` — preferred over legacy `missions_points`).
 */
function parseMissionTriggers(value: unknown): ParsedMissionTriggers {
	if (!Array.isArray(value)) {
		return {
			types: [],
			progressTarget: 0,
			rewardPoints: 0,
			rewardLabel: null,
		};
	}

	const types: string[] = [];
	let progressTarget = 0;
	let rewardPoints = 0;
	let rewardLabel: string | null = null;

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

		progressTarget = Math.max(
			progressTarget,
			asNumber(parameters.amount),
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
				rewardLabel = `${amount} ${rewardType}`;
			}
		}
	}

	return { types, progressTarget, rewardPoints, rewardLabel };
}

function firstPlayableGame(
	games: MissionCard["games"],
): MissionCard["games"][number] | null {
	return games.find((game) => Boolean(game.uniqueId)) ?? null;
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
		payload.missionStatus === "COMPLETED" ||
		payload.missionStatus === "COMPLETE" ||
		payload.progressPercentage >= 100
	) {
		return "completed";
	}
	if (payload.missionStatus === "INACTIVE" || payload.numericStatus === 0) {
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
}): string {
	if (payload.status === "completed") return "Completed";
	if (payload.actionKind === "invite") return "Referral";
	if (payload.games[0]?.name) return payload.games[0].name;
	if (payload.providers[0]?.name) return payload.providers[0].name;
	return "Progress";
}

function fallbackTitle(payload: {
	level: string;
	actionKind: MissionActionKind;
	providers: MissionCard["providers"];
	games: MissionCard["games"];
}): string {
	if (payload.games[0]?.name) return `Play ${payload.games[0].name}`;
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
	progressTarget: number;
	triggerTypes: string[];
}): string {
	if (payload.triggerTypes[0]) return payload.triggerTypes[0];
	if (payload.games.length > 0) {
		const names = payload.games
			.slice(0, 2)
			.map((game) => game.name)
			.join(", ");
		return `Complete play on ${names}${payload.games.length > 2 ? " and more" : ""}.`;
	}
	if (payload.providers.length > 0) {
		return `Complete the required play on ${payload.providers.map((provider) => provider.name).join(", ")}.`;
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
