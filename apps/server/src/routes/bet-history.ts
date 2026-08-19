import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq, isNotNull, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { toWAT } from "@/utils";
import type { CloudflareBindings } from "../types";
import { fetchBetDetailsById } from "@/utils/bet-details";
import { getFixtureTitlesByIds } from "@/utils/fixtures";

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

function getGameTypeLabel(betData: string | null, betType: number | null = null): string {
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
			const gameName = parsed.gameName || parsed.game_name || 'Casino';
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
						'football': 'Sport',
						'soccer': 'Sport',
						'basketball': 'Basketball',
						'tennis': 'Tennis',
						'baseball': 'Baseball',
						'americanfootball': 'American Football',
						'icehockey': 'Ice Hockey',
						'rugby': 'Rugby',
						'cricket': 'Cricket',
						'boxing': 'Boxing',
						'mma': 'MMA',
						'esports': 'Esports',
					};
					return `Bets - ${sportMap[firstOdd.sport_id] || 'Sport'}`;
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

function deriveStatusFromCasino(type: string): "success" | "pending" | "failed" {
	switch (type) {
		case "WIN":
		case "win":
		case "won":
		case "WON":
		case "CREDIT":
			return "success";
		case "BET":
		case "bet":
		case "DEBIT":
		case "debit":
			return "pending";
		default:
			return "failed";
	}
}

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
		createdAt: Date;
	}> = [];

	// ===== 1.SPORTSBOOK BETS =====
	const sbFilters: any[] = [eq(schema.sportsbookBet.userId, user.id)];
	if (filter === "settled") {
		sbFilters.push(isNotNull(schema.sportsbookBet.settleType));
	}
	if (filter === "unsettled") {
		sbFilters.push(sql`${schema.sportsbookBet.settleType} IS NULL`);
	}
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
		const isSettled = row.settleType !== null;
		const stakeNaira = row.stake / 100;
		const oddsValue = row.totalOdds ? Number.parseFloat(row.totalOdds) : 0;
		const status = row.settleType === 1 ? "success" : row.settleType === 3 ? "failed" : "pending";

		allItems.push({
			id: row.id,
			ticketId: row.id,
			type: getGameTypeLabel(row.betData, row.betType),
			amount: stakeNaira,
			multiplier: oddsValue,
			status,
			placedAt: toWAT(row.createdAt),
			totalOdds: row.totalOdds,
			potentialWin: oddsValue > 0 ? stakeNaira * oddsValue : null,
			actualPayout: isSettled ? (row.settleAmount ?? 0) / 100 : null,
			settledAt: isSettled ? toWAT(row.updatedAt) : null,
			createdAt: row.createdAt,
		});
	}

	// ===== 2. FETCH CASINO TRANSACTIONS=====
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
		let gameName = "Casino";
		if (row.game) {
			const name = await getGameName(row.game);
			if (name) gameName = name;
		}

		const amountNaira = row.amount / 100;
		const isWin = ["WIN", "win", "WON", "won", "CREDIT"].includes(row.type);
		const status = deriveStatusFromCasino(row.type);

		if (filter === "settled" && !isWin) continue;
		if (filter === "unsettled" && isWin) continue;

		allItems.push({
			id: row.id,
			ticketId: row.id,
			type: `Casino - ${gameName}`,
			amount: amountNaira,
			multiplier: 0,
			status,
			placedAt: toWAT(row.createdAt),
			totalOdds: null,
			potentialWin: isWin ? amountNaira : null,
			actualPayout: isWin ? amountNaira : null,
			settledAt: isWin ? toWAT(row.createdAt) : null,
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
		})
		.from(schema.thundrTransactions)
		.where(and(...thundrFilters))
		.orderBy(desc(schema.thundrTransactions.createdAt))
		.limit(MAX_PER_SOURCE);

	for (const row of thundrRows) {
		const amountNaira = row.amount / 100;
		const isWin = ["WIN", "win", "WON", "won"].includes(row.type);
		const status = deriveStatusFromCasino(row.type);

		if (filter === "settled" && !isWin) continue;
		if (filter === "unsettled" && isWin) continue;

		allItems.push({
			id: row.id,
			ticketId: row.id,
			type: `Casino - ${row.gameId || 'Thundr'}`,
			amount: amountNaira,
			multiplier: 0,
			status,
			placedAt: toWAT(row.createdAt),
			totalOdds: null,
			potentialWin: isWin ? amountNaira : null,
			actualPayout: isWin ? amountNaira : null,
			settledAt: isWin ? toWAT(row.createdAt) : null,
			createdAt: row.createdAt,
		});
	}

	// ===== 4.  SLOTEGRATOR TRANSACTIONS =====
	const slotFilters: any[] = [eq(schema.slotitegrationTransactions.userId, user.id)];
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
		})
		.from(schema.slotitegrationTransactions)
		.where(and(...slotFilters))
		.orderBy(desc(schema.slotitegrationTransactions.createdAt))
		.limit(MAX_PER_SOURCE);

	for (const row of slotRows) {
		let gameName = "Slotegrator";
		if (row.gameId) {
			const name = await getGameName(row.gameId);
			if (name) gameName = name;
		}

		const amountNaira = row.amount / 100;
		const isWin = ["win", "WIN", "WON", "won"].includes(row.type);
		const status = deriveStatusFromCasino(row.type);

		if (filter === "settled" && !isWin) continue;
		if (filter === "unsettled" && isWin) continue;

		allItems.push({
			id: row.id,
			ticketId: row.id,
			type: `Casino - ${gameName}`,
			amount: amountNaira,
			multiplier: 0,
			status,
			placedAt: toWAT(row.createdAt),
			totalOdds: null,
			potentialWin: isWin ? amountNaira : null,
			actualPayout: isWin ? amountNaira : null,
			settledAt: isWin ? toWAT(row.createdAt) : null,
			createdAt: row.createdAt,
		});
	}

	// ===== 5.  SCORPIO TRANSACTIONS =====
	const scorpioFilters: any[] = [eq(schema.scorpioTransactions.userId, user.id)];
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
		})
		.from(schema.scorpioTransactions)
		.where(and(...scorpioFilters))
		.orderBy(desc(schema.scorpioTransactions.createdAt))
		.limit(MAX_PER_SOURCE);

	for (const row of scorpioRows) {
		const amountNaira = row.amount / 100;
		const isWin = ["WIN", "win", "WON", "won"].includes(row.type);
		const status = deriveStatusFromCasino(row.type);

		if (filter === "settled" && !isWin) continue;
		if (filter === "unsettled" && isWin) continue;

		allItems.push({
			id: row.id,
			ticketId: row.id,
			type: `Casino - ${row.gameCode || 'Scorpio'}`,
			amount: amountNaira,
			multiplier: 0,
			status,
			placedAt: toWAT(row.createdAt),
			totalOdds: null,
			potentialWin: isWin ? amountNaira : null,
			actualPayout: isWin ? amountNaira : null,
			settledAt: isWin ? toWAT(row.createdAt) : null,
			createdAt: row.createdAt,
		});
	}

	// ===== 6. SORT AND PAGINATE =====
	allItems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

	const total = allItems.length;
	const totalPages = Math.max(1, Math.ceil(total / limit));
	const paginated = allItems.slice(offset, offset + limit);

	// ===== 7. COUNTS =====
	const settledItems = allItems.filter((item) => item.status === "success");
	const unsettledItems = allItems.filter((item) => item.status === "pending" || item.status === "failed");

	return c.json(
		{
			success: true as const,
			data: {
				items: paginated,
				page,
				totalPages,
				counts: {
					all: total,
					settled: settledItems.length,
					unsettled: unsettledItems.length,
				},
			},
		},
		200,
	);
});

// ─── Ticket Detail ───

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

const TicketSelectionSchema = z.object({
	matchId: z.string().nullable(),
	match: z.string(),
	market: z.string().nullable(),
	result: z.string().nullable(),
	pick: z.string().nullable(),
	status: z.enum(["won", "lost", "pending"]),
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

function deriveSelectionStatus(oddStatus: number | null): "won" | "lost" | "pending" {
	if (oddStatus === 1) return "won";
	if (oddStatus === 3) return "lost";
	return "pending";
}

betHistoryRoute.openapi(getTicketDetailRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ success: false as const, error: "Unauthorized" }, 401);
	}

	const { id } = c.req.valid("param");
	const db = drizzle(c.env.DB, { schema });

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
		})
		.from(schema.sportsbookBet)
		.where(
			and(
				eq(schema.sportsbookBet.id, id),
				eq(schema.sportsbookBet.userId, user.id),
			),
		)
		.get();

	if (!bet) {
		return c.json({ success: false as const, error: "Ticket not found" }, 404);
	}

	const derived = deriveStatus(bet.status, bet.settleType);
	const outcome: "won" | "lost" | "pending" =
		derived === "success" ? "won" : derived === "failed" ? "lost" : "pending";

	const stakeNaira = bet.stake / 100;
	const oddsValue = bet.totalOdds ? Number.parseFloat(bet.totalOdds) : 0;
	const potentialWin = oddsValue > 0 ? stakeNaira * oddsValue : 0;

	let rawSelections: Array<Record<string, any>> = [];
	try {
		const parsed = bet.betData ? JSON.parse(bet.betData) : null;
		if (parsed && Array.isArray(parsed.bet_odds)) {
			rawSelections = parsed.bet_odds;
		}
	} catch {
		rawSelections = [];
	}
	const matchIds = rawSelections.map((s) => s.match_id).filter(Boolean) as string[];
	const titleById = await getFixtureTitlesByIds(c.env, matchIds);

	const selections = rawSelections.map((s) => ({
		matchId: s.match_id ?? null,
		match: (s.match_id ? titleById.get(s.match_id) : undefined) ?? s.match_id ?? "Unknown match",
		market: s.market_id ? `Market ${s.market_id}` : null,
		result: null,
		pick: s.odd_ratio ? `@${s.odd_ratio}` : null,
		status: deriveSelectionStatus(s.odd_status ?? null),
	}));

	return c.json(
		{
			success: true as const,
			data: {
				ticketId: bet.id,
				dateTime: toWAT(bet.createdAt),
				betType: bet.betType ? (BET_TYPE_LABELS[bet.betType] ?? "Unknown") : "Unknown",
				outcome,
				stake: stakeNaira,
				totalOdds: oddsValue,
				totalReturn: outcome === "won" ? (bet.settleAmount ?? 0) / 100 : null,
				potentialCashout: outcome === "pending" ? potentialWin : null,
				numberOfBets: selections.length,
				selections,
			},
		},
		200,
	);
});

export default betHistoryRoute;