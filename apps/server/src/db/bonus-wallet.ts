/**
 * Locked bonus funds inside the main wallet.
 *
 * Bonus Engine funds live in `wallet.balance` so every casino provider and the
 * sportsbook can stake them, and `wallet.bonus_balance` marks the part that is
 * not withdrawable yet. Invariant: 0 <= bonus_balance <= balance. Real cash is
 * spent first; the `wallet_bonus_balance_spend` trigger shrinks the locked
 * part only once a debit takes the balance below it.
 *
 * Every mutation here is one D1 batch (one transaction) that writes the ledger
 * row first and derives the wallet change from that row, so the amount
 * recorded and the amount moved can never disagree, and a replayed reference
 * fails on the unique index instead of moving money twice.
 */
import { isUniqueConstraintError } from "../services/casino-settlement";
import type { CloudflareBindings } from "../types";

type D1 = CloudflareBindings["DB"];

const NOW_MS_SQL = "cast(unixepoch('subsecond') * 1000 as integer)";

export type WalletFunds = {
	balanceKobo: number;
	frozenKobo: number;
	/** Locked bonus part of `balanceKobo`. */
	bonusKobo: number;
	/** `balanceKobo` minus locked bonus. */
	realKobo: number;
	/** What may leave the platform: balance − frozen − bonus. */
	withdrawableKobo: number;
	/** Most recent debit and the part of it paid from bonus funds. */
	lastDebitKobo: number;
	lastDebitBonusKobo: number;
};

export function walletFundsFromRow(row: {
	balance: number;
	frozenBalance?: number | null;
	bonusBalance?: number | null;
	lastDebitKobo?: number | null;
	lastDebitBonusKobo?: number | null;
}): WalletFunds {
	const balanceKobo = row.balance;
	const frozenKobo = Math.max(0, row.frozenBalance ?? 0);
	const bonusKobo = Math.min(
		Math.max(0, row.bonusBalance ?? 0),
		Math.max(0, balanceKobo),
	);
	return {
		balanceKobo,
		frozenKobo,
		bonusKobo,
		realKobo: Math.max(0, balanceKobo - bonusKobo),
		withdrawableKobo: Math.max(0, balanceKobo - frozenKobo - bonusKobo),
		lastDebitKobo: Math.max(0, row.lastDebitKobo ?? 0),
		lastDebitBonusKobo: Math.max(0, row.lastDebitBonusKobo ?? 0),
	};
}

export async function readWalletFunds(
	DB: D1,
	userId: string,
): Promise<WalletFunds | null> {
	const row = await DB.prepare(
		"SELECT balance, frozen_balance, bonus_balance, last_debit_kobo, last_debit_bonus_kobo FROM wallet WHERE user_id = ? LIMIT 1",
	)
		.bind(userId)
		.first<{
			balance: number;
			frozen_balance: number;
			bonus_balance: number;
			last_debit_kobo: number;
			last_debit_bonus_kobo: number;
		}>();
	if (!row) return null;
	return walletFundsFromRow({
		balance: Number(row.balance),
		frozenBalance: Number(row.frozen_balance),
		bonusBalance: Number(row.bonus_balance),
		lastDebitKobo: Number(row.last_debit_kobo),
		lastDebitBonusKobo: Number(row.last_debit_bonus_kobo),
	});
}

export type BonusWalletMoveResult = {
	status: "applied" | "duplicate" | "wallet_missing";
	requestedKobo: number;
	/** Signed change actually applied to `bonus_balance` (0 on duplicate). */
	appliedKobo: number;
};

type BonusMoveKind = "grant" | "forfeit" | "unlock" | "lock";

/**
 * Signed change to `bonus_balance`, as SQL over the wallet row. Each `?` is
 * the requested amount (bound once per occurrence).
 *
 * - grant: new bonus funds, added to balance and to the locked part.
 * - forfeit: removed from both, never more than is locked or than is free of
 *   pending sportsbook stakes (frozen), so a forfeit cannot overdraw.
 * - unlock: locked → withdrawable, balance unchanged.
 * - lock: withdrawable → locked (winnings of bonus stakes), balance unchanged.
 */
const BONUS_DELTA_SQL: Record<BonusMoveKind, { sql: string; params: number }> =
	{
		grant: { sql: "?", params: 1 },
		forfeit: {
			sql: "-MIN(?, bonus_balance, MAX(balance - frozen_balance, 0))",
			params: 1,
		},
		unlock: { sql: "-MIN(?, bonus_balance)", params: 1 },
		lock: { sql: "MIN(?, MAX(balance - bonus_balance, 0))", params: 1 },
	};

const MOVES_BALANCE: Record<BonusMoveKind, boolean> = {
	grant: true,
	forfeit: true,
	unlock: false,
	lock: false,
};

async function moveBonusFunds(payload: {
	DB: D1;
	userId: string;
	kind: BonusMoveKind;
	amountKobo: number;
	reference: string;
	/** Main-ledger payment method; required for kinds that move `balance`. */
	paymentMethod?: string;
	metadata?: Record<string, unknown>;
}): Promise<BonusWalletMoveResult> {
	const requestedKobo = payload.amountKobo;
	if (!Number.isSafeInteger(requestedKobo) || requestedKobo <= 0) {
		return { status: "applied", requestedKobo, appliedKobo: 0 };
	}

	const { DB, userId, kind, reference } = payload;
	const delta = BONUS_DELTA_SQL[kind];
	const deltaParams = Array<number>(delta.params).fill(requestedKobo);
	const metadataJson = JSON.stringify({
		source: "bonus_engine",
		requestedKobo,
		...payload.metadata,
	});
	const ledgerAmountSql =
		"(SELECT amount FROM bonus_wallet_ledger WHERE reference = ?)";

	const statements = [
		DB.prepare(
			`INSERT INTO bonus_wallet_ledger (id, user_id, amount, kind, reference, bonus_balance_after, metadata, created_at)
			 SELECT ?, user_id, ${delta.sql}, ?, ?, bonus_balance + ${delta.sql}, ?, ${NOW_MS_SQL}
			 FROM wallet WHERE user_id = ?`,
		).bind(
			crypto.randomUUID(),
			...deltaParams,
			kind,
			reference,
			...deltaParams,
			metadataJson,
			userId,
		),
	];

	if (MOVES_BALANCE[kind]) {
		statements.push(
			DB.prepare(
				`INSERT INTO wallet_transaction (id, user_id, amount, type, reference, status, payment_method, balance, metadata, created_at)
				 SELECT ?, user_id, ABS(${ledgerAmountSql}), CASE WHEN ${ledgerAmountSql} > 0 THEN 'credit' ELSE 'debit' END,
				        ?, 'success', ?, balance + ${ledgerAmountSql}, ?, ${NOW_MS_SQL}
				 FROM wallet WHERE user_id = ? AND ${ledgerAmountSql} <> 0`,
			).bind(
				crypto.randomUUID(),
				reference,
				reference,
				reference,
				payload.paymentMethod ?? "bonus_engine_bonus",
				reference,
				metadataJson,
				userId,
				reference,
			),
		);
	}

	statements.push(
		DB.prepare(
			`UPDATE wallet SET
				bonus_balance = bonus_balance + ${ledgerAmountSql},
				${MOVES_BALANCE[kind] ? `balance = balance + ${ledgerAmountSql},` : ""}
				updated_at = ${NOW_MS_SQL}
			 WHERE user_id = ? AND ${ledgerAmountSql} <> 0`,
		).bind(
			reference,
			...(MOVES_BALANCE[kind] ? [reference] : []),
			userId,
			reference,
		),
	);

	try {
		await DB.batch(statements);
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			return { status: "duplicate", requestedKobo, appliedKobo: 0 };
		}
		throw error;
	}

	const row = await DB.prepare(
		"SELECT amount FROM bonus_wallet_ledger WHERE reference = ? LIMIT 1",
	)
		.bind(reference)
		.first<{ amount: number }>();
	if (!row) {
		return { status: "wallet_missing", requestedKobo, appliedKobo: 0 };
	}

	const appliedKobo = Number(row.amount);
	if (Math.abs(appliedKobo) !== requestedKobo) {
		console.warn(
			JSON.stringify({
				tag: "bonus_wallet_clamped",
				userId,
				kind,
				reference,
				requestedKobo,
				appliedKobo,
			}),
		);
	}
	return { status: "applied", requestedKobo, appliedKobo };
}

/** Adds new bonus funds: playable now, withdrawable once unlocked. */
export function grantLockedBonus(payload: {
	DB: D1;
	userId: string;
	amountKobo: number;
	reference: string;
	paymentMethod: string;
	metadata?: Record<string, unknown>;
}): Promise<BonusWalletMoveResult> {
	return moveBonusFunds({ ...payload, kind: "grant" });
}

/** Removes locked bonus funds (cancel, expiry, loss, conversion cap). */
export function forfeitLockedBonus(payload: {
	DB: D1;
	userId: string;
	amountKobo: number;
	reference: string;
	paymentMethod: string;
	metadata?: Record<string, unknown>;
}): Promise<BonusWalletMoveResult> {
	return moveBonusFunds({ ...payload, kind: "forfeit" });
}

/** Releases locked bonus funds to withdrawable cash (wagering completed). */
export function unlockLockedBonus(payload: {
	DB: D1;
	userId: string;
	amountKobo: number;
	reference: string;
	metadata?: Record<string, unknown>;
}): Promise<BonusWalletMoveResult> {
	return moveBonusFunds({ ...payload, kind: "unlock" });
}

/** Locks the bonus-funded share of a win or refund until wagering completes. */
export function lockBonusWinnings(payload: {
	DB: D1;
	userId: string;
	amountKobo: number;
	reference: string;
	metadata?: Record<string, unknown>;
}): Promise<BonusWalletMoveResult> {
	return moveBonusFunds({ ...payload, kind: "lock" });
}

export type CashCreditResult = {
	status: "credited" | "duplicate" | "wallet_missing";
	amountKobo: number;
};

/**
 * Credits withdrawable cash once per `reference` (mission, tournament and
 * loyalty cash rewards). Ledger row and balance move in one transaction.
 */
export async function creditWalletCash(payload: {
	DB: D1;
	userId: string;
	amountKobo: number;
	reference: string;
	paymentMethod: string;
	metadata?: Record<string, unknown>;
}): Promise<CashCreditResult> {
	const { DB, userId, amountKobo, reference } = payload;
	if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
		throw new Error(`Invalid cash credit amount: ${amountKobo}`);
	}

	try {
		await DB.batch([
			DB.prepare(
				`INSERT INTO wallet_transaction (id, user_id, amount, type, reference, status, payment_method, balance, metadata, created_at)
				 SELECT ?, user_id, ?, 'credit', ?, 'success', ?, balance + ?, ?, ${NOW_MS_SQL}
				 FROM wallet WHERE user_id = ?`,
			).bind(
				crypto.randomUUID(),
				amountKobo,
				reference,
				payload.paymentMethod,
				amountKobo,
				JSON.stringify({ source: "bonus_engine", ...payload.metadata }),
				userId,
			),
			DB.prepare(
				`UPDATE wallet SET balance = balance + ?, updated_at = ${NOW_MS_SQL}
				 WHERE user_id = ? AND EXISTS (SELECT 1 FROM wallet_transaction WHERE reference = ?)`,
			).bind(amountKobo, userId, reference),
		]);
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			return { status: "duplicate", amountKobo };
		}
		throw error;
	}

	const row = await DB.prepare(
		"SELECT 1 AS found FROM wallet_transaction WHERE reference = ? LIMIT 1",
	)
		.bind(reference)
		.first<{ found: number }>();
	return row
		? { status: "credited", amountKobo }
		: { status: "wallet_missing", amountKobo };
}
