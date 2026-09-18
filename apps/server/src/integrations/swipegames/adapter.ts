import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { creditWallet, debitWallet } from "@/db/atomic-wallet";
import * as schema from "@/db/schema";
import { generateUUIDv7 } from "@/utils/uuid";
import { koboToNairaDecimal, nairaDecimalToKobo } from "./money";
import type {
	AdapterErrorResponse,
	BalanceResponse,
	BetRequest,
	BetResponse,
	RefundRequest,
	RefundResponse,
	WinRequest,
	WinResponse,
} from "./types";

type Db = DrizzleD1Database<typeof schema>;

export type AdapterSuccess<T> = { ok: true; status: 200; body: T };
export type AdapterFailure = {
	ok: false;
	status: 400 | 401 | 404 | 500;
	body: AdapterErrorResponse;
};
export type AdapterResult<T> = AdapterSuccess<T> | AdapterFailure;

export function isUniqueConstraintError(error: unknown): boolean {
	let current: unknown = error;
	for (let i = 0; i < 5 && current; i++) {
		const message = current instanceof Error ? current.message : String(current);
		if (
			message.includes("UNIQUE constraint failed") ||
			(message.includes("D1_ERROR") && message.toUpperCase().includes("UNIQUE"))
		) {
			return true;
		}
		current =
			current instanceof Error && "cause" in current
				? current.cause
				: undefined;
	}
	return false;
}

function fail(
	status: AdapterFailure["status"],
	message: string,
	code?: AdapterErrorResponse["code"],
	action?: AdapterErrorResponse["action"],
	details?: string,
): AdapterFailure {
	return {
		ok: false,
		status,
		body: {
			message,
			...(code ? { code } : {}),
			...(action ? { action } : {}),
			...(details ? { details } : {}),
		},
	};
}

function ok<T>(body: T): AdapterSuccess<T> {
	return { ok: true, status: 200, body };
}

async function getWalletKobo(db: Db, userId: string): Promise<number> {
	const [wallet] = await db
		.select({ balance: schema.wallet.balance })
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, userId))
		.limit(1);
	return wallet?.balance ?? 0;
}

async function findSession(db: Db, sessionID: string) {
	const [row] = await db
		.select()
		.from(schema.swipegamesSessions)
		.where(eq(schema.swipegamesSessions.sessionId, sessionID))
		.limit(1);
	return row ?? null;
}

async function findByProviderTxId(db: Db, providerTxId: string) {
	const [row] = await db
		.select()
		.from(schema.swipegamesTransactions)
		.where(eq(schema.swipegamesTransactions.providerTxId, providerTxId))
		.limit(1);
	return row ?? null;
}

async function findRefundForOrig(db: Db, origProviderTxId: string) {
	const [row] = await db
		.select()
		.from(schema.swipegamesTransactions)
		.where(eq(schema.swipegamesTransactions.origProviderTxId, origProviderTxId))
		.limit(1);
	return row ?? null;
}

function moneyResponse(
	kobo: number,
	txID: string,
): { balance: string; txID: string } {
	return { balance: koboToNairaDecimal(kobo), txID };
}

export async function handleBalance(
	db: Db,
	sessionID: string,
): Promise<AdapterResult<BalanceResponse>> {
	const session = await findSession(db, sessionID);
	if (!session) {
		return fail(404, "Game session not found", "session_not_found", "refresh");
	}
	const balance = koboToNairaDecimal(await getWalletKobo(db, session.userId));
	return ok({ balance });
}

export async function handleBet(
	db: Db,
	request: BetRequest,
): Promise<AdapterResult<BetResponse>> {
	const session = await findSession(db, request.sessionID);
	if (!session) {
		return fail(404, "Game session not found", "session_not_found", "refresh");
	}

	const existing = await findByProviderTxId(db, request.txID);
	if (existing) {
		return ok(
			moneyResponse(existing.balanceAfter ?? 0, existing.id),
		);
	}

	const isFree = request.type === "free";
	let amountKobo = 0;
	try {
		amountKobo = isFree ? 0 : nairaDecimalToKobo(request.amount);
	} catch (error) {
		return fail(
			400,
			"Invalid bet amount",
			undefined,
			undefined,
			error instanceof Error ? error.message : String(error),
		);
	}

	if (!isFree && amountKobo > 0) {
		const current = await getWalletKobo(db, session.userId);
		if (current < amountKobo) {
			return fail(
				400,
				"Insufficient funds",
				"insufficient_funds",
				undefined,
				koboToNairaDecimal(current),
			);
		}
	}

	const ledgerId = generateUUIDv7();
	const balanceBefore = await getWalletKobo(db, session.userId);

	try {
		await db.insert(schema.swipegamesTransactions).values({
			id: ledgerId,
			providerTxId: request.txID,
			userId: session.userId,
			type: "bet",
			playType: request.type,
			amount: amountKobo,
			balanceBefore,
			balanceAfter: balanceBefore,
			roundId: request.roundID,
			sessionId: session.sessionId,
			frId: request.frID ?? null,
			gameId: session.gameId,
		});
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			const raced = await findByProviderTxId(db, request.txID);
			if (raced) {
				return ok(moneyResponse(raced.balanceAfter ?? 0, raced.id));
			}
		}
		throw error;
	}

	if (amountKobo > 0) {
		const wallet = await debitWallet(db, session.userId, amountKobo);
		if (!wallet) {
			await db
				.delete(schema.swipegamesTransactions)
				.where(eq(schema.swipegamesTransactions.id, ledgerId));
			const current = await getWalletKobo(db, session.userId);
			return fail(
				400,
				"Insufficient funds",
				"insufficient_funds",
				undefined,
				koboToNairaDecimal(current),
			);
		}
		await db
			.update(schema.swipegamesTransactions)
			.set({
				balanceBefore,
				balanceAfter: wallet.balance,
			})
			.where(eq(schema.swipegamesTransactions.id, ledgerId));
		return ok(moneyResponse(wallet.balance, ledgerId));
	}

	return ok(moneyResponse(balanceBefore, ledgerId));
}

export async function handleWin(
	db: Db,
	request: WinRequest,
): Promise<AdapterResult<WinResponse>> {
	const session = await findSession(db, request.sessionID);
	if (!session) {
		return fail(404, "Game session not found", "session_not_found", "refresh");
	}

	const existing = await findByProviderTxId(db, request.txID);
	if (existing) {
		return ok(moneyResponse(existing.balanceAfter ?? 0, existing.id));
	}

	// Free-round bet/win are tracking only. Real credit happens on the bonus
	// withdrawal: type=regular with frID after the campaign completes.
	const isTrackingOnly = request.type === "free";
	let amountKobo = 0;
	try {
		amountKobo = isTrackingOnly ? 0 : nairaDecimalToKobo(request.amount);
	} catch (error) {
		return fail(
			400,
			"Invalid win amount",
			undefined,
			undefined,
			error instanceof Error ? error.message : String(error),
		);
	}

	const ledgerId = generateUUIDv7();
	const balanceBefore = await getWalletKobo(db, session.userId);

	try {
		await db.insert(schema.swipegamesTransactions).values({
			id: ledgerId,
			providerTxId: request.txID,
			userId: session.userId,
			type: "win",
			playType: request.type,
			amount: amountKobo,
			balanceBefore,
			balanceAfter: balanceBefore,
			roundId: request.roundID,
			sessionId: session.sessionId,
			frId: request.frID ?? null,
			gameId: session.gameId,
		});
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			const raced = await findByProviderTxId(db, request.txID);
			if (raced) {
				return ok(moneyResponse(raced.balanceAfter ?? 0, raced.id));
			}
		}
		throw error;
	}

	if (amountKobo > 0) {
		const wallet = await creditWallet(db, session.userId, amountKobo);
		if (!wallet) {
			await db
				.delete(schema.swipegamesTransactions)
				.where(eq(schema.swipegamesTransactions.id, ledgerId));
			return fail(500, "Wallet not found");
		}
		await db
			.update(schema.swipegamesTransactions)
			.set({
				balanceBefore,
				balanceAfter: wallet.balance,
			})
			.where(eq(schema.swipegamesTransactions.id, ledgerId));
		return ok(moneyResponse(wallet.balance, ledgerId));
	}

	return ok(moneyResponse(balanceBefore, ledgerId));
}

export async function handleRefund(
	db: Db,
	request: RefundRequest,
): Promise<AdapterResult<RefundResponse>> {
	const session = await findSession(db, request.sessionID);
	const original = await findByProviderTxId(db, request.origTxID);
	const userId = session?.userId ?? original?.userId;
	const currentKobo = userId ? await getWalletKobo(db, userId) : 0;
	const ledgerId = generateUUIDv7();

	if (!userId) {
		return ok({ balance: "0.00", txID: ledgerId });
	}

	const existing = await findByProviderTxId(db, request.txID);
	if (existing) {
		return ok(moneyResponse(existing.balanceAfter ?? currentKobo, existing.id));
	}

	const alreadyRefunded = await findRefundForOrig(db, request.origTxID);
	if (alreadyRefunded) {
		return ok(
			moneyResponse(
				alreadyRefunded.balanceAfter ?? currentKobo,
				alreadyRefunded.id,
			),
		);
	}

	const creditKobo = original?.amount ?? 0;
	const balanceBefore = currentKobo;

	try {
		await db.insert(schema.swipegamesTransactions).values({
			id: ledgerId,
			providerTxId: request.txID,
			origProviderTxId: request.origTxID,
			userId,
			type: "refund",
			playType: null,
			amount: creditKobo,
			balanceBefore,
			balanceAfter: balanceBefore,
			roundId: request.roundID ?? original?.roundId ?? "",
			sessionId: request.sessionID,
			frId: null,
			gameId: session?.gameId ?? original?.gameId ?? "",
		});
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			const raced = await findByProviderTxId(db, request.txID);
			if (raced) {
				return ok(
					moneyResponse(raced.balanceAfter ?? currentKobo, raced.id),
				);
			}
		}
		return ok(moneyResponse(currentKobo, ledgerId));
	}

	if (userId && creditKobo > 0 && original && original.type === "bet") {
		const wallet = await creditWallet(db, userId, creditKobo);
		if (wallet) {
			await db
				.update(schema.swipegamesTransactions)
				.set({
					balanceBefore,
					balanceAfter: wallet.balance,
				})
				.where(eq(schema.swipegamesTransactions.id, ledgerId));
			return ok(moneyResponse(wallet.balance, ledgerId));
		}
	}

	return ok(moneyResponse(currentKobo, ledgerId));
}
