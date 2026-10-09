import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { walletFundsFromRow } from "../../db/bonus-wallet";
import * as schema from "../../db/schema";
import { isUniqueConstraintError } from "../casino-settlement";
import type { CloudflareBindings } from "../../types";
import { hashBonusEngineIdempotencyKey } from "./crypto";

type BonusEngineDb = ReturnType<typeof drizzle<typeof schema>>;

function createBonusEngineDb(env: CloudflareBindings): BonusEngineDb {
	return drizzle(env.DB, { schema });
}

export async function recordBonusEngineCallbackEvent(payload: {
	env: CloudflareBindings;
	eventType: string;
	idempotencySeed: string;
	bodyJson: string;
}): Promise<{ isNew: boolean; idempotencyKey: string }> {
	const db = createBonusEngineDb(payload.env);
	const idempotencyKey = await hashBonusEngineIdempotencyKey(
		`${payload.eventType}:${payload.idempotencySeed}`,
	);

	const existing = await db.query.bonusEngineCallbackEvent.findFirst({
		where: eq(schema.bonusEngineCallbackEvent.idempotencyKey, idempotencyKey),
	});
	if (existing) {
		return { isNew: false, idempotencyKey };
	}

	try {
		await db.insert(schema.bonusEngineCallbackEvent).values({
			id: crypto.randomUUID(),
			idempotencyKey,
			eventType: payload.eventType,
			payloadJson: payload.bodyJson,
		});
		return { isNew: true, idempotencyKey };
	} catch (error) {
		// Only a concurrent identical delivery counts as a duplicate; any other
		// failure must surface so the engine retries instead of getting a 200.
		if (isUniqueConstraintError(error)) {
			return { isNew: false, idempotencyKey };
		}
		throw error;
	}
}

export async function upsertBonusEngineLoyaltySnapshot(payload: {
	env: CloudflareBindings;
	userId: string;
	totalPoints?: number;
	loyaltyLevel: string;
}): Promise<void> {
	const db = createBonusEngineDb(payload.env);
	const existing = await db.query.bonusEngineLoyaltySnapshot.findFirst({
		where: eq(schema.bonusEngineLoyaltySnapshot.userId, payload.userId),
	});

	if (existing) {
		await db
			.update(schema.bonusEngineLoyaltySnapshot)
			.set({
				totalPoints: payload.totalPoints ?? existing.totalPoints,
				loyaltyLevel: payload.loyaltyLevel,
				updatedAt: new Date(),
			})
			.where(eq(schema.bonusEngineLoyaltySnapshot.userId, payload.userId));
		return;
	}

	await db.insert(schema.bonusEngineLoyaltySnapshot).values({
		userId: payload.userId,
		totalPoints: payload.totalPoints ?? 0,
		loyaltyLevel: payload.loyaltyLevel,
	});
}

export async function listBonusEngineMissionProgressForUser(payload: {
	env: CloudflareBindings;
	userId: string;
}): Promise<
	Array<{
		missionId: string;
		progressPercentage: number;
		completedAt: Date | null;
		engineCompletedAt: Date | null;
		rewardJson: string | null;
	}>
> {
	const db = createBonusEngineDb(payload.env);
	const rows = await db.query.bonusEngineMissionProgress.findMany({
		where: eq(schema.bonusEngineMissionProgress.userId, payload.userId),
	});
	return rows.map((row) => ({
		missionId: row.missionId,
		progressPercentage: row.progressPercentage,
		completedAt: row.completedAt ?? null,
		engineCompletedAt: row.engineCompletedAt ?? null,
		rewardJson: row.rewardJson ?? null,
	}));
}

/**
 * Upserts a mission snapshot. Progress only moves forward. `completedAt`
 * means "reward handled" and is only ever set by the complete callback or
 * reconciliation; `engineCompletedAt` records when polling first saw 100%.
 */
export async function upsertBonusEngineMissionProgress(payload: {
	env: CloudflareBindings;
	userId: string;
	missionId: string;
	progressPercentage: number;
	completedAt?: Date | null;
	engineCompletedAt?: Date | null;
	rewardJson?: string | null;
}): Promise<void> {
	const db = createBonusEngineDb(payload.env);
	const missionKey = and(
		eq(schema.bonusEngineMissionProgress.userId, payload.userId),
		eq(schema.bonusEngineMissionProgress.missionId, payload.missionId),
	);

	const existing = await db.query.bonusEngineMissionProgress.findFirst({
		where: missionKey,
	});

	if (existing) {
		const nextPercentage = Math.max(
			existing.progressPercentage,
			payload.progressPercentage,
		);
		await db
			.update(schema.bonusEngineMissionProgress)
			.set({
				progressPercentage: nextPercentage,
				completedAt: existing.completedAt ?? payload.completedAt ?? null,
				engineCompletedAt:
					existing.engineCompletedAt ?? payload.engineCompletedAt ?? null,
				rewardJson: payload.rewardJson ?? existing.rewardJson,
				updatedAt: new Date(),
			})
			.where(missionKey);
		return;
	}

	await db.insert(schema.bonusEngineMissionProgress).values({
		userId: payload.userId,
		missionId: payload.missionId,
		progressPercentage: payload.progressPercentage,
		completedAt: payload.completedAt ?? null,
		engineCompletedAt: payload.engineCompletedAt ?? null,
		rewardJson: payload.rewardJson ?? null,
	});
}

/**
 * Missions the engine reported complete whose reward callback never arrived
 * within the grace window. Bounded so the hourly cron stays cheap.
 */
export async function listMissionsAwaitingReward(payload: {
	env: CloudflareBindings;
	olderThan: Date;
	limit: number;
}): Promise<Array<{ userId: string; missionId: string }>> {
	const { results } = await payload.env.DB.prepare(
		`SELECT user_id, mission_id FROM bonus_engine_mission_progress
		 WHERE completed_at IS NULL AND engine_completed_at IS NOT NULL
		   AND engine_completed_at <= ?
		 ORDER BY engine_completed_at LIMIT ?`,
	)
		.bind(payload.olderThan.getTime(), payload.limit)
		.all<{ user_id: string; mission_id: string }>();
	return (results ?? []).map((row) => ({
		userId: row.user_id,
		missionId: row.mission_id,
	}));
}

export async function getBonusEngineWalletBalances(payload: {
	env: CloudflareBindings;
	userId: string;
}): Promise<{ realWalletBalance: number; bonusWalletBalance: number }> {
	const db = createBonusEngineDb(payload.env);
	const mainWallet = await db.query.wallet.findFirst({
		where: eq(schema.wallet.userId, payload.userId),
	});
	if (!mainWallet) {
		return { realWalletBalance: 0, bonusWalletBalance: 0 };
	}

	// Bonus funds are a locked part of the main wallet; the engine models them
	// as a separate bonus wallet, so split them back out.
	const funds = walletFundsFromRow(mainWallet);
	return {
		realWalletBalance: funds.realKobo / 100,
		bonusWalletBalance: funds.bonusKobo / 100,
	};
}

export type BonusEngineUserBonusSnapshot = {
	bonusId: string;
	status: string;
	payloadJson: string;
};

/**
 * Returns SportsDey wallet figures plus display name for Bonus Engine
 * callback ACKs. Missing wallets read as 0; missing users get an empty name.
 */
export async function getBonusEngineCallbackWalletView(payload: {
	env: CloudflareBindings;
	userId: string;
}): Promise<{
	userId: string;
	username: string;
	realWalletBalance: number;
	bonusWalletBalance: number;
	timestamp: string;
}> {
	const db = createBonusEngineDb(payload.env);
	const [userRow, balances] = await Promise.all([
		db.query.user.findFirst({
			where: eq(schema.user.id, payload.userId),
		}),
		getBonusEngineWalletBalances(payload),
	]);

	return {
		userId: payload.userId,
		username: userRow?.name?.trim() ?? "",
		realWalletBalance: balances.realWalletBalance,
		bonusWalletBalance: balances.bonusWalletBalance,
		timestamp: new Date().toISOString(),
	};
}

/** Local snapshots of the player's bonuses that are still ACTIVE. */
export async function listActiveBonusEngineUserBonusIds(payload: {
	env: CloudflareBindings;
	userId: string;
}): Promise<string[]> {
	const snapshots = await listBonusEngineUserBonusSnapshots(payload);
	return snapshots
		.filter((row) => row.status.trim().toUpperCase() === "ACTIVE")
		.map((row) => row.bonusId);
}

/**
 * Loads local bonus snapshots for a player so list/activate can overlay
 * allocation and status callbacks onto the engine assignment list.
 */
export async function listBonusEngineUserBonusSnapshots(payload: {
	env: CloudflareBindings;
	userId: string;
}): Promise<BonusEngineUserBonusSnapshot[]> {
	try {
		const db = createBonusEngineDb(payload.env);
		const rows = await db.query.bonusEngineUserBonus.findMany({
			where: eq(schema.bonusEngineUserBonus.userId, payload.userId),
		});
		return rows.map((row) => ({
			bonusId: row.bonusId,
			status: row.status,
			payloadJson: row.payloadJson,
		}));
	} catch (error: unknown) {
		console.error("Bonus snapshot list failed", {
			userId: payload.userId,
			error,
		});
		return [];
	}
}

/**
 * Upserts a player bonus snapshot from allocation or status callbacks.
 * Status from the callback wins; payload keeps the richest JSON we have.
 */
export async function upsertBonusEngineUserBonus(payload: {
	env: CloudflareBindings;
	userId: string;
	bonusId: string;
	status: string;
	payloadJson: string;
}): Promise<void> {
	const db = createBonusEngineDb(payload.env);
	const bonusKey = and(
		eq(schema.bonusEngineUserBonus.userId, payload.userId),
		eq(schema.bonusEngineUserBonus.bonusId, payload.bonusId),
	);
	const existing = await db.query.bonusEngineUserBonus.findFirst({
		where: bonusKey,
	});

	if (existing) {
		await db
			.update(schema.bonusEngineUserBonus)
			.set({
				status: payload.status || existing.status,
				payloadJson: mergeBonusEnginePayloadJson(
					existing.payloadJson,
					payload.payloadJson,
				),
				updatedAt: new Date(),
			})
			.where(bonusKey);
		return;
	}

	await db.insert(schema.bonusEngineUserBonus).values({
		userId: payload.userId,
		bonusId: payload.bonusId,
		status: payload.status,
		payloadJson: payload.payloadJson,
	});
}

/**
 * Merges assignment JSON with a later status callback so updateBonus does
 * not wipe campaign fields stored from bonusAllocation.
 */
function mergeBonusEnginePayloadJson(
	existingJson: string,
	incomingJson: string,
): string {
	if (!incomingJson) return existingJson;
	if (!existingJson) return incomingJson;
	try {
		const existingParsed = JSON.parse(existingJson) as unknown;
		const incomingParsed = JSON.parse(incomingJson) as unknown;
		if (
			typeof existingParsed === "object" &&
			existingParsed !== null &&
			!Array.isArray(existingParsed) &&
			typeof incomingParsed === "object" &&
			incomingParsed !== null &&
			!Array.isArray(incomingParsed)
		) {
			return JSON.stringify({ ...existingParsed, ...incomingParsed });
		}
	} catch {
		return incomingJson;
	}
	return incomingJson;
}
