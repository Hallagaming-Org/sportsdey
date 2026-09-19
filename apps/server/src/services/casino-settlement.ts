/**
 * Shared claim-first settlement for casino provider wallet callbacks.
 *
 * Invariant: a unique idempotency row ("claim") must be inserted BEFORE the
 * wallet balance is mutated. If the claim insert hits a unique constraint,
 * the callback is a duplicate/replay and the stored result is echoed without
 * moving money again. If the wallet mutation fails, the claim is released so
 * a provider retry can settle exactly once.
 *
 * This is the same pattern LuckyWorld (`claimGameTx` + `settleClaimedWallet`)
 * and Scorpio already use; Pockets/Halla/Thndr/Slotegrator route through this
 * helper so no adapter hand-rolls its own credit/debit/ledger ordering.
 */

export function isUniqueConstraintError(error: unknown): boolean {
	let current: unknown = error;
	for (let i = 0; i < 5 && current; i++) {
		const message =
			current instanceof Error ? current.message : String(current);
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

export type MoneyMovementContext = {
	provider: string;
	action: string;
	userId: string;
	txId: string;
	roundId?: string | null;
	amountKobo: number;
};

/**
 * Structured money-movement log line. Every wallet mutation in a casino
 * callback logs one of these so incidents can be traced without DB archaeology.
 */
export function logMoneyMovement(
	entry: MoneyMovementContext & {
		claimStatus: "settled" | "duplicate" | "wallet_failed" | "error";
		balanceBefore?: number;
		balanceAfter?: number;
		detail?: string;
	},
): void {
	console.log(JSON.stringify({ tag: "money_movement", ...entry }));
}

export type SettleOutcome<Existing> =
	| { status: "duplicate"; existing: Existing }
	| { status: "settled"; balance: number }
	| { status: "wallet_failed" };

/**
 * Claim-first settle:
 * 1. `insertClaim` — unique insert; conflict means duplicate → echo `findExisting`.
 * 2. `mutateWallet` — the single balance UPDATE; undefined = failed (e.g. insufficient funds).
 *    On failure/throw the claim is released via `releaseClaim` so a retry can settle.
 * 3. `finalize` — record final balances / ledger rows. Failures here must not
 *    reverse the wallet (money already moved); they are logged and swallowed
 *    by the caller if idempotent.
 */
export async function settleWithClaim<Existing>(opts: {
	context: MoneyMovementContext;
	insertClaim: () => Promise<unknown>;
	findExisting: () => Promise<Existing | null | undefined>;
	releaseClaim: () => Promise<unknown>;
	mutateWallet: () => Promise<{ balance: number } | undefined>;
	finalize: (balanceAfter: number) => Promise<void>;
}): Promise<SettleOutcome<Existing>> {
	try {
		await opts.insertClaim();
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			const existing = await opts.findExisting();
			if (existing) {
				logMoneyMovement({ ...opts.context, claimStatus: "duplicate" });
				return { status: "duplicate", existing };
			}
		}
		logMoneyMovement({
			...opts.context,
			claimStatus: "error",
			detail: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}

	let updated: { balance: number } | undefined;
	try {
		updated = await opts.mutateWallet();
	} catch (error) {
		try {
			await opts.releaseClaim();
		} catch {
			// Keep the wallet error; a stuck claim must not hide it.
		}
		logMoneyMovement({
			...opts.context,
			claimStatus: "error",
			detail: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}

	if (!updated) {
		await opts.releaseClaim();
		logMoneyMovement({ ...opts.context, claimStatus: "wallet_failed" });
		return { status: "wallet_failed" };
	}

	try {
		await opts.finalize(updated.balance);
	} catch (error) {
		// Money already moved; never reverse here. Log for reconciliation.
		logMoneyMovement({
			...opts.context,
			claimStatus: "error",
			balanceAfter: updated.balance,
			detail: `finalize failed: ${error instanceof Error ? error.message : String(error)}`,
		});
	}

	logMoneyMovement({
		...opts.context,
		claimStatus: "settled",
		balanceBefore: updated.balance - signedAmount(opts.context),
		balanceAfter: updated.balance,
	});
	return { status: "settled", balance: updated.balance };
}

function signedAmount(context: MoneyMovementContext): number {
	const debitActions = new Set(["bet", "debit", "withdraw"]);
	return debitActions.has(context.action)
		? -context.amountKobo
		: context.amountKobo;
}
