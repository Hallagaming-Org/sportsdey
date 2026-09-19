/**
 * Claim-first wallet settlement for the Pockets-shaped providers
 * (Lagos Rush `/pockets/*` and Halla `/halla/pockets/*`).
 *
 * The provider's own transactionId is required on every money call. The claim
 * row is inserted into `pockets_transactions` with a deterministic primary key
 * `{provider}:{action}:{providerTxId}` BEFORE the wallet moves, so provider
 * retries and concurrent duplicates settle exactly once (the PK unique
 * constraint is the lock). Previously these routes moved money first and then
 * minted a random UUID — every retry was a fresh credit.
 */
import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { creditWallet, debitWallet } from "@/db/atomic-wallet";
import * as schema from "@/db/schema";
import { isPositiveKobo } from "@/utils/casino-money";
import { settleWithClaim } from "./casino-settlement";

type Db = DrizzleD1Database<typeof schema>;

export type PocketsSettleInput = {
	db: Db;
	/** Claim-key prefix; keeps Lagos Rush and Halla ids from colliding. */
	provider: "pockets" | "halla";
	/** `wallet_transaction.paymentMethod` label. */
	paymentMethod: string;
	action: "debit" | "credit" | "refund";
	playerId: string;
	providerTxId: string;
	amountKobo: number;
	currency: string;
	metadata: Record<string, unknown>;
};

export type PocketsSettleResult =
	| {
			status: "settled" | "duplicate";
			oldBalanceKobo: number;
			newBalanceKobo: number;
			transactionId: string;
	  }
	| { status: "invalid_amount" }
	| { status: "wallet_missing" }
	| { status: "insufficient" };

export async function settlePocketsTransaction(
	input: PocketsSettleInput,
): Promise<PocketsSettleResult> {
	const { db, action, playerId, amountKobo } = input;

	if (!isPositiveKobo(amountKobo)) {
		return { status: "invalid_amount" };
	}

	const [wallet] = await db
		.select({ balance: schema.wallet.balance })
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, playerId))
		.limit(1);

	if (!wallet) {
		return { status: "wallet_missing" };
	}

	if (action === "debit" && wallet.balance < amountKobo) {
		return { status: "insufficient" };
	}

	const claimId = `${input.provider}:${action}:${input.providerTxId}`;
	const ledgerType = action.toUpperCase();
	const walletTxnType = action === "debit" ? "debit" : action;

	const outcome = await settleWithClaim<
		typeof schema.pocketsTransactions.$inferSelect
	>({
		context: {
			provider: input.provider,
			action,
			userId: playerId,
			txId: input.providerTxId,
			amountKobo,
		},
		insertClaim: () =>
			db.insert(schema.pocketsTransactions).values({
				id: claimId,
				userId: playerId,
				type: ledgerType,
				amount: amountKobo,
				balanceBefore: wallet.balance,
				balanceAfter: wallet.balance,
				currency: input.currency,
			}),
		findExisting: async () => {
			const [row] = await db
				.select()
				.from(schema.pocketsTransactions)
				.where(eq(schema.pocketsTransactions.id, claimId))
				.limit(1);
			return row;
		},
		releaseClaim: () =>
			db
				.delete(schema.pocketsTransactions)
				.where(eq(schema.pocketsTransactions.id, claimId)),
		mutateWallet: () =>
			action === "debit"
				? debitWallet(db, playerId, amountKobo)
				: creditWallet(db, playerId, amountKobo),
		finalize: async (balanceAfter) => {
			const balanceBefore =
				action === "debit"
					? balanceAfter + amountKobo
					: balanceAfter - amountKobo;
			await db
				.update(schema.pocketsTransactions)
				.set({ balanceBefore, balanceAfter })
				.where(eq(schema.pocketsTransactions.id, claimId));
			await db.insert(schema.walletTransaction).values({
				id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
				userId: playerId,
				amount: amountKobo,
				type: walletTxnType,
				reference: claimId,
				status: "success",
				paymentMethod: input.paymentMethod,
				balance: balanceAfter,
				metadata: JSON.stringify({
					...input.metadata,
					providerTxId: input.providerTxId,
				}),
			});
		},
	});

	if (outcome.status === "duplicate") {
		return {
			status: "duplicate",
			oldBalanceKobo: outcome.existing.balanceBefore ?? wallet.balance,
			newBalanceKobo: outcome.existing.balanceAfter ?? wallet.balance,
			transactionId: outcome.existing.id,
		};
	}

	if (outcome.status === "wallet_failed") {
		return action === "debit"
			? { status: "insufficient" }
			: { status: "wallet_missing" };
	}

	return {
		status: "settled",
		oldBalanceKobo:
			action === "debit"
				? outcome.balance + amountKobo
				: outcome.balance - amountKobo,
		newBalanceKobo: outcome.balance,
		transactionId: claimId,
	};
}
