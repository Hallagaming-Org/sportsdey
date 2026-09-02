import { eq, sql } from "drizzle-orm";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../db/schema";
import type { CloudflareBindings } from "../../types";
import { generateUUIDv7 } from "../../utils/uuid";
import {
	BONUS_ENGINE_BONUS_ACTIVATE_REFERENCE_PREFIX,
	BONUS_ENGINE_BONUS_STATUS_REFERENCE_PREFIX,
	BONUS_ENGINE_MISSION_REWARD_REFERENCE_PREFIX,
	BONUS_ENGINE_REWARD_TYPE,
	BONUS_ENGINE_WALLET_PAYMENT_METHOD,
} from "./bonus-engine.service.constant";

const KOBO_PER_MAJOR = 100;

type BonusEngineDb = DrizzleD1Database<typeof schema>;

export type ParsedMissionCashReward = {
	amountMajor: number;
	rewardType: string;
};

export type MissionRealCashCreditResult = {
	status: "skipped" | "credited" | "already_credited" | "wallet_missing";
	credited: boolean;
	amountKobo: number;
	reference: string | null;
};

export function parseMissionRealCashReward(
	reward: unknown,
): ParsedMissionCashReward | null {
	const candidates = Array.isArray(reward) ? reward : [reward];
	for (const entry of candidates) {
		if (typeof entry !== "object" || entry === null) continue;
		const row = entry as Record<string, unknown>;
		const rewardType =
			typeof row.type === "string" ? row.type.trim() : "";
		if (
			rewardType.toLowerCase() !==
			BONUS_ENGINE_REWARD_TYPE.REAL_CASH.toLowerCase()
		) {
			continue;
		}
		const amountRaw = row.value ?? row.amount;
		const amountMajor =
			typeof amountRaw === "number"
				? amountRaw
				: typeof amountRaw === "string"
					? Number(amountRaw)
					: NaN;
		if (!Number.isFinite(amountMajor) || amountMajor <= 0) continue;
		return { amountMajor, rewardType };
	}
	return null;
}

export async function creditMissionRealCashReward(payload: {
	env: CloudflareBindings;
	userId: string;
	missionId: string;
	reward: unknown;
}): Promise<MissionRealCashCreditResult> {
	const parsed = parseMissionRealCashReward(payload.reward);
	if (!parsed) {
		return {
			status: "skipped",
			credited: false,
			amountKobo: 0,
			reference: null,
		};
	}

	const amountKobo = Math.round(parsed.amountMajor * KOBO_PER_MAJOR);
	if (amountKobo <= 0) {
		return {
			status: "skipped",
			credited: false,
			amountKobo: 0,
			reference: null,
		};
	}

	const reference = `${BONUS_ENGINE_MISSION_REWARD_REFERENCE_PREFIX}:${payload.missionId}:${payload.userId}`;
	const db = drizzle(payload.env.DB, { schema });

	const existing = await db.query.walletTransaction.findFirst({
		where: eq(schema.walletTransaction.reference, reference),
	});
	if (existing) {
		return {
			status: "already_credited",
			credited: false,
			amountKobo,
			reference,
		};
	}

	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, payload.userId))
		.limit(1);

	if (!wallet) {
		console.error("Mission Real Cash credit skipped — wallet missing", {
			userId: payload.userId,
			missionId: payload.missionId,
		});
		return {
			status: "wallet_missing",
			credited: false,
			amountKobo,
			reference,
		};
	}

	const newBalance = wallet.balance + amountKobo;
	try {
		await db.batch([
			db.insert(schema.walletTransaction).values({
				id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
				userId: payload.userId,
				amount: amountKobo,
				type: "credit",
				reference,
				status: "success",
				paymentMethod: BONUS_ENGINE_WALLET_PAYMENT_METHOD.MISSION_REAL_CASH,
				balance: newBalance,
				metadata: JSON.stringify({
					source: "bonus_engine",
					missionId: payload.missionId,
					rewardType: parsed.rewardType,
					amountMajor: parsed.amountMajor,
				}),
			}),
			db
				.update(schema.wallet)
				.set({
					balance: sql`${schema.wallet.balance} + ${amountKobo}`,
				})
				.where(eq(schema.wallet.userId, payload.userId)),
		]);
	} catch (error: unknown) {
		if (isUniqueConstraintError(error)) {
			return {
				status: "already_credited",
				credited: false,
				amountKobo,
				reference,
			};
		}
		throw error;
	}

	return { status: "credited", credited: true, amountKobo, reference };
}

export type BonusActivationCreditResult = {
	status: "skipped" | "credited" | "already_credited" | "wallet_missing";
	credited: boolean;
	bonusKobo: number;
	cashKobo: number;
};

/**
 * Credits SportsDey wallets after Bonus Engine accepts `activate_bonus`.
 * `bonusAmountMajor` goes to `game_wallet` (bonus wallet); `cashAmountMajor`
 * goes to the main wallet. Each side is idempotent via a unique reference
 * `be_bonus_activate:{userbonusId}:{userId}:{bonus|cash}`. Engine-returned
 * balances are never written — SportsDey remains source of truth.
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
		return {
			status: "skipped",
			credited: false,
			bonusKobo: 0,
			cashKobo: 0,
		};
	}

	const db = drizzle(payload.env.DB, { schema });
	const bonusRef = `${BONUS_ENGINE_BONUS_ACTIVATE_REFERENCE_PREFIX}:${payload.userbonusId}:${payload.userId}:bonus`;
	const cashRef = `${BONUS_ENGINE_BONUS_ACTIVATE_REFERENCE_PREFIX}:${payload.userbonusId}:${payload.userId}:cash`;

	const bonusResult =
		bonusKobo > 0
			? await creditGameWalletAmount({
					db,
					userId: payload.userId,
					userbonusId: payload.userbonusId,
					amountKobo: bonusKobo,
					reference: bonusRef,
				})
			: { status: "skipped" as const, credited: false };

	if (bonusResult.status === "wallet_missing") {
		return {
			status: "wallet_missing",
			credited: false,
			bonusKobo,
			cashKobo,
		};
	}

	const cashResult =
		cashKobo > 0
			? await creditMainWalletAmount({
					db,
					userId: payload.userId,
					userbonusId: payload.userbonusId,
					amountKobo: cashKobo,
					reference: cashRef,
				})
			: { status: "skipped" as const, credited: false };

	if (cashResult.status === "wallet_missing") {
		return {
			status: "wallet_missing",
			credited: bonusResult.credited,
			bonusKobo,
			cashKobo,
		};
	}

	const credited = bonusResult.credited || cashResult.credited;
	const already =
		bonusResult.status === "already_credited" ||
		cashResult.status === "already_credited";
	return {
		status: credited ? "credited" : already ? "already_credited" : "skipped",
		credited,
		bonusKobo,
		cashKobo,
	};
}

function majorToKobo(amountMajor: number): number {
	if (!Number.isFinite(amountMajor) || amountMajor <= 0) return 0;
	return Math.round(amountMajor * KOBO_PER_MAJOR);
}

async function creditGameWalletAmount(payload: {
	db: BonusEngineDb;
	userId: string;
	userbonusId: string;
	amountKobo: number;
	reference: string;
}): Promise<{
	status: "credited" | "already_credited" | "wallet_missing";
	credited: boolean;
}> {
	const existing = await payload.db.query.gameWalletTransaction.findFirst({
		where: eq(schema.gameWalletTransaction.reference, payload.reference),
	});
	if (existing) {
		return { status: "already_credited", credited: false };
	}

	let [gameWalletRow] = await payload.db
		.select()
		.from(schema.gameWallet)
		.where(eq(schema.gameWallet.userId, payload.userId))
		.limit(1);

	if (!gameWalletRow) {
		const [created] = await payload.db
			.insert(schema.gameWallet)
			.values({
				id: generateUUIDv7(),
				userId: payload.userId,
				balance: 0,
			})
			.returning();
		gameWalletRow = created;
	}

	if (!gameWalletRow) {
		console.error("Bonus activation credit skipped — game wallet missing", {
			userId: payload.userId,
			userbonusId: payload.userbonusId,
		});
		return { status: "wallet_missing", credited: false };
	}

	try {
		await payload.db.batch([
			payload.db.insert(schema.gameWalletTransaction).values({
				id: generateUUIDv7(),
				userId: payload.userId,
				amount: payload.amountKobo,
				type: "credit",
				reference: payload.reference,
				status: "completed",
			}),
			payload.db
				.update(schema.gameWallet)
				.set({
					balance: sql`${schema.gameWallet.balance} + ${payload.amountKobo}`,
				})
				.where(eq(schema.gameWallet.userId, payload.userId)),
		]);
	} catch (error: unknown) {
		if (isUniqueConstraintError(error)) {
			return { status: "already_credited", credited: false };
		}
		throw error;
	}

	return { status: "credited", credited: true };
}

async function creditMainWalletAmount(payload: {
	db: BonusEngineDb;
	userId: string;
	userbonusId: string;
	amountKobo: number;
	reference: string;
}): Promise<{
	status: "credited" | "already_credited" | "wallet_missing";
	credited: boolean;
}> {
	const existing = await payload.db.query.walletTransaction.findFirst({
		where: eq(schema.walletTransaction.reference, payload.reference),
	});
	if (existing) {
		return { status: "already_credited", credited: false };
	}

	const [wallet] = await payload.db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, payload.userId))
		.limit(1);

	if (!wallet) {
		console.error("Bonus activation cash credit skipped — wallet missing", {
			userId: payload.userId,
			userbonusId: payload.userbonusId,
		});
		return { status: "wallet_missing", credited: false };
	}

	try {
		await payload.db.batch([
			payload.db.insert(schema.walletTransaction).values({
				id: generateUUIDv7(),
				userId: payload.userId,
				amount: payload.amountKobo,
				type: "credit",
				reference: payload.reference,
				status: "success",
				paymentMethod: BONUS_ENGINE_WALLET_PAYMENT_METHOD.BONUS_ACTIVATE,
				balance: wallet.balance + payload.amountKobo,
				metadata: JSON.stringify({
					source: "bonus_engine",
					userbonusId: payload.userbonusId,
					walletKind: "cash",
				}),
			}),
			payload.db
				.update(schema.wallet)
				.set({
					balance: sql`${schema.wallet.balance} + ${payload.amountKobo}`,
				})
				.where(eq(schema.wallet.userId, payload.userId)),
		]);
	} catch (error: unknown) {
		if (isUniqueConstraintError(error)) {
			return { status: "already_credited", credited: false };
		}
		throw error;
	}

	return { status: "credited", credited: true };
}

export type BonusStatusWalletApplyResult = {
	status: "skipped" | "applied" | "already_applied" | "wallet_missing";
	applied: boolean;
	realKobo: number;
	bonusKobo: number;
};

/**
 * Applies `updateBonus` amount changes to SportsDey wallets.
 * Engine absolute balances are ignored. Positive `bonusAmountChange` is treated
 * as funds leaving the bonus wallet (debit). Real change is signed as sent.
 * Each side is idempotent per bonus id + status.
 */
export async function applyBonusStatusWalletChanges(payload: {
	env: CloudflareBindings;
	userId: string;
	bonusId: string;
	bonusStatus: string;
	realKobo: number;
	bonusKobo: number;
}): Promise<BonusStatusWalletApplyResult> {
	if (payload.realKobo === 0 && payload.bonusKobo === 0) {
		return {
			status: "skipped",
			applied: false,
			realKobo: 0,
			bonusKobo: 0,
		};
	}

	const db = drizzle(payload.env.DB, { schema });
	const statusKey = payload.bonusStatus.trim().toUpperCase() || "UNKNOWN";
	const realRef = `${BONUS_ENGINE_BONUS_STATUS_REFERENCE_PREFIX}:${payload.bonusId}:${payload.userId}:${statusKey}:real`;
	const bonusRef = `${BONUS_ENGINE_BONUS_STATUS_REFERENCE_PREFIX}:${payload.bonusId}:${payload.userId}:${statusKey}:bonus`;

	const realResult =
		payload.realKobo !== 0
			? await applySignedMainWalletDelta({
					db,
					userId: payload.userId,
					bonusId: payload.bonusId,
					signedKobo: payload.realKobo,
					reference: realRef,
					paymentMethod: BONUS_ENGINE_WALLET_PAYMENT_METHOD.BONUS_STATUS,
				})
			: { status: "skipped" as const, applied: false };

	if (realResult.status === "wallet_missing") {
		return {
			status: "wallet_missing",
			applied: false,
			realKobo: payload.realKobo,
			bonusKobo: payload.bonusKobo,
		};
	}

	const bonusResult =
		payload.bonusKobo !== 0
			? await applySignedGameWalletDelta({
					db,
					userId: payload.userId,
					bonusId: payload.bonusId,
					signedKobo: payload.bonusKobo,
					reference: bonusRef,
				})
			: { status: "skipped" as const, applied: false };

	if (bonusResult.status === "wallet_missing") {
		return {
			status: "wallet_missing",
			applied: realResult.applied,
			realKobo: payload.realKobo,
			bonusKobo: payload.bonusKobo,
		};
	}

	const applied = realResult.applied || bonusResult.applied;
	const already =
		realResult.status === "already_applied" ||
		bonusResult.status === "already_applied";
	return {
		status: applied ? "applied" : already ? "already_applied" : "skipped",
		applied,
		realKobo: payload.realKobo,
		bonusKobo: payload.bonusKobo,
	};
}

async function applySignedGameWalletDelta(payload: {
	db: BonusEngineDb;
	userId: string;
	bonusId: string;
	signedKobo: number;
	reference: string;
}): Promise<{
	status: "applied" | "already_applied" | "wallet_missing";
	applied: boolean;
}> {
	const existing = await payload.db.query.gameWalletTransaction.findFirst({
		where: eq(schema.gameWalletTransaction.reference, payload.reference),
	});
	if (existing) {
		return { status: "already_applied", applied: false };
	}

	let [gameWalletRow] = await payload.db
		.select()
		.from(schema.gameWallet)
		.where(eq(schema.gameWallet.userId, payload.userId))
		.limit(1);

	if (!gameWalletRow) {
		const [created] = await payload.db
			.insert(schema.gameWallet)
			.values({
				id: generateUUIDv7(),
				userId: payload.userId,
				balance: 0,
			})
			.returning();
		gameWalletRow = created;
	}

	if (!gameWalletRow) {
		console.error("Bonus status game-wallet update skipped — wallet missing", {
			userId: payload.userId,
			bonusId: payload.bonusId,
		});
		return { status: "wallet_missing", applied: false };
	}

	const appliedKobo = clampWalletDelta(gameWalletRow.balance, payload.signedKobo);
	if (appliedKobo === 0) {
		return { status: "already_applied", applied: false };
	}

	try {
		await payload.db.batch([
			payload.db.insert(schema.gameWalletTransaction).values({
				id: generateUUIDv7(),
				userId: payload.userId,
				amount: Math.abs(appliedKobo),
				type: appliedKobo > 0 ? "credit" : "debit",
				reference: payload.reference,
				status: "completed",
			}),
			payload.db
				.update(schema.gameWallet)
				.set({
					balance: sql`${schema.gameWallet.balance} + ${appliedKobo}`,
				})
				.where(eq(schema.gameWallet.userId, payload.userId)),
		]);
	} catch (error: unknown) {
		if (isUniqueConstraintError(error)) {
			return { status: "already_applied", applied: false };
		}
		throw error;
	}

	return { status: "applied", applied: true };
}

async function applySignedMainWalletDelta(payload: {
	db: BonusEngineDb;
	userId: string;
	bonusId: string;
	signedKobo: number;
	reference: string;
	paymentMethod: string;
}): Promise<{
	status: "applied" | "already_applied" | "wallet_missing";
	applied: boolean;
}> {
	const existing = await payload.db.query.walletTransaction.findFirst({
		where: eq(schema.walletTransaction.reference, payload.reference),
	});
	if (existing) {
		return { status: "already_applied", applied: false };
	}

	const [wallet] = await payload.db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, payload.userId))
		.limit(1);

	if (!wallet) {
		console.error("Bonus status cash update skipped — wallet missing", {
			userId: payload.userId,
			bonusId: payload.bonusId,
		});
		return { status: "wallet_missing", applied: false };
	}

	const appliedKobo = clampWalletDelta(wallet.balance, payload.signedKobo);
	if (appliedKobo === 0) {
		return { status: "already_applied", applied: false };
	}

	try {
		await payload.db.batch([
			payload.db.insert(schema.walletTransaction).values({
				id: generateUUIDv7(),
				userId: payload.userId,
				amount: Math.abs(appliedKobo),
				type: appliedKobo > 0 ? "credit" : "debit",
				reference: payload.reference,
				status: "success",
				paymentMethod: payload.paymentMethod,
				balance: wallet.balance + appliedKobo,
				metadata: JSON.stringify({
					source: "bonus_engine",
					bonusId: payload.bonusId,
					walletKind: "real",
				}),
			}),
			payload.db
				.update(schema.wallet)
				.set({
					balance: sql`${schema.wallet.balance} + ${appliedKobo}`,
				})
				.where(eq(schema.wallet.userId, payload.userId)),
		]);
	} catch (error: unknown) {
		if (isUniqueConstraintError(error)) {
			return { status: "already_applied", applied: false };
		}
		throw error;
	}

	return { status: "applied", applied: true };
}

function clampWalletDelta(currentBalance: number, signedKobo: number): number {
	if (signedKobo >= 0) return signedKobo;
	return Math.max(signedKobo, -currentBalance);
}

function isUniqueConstraintError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /unique|constraint/i.test(message);
}
