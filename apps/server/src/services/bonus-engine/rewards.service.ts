/**
 * Where Bonus Engine value lands in SportsDey wallets.
 *
 * - Cash rewards (mission Real Cash, tournament prizes, loyalty cash, bonus
 *   `cash_amount`) are withdrawable credits to the main wallet.
 * - Bonus funds (`bonus_amount`) are credited into the main wallet as a locked
 *   part (`wallet.bonus_balance`): playable on every game, not withdrawable
 *   until the engine reports the bonus COMPLETED.
 *
 * Every credit is keyed by a unique reference so engine retries and parallel
 * deliveries move money once.
 */
import {
	creditWalletCash,
	forfeitLockedBonus,
	grantLockedBonus,
	readWalletFunds,
	unlockLockedBonus,
} from "../../db/bonus-wallet";
import type { CloudflareBindings } from "../../types";
import {
	BONUS_ENGINE_BONUS_ACTIVATE_REFERENCE_PREFIX,
	BONUS_ENGINE_BONUS_FORFEIT_REFERENCE_PREFIX,
	BONUS_ENGINE_BONUS_STATUS,
	BONUS_ENGINE_BONUS_STATUS_REFERENCE_PREFIX,
	BONUS_ENGINE_LOYALTY_REDEEM_REFERENCE_PREFIX,
	BONUS_ENGINE_MISSION_REWARD_REFERENCE_PREFIX,
	BONUS_ENGINE_REWARD_TYPE,
	BONUS_ENGINE_TERMINAL_BONUS_STATUSES,
	BONUS_ENGINE_TOURNAMENT_PRIZE_REFERENCE_PREFIX,
	BONUS_ENGINE_WALLET_PAYMENT_METHOD,
} from "./bonus-engine.service.constant";
import { listActiveBonusEngineUserBonusIds } from "./persistence.service";

const KOBO_PER_MAJOR = 100;

export function majorToKobo(amountMajor: number): number {
	if (!Number.isFinite(amountMajor) || amountMajor <= 0) return 0;
	return Math.round(amountMajor * KOBO_PER_MAJOR);
}

// ---------------------------------------------------------------------------
// Missions
// ---------------------------------------------------------------------------

export type ParsedMissionCashReward = {
	amountMajor: number;
	rewardType: string;
};

/** `engine`: non-monetary rewards the engine applies itself (points, badges). */
export type MissionRewardKind = "real_cash" | "engine" | "unsupported";

export type ParsedMissionReward = {
	kind: MissionRewardKind;
	rewardType: string;
	amountMajor: number;
};

/**
 * Reads every `{ type, value | amount }` entry of a mission reward payload
 * (object or array). Entries without a positive amount are dropped.
 */
const ENGINE_APPLIED_REWARD_TYPES = new Set<string>([
	BONUS_ENGINE_REWARD_TYPE.POINTS.toLowerCase(),
	"point",
	"loyalty points",
	"badge",
	"badges",
]);

export function parseMissionRewards(reward: unknown): ParsedMissionReward[] {
	const candidates = Array.isArray(reward) ? reward : [reward];
	const parsed: ParsedMissionReward[] = [];
	for (const entry of candidates) {
		if (typeof entry !== "object" || entry === null) continue;
		const row = entry as Record<string, unknown>;
		const rewardType = typeof row.type === "string" ? row.type.trim() : "";
		if (!rewardType) continue;
		const kind = classifyMissionRewardType(rewardType);
		const amountMajor = asPositiveNumber(row.value ?? row.amount);
		// Badges name the badge instead of carrying an amount.
		if (amountMajor <= 0 && kind !== "engine") continue;
		parsed.push({ kind, rewardType, amountMajor });
	}
	return parsed;
}

function classifyMissionRewardType(rewardType: string): MissionRewardKind {
	const normalized = rewardType.toLowerCase().replace(/[_-]+/g, " ");
	if (normalized === BONUS_ENGINE_REWARD_TYPE.REAL_CASH.toLowerCase()) {
		return "real_cash";
	}
	if (ENGINE_APPLIED_REWARD_TYPES.has(normalized)) return "engine";
	return "unsupported";
}

export function parseMissionRealCashReward(
	reward: unknown,
): ParsedMissionCashReward | null {
	const cash = parseMissionRewards(reward).find(
		(entry) => entry.kind === "real_cash",
	);
	return cash
		? { amountMajor: cash.amountMajor, rewardType: cash.rewardType }
		: null;
}

export type MissionRewardCreditResult = {
	status:
		| "credited"
		| "already_credited"
		| "wallet_missing"
		| "engine_fulfilled"
		| "unfulfilled"
		| "skipped";
	credited: boolean;
	amountKobo: number;
	reference: string | null;
	rewardTypes: string[];
};

export function missionRewardReference(
	missionId: string,
	userId: string,
): string {
	return `${BONUS_ENGINE_MISSION_REWARD_REFERENCE_PREFIX}:${missionId}:${userId}`;
}

/**
 * Grants a mission reward once per mission + player.
 *
 * - Real Cash: credited to the main wallet (withdrawable).
 * - Points / Badges: non-monetary, the engine applies them itself.
 * - Anything else (bonus, free spins, free bets): SportsDey has no provider
 *   integration to grant it, so it is logged as `bonus_engine_reward_unfulfilled`
 *   for ops instead of silently skipped. The raw callback is stored either way.
 */
export async function creditMissionReward(payload: {
	env: CloudflareBindings;
	userId: string;
	missionId: string;
	reward: unknown;
}): Promise<MissionRewardCreditResult> {
	const rewards = parseMissionRewards(payload.reward);
	const rewardTypes = rewards.map((entry) => entry.rewardType);
	const cashMajor = rewards
		.filter((entry) => entry.kind === "real_cash")
		.reduce((sum, entry) => sum + entry.amountMajor, 0);
	const unsupported = rewards.filter((entry) => entry.kind === "unsupported");

	if (unsupported.length > 0) {
		console.error(
			JSON.stringify({
				tag: "bonus_engine_reward_unfulfilled",
				source: "mission",
				userId: payload.userId,
				missionId: payload.missionId,
				rewards: unsupported,
			}),
		);
	}

	const amountKobo = majorToKobo(cashMajor);
	if (amountKobo <= 0) {
		return {
			status:
				unsupported.length > 0
					? "unfulfilled"
					: rewards.length > 0
						? "engine_fulfilled"
						: "skipped",
			credited: false,
			amountKobo: 0,
			reference: null,
			rewardTypes,
		};
	}

	const reference = missionRewardReference(payload.missionId, payload.userId);
	const credit = await creditWalletCash({
		DB: payload.env.DB,
		userId: payload.userId,
		amountKobo,
		reference,
		paymentMethod: BONUS_ENGINE_WALLET_PAYMENT_METHOD.MISSION_REAL_CASH,
		metadata: {
			missionId: payload.missionId,
			rewardTypes,
			amountMajor: cashMajor,
		},
	});
	if (credit.status === "wallet_missing") {
		console.error("Mission Real Cash credit skipped — wallet missing", {
			userId: payload.userId,
			missionId: payload.missionId,
		});
	}
	return {
		status:
			credit.status === "credited"
				? "credited"
				: credit.status === "duplicate"
					? "already_credited"
					: "wallet_missing",
		credited: credit.status === "credited",
		amountKobo,
		reference,
		rewardTypes,
	};
}

// ---------------------------------------------------------------------------
// Bonus activation / allocation
// ---------------------------------------------------------------------------

export type BonusActivationCreditResult = {
	status: "skipped" | "credited" | "already_credited" | "wallet_missing";
	credited: boolean;
	bonusKobo: number;
	cashKobo: number;
};

export function bonusActivationReference(
	userbonusId: string,
	userId: string,
	part: "bonus" | "cash",
): string {
	return `${BONUS_ENGINE_BONUS_ACTIVATE_REFERENCE_PREFIX}:${userbonusId}:${userId}:${part}`;
}

/**
 * Credits SportsDey wallets once Bonus Engine accepts `activate_bonus` (or
 * allocates an already-active bonus). `bonus_amount` becomes locked bonus
 * funds in the main wallet; `cash_amount` is withdrawable cash. Each part is
 * idempotent via `be_bonus_activate:{userbonusId}:{userId}:{bonus|cash}`.
 */
export async function creditBonusActivation(payload: {
	env: CloudflareBindings;
	userId: string;
	userbonusId: string;
	bonusAmountMajor: number;
	cashAmountMajor: number;
}): Promise<BonusActivationCreditResult> {
	const bonusKobo = majorToKobo(payload.bonusAmountMajor);
	const cashKobo = majorToKobo(payload.cashAmountMajor);
	if (bonusKobo <= 0 && cashKobo <= 0) {
		return { status: "skipped", credited: false, bonusKobo: 0, cashKobo: 0 };
	}

	const metadata = { userbonusId: payload.userbonusId };
	const bonusResult =
		bonusKobo > 0
			? await grantLockedBonus({
					DB: payload.env.DB,
					userId: payload.userId,
					amountKobo: bonusKobo,
					reference: bonusActivationReference(
						payload.userbonusId,
						payload.userId,
						"bonus",
					),
					paymentMethod: BONUS_ENGINE_WALLET_PAYMENT_METHOD.BONUS_ACTIVATE,
					metadata: { ...metadata, walletKind: "bonus" },
				})
			: null;
	if (bonusResult?.status === "wallet_missing") {
		console.error("Bonus activation credit skipped — wallet missing", {
			userId: payload.userId,
			userbonusId: payload.userbonusId,
		});
		return { status: "wallet_missing", credited: false, bonusKobo, cashKobo };
	}

	const cashResult =
		cashKobo > 0
			? await creditWalletCash({
					DB: payload.env.DB,
					userId: payload.userId,
					amountKobo: cashKobo,
					reference: bonusActivationReference(
						payload.userbonusId,
						payload.userId,
						"cash",
					),
					paymentMethod: BONUS_ENGINE_WALLET_PAYMENT_METHOD.BONUS_ACTIVATE,
					metadata: { ...metadata, walletKind: "cash" },
				})
			: null;
	if (cashResult?.status === "wallet_missing") {
		console.error("Bonus activation cash credit skipped — wallet missing", {
			userId: payload.userId,
			userbonusId: payload.userbonusId,
		});
		return {
			status: "wallet_missing",
			credited: bonusResult?.status === "applied",
			bonusKobo,
			cashKobo,
		};
	}

	const credited =
		bonusResult?.status === "applied" || cashResult?.status === "credited";
	const already =
		bonusResult?.status === "duplicate" || cashResult?.status === "duplicate";
	return {
		status: credited ? "credited" : already ? "already_credited" : "skipped",
		credited,
		bonusKobo,
		cashKobo,
	};
}

// ---------------------------------------------------------------------------
// Bonus status changes (updateBonus) and cancel
// ---------------------------------------------------------------------------

export type BonusStatusWalletApplyResult = {
	status: "skipped" | "applied" | "already_applied" | "wallet_missing";
	applied: boolean;
	unlockedKobo: number;
	forfeitedKobo: number;
	grantedKobo: number;
};

/**
 * Applies an `updateBonus` status change to the locked bonus funds.
 *
 * The engine's amount-change sign convention is undocumented, so this is
 * driven by status and magnitudes instead:
 * - COMPLETED: `real_amount_change` is the converted amount → unlocked to
 *   cash (never minted; capped by what is locked). Bonus leaving beyond that
 *   (above `max_conversion_amount`) is forfeited.
 * - CANCELLED / EXPIRED / LOST: `bonus_amount_change` is forfeited.
 * - ACTIVE: the bonus is live → granted once, keyed like activation.
 * When a terminal status carries no amounts, falls back to this bonus's own
 * funds (everything locked if it is the player's only active bonus).
 * A negative real change never debits cash: the engine mirrors our ledger, it
 * does not own it. Terminal statuses happen once per bonus, so money refs are
 * per bonus + status and replays cannot apply twice.
 */
export async function applyBonusStatusWalletChanges(payload: {
	env: CloudflareBindings;
	userId: string;
	bonusId: string;
	bonusStatus: string;
	realAmountChangeMajor: number;
	bonusAmountChangeMajor: number;
}): Promise<BonusStatusWalletApplyResult> {
	const status = normalizeBonusStatus(payload.bonusStatus);
	const realChangeKobo = toKoboMagnitude(payload.realAmountChangeMajor);
	const bonusOutKobo = toKoboMagnitude(payload.bonusAmountChangeMajor);
	const convertedKobo = payload.realAmountChangeMajor > 0 ? realChangeKobo : 0;
	const result: BonusStatusWalletApplyResult = {
		status: "skipped",
		applied: false,
		unlockedKobo: 0,
		forfeitedKobo: 0,
		grantedKobo: 0,
	};

	if (payload.realAmountChangeMajor < 0) {
		console.warn(
			JSON.stringify({
				tag: "bonus_engine_negative_real_change_ignored",
				userId: payload.userId,
				bonusId: payload.bonusId,
				bonusStatus: status,
				realAmountChangeMajor: payload.realAmountChangeMajor,
			}),
		);
	}

	if (status === BONUS_ENGINE_BONUS_STATUS.ACTIVE) {
		if (bonusOutKobo <= 0) return result;
		const grant = await grantLockedBonus({
			DB: payload.env.DB,
			userId: payload.userId,
			amountKobo: bonusOutKobo,
			reference: bonusActivationReference(
				payload.bonusId,
				payload.userId,
				"bonus",
			),
			paymentMethod: BONUS_ENGINE_WALLET_PAYMENT_METHOD.BONUS_ACTIVATE,
			metadata: { bonusId: payload.bonusId, bonusStatus: status },
		});
		return foldMove(result, grant, "grantedKobo");
	}

	if (!BONUS_ENGINE_TERMINAL_BONUS_STATUSES.has(status)) {
		return result;
	}

	const missingAmounts = bonusOutKobo === 0 && convertedKobo === 0;
	const fallbackKobo = missingAmounts
		? await bonusFundsAttributableTo({
				env: payload.env,
				userId: payload.userId,
				bonusId: payload.bonusId,
			})
		: 0;
	if (missingAmounts) {
		console.warn(
			JSON.stringify({
				tag: "bonus_engine_status_without_amounts",
				userId: payload.userId,
				bonusId: payload.bonusId,
				bonusStatus: status,
				fallbackKobo,
			}),
		);
	}

	const isCompleted = status === BONUS_ENGINE_BONUS_STATUS.COMPLETED;
	const unlockKobo =
		isCompleted && missingAmounts ? fallbackKobo : convertedKobo;
	const forfeitKobo = missingAmounts
		? isCompleted
			? 0
			: fallbackKobo
		: Math.max(0, bonusOutKobo - convertedKobo);

	let next = result;
	if (unlockKobo > 0) {
		const unlock = await unlockLockedBonus({
			DB: payload.env.DB,
			userId: payload.userId,
			amountKobo: unlockKobo,
			reference: `${BONUS_ENGINE_BONUS_STATUS_REFERENCE_PREFIX}:${payload.bonusId}:${payload.userId}:${status}:unlock`,
			metadata: { bonusId: payload.bonusId, bonusStatus: status },
		});
		next = foldMove(next, unlock, "unlockedKobo");
		if (next.status === "wallet_missing") return next;
	}
	if (forfeitKobo > 0) {
		const forfeit = await forfeitLockedBonus({
			DB: payload.env.DB,
			userId: payload.userId,
			amountKobo: forfeitKobo,
			reference: bonusForfeitReference(payload.bonusId, payload.userId),
			paymentMethod: BONUS_ENGINE_WALLET_PAYMENT_METHOD.BONUS_STATUS,
			metadata: { bonusId: payload.bonusId, bonusStatus: status },
		});
		next = foldMove(next, forfeit, "forfeitedKobo");
	}
	return next;
}

export function bonusForfeitReference(bonusId: string, userId: string): string {
	return `${BONUS_ENGINE_BONUS_FORFEIT_REFERENCE_PREFIX}:${bonusId}:${userId}`;
}

/**
 * Claws back a bonus the player cancelled. Shares its reference with the
 * engine's CANCELLED `updateBonus`, so whichever lands first applies.
 */
export async function forfeitCancelledBonus(payload: {
	env: CloudflareBindings;
	userId: string;
	bonusId: string;
}): Promise<BonusStatusWalletApplyResult> {
	const amountKobo = await bonusFundsAttributableTo(payload);
	const result: BonusStatusWalletApplyResult = {
		status: "skipped",
		applied: false,
		unlockedKobo: 0,
		forfeitedKobo: 0,
		grantedKobo: 0,
	};
	if (amountKobo <= 0) return result;
	const forfeit = await forfeitLockedBonus({
		DB: payload.env.DB,
		userId: payload.userId,
		amountKobo,
		reference: bonusForfeitReference(payload.bonusId, payload.userId),
		paymentMethod: BONUS_ENGINE_WALLET_PAYMENT_METHOD.BONUS_STATUS,
		metadata: {
			bonusId: payload.bonusId,
			bonusStatus: "CANCELLED",
			by: "player",
		},
	});
	return foldMove(result, forfeit, "forfeitedKobo");
}

/**
 * Locked funds that belong to one bonus. Locked funds are pooled, so when it
 * is the player's only active bonus everything locked (bonus + winnings from
 * it) is attributed to it; otherwise only what was granted for it.
 */
async function bonusFundsAttributableTo(payload: {
	env: CloudflareBindings;
	userId: string;
	bonusId: string;
}): Promise<number> {
	const [funds, activeIds, grantedKobo] = await Promise.all([
		readWalletFunds(payload.env.DB, payload.userId),
		listActiveBonusEngineUserBonusIds(payload),
		grantedBonusKobo(payload),
	]);
	const lockedKobo = funds?.bonusKobo ?? 0;
	const otherActive = activeIds.filter((id) => id !== payload.bonusId);
	if (otherActive.length === 0) return lockedKobo;
	return Math.min(lockedKobo, grantedKobo);
}

async function grantedBonusKobo(payload: {
	env: CloudflareBindings;
	userId: string;
	bonusId: string;
}): Promise<number> {
	const reference = bonusActivationReference(
		payload.bonusId,
		payload.userId,
		"bonus",
	);
	const granted = await payload.env.DB.prepare(
		"SELECT amount FROM bonus_wallet_ledger WHERE reference = ? AND kind = 'grant' LIMIT 1",
	)
		.bind(reference)
		.first<{ amount: number }>();
	if (granted) return Math.max(0, Number(granted.amount));
	// Activated before bonus funds moved into the main wallet.
	const legacy = await payload.env.DB.prepare(
		"SELECT amount FROM game_wallet_transaction WHERE reference = ? LIMIT 1",
	)
		.bind(reference)
		.first<{ amount: number }>();
	return Math.max(0, Number(legacy?.amount ?? 0));
}

function foldMove(
	current: BonusStatusWalletApplyResult,
	move: {
		status: "applied" | "duplicate" | "wallet_missing";
		appliedKobo: number;
	},
	field: "unlockedKobo" | "forfeitedKobo" | "grantedKobo",
): BonusStatusWalletApplyResult {
	if (move.status === "wallet_missing") {
		return { ...current, status: "wallet_missing", applied: false };
	}
	if (move.status === "duplicate") {
		return current.applied
			? current
			: { ...current, status: "already_applied" };
	}
	return {
		...current,
		status: "applied",
		applied: true,
		[field]: Math.abs(move.appliedKobo),
	};
}

function normalizeBonusStatus(status: string): string {
	const upper = status.trim().toUpperCase();
	return upper === BONUS_ENGINE_BONUS_STATUS.CANCELED
		? BONUS_ENGINE_BONUS_STATUS.CANCELLED
		: upper;
}

function toKoboMagnitude(amountMajor: number): number {
	if (!Number.isFinite(amountMajor) || amountMajor === 0) return 0;
	return Math.round(Math.abs(amountMajor) * KOBO_PER_MAJOR);
}

// ---------------------------------------------------------------------------
// Tournaments and loyalty
// ---------------------------------------------------------------------------

export type CashRewardCreditResult = {
	status: "credited" | "already_credited" | "wallet_missing" | "skipped";
	amountKobo: number;
	reference: string | null;
};

/** Credits a tournament prize once per tournament + player (cash). */
export async function creditTournamentPrize(payload: {
	env: CloudflareBindings;
	userId: string;
	tournamentId: string;
	prizeMajor: number;
	rank?: number;
}): Promise<CashRewardCreditResult> {
	const amountKobo = majorToKobo(payload.prizeMajor);
	if (amountKobo <= 0) {
		return { status: "skipped", amountKobo: 0, reference: null };
	}
	const reference = `${BONUS_ENGINE_TOURNAMENT_PRIZE_REFERENCE_PREFIX}:${payload.tournamentId}:${payload.userId}`;
	const credit = await creditWalletCash({
		DB: payload.env.DB,
		userId: payload.userId,
		amountKobo,
		reference,
		paymentMethod: BONUS_ENGINE_WALLET_PAYMENT_METHOD.TOURNAMENT_PRIZE,
		metadata: {
			tournamentId: payload.tournamentId,
			rank: payload.rank ?? null,
			amountMajor: payload.prizeMajor,
		},
	});
	return {
		status: credit.status === "duplicate" ? "already_credited" : credit.status,
		amountKobo,
		reference,
	};
}

/** Credits a loyalty redemption's cash reward once per redemption. */
export async function creditLoyaltyRedemption(payload: {
	env: CloudflareBindings;
	userId: string;
	redemptionId: string;
	amountKobo: number;
	metadata?: Record<string, unknown>;
}): Promise<CashRewardCreditResult> {
	if (payload.amountKobo <= 0) {
		return { status: "skipped", amountKobo: 0, reference: null };
	}
	const reference = `${BONUS_ENGINE_LOYALTY_REDEEM_REFERENCE_PREFIX}:${payload.redemptionId}`;
	const credit = await creditWalletCash({
		DB: payload.env.DB,
		userId: payload.userId,
		amountKobo: payload.amountKobo,
		reference,
		paymentMethod: BONUS_ENGINE_WALLET_PAYMENT_METHOD.LOYALTY_REDEEM,
		metadata: { redemptionId: payload.redemptionId, ...payload.metadata },
	});
	return {
		status: credit.status === "duplicate" ? "already_credited" : credit.status,
		amountKobo: payload.amountKobo,
		reference,
	};
}

function asPositiveNumber(value: unknown): number {
	const parsed =
		typeof value === "number"
			? value
			: typeof value === "string" && value.trim()
				? Number(value)
				: Number.NaN;
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
