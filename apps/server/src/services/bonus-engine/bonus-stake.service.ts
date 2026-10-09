/**
 * Bonus share of stakes and results.
 *
 * Bonus funds are spent after real cash (the wallet trigger records each
 * debit and its bonus-funded part in `wallet.last_debit_*`). A stake that used bonus
 * funds is remembered by bet reference; when its win or refund arrives, the
 * same share of it is locked again, so a lucky bonus-funded spin cannot turn
 * into withdrawable cash before wagering is complete. The split is also what
 * Bonus Engine needs as `bonus_bet_amount` / `bonus_win_amount`.
 */
import { lockBonusWinnings, readWalletFunds } from "../../db/bonus-wallet";
import type { CloudflareBindings } from "../../types";
import { BONUS_ENGINE_BONUS_WIN_LOCK_REFERENCE_PREFIX } from "./bonus-engine.service.constant";

export type StakeSplit = { realKobo: number; bonusKobo: number };

/** `amount × numerator / denominator`, floored, in integer kobo. */
function shareOf(amount: number, numerator: number, denominator: number) {
	if (denominator <= 0 || numerator <= 0) return 0;
	return Math.floor((amount * numerator) / denominator);
}

/**
 * Reads the bonus share of the debit that just happened and remembers it for
 * `betRef`. Call right after the stake debit, in the same request. Never
 * throws: a bookkeeping failure must not fail the provider callback.
 */
export async function captureBonusStakeSplit(payload: {
	env: CloudflareBindings;
	userId: string;
	betRef: string;
	stakeKobo: number;
}): Promise<StakeSplit> {
	const stakeKobo = Math.max(0, Math.round(payload.stakeKobo));
	const allReal = { realKobo: stakeKobo, bonusKobo: 0 };
	if (stakeKobo === 0 || !payload.betRef) return allReal;
	try {
		const funds = await readWalletFunds(payload.env.DB, payload.userId);
		const lastDebitKobo = funds?.lastDebitKobo ?? 0;
		const lastDebitBonusKobo = funds?.lastDebitBonusKobo ?? 0;
		const bonusKobo = Math.min(
			stakeKobo,
			lastDebitKobo === stakeKobo
				? lastDebitBonusKobo
				: shareOf(stakeKobo, lastDebitBonusKobo, lastDebitKobo),
		);
		if (bonusKobo <= 0) return allReal;
		await payload.env.DB.prepare(
			"INSERT OR IGNORE INTO bonus_stake_split (user_id, bet_ref, stake_kobo, bonus_kobo) VALUES (?, ?, ?, ?)",
		)
			.bind(payload.userId, payload.betRef, stakeKobo, bonusKobo)
			.run();
		return { realKobo: stakeKobo - bonusKobo, bonusKobo };
	} catch (error) {
		console.error("Bonus stake split capture failed", {
			userId: payload.userId,
			betRef: payload.betRef,
			error,
		});
		return allReal;
	}
}

/**
 * Locks the bonus-funded share of a win or refund. Uses the split recorded
 * for `betRef`; when the provider reports results under a different id, falls
 * back to the bonus share of the player's latest debit (casino play is
 * debit → result, so that is the stake this result belongs to).
 * Idempotent per result reference. Never throws.
 */
export async function lockBonusShareOfResult(payload: {
	env: CloudflareBindings;
	userId: string;
	betRef: string;
	/** Unique per result (e.g. win tx id, or bet id + result kind). */
	resultRef: string;
	amountKobo: number;
	/** Sportsbook results always carry the bet id, so never guess. */
	allowLatestDebitFallback?: boolean;
}): Promise<StakeSplit> {
	const amountKobo = Math.max(0, Math.round(payload.amountKobo));
	const allReal = { realKobo: amountKobo, bonusKobo: 0 };
	if (amountKobo === 0) return allReal;
	try {
		const split = await payload.env.DB.prepare(
			"SELECT stake_kobo, bonus_kobo FROM bonus_stake_split WHERE user_id = ? AND bet_ref = ? LIMIT 1",
		)
			.bind(payload.userId, payload.betRef)
			.first<{ stake_kobo: number; bonus_kobo: number }>();

		let bonusPart = 0;
		let wholeStake = 0;
		if (split && Number(split.stake_kobo) > 0) {
			bonusPart = Number(split.bonus_kobo);
			wholeStake = Number(split.stake_kobo);
		} else if (payload.allowLatestDebitFallback !== false) {
			const funds = await readWalletFunds(payload.env.DB, payload.userId);
			bonusPart = funds?.lastDebitBonusKobo ?? 0;
			wholeStake = funds?.lastDebitKobo ?? 0;
		}

		const wantedKobo = shareOf(amountKobo, bonusPart, wholeStake);
		if (wantedKobo <= 0) return allReal;

		const lock = await lockBonusWinnings({
			DB: payload.env.DB,
			userId: payload.userId,
			amountKobo: wantedKobo,
			reference: `${BONUS_ENGINE_BONUS_WIN_LOCK_REFERENCE_PREFIX}:${payload.userId}:${payload.resultRef}`,
			metadata: {
				betRef: payload.betRef,
				resultKobo: amountKobo,
				stakeKobo: wholeStake,
				stakeBonusKobo: bonusPart,
			},
		});
		const bonusKobo =
			lock.status === "applied"
				? lock.appliedKobo
				: lock.status === "duplicate"
					? wantedKobo
					: 0;
		return { realKobo: amountKobo - bonusKobo, bonusKobo };
	} catch (error) {
		console.error("Bonus win lock failed", {
			userId: payload.userId,
			betRef: payload.betRef,
			error,
		});
		return allReal;
	}
}

/** Drops stake splits whose bets have long settled (hourly cron). */
export async function pruneBonusStakeSplits(
	env: CloudflareBindings,
	olderThan: Date,
): Promise<void> {
	await env.DB.prepare("DELETE FROM bonus_stake_split WHERE created_at < ?")
		.bind(olderThan.getTime())
		.run();
}
