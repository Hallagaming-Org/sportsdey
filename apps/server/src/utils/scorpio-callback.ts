import { and, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { generateUUIDv7 } from "@/utils/uuid";

type Db = DrizzleD1Database<typeof schema>;

export type ScorpioCallbackStatus =
	| "OK"
	| "ERR_NOT_AUTHENTICATED"
	| "ERR_NOT_ENOUGH_MONEY"
	| "ERR_INVALID_ACCOUNT"
	| "ERR_INVALID_PLAYER_ID"
	| "ERR_INTEGRITY_CHECK_FAILED"
	| "ERR_TRANSACTION_DOES_NOT_EXIST"
	| "ERR_TRANSACTION_ROLLED_BACK"
	| "ERR_UNKNOWN";

export type ScorpioCallbackResult = {
	balance?: number;
	statusCode: ScorpioCallbackStatus;
};

/** Scorpio amounts are major currency units; wallet stores kobo. */
export function scorpioAmountToKobo(amount: number): number {
	return Math.round(amount * 100);
}

export function koboToScorpioBalance(kobo: number): number {
	return kobo / 100;
}

async function getWalletKobo(db: Db, userId: string): Promise<number> {
	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, userId))
		.limit(1);
	return wallet?.balance ?? 0;
}

async function ensureUserExists(db: Db, userId: string): Promise<boolean> {
	const [user] = await db
		.select({ id: schema.user.id })
		.from(schema.user)
		.where(eq(schema.user.id, userId))
		.limit(1);
	return Boolean(user);
}

export async function handleScorpioBalance(
	db: Db,
	input: { playerId: string; currency: string },
): Promise<ScorpioCallbackResult> {
	const exists = await ensureUserExists(db, input.playerId);
	if (!exists) {
		return { statusCode: "ERR_INVALID_PLAYER_ID" };
	}

	const kobo = await getWalletKobo(db, input.playerId);
	return {
		balance: koboToScorpioBalance(kobo),
		statusCode: "OK",
	};
}

export async function handleScorpioBet(
	db: Db,
	input: {
		playerId: string;
		transactionId: string;
		roundId: string;
		amount: number;
		currency: string;
		providerId: number;
		gameCode: string;
	},
): Promise<ScorpioCallbackResult> {
	const exists = await ensureUserExists(db, input.playerId);
	if (!exists) {
		return { statusCode: "ERR_NOT_AUTHENTICATED" };
	}

	const [existing] = await db
		.select()
		.from(schema.scorpioTransactions)
		.where(eq(schema.scorpioTransactions.transactionId, input.transactionId))
		.limit(1);

	if (existing) {
		return {
			balance: koboToScorpioBalance(
				existing.balanceAfter ?? (await getWalletKobo(db, input.playerId)),
			),
			statusCode: "OK",
		};
	}

	const amountKobo = scorpioAmountToKobo(input.amount);
	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, input.playerId))
		.limit(1);

	const oldBalance = wallet?.balance ?? 0;
	if (!wallet || oldBalance < amountKobo) {
		return {
			balance: koboToScorpioBalance(oldBalance),
			statusCode: "ERR_NOT_ENOUGH_MONEY",
		};
	}

	const newBalance = oldBalance - amountKobo;

	await db
		.update(schema.wallet)
		.set({ balance: newBalance })
		.where(eq(schema.wallet.userId, input.playerId));

	await db.insert(schema.walletTransaction).values({
		id: generateUUIDv7(),
		userId: input.playerId,
		amount: amountKobo,
		type: "debit",
		reference: null,
		status: "success",
		paymentMethod: "scorpio",
		balance: newBalance,
		metadata: JSON.stringify({
			provider: "scorpio",
			action: "bet",
			transactionId: input.transactionId,
			roundId: input.roundId,
			gameCode: input.gameCode,
		}),
	});

	await db.insert(schema.scorpioTransactions).values({
		id: generateUUIDv7(),
		transactionId: input.transactionId,
		userId: input.playerId,
		type: "BET",
		amount: amountKobo,
		balanceBefore: oldBalance,
		balanceAfter: newBalance,
		roundId: input.roundId,
		providerId: input.providerId,
		gameCode: input.gameCode,
		currency: input.currency,
	});

	return {
		balance: koboToScorpioBalance(newBalance),
		statusCode: "OK",
	};
}

export async function handleScorpioWin(
	db: Db,
	input: {
		playerId: string;
		transactionId: string;
		roundId: string;
		amount: number;
		currency: string;
		providerId: number;
		gameCode: string;
	},
): Promise<ScorpioCallbackResult> {
	const exists = await ensureUserExists(db, input.playerId);
	if (!exists) {
		return { statusCode: "ERR_NOT_AUTHENTICATED" };
	}

	const [existing] = await db
		.select()
		.from(schema.scorpioTransactions)
		.where(eq(schema.scorpioTransactions.transactionId, input.transactionId))
		.limit(1);

	if (existing) {
		return {
			balance: koboToScorpioBalance(
				existing.balanceAfter ?? (await getWalletKobo(db, input.playerId)),
			),
			statusCode: "OK",
		};
	}

	const amountKobo = scorpioAmountToKobo(input.amount);
	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, input.playerId))
		.limit(1);

	const oldBalance = wallet?.balance ?? 0;
	const newBalance = oldBalance + amountKobo;

	if (wallet) {
		await db
			.update(schema.wallet)
			.set({ balance: newBalance })
			.where(eq(schema.wallet.userId, input.playerId));
	} else {
		await db.insert(schema.wallet).values({
			id: generateUUIDv7(),
			userId: input.playerId,
			balance: newBalance,
		});
	}

	await db.insert(schema.walletTransaction).values({
		id: generateUUIDv7(),
		userId: input.playerId,
		amount: amountKobo,
		type: "credit",
		reference: null,
		status: "success",
		paymentMethod: "scorpio",
		balance: newBalance,
		metadata: JSON.stringify({
			provider: "scorpio",
			action: "win",
			transactionId: input.transactionId,
			roundId: input.roundId,
			gameCode: input.gameCode,
		}),
	});

	await db.insert(schema.scorpioTransactions).values({
		id: generateUUIDv7(),
		transactionId: input.transactionId,
		userId: input.playerId,
		type: "WIN",
		amount: amountKobo,
		balanceBefore: oldBalance,
		balanceAfter: newBalance,
		roundId: input.roundId,
		providerId: input.providerId,
		gameCode: input.gameCode,
		currency: input.currency,
	});

	return {
		balance: koboToScorpioBalance(newBalance),
		statusCode: "OK",
	};
}

export async function handleScorpioCancel(
	db: Db,
	input: {
		playerId: string;
		transactionId: string;
		referenceId: string;
		roundId: string;
		amount: number;
		currency: string;
		providerId: number;
		gameCode: string;
	},
): Promise<ScorpioCallbackResult> {
	const exists = await ensureUserExists(db, input.playerId);
	if (!exists) {
		return { statusCode: "ERR_NOT_AUTHENTICATED" };
	}

	const [duplicateCancel] = await db
		.select()
		.from(schema.scorpioTransactions)
		.where(eq(schema.scorpioTransactions.transactionId, input.transactionId))
		.limit(1);

	if (duplicateCancel) {
		return {
			balance: koboToScorpioBalance(
				duplicateCancel.balanceAfter ??
					(await getWalletKobo(db, input.playerId)),
			),
			statusCode: "OK",
		};
	}

	const [original] = await db
		.select()
		.from(schema.scorpioTransactions)
		.where(
			and(
				eq(schema.scorpioTransactions.transactionId, input.referenceId),
				eq(schema.scorpioTransactions.userId, input.playerId),
			),
		)
		.limit(1);

	if (!original) {
		return {
			balance: koboToScorpioBalance(await getWalletKobo(db, input.playerId)),
			statusCode: "ERR_TRANSACTION_DOES_NOT_EXIST",
		};
	}

	const [alreadyCancelled] = await db
		.select()
		.from(schema.scorpioTransactions)
		.where(
			and(
				eq(schema.scorpioTransactions.referenceId, input.referenceId),
				eq(schema.scorpioTransactions.type, "CANCEL"),
			),
		)
		.limit(1);

	if (alreadyCancelled || original.type === "CANCEL") {
		return {
			balance: koboToScorpioBalance(await getWalletKobo(db, input.playerId)),
			statusCode: "ERR_TRANSACTION_ROLLED_BACK",
		};
	}

	const amountKobo = scorpioAmountToKobo(input.amount);
	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, input.playerId))
		.limit(1);

	const oldBalance = wallet?.balance ?? 0;
	// Cancel refunds a prior BET
	const newBalance =
		original.type === "BET" ? oldBalance + amountKobo : oldBalance - amountKobo;

	if (wallet) {
		await db
			.update(schema.wallet)
			.set({ balance: newBalance })
			.where(eq(schema.wallet.userId, input.playerId));
	}

	await db.insert(schema.walletTransaction).values({
		id: generateUUIDv7(),
		userId: input.playerId,
		amount: amountKobo,
		type: "refund",
		reference: null,
		status: "success",
		paymentMethod: "scorpio",
		balance: newBalance,
		metadata: JSON.stringify({
			provider: "scorpio",
			action: "cancel",
			transactionId: input.transactionId,
			referenceId: input.referenceId,
			roundId: input.roundId,
			gameCode: input.gameCode,
		}),
	});

	await db.insert(schema.scorpioTransactions).values({
		id: generateUUIDv7(),
		transactionId: input.transactionId,
		referenceId: input.referenceId,
		userId: input.playerId,
		type: "CANCEL",
		amount: amountKobo,
		balanceBefore: oldBalance,
		balanceAfter: newBalance,
		roundId: input.roundId,
		providerId: input.providerId,
		gameCode: input.gameCode,
		currency: input.currency,
	});

	return {
		balance: koboToScorpioBalance(newBalance),
		statusCode: "OK",
	};
}

export async function processScorpioCallback(
	db: Db,
	body: Record<string, unknown>,
): Promise<ScorpioCallbackResult> {
	const command = String(body.command ?? "");

	try {
		switch (command) {
			case "balance":
				return handleScorpioBalance(db, {
					playerId: String(body.playerId),
					currency: String(body.currency ?? "NGN"),
				});
			case "bet":
				return handleScorpioBet(db, {
					playerId: String(body.playerId),
					transactionId: String(body.transactionId),
					roundId: String(body.roundId),
					amount: Number(body.amount),
					currency: String(body.currency ?? "NGN"),
					providerId: Number(body.providerId),
					gameCode: String(body.gameCode),
				});
			case "win":
				return handleScorpioWin(db, {
					playerId: String(body.playerId),
					transactionId: String(body.transactionId),
					roundId: String(body.roundId),
					amount: Number(body.amount),
					currency: String(body.currency ?? "NGN"),
					providerId: Number(body.providerId),
					gameCode: String(body.gameCode),
				});
			case "cancel":
				return handleScorpioCancel(db, {
					playerId: String(body.playerId),
					transactionId: String(body.transactionId),
					referenceId: String(body.referenceId),
					roundId: String(body.roundId),
					amount: Number(body.amount),
					currency: String(body.currency ?? "NGN"),
					providerId: Number(body.providerId),
					gameCode: String(body.gameCode),
				});
			default:
				return { statusCode: "ERR_UNKNOWN" };
		}
	} catch (error) {
		console.log("scorpio callback handler error", {
			command,
			error: error instanceof Error ? error.message : "unknown",
		});
		return {
			balance: undefined,
			statusCode: "ERR_UNKNOWN",
		};
	}
}
