import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
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
	settleAmount: number | null,
): "success" | "pending" | "failed" {
	if (status !== "settled") return "pending";

	return (settleAmount ?? 0) > 0 ? "success" : "failed";
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
		baseFilters.push(eq(schema.sportsbookBet.status, "settled"));
	}
	if (filter === "unsettled") {
		baseFilters.push(
			sql`${schema.sportsbookBet.status} != 'settled'`,
		);
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
			betData: schema.sportsbookBet.betData,
			createdAt: schema.sportsbookBet.createdAt,
		})
		.from(schema.sportsbookBet)
		.where(and(...baseFilters))
		.orderBy(desc(schema.sportsbookBet.createdAt))
		.limit(limit)
		.offset(offset);

	const items = rows.map((row) => ({
		id: row.id,
		ticketId: row.id,
		type: parseGameType(row.betData),
		amount: row.stake / 100,
		multiplier: row.totalOdds ? Number.parseFloat(row.totalOdds) : 0,
		status: deriveStatus(row.status, row.settleAmount),
		placedAt: toWAT(row.createdAt),
	}));


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
				eq(schema.sportsbookBet.status, "settled"),
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