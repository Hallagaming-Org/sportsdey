import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../db/schema";
import type { CloudflareBindings } from "../../types";
import { hashBonusEngineIdempotencyKey } from "./crypto";

type BonusEngineDb = ReturnType<typeof drizzle<typeof schema>>;

function createBonusEngineDb(env: CloudflareBindings): BonusEngineDb {
	return drizzle(env.DB, { schema });
}

/**
 * Records a callback event once. Returns whether this delivery is new.
 * Duplicate idempotency keys yield `isNew: false` so handlers can ACK without re-applying.
 */
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
	} catch {
		return { isNew: false, idempotencyKey };
	}
}

/**
 * Upserts the local loyalty points/level snapshot for a player.
 * Omit `totalPoints` to update only the VIP level (level-up callbacks).
 */
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

/**
 * Upserts mission progress (and optional completion metadata) for a player.
 */
export async function upsertBonusEngineMissionProgress(payload: {
	env: CloudflareBindings;
	userId: string;
	missionId: string;
	progressPercentage: number;
	completedAt?: Date | null;
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
		await db
			.update(schema.bonusEngineMissionProgress)
			.set({
				progressPercentage: payload.progressPercentage,
				completedAt: payload.completedAt ?? existing.completedAt,
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
		rewardJson: payload.rewardJson ?? null,
	});
}

/**
 * Loads real (main wallet) and bonus (game wallet) balances in major currency units.
 */
export async function getBonusEngineWalletBalances(payload: {
	env: CloudflareBindings;
	userId: string;
}): Promise<{ realWalletBalance: number; bonusWalletBalance: number }> {
	const db = createBonusEngineDb(payload.env);
	const [mainWallet, gameWalletRow] = await Promise.all([
		db.query.wallet.findFirst({
			where: eq(schema.wallet.userId, payload.userId),
		}),
		db.query.gameWallet.findFirst({
			where: eq(schema.gameWallet.userId, payload.userId),
		}),
	]);

	return {
		realWalletBalance: (mainWallet?.balance ?? 0) / 100,
		bonusWalletBalance: (gameWalletRow?.balance ?? 0) / 100,
	};
}
