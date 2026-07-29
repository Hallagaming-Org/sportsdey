import { and, eq, gte, sql } from "drizzle-orm";
import * as schema from "./schema";

type WalletDb = {
	update: (table: typeof schema.wallet) => any;
};

/**
 * Wallet mutations must be expressed as SQL arithmetic. Reading a balance in
 * application code and writing the calculated value loses concurrent updates.
 */
export const debitWallet = async (
	db: WalletDb,
	userId: string,
	amount: number,
) => {
	const [wallet] = await db
		.update(schema.wallet)
		.set({
			balance: sql`${schema.wallet.balance} - ${amount}`,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(schema.wallet.userId, userId),
				gte(schema.wallet.balance, amount),
			),
		)
		.returning({ id: schema.wallet.id, balance: schema.wallet.balance });

	return wallet;
};

export const creditWallet = async (
	db: WalletDb,
	userId: string,
	amount: number,
) => {
	const [wallet] = await db
		.update(schema.wallet)
		.set({
			balance: sql`${schema.wallet.balance} + ${amount}`,
			updatedAt: new Date(),
		})
		.where(eq(schema.wallet.userId, userId))
		.returning({ id: schema.wallet.id, balance: schema.wallet.balance });

	return wallet;
};

export const freezeWallet = async (
	db: WalletDb,
	userId: string,
	amount: number,
) => {
	const [wallet] = await db
		.update(schema.wallet)
		.set({
			frozenBalance: sql`${schema.wallet.frozenBalance} + ${amount}`,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(schema.wallet.userId, userId),
				sql`${schema.wallet.balance} - ${schema.wallet.frozenBalance} >= ${amount}`,
			),
		)
		.returning({
			id: schema.wallet.id,
			balance: schema.wallet.balance,
			frozenBalance: schema.wallet.frozenBalance,
		});

	return wallet;
};

export const unfreezeWallet = async (
	db: WalletDb,
	userId: string,
	amount: number,
) => {
	const [wallet] = await db
		.update(schema.wallet)
		.set({
			frozenBalance: sql`${schema.wallet.frozenBalance} - ${amount}`,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(schema.wallet.userId, userId),
				gte(schema.wallet.frozenBalance, amount),
			),
		)
		.returning({
			id: schema.wallet.id,
			balance: schema.wallet.balance,
			frozenBalance: schema.wallet.frozenBalance,
		});

	return wallet;
};
