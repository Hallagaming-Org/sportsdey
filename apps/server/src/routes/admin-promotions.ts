import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { Context } from "hono";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import * as schema from "@/db/schema";
import { requirePermission } from "@/middleware/admin-permissions";
import { successResponseSchema, ErrorResponseSchema } from "@/schemas";
import { parseQueryDateRange } from "@/utils";
import type { CloudflareBindings } from "../types";

type AdminRouteContext = { Bindings: CloudflareBindings };

const adminPromotionsRoute = new OpenAPIHono<AdminRouteContext>();

const PROMOTION_TYPE_LABELS: Record<string, string> = {
	bet_boost: "Bet Boost",
	free_bet: "Free Bet",
	deposit_match: "Deposit Match",
};

function mapPromotionType(type: string): string {
	return PROMOTION_TYPE_LABELS[type] ?? type;
}

function mapPromotionTypeFilter(value?: string): string | undefined {
	if (!value) return undefined;
	if (value === "freebets") return "free_bet";
	if (value === "bet_boost") return "bet_boost";
	return "deposit_match";
}

function deriveStatus(endDateTime: Date): "active" | "expired" {
	return endDateTime.getTime() > Date.now() ? "active" : "expired";
}

const PromotionsDateQuerySchema = z.object({
	fromDate: z
		.string()
		.optional()
		.openapi({ description: "Filter start date (YYYY-MM-DD)" }),
	toDate: z
		.string()
		.optional()
		.openapi({ description: "Filter end date (YYYY-MM-DD)" }),
});

const ListPromotionsQuerySchema = z.object({
	status: z
		.enum(["active", "expired"])
		.optional()
		.openapi({ description: "Filter by derived status (active = end date not passed)" }),
	promotionType: z
		.enum(["freebets", "bet_boost", "deposit_match"])
		.optional()
		.openapi({ description: "Filter by promotion type" }),
	fromDate: z
		.string()
		.optional()
		.openapi({ description: "Filter start date (YYYY-MM-DD)" }),
	toDate: z
		.string()
		.optional()
		.openapi({ description: "Filter end date (YYYY-MM-DD)" }),
	page: z.coerce
		.number()
		.int()
		.min(1)
		.default(1)
		.openapi({ description: "Page number" }),
	limit: z.coerce
		.number()
		.int()
		.min(1)
		.max(100)
		.default(20)
		.openapi({ description: "Items per page" }),
});

const PromotionItemSchema = z.object({
	id: z.string().openapi({ description: "Promotion ID" }),
	name: z.string().openapi({ description: "Promotion name" }),
	type: z.string().openapi({ description: "Promotion type (display label)" }),
	eligibleUsers: z
		.string()
		.openapi({ description: "Eligible user group" }),
	endDate: z.string().openapi({ description: "Promotion end date (ISO)" }),
	status: z
		.enum(["active", "expired"])
		.openapi({ description: "Derived promotion status" }),
	dataBetBoostId: z
		.string()
		.nullable()
		.openapi({ description: "Data.Bet bet boost ID for bet_boost promotions" }),
});

const listPromotionsRoute = createRoute({
	method: "get",
	path: "/sportsbook-promotions",
	tags: ["Admin - Sportsbook Promotions"],
	summary: "List sportsbook promotions",
	description:
		"Retrieve all sportsbook promotions with optional filters for status, promotion type, and time period.",
	security: [{ BearerAuth: [] }],
	request: {
		query: ListPromotionsQuerySchema,
	},
	responses: {
		200: {
			description: "Promotions retrieved successfully",
			content: {
				"application/json": {
					schema: successResponseSchema(
						z.object({
							promotions: z.array(PromotionItemSchema),
							pagination: z.object({
								page: z.number(),
								limit: z.number(),
								total: z.number(),
								totalPages: z.number(),
							}),
						}),
					),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		403: {
			description: "Forbidden",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

const OverviewResponseSchema = z.object({
	activePromotions: z
		.number()
		.openapi({ description: "Number of active promotions" }),
	expiredPromotions: z
		.number()
		.openapi({ description: "Number of expired promotions" }),
	revenue: z
		.object({
			totalSettledBet: z
				.number()
				.openapi({ description: "Total settled stake on boosted bets (NGN)" }),
			totalWinningsPaid: z
				.number()
				.openapi({ description: "Total winnings paid out on boosted bets (NGN)" }),
			revenue: z
				.number()
				.openapi({
					description: "Revenue = total settled bet - total winnings paid (NGN)",
				}),
		})
		.openapi({ description: "Revenue metrics for boosted bets" }),
});

const getPromotionsOverviewRoute = createRoute({
	method: "get",
	path: "/sportsbook-promotions/overview",
	tags: ["Admin - Sportsbook Promotions"],
	summary: "Get sportsbook promotions overview",
	description:
		"Retrieve active/expired promotion counts and revenue metrics for promotions (bets placed with a bet boost).",
	security: [{ BearerAuth: [] }],
	request: {
		query: PromotionsDateQuerySchema,
	},
	responses: {
		200: {
			description: "Overview retrieved successfully",
			content: {
				"application/json": {
					schema: successResponseSchema(OverviewResponseSchema),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		403: {
			description: "Forbidden",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

const StatusSplitResponseSchema = z.object({
	active: z
		.object({
			count: z.number(),
			percentage: z.number(),
		})
		.openapi({ description: "Active promotions split" }),
	expired: z
		.object({
			count: z.number(),
			percentage: z.number(),
		})
		.openapi({ description: "Expired promotions split" }),
});

const getPromotionsStatusSplitRoute = createRoute({
	method: "get",
	path: "/sportsbook-promotions/status-split",
	tags: ["Admin - Sportsbook Promotions"],
	summary: "Get promotion status split",
	description:
		"Retrieve the percentage split of promotions by status (active and expired only).",
	security: [{ BearerAuth: [] }],
	request: {
		query: PromotionsDateQuerySchema,
	},
	responses: {
		200: {
			description: "Status split retrieved successfully",
			content: {
				"application/json": {
					schema: successResponseSchema(StatusSplitResponseSchema),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		403: {
			description: "Forbidden",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

async function requireAdminAccess(c: Context<AdminRouteContext>) {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (
		!session ||
		(session.role !== "admin" && session.role !== "super_admin")
	) {
		return c.json({ success: false, error: "Forbidden - admin only" }, 403);
	}

	if (
		session.role !== "super_admin" &&
		!requirePermission(session, "general")
	) {
		return c.json(
			{
				success: false,
				error: "Forbidden - general permission required",
			},
			403,
		);
	}

	return null;
}

adminPromotionsRoute.openapi(listPromotionsRoute, async (c) => {
	const denied = await requireAdminAccess(c);
	if (denied) return denied;

	const query = c.req.valid("query");
	const { status, promotionType, page, limit } = query;
	const { fromDate, toDate } = parseQueryDateRange({
		fromDate: query.fromDate,
		toDate: query.toDate,
	});

	const db = drizzle(c.env.DB, { schema });

	const conditions: Parameters<typeof and>[0][] = [];

	if (status === "active") {
		conditions.push(gte(schema.sportsbookPromotion.endDateTime, new Date()));
	} else if (status === "expired") {
		conditions.push(lte(schema.sportsbookPromotion.endDateTime, new Date()));
	}

	const mappedType = mapPromotionTypeFilter(promotionType);
	if (mappedType) {
		conditions.push(eq(schema.sportsbookPromotion.promotionType, mappedType as any));
	}

	if (fromDate) {
		conditions.push(gte(schema.sportsbookPromotion.createdAt, fromDate));
	}
	if (toDate) {
		conditions.push(lte(schema.sportsbookPromotion.createdAt, toDate));
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	const [countResult] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(schema.sportsbookPromotion)
		.where(whereClause);

	const total = Number(countResult?.count ?? 0);
	const totalPages = Math.ceil(total / limit);
	const offset = (page - 1) * limit;

	const promotions = await db
		.select({
			id: schema.sportsbookPromotion.id,
			promotionType: schema.sportsbookPromotion.promotionType,
			name: schema.sportsbookPromotion.name,
			eligibleUsers: schema.sportsbookPromotion.eligibleUsers,
			endDateTime: schema.sportsbookPromotion.endDateTime,
			dataBetBoostId: schema.sportsbookBetBoost.dataBetBoostId,
		})
		.from(schema.sportsbookPromotion)
		.leftJoin(
			schema.sportsbookBetBoost,
			eq(
				schema.sportsbookBetBoost.promotionId,
				schema.sportsbookPromotion.id,
			),
		)
		.where(whereClause)
		.orderBy(desc(schema.sportsbookPromotion.createdAt))
		.limit(limit)
		.offset(offset);

	const seen = new Set<string>();
	const uniquePromotions: typeof promotions = [];
	for (const promo of promotions) {
		if (seen.has(promo.id)) continue;
		seen.add(promo.id);
		uniquePromotions.push(promo);
	}

	return c.json({
		success: true,
		data: {
			promotions: uniquePromotions.map((promo) => ({
				id: promo.id,
				name: promo.name,
				type: mapPromotionType(promo.promotionType),
				eligibleUsers: promo.eligibleUsers,
				endDate: promo.endDateTime.toISOString(),
				status: deriveStatus(promo.endDateTime),
				dataBetBoostId: promo.dataBetBoostId,
			})),
			pagination: {
				page,
				limit,
				total,
				totalPages,
			},
		},
	});
});

adminPromotionsRoute.openapi(getPromotionsOverviewRoute, async (c) => {
	const denied = await requireAdminAccess(c);
	if (denied) return denied;

	const query = c.req.valid("query");
	const { fromDate, toDate } = parseQueryDateRange({
		fromDate: query.fromDate,
		toDate: query.toDate,
	});

	const db = drizzle(c.env.DB, { schema });
	const now = new Date();

	const activeConditions: Parameters<typeof and>[0][] = [
		gte(schema.sportsbookPromotion.endDateTime, now),
	];
	const expiredConditions: Parameters<typeof and>[0][] = [
		lte(schema.sportsbookPromotion.endDateTime, now),
	];
	if (fromDate) {
		activeConditions.push(gte(schema.sportsbookPromotion.createdAt, fromDate));
		expiredConditions.push(gte(schema.sportsbookPromotion.createdAt, fromDate));
	}
	if (toDate) {
		activeConditions.push(lte(schema.sportsbookPromotion.createdAt, toDate));
		expiredConditions.push(lte(schema.sportsbookPromotion.createdAt, toDate));
	}

	const [activeResult] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(schema.sportsbookPromotion)
		.where(and(...activeConditions));

	const [expiredResult] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(schema.sportsbookPromotion)
		.where(and(...expiredConditions));

	const betConditions: Parameters<typeof and>[0][] = [
		sql`${schema.sportsbookBet.betBoostId} IS NOT NULL`,
		sql`${schema.sportsbookBet.settleType} IS NOT NULL`,
	];
	const winningsConditions: Parameters<typeof and>[0][] = [
		sql`${schema.sportsbookBet.betBoostId} IS NOT NULL`,
		eq(schema.sportsbookBet.settleType, 1),
	];
	if (fromDate) {
		betConditions.push(gte(schema.sportsbookBet.createdAt, fromDate));
		winningsConditions.push(gte(schema.sportsbookBet.createdAt, fromDate));
	}
	if (toDate) {
		betConditions.push(lte(schema.sportsbookBet.createdAt, toDate));
		winningsConditions.push(lte(schema.sportsbookBet.createdAt, toDate));
	}

	const [settledResult] = await db
		.select({
			total: sql<number>`COALESCE(SUM(${schema.sportsbookBet.stake}), 0)`,
		})
		.from(schema.sportsbookBet)
		.where(and(...betConditions));

	const [winningsResult] = await db
		.select({
			total: sql<number>`COALESCE(SUM(${schema.sportsbookBet.settleAmount}), 0)`,
		})
		.from(schema.sportsbookBet)
		.where(and(...winningsConditions));

	const totalSettledBet = Number(settledResult?.total ?? 0);
	const totalWinningsPaid = Number(winningsResult?.total ?? 0);
	const revenue = (totalSettledBet - totalWinningsPaid) / 100;

	return c.json({
		success: true,
		data: {
			activePromotions: Number(activeResult?.count ?? 0),
			expiredPromotions: Number(expiredResult?.count ?? 0),
			revenue: {
				totalSettledBet: totalSettledBet / 100,
				totalWinningsPaid: totalWinningsPaid / 100,
				revenue,
			},
		},
	});
});

adminPromotionsRoute.openapi(getPromotionsStatusSplitRoute, async (c) => {
	const denied = await requireAdminAccess(c);
	if (denied) return denied;

	const query = c.req.valid("query");
	const { fromDate, toDate } = parseQueryDateRange({
		fromDate: query.fromDate,
		toDate: query.toDate,
	});

	const db = drizzle(c.env.DB, { schema });
	const now = new Date();

	const activeConditions: Parameters<typeof and>[0][] = [
		gte(schema.sportsbookPromotion.endDateTime, now),
	];
	const expiredConditions: Parameters<typeof and>[0][] = [
		lte(schema.sportsbookPromotion.endDateTime, now),
	];
	if (fromDate) {
		activeConditions.push(gte(schema.sportsbookPromotion.createdAt, fromDate));
		expiredConditions.push(gte(schema.sportsbookPromotion.createdAt, fromDate));
	}
	if (toDate) {
		activeConditions.push(lte(schema.sportsbookPromotion.createdAt, toDate));
		expiredConditions.push(lte(schema.sportsbookPromotion.createdAt, toDate));
	}

	const [activeResult] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(schema.sportsbookPromotion)
		.where(and(...activeConditions));

	const [expiredResult] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(schema.sportsbookPromotion)
		.where(and(...expiredConditions));

	const activeCount = Number(activeResult?.count ?? 0);
	const expiredCount = Number(expiredResult?.count ?? 0);
	const total = activeCount + expiredCount;

	const percentageOf = (count: number) =>
		total > 0 ? Math.round((count / total) * 1000) / 10 : 0;

	return c.json({
		success: true,
		data: {
			active: {
				count: activeCount,
				percentage: percentageOf(activeCount),
			},
			expired: {
				count: expiredCount,
				percentage: percentageOf(expiredCount),
			},
		},
	});
});

export default adminPromotionsRoute;
