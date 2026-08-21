import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../db/schema";
import type { CloudflareBindings } from "../../types";
import {
	BONUS_ENGINE_MISSION_REWARD_REFERENCE_PREFIX,
	BONUS_ENGINE_REWARD_TYPE,
	BONUS_ENGINE_WALLET_PAYMENT_METHOD,
} from "./bonus-engine.service.constant";

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

	const amountKobo = Math.round(parsed.amountMajor * 100);
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

function isUniqueConstraintError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /unique|constraint/i.test(message);
}
