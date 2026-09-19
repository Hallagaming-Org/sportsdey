import { and, eq, gte, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { toKobo } from "@/utils/casino-money";
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
	balance: number;
	statusCode: ScorpioCallbackStatus;
};

function callbackResult(
	statusCode: ScorpioCallbackStatus,
	kobo = 0,
): ScorpioCallbackResult {
	return { balance: koboToScorpioBalance(kobo), statusCode };
}

/** Scorpio amounts are major currency units; wallet stores kobo. */
export function scorpioAmountToKobo(amount: number): number {
	return toKobo(amount, "naira");
}

export function koboToScorpioBalance(kobo: number): number {
	return kobo / 100;
}

/** SQLite / D1 unique violations — same class of errors Thndr/Pockets rely on unique tx ids for. */
export function isUniqueConstraintError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return (
		message.includes("UNIQUE constraint failed") ||
		(message.includes("D1_ERROR") && message.toUpperCase().includes("UNIQUE"))
	);
}

async function getWalletKobo(db: Db, userId: string): Promise<number> {
	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, userId))
		.limit(1);
	return wallet?.balance ?? 0;
}

export async function scorpioCallbackResponse(
	db: Db | null,
	playerId: string | undefined,
	statusCode: ScorpioCallbackStatus,
): Promise<ScorpioCallbackResult> {
	if (!db || !playerId) return callbackResult(statusCode);
	try {
		const userId = await resolveScorpioUserId(db, playerId);
		if (!userId) return callbackResult(statusCode);
		return callbackResult(statusCode, await getWalletKobo(db, userId));
	} catch {
		return callbackResult(statusCode);
	}
}

export async function resolveScorpioUserId(
	db: Db,
	playerId: string,
): Promise<string | null> {
	const trimmed = playerId.trim();
	if (!trimmed) return null;

	const [byUser] = await db
		.select({ id: schema.user.id })
		.from(schema.user)
		.where(eq(schema.user.id, trimmed))
		.limit(1);
	if (byUser) return byUser.id;

	// Scorpio sends playerExternalId (= our user id). Prefer local mapping even if
	// the user row lookup somehow misses (still need wallet for balance).
	const [byScorpioUser] = await db
		.select({ userId: schema.scorpioPlayers.userId })
		.from(schema.scorpioPlayers)
		.where(eq(schema.scorpioPlayers.userId, trimmed))
		.limit(1);
	if (byScorpioUser) return byScorpioUser.userId;

	const asCode = Number(trimmed);
	if (Number.isInteger(asCode) && asCode > 0) {
		const [byCode] = await db
			.select({ userId: schema.scorpioPlayers.userId })
			.from(schema.scorpioPlayers)
			.where(eq(schema.scorpioPlayers.playerCode, asCode))
			.limit(1);
		if (byCode) return byCode.userId;
	}

	const [byWallet] = await db
		.select({ userId: schema.wallet.userId })
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, trimmed))
		.limit(1);
	if (byWallet) return byWallet.userId;

	return null;
}

async function ensureUserExists(db: Db, playerId: string): Promise<boolean> {
	return Boolean(await resolveScorpioUserId(db, playerId));
}

async function findByTransactionId(db: Db, transactionId: string) {
	const [row] = await db
		.select()
		.from(schema.scorpioTransactions)
		.where(eq(schema.scorpioTransactions.transactionId, transactionId))
		.limit(1);
	return row ?? null;
}

async function idempotentOk(
	db: Db,
	playerId: string,
	transactionId: string,
): Promise<ScorpioCallbackResult> {
	const existing = await findByTransactionId(db, transactionId);
	return {
		balance: koboToScorpioBalance(
			existing?.balanceAfter ?? (await getWalletKobo(db, playerId)),
		),
		statusCode: "OK",
	};
}

export async function handleScorpioBalance(
	db: Db,
	input: { playerId: string; currency: string },
): Promise<ScorpioCallbackResult> {
	const exists = await ensureUserExists(db, input.playerId);
	if (!exists) {
		return callbackResult("ERR_INVALID_PLAYER_ID");
	}

	const kobo = await getWalletKobo(db, input.playerId);
	return callbackResult("OK", kobo);
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
		return callbackResult("ERR_INVALID_PLAYER_ID");
	}

	if (await findByTransactionId(db, input.transactionId)) {
		return idempotentOk(db, input.playerId, input.transactionId);
	}

	const amountKobo = scorpioAmountToKobo(input.amount);
	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, input.playerId))
		.limit(1);

	const oldBalance = wallet?.balance ?? 0;
	if (!wallet || oldBalance < amountKobo) {
		return callbackResult("ERR_NOT_ENOUGH_MONEY", oldBalance);
	}

	const newBalance = oldBalance - amountKobo;
	const ledgerId = generateUUIDv7();

	// Claim unique transactionId first (race winner), matching unique-index idempotency.
	try {
		await db.insert(schema.scorpioTransactions).values({
			id: ledgerId,
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
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			return idempotentOk(db, input.playerId, input.transactionId);
		}
		throw error;
	}

	const [updated] = await db
		.update(schema.wallet)
		.set({ balance: sql`${schema.wallet.balance} - ${amountKobo}` })
		.where(
			and(
				eq(schema.wallet.userId, input.playerId),
				gte(schema.wallet.balance, amountKobo),
			),
		)
		.returning();

	if (!updated) {
		await db
			.delete(schema.scorpioTransactions)
			.where(eq(schema.scorpioTransactions.transactionId, input.transactionId));
		const balance = await getWalletKobo(db, input.playerId);
		return {
			balance: koboToScorpioBalance(balance),
			statusCode: "ERR_NOT_ENOUGH_MONEY",
		};
	}

	const balanceAfter = updated.balance;
	await db
		.update(schema.scorpioTransactions)
		.set({
			balanceBefore: balanceAfter + amountKobo,
			balanceAfter,
		})
		.where(eq(schema.scorpioTransactions.transactionId, input.transactionId));

	await db.insert(schema.walletTransaction).values({
		id: generateUUIDv7(),
		userId: input.playerId,
		amount: amountKobo,
		type: "debit",
		reference: null,
		status: "success",
		paymentMethod: "scorpio",
		balance: balanceAfter,
		metadata: JSON.stringify({
			provider: "scorpio",
			action: "bet",
			transactionId: input.transactionId,
			roundId: input.roundId,
			gameCode: input.gameCode,
		}),
	});

	return {
		balance: koboToScorpioBalance(balanceAfter),
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
		return callbackResult("ERR_INVALID_PLAYER_ID");
	}

	if (await findByTransactionId(db, input.transactionId)) {
		return idempotentOk(db, input.playerId, input.transactionId);
	}

	const amountKobo = scorpioAmountToKobo(input.amount);

	if (amountKobo > 0) {
		// A win payout must correspond to a bet we actually debited for this
		// round. Prevents unpaired-win credits from spoofed or mis-sequenced
		// callbacks.
		const [priorBet] = await db
			.select({ id: schema.scorpioTransactions.id })
			.from(schema.scorpioTransactions)
			.where(
				and(
					eq(schema.scorpioTransactions.userId, input.playerId),
					eq(schema.scorpioTransactions.roundId, input.roundId),
					eq(schema.scorpioTransactions.type, "BET"),
				),
			)
			.limit(1);
		if (!priorBet) {
			return callbackResult(
				"ERR_TRANSACTION_DOES_NOT_EXIST",
				await getWalletKobo(db, input.playerId),
			);
		}
	}

	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, input.playerId))
		.limit(1);

	const oldBalance = wallet?.balance ?? 0;
	const newBalance = oldBalance + amountKobo;

	try {
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
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			return idempotentOk(db, input.playerId, input.transactionId);
		}
		throw error;
	}

	if (wallet) {
		const [updated] = await db
			.update(schema.wallet)
			.set({ balance: sql`${schema.wallet.balance} + ${amountKobo}` })
			.where(eq(schema.wallet.userId, input.playerId))
			.returning();
		const balanceAfter = updated?.balance ?? newBalance;
		await db
			.update(schema.scorpioTransactions)
			.set({
				balanceBefore: balanceAfter - amountKobo,
				balanceAfter,
			})
			.where(eq(schema.scorpioTransactions.transactionId, input.transactionId));

		await db.insert(schema.walletTransaction).values({
			id: generateUUIDv7(),
			userId: input.playerId,
			amount: amountKobo,
			type: "credit",
			reference: null,
			status: "success",
			paymentMethod: "scorpio",
			balance: balanceAfter,
			metadata: JSON.stringify({
				provider: "scorpio",
				action: "win",
				transactionId: input.transactionId,
				roundId: input.roundId,
				gameCode: input.gameCode,
			}),
		});

		return {
			balance: koboToScorpioBalance(balanceAfter),
			statusCode: "OK",
		};
	}

	await db.insert(schema.wallet).values({
		id: generateUUIDv7(),
		userId: input.playerId,
		balance: newBalance,
	});

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
		return callbackResult("ERR_INVALID_PLAYER_ID");
	}

	if (await findByTransactionId(db, input.transactionId)) {
		return idempotentOk(db, input.playerId, input.transactionId);
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

	// Same rule as casino-provider rollback_spribe: BET refunds, other types reverse.
	if (original.type !== "BET" && original.type !== "WIN") {
		return {
			balance: koboToScorpioBalance(await getWalletKobo(db, input.playerId)),
			statusCode: "ERR_UNKNOWN",
		};
	}

	const amountKobo = original.amount;
	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, input.playerId))
		.limit(1);

	const oldBalance = wallet?.balance ?? 0;
	const adjustment = original.type === "BET" ? amountKobo : -amountKobo;
	const newBalance = oldBalance + adjustment;

	if (original.type === "WIN" && (!wallet || oldBalance < amountKobo)) {
		return {
			balance: koboToScorpioBalance(oldBalance),
			statusCode: "ERR_NOT_ENOUGH_MONEY",
		};
	}

	try {
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
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			return idempotentOk(db, input.playerId, input.transactionId);
		}
		throw error;
	}

	if (wallet) {
		if (original.type === "BET") {
			await db
				.update(schema.wallet)
				.set({ balance: sql`${schema.wallet.balance} + ${amountKobo}` })
				.where(eq(schema.wallet.userId, input.playerId));
		} else {
			const [updated] = await db
				.update(schema.wallet)
				.set({ balance: sql`${schema.wallet.balance} - ${amountKobo}` })
				.where(
					and(
						eq(schema.wallet.userId, input.playerId),
						gte(schema.wallet.balance, amountKobo),
					),
				)
				.returning();
			if (!updated) {
				await db
					.delete(schema.scorpioTransactions)
					.where(
						eq(schema.scorpioTransactions.transactionId, input.transactionId),
					);
				return {
					balance: koboToScorpioBalance(
						await getWalletKobo(db, input.playerId),
					),
					statusCode: "ERR_NOT_ENOUGH_MONEY",
				};
			}
		}
	} else if (original.type === "BET") {
		await db.insert(schema.wallet).values({
			id: generateUUIDv7(),
			userId: input.playerId,
			balance: amountKobo,
		});
	} else {
		await db
			.delete(schema.scorpioTransactions)
			.where(eq(schema.scorpioTransactions.transactionId, input.transactionId));
		return {
			balance: 0,
			statusCode: "ERR_NOT_ENOUGH_MONEY",
		};
	}

	const balanceAfter = await getWalletKobo(db, input.playerId);
	await db
		.update(schema.scorpioTransactions)
		.set({ balanceBefore: oldBalance, balanceAfter })
		.where(eq(schema.scorpioTransactions.transactionId, input.transactionId));

	await db.insert(schema.walletTransaction).values({
		id: generateUUIDv7(),
		userId: input.playerId,
		amount: amountKobo,
		type: "refund",
		reference: null,
		status: "success",
		paymentMethod: "scorpio",
		balance: balanceAfter,
		metadata: JSON.stringify({
			provider: "scorpio",
			action: "cancel",
			transactionId: input.transactionId,
			referenceId: input.referenceId,
			roundId: input.roundId,
			gameCode: input.gameCode,
			originalType: original.type,
		}),
	});

	return {
		balance: koboToScorpioBalance(balanceAfter),
		statusCode: "OK",
	};
}

export async function processScorpioCallback(
	db: Db,
	body: Record<string, unknown>,
): Promise<ScorpioCallbackResult> {
	const command = String(body.command ?? "");
	const rawPlayerId = String(body.playerId ?? "");
	const playerId = (await resolveScorpioUserId(db, rawPlayerId)) ?? rawPlayerId;

	try {
		switch (command) {
			case "balance":
				return handleScorpioBalance(db, {
					playerId,
					currency: String(body.currency ?? "NGN"),
				});
			case "bet":
				return handleScorpioBet(db, {
					playerId,
					transactionId: String(body.transactionId),
					roundId: String(body.roundId),
					amount: Number(body.amount),
					currency: String(body.currency ?? "NGN"),
					providerId: Number(body.providerId),
					gameCode: String(body.gameCode),
				});
			case "win":
				return handleScorpioWin(db, {
					playerId,
					transactionId: String(body.transactionId),
					roundId: String(body.roundId),
					amount: Number(body.amount),
					currency: String(body.currency ?? "NGN"),
					providerId: Number(body.providerId),
					gameCode: String(body.gameCode),
				});
			case "cancel":
				return handleScorpioCancel(db, {
					playerId,
					transactionId: String(body.transactionId),
					referenceId: String(body.referenceId),
					roundId: String(body.roundId),
					amount: Number(body.amount),
					currency: String(body.currency ?? "NGN"),
					providerId: Number(body.providerId),
					gameCode: String(body.gameCode),
				});
			default:
				return scorpioCallbackResponse(db, playerId, "ERR_UNKNOWN");
		}
	} catch (error) {
		console.log("scorpio callback handler error", {
			command,
			error: error instanceof Error ? error.message : "unknown",
			cause:
				error instanceof Error && error.cause instanceof Error
					? error.cause.message
					: undefined,
			stack: error instanceof Error ? error.stack : undefined,
		});
		return scorpioCallbackResponse(db, playerId, "ERR_UNKNOWN");
	}
}
