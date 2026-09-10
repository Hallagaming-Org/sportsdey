import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { toWAT } from "@/utils";
import { getFixtureTitlesByIds, matchDisplayName } from "@/utils/fixtures";
import {
	collectTicketOdds,
	formatTicketSelection,
	loadMarketDefinitions,
	parseMarketId,
} from "@/utils/ticket-selection-labels";
import type { CloudflareBindings } from "../types";

const betHistoryRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const MAX_PER_SOURCE = 2000;

const BetHistoryItemSchema = z.object({
	id: z.string(),
	ticketId: z.string(),
	type: z.string(),
	amount: z.number(),
	multiplier: z.number(),
	status: z.enum(["success", "pending", "failed"]),
	placedAt: z.string(),
	totalOdds: z.string().nullable(),
	potentialWin: z.number().nullable(),
	actualPayout: z.number().nullable(),
	settledAt: z.string().nullable(),
	betType: z.string().nullable(),
});

const BetHistoryResponseSchema = z
	.object({
		success: z.literal(true),
		data: z.object({
			items: z.array(BetHistoryItemSchema),
			page: z.number(),
			totalPages: z.number(),
			counts: z.object({
				all: z.number(),
				settled: z.number(),
				unsettled: z.number(),
			}),
		}),
	})
	.openapi("BetHistoryResponse");

const ErrorSchema = z.object({
	success: z.literal(false),
	error: z.string(),
});

const getBetHistoryRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["Bet History"],
	summary: "Get current user's bet history",
	security: [{ BearerAuth: [] }],
	request: {
		query: z.object({
			page: z.string().optional(),
			limit: z.string().optional(),
			filter: z.enum(["all", "settled", "unsettled"]).optional(),
			search: z.string().optional(),
		}),
	},
	responses: {
		200: {
			description: "Bet history retrieved successfully",
			content: { "application/json": { schema: BetHistoryResponseSchema } },
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorSchema } },
		},
	},
});

function getGameTypeLabel(
	betData: string | null,
	betType: number | null = null,
): string {
	if (betType) {
		const typeMap: Record<number, string> = {
			1: "Bets - Single",
			2: "Bets - Accumulator",
			3: "Bets - System",
			4: "Bets - Chain",
			5: "Bets - Conditional",
			6: "Bets - Multi-single",
			7: "Bets - Multi-accumulator",
			8: "Bets - Live series",
			9: "Bets - Live accumulator",
		};
		return typeMap[betType] || "Bets - Sport";
	}

	if (!betData) return "Bets - Sport";

	try {
		const parsed = JSON.parse(betData);

		if (parsed.provider || parsed.gameName || parsed.game_name) {
			const gameName = parsed.gameName || parsed.game_name || "Casino";
			return `Casino - ${gameName}`;
		}

		if (parsed.gameType === "Sportsbook") {
			if (parsed.sport) {
				return `Bets - ${parsed.sport}`;
			}
			if (parsed.bet_odds && parsed.bet_odds.length > 0) {
				const firstOdd = parsed.bet_odds[0];
				if (firstOdd.sport_id) {
					const sportMap: Record<string, string> = {
						football: "Sport",
						soccer: "Sport",
						basketball: "Basketball",
						tennis: "Tennis",
						baseball: "Baseball",
						americanfootball: "American Football",
						icehockey: "Ice Hockey",
						rugby: "Rugby",
						cricket: "Cricket",
						boxing: "Boxing",
						mma: "MMA",
						esports: "Esports",
					};
					return `Bets - ${sportMap[firstOdd.sport_id] || "Sport"}`;
				}
			}
			return "Bets - Sport";
		}

		if (parsed.gameType) {
			return parsed.gameType;
		}

		return "Bets - Sport";
	} catch {
		return "Bets - Sport";
	}
}

function deriveStatus(
	status: string,
	settleType: number | null,
): "success" | "pending" | "failed" {
	if (settleType === 1) return "success";
	if (settleType === 3) return "failed";
	if (settleType !== null) return "failed";
	if (status === "created" || status === "accepted") return "pending";
	return "failed";
}

type CasinoStatus = "success" | "pending" | "failed";

const CASINO_WIN_TYPES = new Set(["win", "won", "credit"]);
const CASINO_BET_TYPES = new Set(["bet", "debit"]);

function casinoTypeKey(type: string): string {
	return type.trim().toLowerCase();
}

function isCasinoWinType(type: string): boolean {
	return CASINO_WIN_TYPES.has(casinoTypeKey(type));
}

function isCasinoBetType(type: string): boolean {
	return CASINO_BET_TYPES.has(casinoTypeKey(type));
}

/**
 * Instant casino rounds settle as soon as the provider posts a result.
 * A WIN of ₦0 is a loss (or a rejected spin), not a win.
 * A BET with no credit is a completed loss, not an open ticket.
 */
export function deriveStatusFromCasino(
	type: string,
	amount = 0,
): CasinoStatus {
	if (isCasinoWinType(type)) {
		return amount > 0 ? "success" : "failed";
	}
	return "failed";
}

type CasinoLedgerRow = {
	id: string;
	type: string;
	amount: number;
	createdAt: Date;
	roundId?: string | null;
	gameLabel: string;
};

type CollapsedCasinoItem = {
	id: string;
	ticketId: string;
	gameLabel: string;
	amount: number;
	status: CasinoStatus;
	payout: number | null;
	createdAt: Date;
	settledAt: Date;
};

export function collapseCasinoLedgerRows(
	rows: CasinoLedgerRow[],
): CollapsedCasinoItem[] {
	const groups = new Map<string, CasinoLedgerRow[]>();
	for (const row of rows) {
		const key = row.roundId?.trim() || `tx:${row.id}`;
		const list = groups.get(key);
		if (list) list.push(row);
		else groups.set(key, [row]);
	}

	const items: CollapsedCasinoItem[] = [];
	for (const group of groups.values()) {
		group.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
		const bets = group.filter((row) => isCasinoBetType(row.type));
		const wins = group.filter((row) => isCasinoWinType(row.type));
		const betAmount = bets.reduce((sum, row) => sum + row.amount, 0);
		const winAmount = wins.reduce((sum, row) => sum + row.amount, 0);

		// Insufficient-funds / rejected play: provider may send WIN 0 with no debit.
		if (bets.length === 0 && winAmount <= 0) {
			continue;
		}

		const primary = bets[0] ?? group[0];
		const status: CasinoStatus = winAmount > 0 ? "success" : "failed";
		items.push({
			id: primary.id,
			ticketId: primary.id,
			gameLabel: primary.gameLabel,
			amount: (betAmount > 0 ? betAmount : winAmount) / 100,
			status,
			payout: status === "success" ? winAmount / 100 : 0,
			createdAt: primary.createdAt,
			settledAt: group[group.length - 1].createdAt,
		});
	}
	return items;
}

function pushCollapsedCasinoItems(
	allItems: Array<{
		id: string;
		ticketId: string;
		type: string;
		amount: number;
		multiplier: number;
		status: CasinoStatus;
		placedAt: string;
		totalOdds: string | null;
		potentialWin: number | null;
		actualPayout: number | null;
		settledAt: string | null;
		betType: string | null;
		createdAt: Date;
	}>,
	items: CollapsedCasinoItem[],
) {
	for (const item of items) {
		const won = item.status === "success";
		allItems.push({
			id: item.id,
			ticketId: item.ticketId,
			type: `Casino - ${item.gameLabel}`,
			amount: item.amount,
			multiplier: won && item.amount > 0 ? (item.payout ?? 0) / item.amount : 0,
			status: item.status,
			placedAt: toWAT(item.createdAt),
			totalOdds: null,
			potentialWin: won ? item.payout : null,
			actualPayout: item.payout,
			settledAt: toWAT(item.settledAt),
			betType: "Casino",
			createdAt: item.createdAt,
		});
	}
}

// Bet Type labels for display
const BET_TYPE_LABELS: Record<number, string> = {
	1: "Single",
	2: "Accumulator",
	3: "System",
	4: "Chain",
	5: "Conditional",
	6: "Multi-single",
	7: "Multi-accumulator",
	8: "Live series",
	9: "Live accumulator",
};

betHistoryRoute.openapi(getBetHistoryRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ success: false as const, error: "Unauthorized" }, 401);
	}

	const db = drizzle(c.env.DB, { schema });

	const query = c.req.valid("query");
	const page = Math.max(1, Number.parseInt(query.page || "1", 10));
	const limit = Math.min(
		100,
		Math.max(1, Number.parseInt(query.limit || "10", 10)),
	);
	const offset = (page - 1) * limit;
	const filter = query.filter ?? "all";
	const search = query.search?.trim();

	const allItems: Array<{
		id: string;
		ticketId: string;
		type: string;
		amount: number;
		multiplier: number;
		status: "success" | "pending" | "failed";
		placedAt: string;
		totalOdds: string | null;
		potentialWin: number | null;
		actualPayout: number | null;
		settledAt: string | null;
		betType: string | null;
		createdAt: Date;
	}> = [];

	// ===== 1. SPORTSBOOK BETS =====
	const sbFilters: any[] = [eq(schema.sportsbookBet.userId, user.id)];
	if (search) {
		sbFilters.push(
			or(
				like(schema.sportsbookBet.id, `%${search}%`),
				like(schema.sportsbookBet.requestId, `%${search}%`),
			),
		);
	}

	const sbRows = await db
		.select({
			id: schema.sportsbookBet.id,
			stake: schema.sportsbookBet.stake,
			totalOdds: schema.sportsbookBet.totalOdds,
			status: schema.sportsbookBet.status,
			settleAmount: schema.sportsbookBet.settleAmount,
			settleType: schema.sportsbookBet.settleType,
			betData: schema.sportsbookBet.betData,
			betType: schema.sportsbookBet.betType,
			createdAt: schema.sportsbookBet.createdAt,
			updatedAt: schema.sportsbookBet.updatedAt,
		})
		.from(schema.sportsbookBet)
		.where(and(...sbFilters))
		.orderBy(desc(schema.sportsbookBet.createdAt))
		.limit(MAX_PER_SOURCE);

	for (const row of sbRows) {
		const stakeNaira = row.stake / 100;
		const oddsValue = row.totalOdds ? Number.parseFloat(row.totalOdds) : 0;
		const status = deriveStatus(row.status, row.settleType);
		const isSettled = status !== "pending";

		const typeLabel = getGameTypeLabel(row.betData, row.betType);
		const betTypeLabel = row.betType
			? BET_TYPE_LABELS[row.betType] || null
			: null;

		allItems.push({
			id: row.id,
			ticketId: row.id,
			type: typeLabel,
			amount: stakeNaira,
			multiplier: oddsValue,
			status,
			placedAt: toWAT(row.createdAt),
			totalOdds: row.totalOdds,
			potentialWin: oddsValue > 0 ? stakeNaira * oddsValue : null,
			actualPayout: isSettled ? (row.settleAmount ?? 0) / 100 : null,
			settledAt: isSettled ? toWAT(row.updatedAt) : null,
			betType: betTypeLabel,
			createdAt: row.createdAt,
		});
	}

	// ===== 2. FETCH CASINO TRANSACTIONS (gameTransactions) =====
	const casinoFilters: any[] = [eq(schema.gameTransactions.userId, user.id)];
	if (search) {
		casinoFilters.push(like(schema.gameTransactions.id, `%${search}%`));
	}

	const casinoRows = await db
		.select({
			id: schema.gameTransactions.id,
			type: schema.gameTransactions.type,
			amount: schema.gameTransactions.amount,
			createdAt: schema.gameTransactions.createdAt,
			game: schema.gameTransactions.game,
		})
		.from(schema.gameTransactions)
		.where(and(...casinoFilters))
		.orderBy(desc(schema.gameTransactions.createdAt))
		.limit(MAX_PER_SOURCE);

	const gameNameCache = new Map<string, string | null>();
	async function getGameName(code: string): Promise<string | null> {
		if (gameNameCache.has(code)) return gameNameCache.get(code)!;
		const [row] = await db
			.select({ name: schema.game.name })
			.from(schema.game)
			.where(eq(schema.game.code, code))
			.limit(1);
		const name = row?.name ?? null;
		gameNameCache.set(code, name);
		return name;
	}

	for (const row of casinoRows) {
		if (isCasinoWinType(row.type) && row.amount <= 0) continue;

		let gameName = "Casino";
		if (row.game) {
			const name = await getGameName(row.game);
			if (name) gameName = name;
		}

		const amountNaira = row.amount / 100;
		const status = deriveStatusFromCasino(row.type, row.amount);
		const won = status === "success";

		allItems.push({
			id: row.id,
			ticketId: row.id,
			type: `Casino - ${gameName}`,
			amount: amountNaira,
			multiplier: 0,
			status,
			placedAt: toWAT(row.createdAt),
			totalOdds: null,
			potentialWin: won ? amountNaira : null,
			actualPayout: won ? amountNaira : 0,
			settledAt: toWAT(row.createdAt),
			betType: "Casino",
			createdAt: row.createdAt,
		});
	}

	// ===== 3. FETCH THUNDR TRANSACTIONS =====
	const thundrFilters: any[] = [eq(schema.thundrTransactions.userId, user.id)];
	if (search) {
		thundrFilters.push(like(schema.thundrTransactions.id, `%${search}%`));
	}

	const thundrRows = await db
		.select({
			id: schema.thundrTransactions.id,
			type: schema.thundrTransactions.type,
			amount: schema.thundrTransactions.amount,
			createdAt: schema.thundrTransactions.createdAt,
			gameId: schema.thundrTransactions.gameId,
			roundId: schema.thundrTransactions.roundId,
		})
		.from(schema.thundrTransactions)
		.where(and(...thundrFilters))
		.orderBy(desc(schema.thundrTransactions.createdAt))
		.limit(MAX_PER_SOURCE);

	const thundrLedger: CasinoLedgerRow[] = [];
	for (const row of thundrRows) {
		let gameName = row.gameId || "Thundr";
		if (row.gameId) {
			const name = await getGameName(row.gameId);
			if (name) gameName = name;
		}
		thundrLedger.push({
			id: row.id,
			type: row.type,
			amount: row.amount,
			createdAt: row.createdAt,
			roundId: row.roundId,
			gameLabel: gameName,
		});
	}
	pushCollapsedCasinoItems(allItems, collapseCasinoLedgerRows(thundrLedger));

	// ===== 4. FETCH SLOTEGRATOR TRANSACTIONS =====
	const slotFilters: any[] = [
		eq(schema.slotitegrationTransactions.userId, user.id),
	];
	if (search) {
		slotFilters.push(like(schema.slotitegrationTransactions.id, `%${search}%`));
	}

	const slotRows = await db
		.select({
			id: schema.slotitegrationTransactions.id,
			type: schema.slotitegrationTransactions.type,
			amount: schema.slotitegrationTransactions.amount,
			createdAt: schema.slotitegrationTransactions.createdAt,
			gameId: schema.slotitegrationTransactions.gameId,
			roundId: schema.slotitegrationTransactions.roundId,
		})
		.from(schema.slotitegrationTransactions)
		.where(and(...slotFilters))
		.orderBy(desc(schema.slotitegrationTransactions.createdAt))
		.limit(MAX_PER_SOURCE);

	const slotLedger: CasinoLedgerRow[] = [];
	for (const row of slotRows) {
		let gameName = "Slotegrator";
		if (row.gameId) {
			const name = await getGameName(row.gameId);
			if (name) gameName = name;
		}
		slotLedger.push({
			id: row.id,
			type: row.type,
			amount: row.amount,
			createdAt: row.createdAt,
			roundId: row.roundId,
			gameLabel: gameName,
		});
	}
	pushCollapsedCasinoItems(allItems, collapseCasinoLedgerRows(slotLedger));

	// ===== 5. FETCH SCORPIO TRANSACTIONS =====
	const scorpioFilters: any[] = [
		eq(schema.scorpioTransactions.userId, user.id),
	];
	if (search) {
		scorpioFilters.push(like(schema.scorpioTransactions.id, `%${search}%`));
	}

	const scorpioRows = await db
		.select({
			id: schema.scorpioTransactions.id,
			type: schema.scorpioTransactions.type,
			amount: schema.scorpioTransactions.amount,
			createdAt: schema.scorpioTransactions.createdAt,
			gameCode: schema.scorpioTransactions.gameCode,
			roundId: schema.scorpioTransactions.roundId,
		})
		.from(schema.scorpioTransactions)
		.where(and(...scorpioFilters))
		.orderBy(desc(schema.scorpioTransactions.createdAt))
		.limit(MAX_PER_SOURCE);

	const scorpioLedger: CasinoLedgerRow[] = [];
	for (const row of scorpioRows) {
		let gameName = "Scorpio";
		if (row.gameCode) {
			const name = await getGameName(row.gameCode);
			if (name) gameName = name;
		}
		scorpioLedger.push({
			id: row.id,
			type: row.type,
			amount: row.amount,
			createdAt: row.createdAt,
			roundId: row.roundId,
			gameLabel: gameName,
		});
	}
	pushCollapsedCasinoItems(allItems, collapseCasinoLedgerRows(scorpioLedger));

	// ===== 6. SORT AND PAGINATE =====
	allItems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

	const settledItems = allItems.filter((item) => item.status !== "pending");
	const unsettledItems = allItems.filter((item) => item.status === "pending");
	const filteredItems =
		filter === "settled"
			? settledItems
			: filter === "unsettled"
				? unsettledItems
				: allItems;

	const total = filteredItems.length;
	const totalPages = Math.max(1, Math.ceil(total / limit));
	const paginated = filteredItems.slice(offset, offset + limit);


	return c.json(
		{
			success: true as const,
			data: {
				items: paginated,
				page,
				totalPages,
				counts: {
					all: allItems.length,
					settled: settledItems.length,
					unsettled: unsettledItems.length,
				},
			},
		},
		200,
	);
});

// ─── Ticket Detail ───

const TicketSelectionSchema = z.object({
	matchId: z.string().nullable(),
	match: z.string(),
	market: z.string().nullable(),
	result: z.string().nullable(),
	pick: z.string().nullable(),
	odds: z.string().nullable(),
	status: z.enum(["won", "lost", "pending"]),
	startTime: z.string().nullable(),
});

const TicketDetailSchema = z.object({
	ticketId: z.string(),
	dateTime: z.string(),
	betType: z.string(),
	outcome: z.enum(["won", "lost", "pending"]),
	stake: z.number(),
	totalOdds: z.number(),
	totalReturn: z.number().nullable(),
	potentialCashout: z.number().nullable(),
	numberOfBets: z.number(),
	selections: z.array(TicketSelectionSchema),
	isCasino: z.boolean().optional(),
	gameName: z.string().optional(),
	provider: z.string().optional(),
	roundId: z.string().optional(),
	multiplier: z.number().optional(),
	casinoSelections: z.array(z.any()).optional(),
});

const TicketDetailResponseSchema = z
	.object({
		success: z.literal(true),
		data: TicketDetailSchema,
	})
	.openapi("TicketDetailResponse");

const getTicketDetailRoute = createRoute({
	method: "get",
	path: "/{id}",
	tags: ["Bet History"],
	summary: "Get a single ticket's details for the current user",
	security: [{ BearerAuth: [] }],
	request: {
		params: z.object({ id: z.string() }),
	},
	responses: {
		200: {
			description: "Ticket detail retrieved",
			content: { "application/json": { schema: TicketDetailResponseSchema } },
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorSchema } },
		},
		404: {
			description: "Ticket not found",
			content: { "application/json": { schema: ErrorSchema } },
		},
	},
});

function deriveSelectionStatus(
	oddStatus: number | null,
): "won" | "lost" | "pending" {
	if (oddStatus === 1) return "won";
	if (oddStatus === 3) return "lost";
	return "pending";
}

type CasinoDetailTx = {
	id: string;
	type: string;
	amount: number;
	balanceBefore: number | null;
	game?: string | null;
	createdAt: Date;
	provider?: string;
	roundId?: string | null;
};

function processCasinoTransaction(
	tx: CasinoDetailTx,
	gameName: string,
	provider: string,
	roundTxs: CasinoDetailTx[] = [],
) {
	const txs = roundTxs.length > 0 ? roundTxs : [tx];
	const bets = txs.filter((row) => isCasinoBetType(row.type));
	const wins = txs.filter((row) => isCasinoWinType(row.type));
	const betAmount = bets.reduce((sum, row) => sum + row.amount, 0);
	const winAmount = wins.reduce((sum, row) => sum + row.amount, 0);
	const outcome: "won" | "lost" | "pending" =
		winAmount > 0 ? "won" : "lost";
	const stakeKobo = betAmount > 0 ? betAmount : tx.amount;
	const stakeNaira = stakeKobo / 100;
	const payoutNaira = winAmount / 100;
	const won = outcome === "won";

	return {
		success: true as const,
		data: {
			ticketId: tx.id,
			dateTime: toWAT(tx.createdAt),
			betType: "Casino",
			outcome,
			stake: stakeNaira,
			totalOdds: 0,
			totalReturn: won ? payoutNaira : null,
			potentialCashout: null,
			numberOfBets: 1,
			selections: [],
			isCasino: true,
			gameName: gameName,
			provider: provider,
			roundId: tx.roundId || undefined,
			multiplier: won && stakeKobo > 0 ? winAmount / stakeKobo : 0,
			casinoSelections: [
				{
					id: tx.id,
					type: tx.type,
					amount: stakeNaira,
					status: outcome,
					gameName: gameName,
					provider: provider,
					roundId: tx.roundId || undefined,
				},
			],
		},
	};
}

betHistoryRoute.openapi(getTicketDetailRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ success: false as const, error: "Unauthorized" }, 401);
	}

	const { id } = c.req.valid("param");
	const db = drizzle(c.env.DB, { schema });

	// find in sportsbook bets
	const bet = await db
		.select({
			id: schema.sportsbookBet.id,
			stake: schema.sportsbookBet.stake,
			totalOdds: schema.sportsbookBet.totalOdds,
			status: schema.sportsbookBet.status,
			settleAmount: schema.sportsbookBet.settleAmount,
			settleType: schema.sportsbookBet.settleType,
			betType: schema.sportsbookBet.betType,
			betData: schema.sportsbookBet.betData,
			createdAt: schema.sportsbookBet.createdAt,
			updatedAt: schema.sportsbookBet.updatedAt,
		})
		.from(schema.sportsbookBet)
		.where(
			and(
				eq(schema.sportsbookBet.id, id),
				eq(schema.sportsbookBet.userId, user.id),
			),
		)
		.get();

	if (bet) {
		const derived = deriveStatus(bet.status, bet.settleType);
		const outcome: "won" | "lost" | "pending" =
			derived === "success" ? "won" : derived === "failed" ? "lost" : "pending";

		const stakeNaira = bet.stake / 100;
		const oddsValue = bet.totalOdds ? Number.parseFloat(bet.totalOdds) : 0;

		let rawSelections: Array<Record<string, any>> = [];
		try {
			const parsed = bet.betData ? JSON.parse(bet.betData) : null;
			rawSelections = collectTicketOdds(parsed);
		} catch {
			rawSelections = [];
		}

		const matchIds = rawSelections
			.map((s) => s.match_id)
			.filter(Boolean) as string[];
		const titleById = await getFixtureTitlesByIds(c.env, matchIds);
		const typeIds = rawSelections
			.map((s) =>
				s.market_id ? parseMarketId(String(s.market_id)).typeId : "",
			)
			.filter(Boolean);
		const marketDefs = await loadMarketDefinitions(c.env, typeIds);

		const selections = rawSelections.map((s) => {
			const matchTitle =
				(s.match_id ? titleById.get(s.match_id) : undefined) ?? null;
			const typeId = s.market_id
				? parseMarketId(String(s.market_id)).typeId
				: "";
			const labels = formatTicketSelection({
				odd: s,
				matchTitle,
				marketDef: typeId ? (marketDefs.get(typeId) ?? null) : null,
			});
			return {
				matchId: s.match_id ?? null,
				match: matchDisplayName(matchTitle, s.match_id),
				market: labels.market,
				result: null,
				pick: labels.pick,
				odds: labels.odds,
				status: deriveSelectionStatus(s.odd_status ?? null),
				startTime: s.meta?.sport_event_info_start_time ?? null,
			};
		});

		return c.json(
			{
				success: true as const,
				data: {
					ticketId: bet.id,
					dateTime: toWAT(bet.createdAt),
					betType: bet.betType
						? (BET_TYPE_LABELS[bet.betType] ?? "Unknown")
						: "Unknown",
					outcome,
					stake: stakeNaira,
					totalOdds: oddsValue,
					totalReturn: outcome === "won" ? (bet.settleAmount ?? 0) / 100 : null,
					potentialCashout: null,
					numberOfBets: selections.length,
					selections,
					isCasino: false,
				},
			},
			200,
		);
	}

	// Try Thundr transactions
	const thundrBet = await db
		.select({
			id: schema.thundrTransactions.id,
			type: schema.thundrTransactions.type,
			amount: schema.thundrTransactions.amount,
			balanceBefore: schema.thundrTransactions.balanceBefore,
			roundId: schema.thundrTransactions.roundId,
			gameId: schema.thundrTransactions.gameId,
			createdAt: schema.thundrTransactions.createdAt,
		})
		.from(schema.thundrTransactions)
		.where(
			and(
				eq(schema.thundrTransactions.id, id),
				eq(schema.thundrTransactions.userId, user.id),
			),
		)
		.get();

	if (thundrBet) {
		let gameName = thundrBet.gameId || "Thundr";
		if (thundrBet.gameId) {
			const [game] = await db
				.select({ name: schema.game.name })
				.from(schema.game)
				.where(eq(schema.game.code, thundrBet.gameId))
				.limit(1);
			if (game?.name) gameName = game.name;
		}
		const roundTxs = thundrBet.roundId
			? await db
					.select({
						id: schema.thundrTransactions.id,
						type: schema.thundrTransactions.type,
						amount: schema.thundrTransactions.amount,
						balanceBefore: schema.thundrTransactions.balanceBefore,
						roundId: schema.thundrTransactions.roundId,
						createdAt: schema.thundrTransactions.createdAt,
					})
					.from(schema.thundrTransactions)
					.where(
						and(
							eq(schema.thundrTransactions.userId, user.id),
							eq(schema.thundrTransactions.roundId, thundrBet.roundId),
						),
					)
			: [];
		return c.json(
			processCasinoTransaction(thundrBet, gameName, "Thundr", roundTxs),
			200,
		);
	}

	// Try gameTransactions
	const casinoBet = await db
		.select({
			id: schema.gameTransactions.id,
			type: schema.gameTransactions.type,
			amount: schema.gameTransactions.amount,
			balanceBefore: schema.gameTransactions.balanceBefore,
			game: schema.gameTransactions.game,
			createdAt: schema.gameTransactions.createdAt,
		})
		.from(schema.gameTransactions)
		.where(
			and(
				eq(schema.gameTransactions.id, id),
				eq(schema.gameTransactions.userId, user.id),
			),
		)
		.get();

	if (casinoBet) {
		let gameName = "Casino";
		if (casinoBet.game) {
			const [game] = await db
				.select({ name: schema.game.name })
				.from(schema.game)
				.where(eq(schema.game.code, casinoBet.game))
				.limit(1);
			if (game?.name) gameName = game.name;
		}
		return c.json(processCasinoTransaction(casinoBet, gameName, "ICRASH"), 200);
	}

	// Try Slotegrator
	const slotBet = await db
		.select({
			id: schema.slotitegrationTransactions.id,
			type: schema.slotitegrationTransactions.type,
			amount: schema.slotitegrationTransactions.amount,
			balanceBefore: schema.slotitegrationTransactions.balanceBefore,
			gameId: schema.slotitegrationTransactions.gameId,
			roundId: schema.slotitegrationTransactions.roundId,
			createdAt: schema.slotitegrationTransactions.createdAt,
		})
		.from(schema.slotitegrationTransactions)
		.where(
			and(
				eq(schema.slotitegrationTransactions.id, id),
				eq(schema.slotitegrationTransactions.userId, user.id),
			),
		)
		.get();

	if (slotBet) {
		let gameName = "Slotegrator";
		if (slotBet.gameId) {
			const [game] = await db
				.select({ name: schema.game.name })
				.from(schema.game)
				.where(eq(schema.game.code, slotBet.gameId))
				.limit(1);
			if (game?.name) gameName = game.name;
		}
		const roundTxs = slotBet.roundId
			? await db
					.select({
						id: schema.slotitegrationTransactions.id,
						type: schema.slotitegrationTransactions.type,
						amount: schema.slotitegrationTransactions.amount,
						balanceBefore: schema.slotitegrationTransactions.balanceBefore,
						roundId: schema.slotitegrationTransactions.roundId,
						createdAt: schema.slotitegrationTransactions.createdAt,
					})
					.from(schema.slotitegrationTransactions)
					.where(
						and(
							eq(schema.slotitegrationTransactions.userId, user.id),
							eq(schema.slotitegrationTransactions.roundId, slotBet.roundId),
						),
					)
			: [];
		return c.json(
			processCasinoTransaction(slotBet, gameName, "Slotegrator", roundTxs),
			200,
		);
	}

	// Try Scorpio
	const scorpioBet = await db
		.select({
			id: schema.scorpioTransactions.id,
			type: schema.scorpioTransactions.type,
			amount: schema.scorpioTransactions.amount,
			balanceBefore: schema.scorpioTransactions.balanceBefore,
			gameCode: schema.scorpioTransactions.gameCode,
			roundId: schema.scorpioTransactions.roundId,
			createdAt: schema.scorpioTransactions.createdAt,
		})
		.from(schema.scorpioTransactions)
		.where(
			and(
				eq(schema.scorpioTransactions.id, id),
				eq(schema.scorpioTransactions.userId, user.id),
			),
		)
		.get();

	if (scorpioBet) {
		let gameName = "Scorpio";
		if (scorpioBet.gameCode) {
			const [game] = await db
				.select({ name: schema.game.name })
				.from(schema.game)
				.where(eq(schema.game.code, scorpioBet.gameCode))
				.limit(1);
			if (game?.name) gameName = game.name;
		}
		const roundTxs = scorpioBet.roundId
			? await db
					.select({
						id: schema.scorpioTransactions.id,
						type: schema.scorpioTransactions.type,
						amount: schema.scorpioTransactions.amount,
						balanceBefore: schema.scorpioTransactions.balanceBefore,
						roundId: schema.scorpioTransactions.roundId,
						createdAt: schema.scorpioTransactions.createdAt,
					})
					.from(schema.scorpioTransactions)
					.where(
						and(
							eq(schema.scorpioTransactions.userId, user.id),
							eq(schema.scorpioTransactions.roundId, scorpioBet.roundId),
						),
					)
			: [];
		return c.json(
			processCasinoTransaction(scorpioBet, gameName, "Scorpio", roundTxs),
			200,
		);
	}

	return c.json({ success: false as const, error: "Ticket not found" }, 404);
});

export default betHistoryRoute;
