import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { ExecutionContext } from "hono";
import * as schema from "@/db/schema";
import { setWebengageUserAttributes } from "@/lib/webengage";
import type { CloudflareBindings } from "@/types";

const GAME_PAYMENT_METHODS = new Set([
	"slotegrator games",
	"lucky games",
	"lagos rush",
	"thndr games",
	"sportsbook",
	"halla",
]);

const SUCCESS_STATUSES = new Set(["success", "completed"]);
const OPEN_BET_STATUSES = new Set(["created", "accepted", "unsettled"]);
const LIVE_BET_TYPES = new Set([8, 9]);

const BET_TYPE_LABELS: Record<number, string> = {
	1: "single",
	2: "accumulator",
	3: "system",
	4: "chain",
	5: "conditional",
	6: "multi-single",
	7: "multi-accumulator",
	8: "live-series",
	9: "live-accumulator",
};

export function toWebengageIso(
	value: Date | string | null | undefined,
): string | undefined {
	if (!value) return undefined;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function kycStatusBoolean(
	verificationStatus: string | null | undefined,
	kycRecordStatus: string | null | undefined,
): boolean {
	return verificationStatus === "approved" || kycRecordStatus === "approved";
}

function naira(kobo: number | null | undefined): number {
	return (kobo ?? 0) / 100;
}

function mode(values: string[]): string | undefined {
	const counts = new Map<string, number>();
	for (const value of values) {
		const key = value.trim();
		if (!key) continue;
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	let winner: string | undefined;
	let best = 0;
	for (const [key, count] of counts) {
		if (count > best) {
			winner = key;
			best = count;
		}
	}
	return winner;
}

export function isDepositTransaction(tx: {
	type: string;
	status: string;
	paymentMethod: string;
}): boolean {
	if (tx.type !== "credit" || !SUCCESS_STATUSES.has(tx.status)) return false;
	const method = tx.paymentMethod.toLowerCase();
	if (method === "wallet_transfer" || GAME_PAYMENT_METHODS.has(method)) {
		return false;
	}
	return true;
}

export function isWithdrawalTransaction(tx: {
	type: string;
	status: string;
	paymentMethod: string;
}): boolean {
	return (
		tx.type === "debit" &&
		SUCCESS_STATUSES.has(tx.status) &&
		tx.paymentMethod.toLowerCase() === "paystack"
	);
}

export function walletTxAggregates(
	txs: Array<{
		type: string;
		status: string;
		paymentMethod: string;
		amount: number;
		createdAt: Date | string | null;
	}>,
) {
	let totalDeposited = 0;
	let depositCount = 0;
	let lastDeposit: Date | undefined;
	let totalWithdrawn = 0;
	for (const tx of txs) {
		const created = tx.createdAt
			? tx.createdAt instanceof Date
				? tx.createdAt
				: new Date(tx.createdAt)
			: undefined;
		if (isDepositTransaction(tx)) {
			totalDeposited += naira(tx.amount);
			depositCount += 1;
			if (created && (!lastDeposit || created > lastDeposit))
				lastDeposit = created;
		}
		if (isWithdrawalTransaction(tx)) totalWithdrawn += naira(tx.amount);
	}
	return {
		total_deposited: totalDeposited,
		deposit_count: depositCount,
		last_deposit_date: toWebengageIso(lastDeposit),
		total_withdrawn: totalWithdrawn,
	};
}

function firstSelection(betData: string | null): {
	sport?: string;
	league?: string;
} {
	if (!betData) return {};
	try {
		const parsed = JSON.parse(betData) as {
			bet_odds?: Array<{
				sport_id?: string | number;
				meta?: {
					sport_event_info_sport_id?: string | number;
					sport_event_info_tournament_id?: string | number;
				};
			}>;
		};
		const odd = parsed.bet_odds?.[0];
		const sport = odd?.meta?.sport_event_info_sport_id ?? odd?.sport_id;
		const league = odd?.meta?.sport_event_info_tournament_id;
		return {
			sport: sport == null ? undefined : String(sport),
			league: league == null ? undefined : String(league),
		};
	} catch {
		return {};
	}
}

export function betAggregates(
	bets: Array<{
		betType: number | null;
		status: string;
		stake: number;
		settleAmount: number | null;
		createdAt: Date | string | null;
		betData: string | null;
	}>,
) {
	const sports: string[] = [];
	const leagues: string[] = [];
	const types: string[] = [];
	let wagered = 0;
	let winnings = 0;
	let liveCount = 0;
	let openCount = 0;
	let lastBet: Date | undefined;

	for (const bet of bets) {
		wagered += naira(bet.stake);
		if (bet.status === "settled") winnings += naira(bet.settleAmount);
		if (OPEN_BET_STATUSES.has(bet.status)) openCount += 1;
		if (bet.betType != null && LIVE_BET_TYPES.has(bet.betType)) liveCount += 1;
		if (bet.betType != null && BET_TYPE_LABELS[bet.betType]) {
			types.push(BET_TYPE_LABELS[bet.betType]);
		}
		const created = bet.createdAt
			? bet.createdAt instanceof Date
				? bet.createdAt
				: new Date(bet.createdAt)
			: undefined;
		if (created && (!lastBet || created > lastBet)) lastBet = created;
		const selection = firstSelection(bet.betData);
		if (selection.sport) sports.push(selection.sport);
		if (selection.league) leagues.push(selection.league);
	}

	const placed = bets.length;
	return {
		total_bets_placed: placed,
		total_amount_wagered: wagered,
		total_winnings: winnings,
		avg_bet_amount: placed > 0 ? wagered / placed : 0,
		last_bet_date: toWebengageIso(lastBet),
		favourite_sport: mode(sports),
		favourite_league: mode(leagues),
		preferred_bet_type: mode(types),
		live_bet_ratio: placed > 0 ? liveCount / placed : 0,
		open_bets_count: openCount,
	};
}

export async function loadWebengageUserProfile(
	env: CloudflareBindings,
	userId: string,
): Promise<Record<string, unknown> | null> {
	const db = drizzle(env.DB, { schema });
	const [existing] = await db
		.select({
			id: schema.user.id,
			name: schema.user.name,
			email: schema.user.email,
			mobileNumber: schema.user.mobileNumber,
			createdAt: schema.user.createdAt,
			verificationStatus: schema.user.verificationStatus,
		})
		.from(schema.user)
		.where(eq(schema.user.id, userId))
		.limit(1);
	if (!existing) return null;

	const [walletRow] = await db
		.select({ balance: schema.wallet.balance })
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, userId))
		.limit(1);
	const [kycRow] = await db
		.select({ status: schema.kyc.status })
		.from(schema.kyc)
		.where(eq(schema.kyc.userId, userId))
		.orderBy(desc(schema.kyc.updatedAt))
		.limit(1);
	const txs = await db
		.select({
			type: schema.walletTransaction.type,
			status: schema.walletTransaction.status,
			paymentMethod: schema.walletTransaction.paymentMethod,
			amount: schema.walletTransaction.amount,
			createdAt: schema.walletTransaction.createdAt,
		})
		.from(schema.walletTransaction)
		.where(eq(schema.walletTransaction.userId, userId));
	const bets = await db
		.select({
			betType: schema.sportsbookBet.betType,
			status: schema.sportsbookBet.status,
			stake: schema.sportsbookBet.stake,
			settleAmount: schema.sportsbookBet.settleAmount,
			createdAt: schema.sportsbookBet.createdAt,
			betData: schema.sportsbookBet.betData,
		})
		.from(schema.sportsbookBet)
		.where(eq(schema.sportsbookBet.userId, userId));

	const nameParts = (existing.name || "").trim().split(/\s+/);
	return {
		userId: existing.id,
		email: existing.email || undefined,
		firstName: nameParts[0] || undefined,
		lastName: nameParts.slice(1).join(" ") || undefined,
		phone: existing.mobileNumber || undefined,
		kyc_status: kycStatusBoolean(existing.verificationStatus, kycRow?.status),
		registration_date: toWebengageIso(existing.createdAt),
		wallet_balance: naira(walletRow?.balance),
		...walletTxAggregates(txs),
		...betAggregates(bets),
	};
}

export async function syncWebengageUserProfile(
	env: CloudflareBindings,
	userId: string,
	executionCtx?: ExecutionContext,
): Promise<void> {
	try {
		const profile = await loadWebengageUserProfile(env, userId);
		if (!profile) return;
		setWebengageUserAttributes(env, profile, executionCtx);
	} catch (error) {
		console.error("WebEngage user profile sync failed", {
			userId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

export function scheduleWebengageUserProfileSync(
	env: CloudflareBindings,
	userId: string,
	executionCtx?: ExecutionContext,
): void {
	const task = syncWebengageUserProfile(env, userId, executionCtx);
	if (executionCtx && typeof executionCtx.waitUntil === "function") {
		executionCtx.waitUntil(task);
		return;
	}
	void task;
}
