/**
 * Wallet ↔ ledger reconciliation (safety net for the casino money-leak class).
 *
 * For each recently-active wallet, recompute the expected balance as the
 * signed sum of its `wallet_transaction` ledger (plus `swipegames_transactions`,
 * which move the wallet without mirroring into `wallet_transaction`) and
 * compare against `wallet.balance`. Any drift is logged as a structured
 * `wallet_reconciliation_drift` event so it can be alerted on from Cloudflare
 * logs, and returned for the admin endpoint.
 *
 * This job only ALERTS — it never mutates balances.
 *
 * Sign conventions (status-aware because reversals flip status in place, e.g.
 * a rejected withdrawal is credited back without a compensating ledger row):
 * - +amount: type in (credit, refund, deposit) with status success
 * - -amount: type in (debit, withdrawal, withdraw) unless status in
 *   (rejected, failed) — pending withdrawals HAVE debited the wallet
 * - other types are excluded from the sum and surfaced as `unknownTypeCount`
 */
import { gte, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import type { CloudflareBindings } from "../types";

// Static literals inlined into the CASE expression below (drizzle's `sql`
// template does not expand arrays into IN lists).
const CREDIT_TYPES_SQL = `('credit', 'refund', 'deposit')`;
const DEBIT_TYPES_SQL = `('debit', 'withdrawal', 'withdraw')`;
const ALL_TYPES_SQL = `('credit', 'refund', 'deposit', 'debit', 'withdrawal', 'withdraw')`;
const REVERSED_STATUSES_SQL = `('rejected', 'failed')`;

export type WalletDrift = {
	userId: string;
	balanceKobo: number;
	expectedKobo: number;
	driftKobo: number;
	walletLedgerKobo: number;
	swipeLedgerKobo: number;
	unknownTypeCount: number;
};

export type WalletReconciliationReport = {
	checkedUsers: number;
	driftedUsers: WalletDrift[];
	sinceIso: string;
};

export async function runWalletReconciliation(
	env: CloudflareBindings,
	options?: {
		sinceMs?: number;
		maxUsers?: number;
		userIds?: string[];
	},
): Promise<WalletReconciliationReport> {
	const db = drizzle(env.DB, { schema });
	// 26h default: hourly cron with overlap so nothing slips between runs.
	const since = new Date(Date.now() - (options?.sinceMs ?? 26 * 60 * 60 * 1000));
	const maxUsers = options?.maxUsers ?? 100;

	let userIds = options?.userIds;
	if (!userIds || userIds.length === 0) {
		const recent = await db
			.selectDistinct({ userId: schema.walletTransaction.userId })
			.from(schema.walletTransaction)
			.where(gte(schema.walletTransaction.createdAt, since))
			.limit(maxUsers);
		userIds = recent.map((row) => row.userId);
	}
	userIds = userIds.slice(0, maxUsers);

	if (userIds.length === 0) {
		return { checkedUsers: 0, driftedUsers: [], sinceIso: since.toISOString() };
	}

	const wallets = await db
		.select({
			userId: schema.wallet.userId,
			balance: schema.wallet.balance,
		})
		.from(schema.wallet)
		.where(inArray(schema.wallet.userId, userIds));

	const ledgerSums = await db
		.select({
			userId: schema.walletTransaction.userId,
			signedSum: sql<number>`COALESCE(SUM(CASE
				WHEN ${schema.walletTransaction.type} IN ${sql.raw(CREDIT_TYPES_SQL)}
					AND ${schema.walletTransaction.status} = 'success'
					THEN ${schema.walletTransaction.amount}
				WHEN ${schema.walletTransaction.type} IN ${sql.raw(DEBIT_TYPES_SQL)}
					AND ${schema.walletTransaction.status} NOT IN ${sql.raw(REVERSED_STATUSES_SQL)}
					THEN -${schema.walletTransaction.amount}
				ELSE 0 END), 0)`,
			unknownTypeCount: sql<number>`SUM(CASE
				WHEN ${schema.walletTransaction.type} NOT IN ${sql.raw(ALL_TYPES_SQL)}
					THEN 1 ELSE 0 END)`,
		})
		.from(schema.walletTransaction)
		.where(inArray(schema.walletTransaction.userId, userIds))
		.groupBy(schema.walletTransaction.userId);

	// Swipe Games settles the wallet without mirroring into wallet_transaction.
	const swipeSums = await db
		.select({
			userId: schema.swipegamesTransactions.userId,
			signedSum: sql<number>`COALESCE(SUM(CASE
				WHEN ${schema.swipegamesTransactions.type} = 'bet'
					THEN -${schema.swipegamesTransactions.amount}
				WHEN ${schema.swipegamesTransactions.type} IN ('win', 'refund')
					THEN ${schema.swipegamesTransactions.amount}
				ELSE 0 END), 0)`,
		})
		.from(schema.swipegamesTransactions)
		.where(inArray(schema.swipegamesTransactions.userId, userIds))
		.groupBy(schema.swipegamesTransactions.userId);

	const ledgerByUser = new Map(
		ledgerSums.map((row) => [
			row.userId,
			{
				signedSum: Number(row.signedSum),
				unknownTypeCount: Number(row.unknownTypeCount),
			},
		]),
	);
	const swipeByUser = new Map(
		swipeSums.map((row) => [row.userId, Number(row.signedSum)]),
	);

	const driftedUsers: WalletDrift[] = [];
	for (const wallet of wallets) {
		const ledger = ledgerByUser.get(wallet.userId) ?? {
			signedSum: 0,
			unknownTypeCount: 0,
		};
		const swipe = swipeByUser.get(wallet.userId) ?? 0;
		const expected = ledger.signedSum + swipe;
		const drift = wallet.balance - expected;
		if (drift !== 0) {
			const entry: WalletDrift = {
				userId: wallet.userId,
				balanceKobo: wallet.balance,
				expectedKobo: expected,
				driftKobo: drift,
				walletLedgerKobo: ledger.signedSum,
				swipeLedgerKobo: swipe,
				unknownTypeCount: ledger.unknownTypeCount,
			};
			driftedUsers.push(entry);
			console.error(
				JSON.stringify({ tag: "wallet_reconciliation_drift", ...entry }),
			);
		}
	}

	console.log(
		JSON.stringify({
			tag: "wallet_reconciliation_run",
			checkedUsers: wallets.length,
			driftedUsers: driftedUsers.length,
			since: since.toISOString(),
		}),
	);

	return {
		checkedUsers: wallets.length,
		driftedUsers,
		sinceIso: since.toISOString(),
	};
}
