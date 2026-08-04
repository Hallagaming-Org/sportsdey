import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq, isNotNull, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { toWAT } from "@/utils";
import type { CloudflareBindings } from "../types";

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

export default betHistoryRoute;