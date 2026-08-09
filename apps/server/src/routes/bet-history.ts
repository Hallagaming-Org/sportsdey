import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq, isNotNull, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { toWAT } from "@/utils";
import type { CloudflareBindings } from "../types";
import { fetchBetDetailsById } from "@/utils/bet-details";
import { getFixtureTitlesByIds } from "@/utils/fixtures";

const betHistoryRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();


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

function parseGameType(betData: string | null): string {
	if (!betData) return "Sportsbook";
	try {
		const parsed = JSON.parse(betData) as { gameType?: string };
		return parsed.gameType || "Sportsbook";
	} catch {
		return "Sportsbook";
	}
}

function deriveStatus(
	status: string,
	settleType: number | null,
): "success" | "pending" | "failed" {
	if (settleType === 1) return "success";
	if (settleType === 3) return "failed";
	if (settleType !== null) return "failed"; // "Declined" in admin's terms
	if (status === "created" || status === "accepted") return "pending";
	return "failed";
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

	const baseFilters = [eq(schema.sportsbookBet.userId, user.id)];

	if (filter === "settled") {
		baseFilters.push(isNotNull(schema.sportsbookBet.settleType));
	}
	if (filter === "unsettled") {
		baseFilters.push(sql`${schema.sportsbookBet.settleType} IS NULL`);
	}
	if (search) {
		baseFilters.push(
			or(
				like(schema.sportsbookBet.id, `%${search}%`),
				like(schema.sportsbookBet.requestId, `%${search}%`),
			) as ReturnType<typeof like>,
		);
	}

	const [countRow] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(schema.sportsbookBet)
		.where(and(...baseFilters));

	const total = Number(countRow?.count ?? 0);
	const totalPages = Math.max(1, Math.ceil(total / limit));

	const rows = await db
		.select({
			id: schema.sportsbookBet.id,
			stake: schema.sportsbookBet.stake,
			totalOdds: schema.sportsbookBet.totalOdds,
			status: schema.sportsbookBet.status,
			settleAmount: schema.sportsbookBet.settleAmount,
			settleType: schema.sportsbookBet.settleType,
			betData: schema.sportsbookBet.betData,
			createdAt: schema.sportsbookBet.createdAt,
			updatedAt: schema.sportsbookBet.updatedAt,
		})
		.from(schema.sportsbookBet)
		.where(and(...baseFilters))
		.orderBy(desc(schema.sportsbookBet.createdAt))
		.limit(limit)
		.offset(offset);

	const items = rows.map((row) => {
		const isSettled = row.settleType !== null;
		const stakeNaira = row.stake / 100;
		const oddsValue = row.totalOdds ? Number.parseFloat(row.totalOdds) : 0;

		return {
			id: row.id,
			ticketId: row.id,
			type: parseGameType(row.betData),
			amount: stakeNaira,
			multiplier: oddsValue,
			status: deriveStatus(row.status, row.settleType),
			placedAt: toWAT(row.createdAt),
			totalOdds: row.totalOdds,
			potentialWin: oddsValue > 0 ? stakeNaira * oddsValue : null,
			actualPayout: isSettled ? (row.settleAmount ?? 0) / 100 : null,
			settledAt: isSettled ? toWAT(row.updatedAt) : null,
		};
	});

	const [allCountRow] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(schema.sportsbookBet)
		.where(eq(schema.sportsbookBet.userId, user.id));

	const [settledCountRow] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(schema.sportsbookBet)
		.where(
			and(
				eq(schema.sportsbookBet.userId, user.id),
				isNotNull(schema.sportsbookBet.settleType),
			),
		);

	const allCount = Number(allCountRow?.count ?? 0);
	const settledCount = Number(settledCountRow?.count ?? 0);

	return c.json(
		{
			success: true as const,
			data: {
				items,
				page,
				totalPages,
				counts: {
					all: allCount,
					settled: settledCount,
					unsettled: allCount - settledCount,
				},
			},
		},
		200,
	);
});

// ─── Ticket Detail

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

	const databetBet = await fetchBetDetailsById(c.env, bet.id);
	console.log("Databet response:", JSON.stringify(databetBet, null, 2));



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