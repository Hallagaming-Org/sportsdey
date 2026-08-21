import { apiRequest } from "@/lib/api";

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
	actionHref: string;
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

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAILY_MAX_MS = 1.5 * MS_PER_DAY;
const WEEKLY_MAX_MS = 8 * MS_PER_DAY;

const ACTION_BY_KIND: Record<
	MissionActionKind,
	{ label: string; href: string }
> = {
	sports: { label: "Go to Sports", href: "/sportsbetting" },
	casino: { label: "Go to Casino", href: "/games" },
	virtuals: { label: "Go to Virtuals", href: "/games?category=virtuals" },
	deposit: { label: "Deposit Now", href: "/wallet" },
	invite: { label: "Invite Now", href: "/account" },
	generic: { label: "Play Now", href: "/games" },
};

/**
 * Fetches the authenticated player's mission list from SportsDey (`POST /mission/list`).
 */
export async function fetchMissionList(): Promise<MissionCard[]> {
	const data = await apiRequest<MissionRecord[]>("mission/list", {
		method: "POST",
		credentials: "include",
		body: JSON.stringify({}),
	});
	const cards = (Array.isArray(data) ? data : []).map(normalizeMissionRecord);
	return applyMissionLevelLocks(cards);
}

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
	const rewardPoints = sumMissionPoints(record.missions_points);
	const progressTarget = resolveProgressTarget(record);
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
	const actionKind = resolveActionKind({
		record,
		providers,
		games,
	});
	const action = ACTION_BY_KIND[actionKind];
	const title =
		asString(record.title ?? record.name ?? record.mission_name) ||
		fallbackTitle({ level, actionKind, providers, games });
	const description =
		asString(record.description ?? record.details ?? record.objective) ||
		fallbackDescription({ actionKind, providers, games, progressTarget });

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
			actionKind,
			providers,
		}),
		rewardPoints,
		rewardLabel: rewardPoints > 0 ? `${rewardPoints} XP` : "Reward TBD",
		status,
		lockedMessage: null,
		actionLabel: status === "completed" ? "Completed" : action.label,
		actionHref: action.href,
		actionKind,
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
			actionLabel: "Locked",
		};
	});
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
		actionLabel: "Go to Sports",
		actionHref: "/sportsbetting",
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
		actionLabel: "Go to Sports",
		actionHref: "/sportsbetting",
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
		actionLabel: "Go to Sports",
		actionHref: "/sportsbetting",
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
		actionLabel: "Completed",
		actionHref: "/wallet",
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
		actionLabel: "Invite Now",
		actionHref: "/account",
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
		actionLabel: "Go to Virtuals",
		actionHref: "/games",
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
		actionLabel: "Completed",
		actionHref: "/games",
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
		actionLabel: "Play Now",
		actionHref: "/videos",
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
		actionLabel: "Completed",
		actionHref: "/account",
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
				providers.push({ uniqueId: providerId, name: providerName || "Provider" });
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

function sumMissionPoints(value: unknown): number {
	if (!Array.isArray(value)) return 0;
	return value.reduce((total, entry) => {
		if (typeof entry !== "object" || entry === null) return total;
		return total + asNumber((entry as Record<string, unknown>).points);
	}, 0);
}

function resolveProgressTarget(record: MissionRecord): number {
	const points = record.missions_points;
	if (Array.isArray(points) && points.length > 0) {
		const maxMission = points.reduce((max, entry) => {
			if (typeof entry !== "object" || entry === null) return max;
			return Math.max(max, asNumber((entry as Record<string, unknown>).mission));
		}, 0);
		return Math.max(1, maxMission, points.length);
	}
	const explicit = asNumber(record.target ?? record.goal ?? record.required_count);
	return explicit > 0 ? explicit : 1;
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
	if (
		payload.missionStatus === "INACTIVE" ||
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

/**
 * Infers CTA destination from mission text + configured providers/games.
 * `provider_games` is the Admin allow-list for which bets count; we also use
 * provider/game names to route the player to the right product surface.
 */
function resolveActionKind(payload: {
	record: MissionRecord;
	providers: MissionCard["providers"];
	games: MissionCard["games"];
}): MissionActionKind {
	const haystack = [
		asString(payload.record.mission_name),
		asString(payload.record.title),
		asString(payload.record.description),
		asString(payload.record.mission_level),
		...payload.providers.map((provider) => provider.name),
		...payload.games.map((game) => `${game.providerName} ${game.name}`),
		...parseTriggerText(payload.record.mission_triggers),
	]
		.join(" ")
		.toLowerCase();

	if (/\b(refer|invite|friend)\b/.test(haystack)) return "invite";
	if (/\bdeposit\b/.test(haystack)) return "deposit";
	if (/\bvirtual\b/.test(haystack)) return "virtuals";
	if (/\b(sport|football|soccer|nba|betting)\b/.test(haystack)) return "sports";
	if (
		/\b(casino|slot|roulette|blackjack|pragmatic|evolution|live casino)\b/.test(
			haystack,
		)
	) {
		return "casino";
	}
	if (payload.games.length > 0 || payload.providers.length > 0) return "casino";
	return "generic";
}

function parseTriggerText(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((entry) => {
		if (typeof entry === "string") return [entry];
		if (typeof entry !== "object" || entry === null) return [];
		const row = entry as Record<string, unknown>;
		return [
			asString(row.type),
			asString(row.name),
			asString(row.trigger),
			asString(row.event),
		].filter(Boolean);
	});
}

function resolveProgressLabel(payload: {
	status: MissionCard["status"];
	actionKind: MissionActionKind;
	providers: MissionCard["providers"];
}): string {
	if (payload.status === "completed") return "Completed";
	if (payload.actionKind === "invite") return "Referral";
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
}): string {
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
