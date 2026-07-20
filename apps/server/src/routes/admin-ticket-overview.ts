import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import * as schema from "@/db/schema";
import { requirePermission } from "@/middleware/admin-permissions";
import { ErrorResponseSchema, successResponseSchema } from "@/schemas";
import { parseQueryDateRange } from "@/utils";
import type { CloudflareBindings } from "../types";

const adminTicketOverviewRoute = new OpenAPIHono<{
	Bindings: CloudflareBindings;
}>();

function formatAmount(amount: number): string {
	return `₦${(amount / 100).toLocaleString("en-NG")}`;
}

const TicketOverviewParamsSchema = z.object({
	userId: z.string().openapi({ description: "User ID", example: "usr_xyz789" }),
});

const TicketOverviewQuerySchema = z.object({
	fromDate: z.string().optional().openapi({ description: "Filter start date (YYYY-MM-DD)" }),
	toDate: z.string().optional().openapi({ description: "Filter end date (YYYY-MM-DD)" }),
});

const TicketOverviewDataSchema = z.object({
	currentBet: z.string().openapi({ example: "₦50,000" }),
	totalGamesWon: z.string().openapi({ example: "₦120,000" }),
	totalGamesLost: z.string().openapi({ example: "₦80,000" }),
	grossGamingRevenue: z.string().openapi({ example: "₦30,000" }),
}).openapi("TicketOverviewData");

const getTicketOverviewRoute = createRoute({
	method: "get",
	path: "/ticket-overview/user/{userId}",
	tags: ["Admin - Ticket Overview"],
	summary: "Get ticket overview for a user",
	description:
		"Retrieve a summary of a user's betting activity: current active bet amount, total games won, total games lost, and gross gaming revenue.",
	security: [{ BearerAuth: [] }],
	request: {
		params: TicketOverviewParamsSchema,
		query: TicketOverviewQuerySchema,
	},
	responses: {
		200: {
			description: "Ticket overview retrieved successfully",
			content: {
				"application/json": {
					schema: successResponseSchema(TicketOverviewDataSchema),
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

adminTicketOverviewRoute.openapi(getTicketOverviewRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json(
			{ success: false, error: "Unauthorized", details: null },
			401,
		);
	}

	const session = await validateAdminSession(c.env, token);
	if (
		!session ||
		(session.role !== "admin" && session.role !== "super_admin")
	) {
		return c.json(
			{ success: false, error: "Forbidden - admin only", details: null },
			403,
		);
	}

	if (
		session.role !== "super_admin" &&
		!requirePermission(session, "view_ticket_history")
	) {
		return c.json(
			{
				success: false,
				error: "Forbidden - view_ticket_history permission required",
				details: null,
			},
			403,
		);
	}

	const userId = c.req.param("userId");
	if (!userId) {
		return c.json(
			{ success: false, error: "userId is required", details: null },
			400,
		);
	}

	const query = c.req.valid("query");
	const { fromDate, toDate } = parseQueryDateRange({
		fromDate: query.fromDate,
		toDate: query.toDate,
	});

	const db = drizzle(c.env.DB, { schema });

	const sbDateConditions: any[] = [];
	if (fromDate) sbDateConditions.push(gte(schema.sportsbookBet.createdAt, fromDate));
	if (toDate) sbDateConditions.push(lte(schema.sportsbookBet.createdAt, toDate));

	// Current bet amount: sum of stakes for active (unsettled) sportsbook bets
	const currentBetConditions = [
		eq(schema.sportsbookBet.userId, userId),
		sql`${schema.sportsbookBet.settleType} IS NULL`,
		sql`${schema.sportsbookBet.status} IN ('created', 'accepted')`,
		...sbDateConditions,
	];

	const [currentBetResult] = await db
		.select({
			total: sql<number>`COALESCE(SUM(${schema.sportsbookBet.stake}), 0)`,
		})
		.from(schema.sportsbookBet)
		.where(and(...currentBetConditions));

	const currentBet = Number(currentBetResult?.total ?? 0);

	// Sportsbook won: sum of settle_amount where settle_type = 1
	const sbWonConditions = [
		eq(schema.sportsbookBet.userId, userId),
		eq(schema.sportsbookBet.settleType, 1),
		...sbDateConditions,
	];

	const [sbWonResult] = await db
		.select({
			total: sql<number>`COALESCE(SUM(${schema.sportsbookBet.settleAmount}), 0)`,
		})
		.from(schema.sportsbookBet)
		.where(and(...sbWonConditions));

	const sportsbookWon = Number(sbWonResult?.total ?? 0);

	// Sportsbook lost: sum of stake where settle_type = 3
	const sbLostConditions = [
		eq(schema.sportsbookBet.userId, userId),
		eq(schema.sportsbookBet.settleType, 3),
		...sbDateConditions,
	];

	const [sbLostResult] = await db
		.select({
			total: sql<number>`COALESCE(SUM(${schema.sportsbookBet.stake}), 0)`,
		})
		.from(schema.sportsbookBet)
		.where(and(...sbLostConditions));

	const sportsbookLost = Number(sbLostResult?.total ?? 0);

	// Sportsbook total wagered (all bets in period)
	const sbWageredConditions = [
		eq(schema.sportsbookBet.userId, userId),
		...sbDateConditions,
	];

	const [sbWageredResult] = await db
		.select({
			total: sql<number>`COALESCE(SUM(${schema.sportsbookBet.stake}), 0)`,
		})
		.from(schema.sportsbookBet)
		.where(and(...sbWageredConditions));

	const sportsbookWagered = Number(sbWageredResult?.total ?? 0);

	// Casino sources: bet types and win types differ per provider
	const casinoSources = [
		{
			table: schema.gameTransactions,
			userIdCol: schema.gameTransactions.userId,
			typeCol: schema.gameTransactions.type,
			amountCol: schema.gameTransactions.amount,
			createdAtCol: schema.gameTransactions.createdAt,
			betTypes: ["BET"],
			winTypes: ["WIN"],
		},
		{
			table: schema.thundrTransactions,
			userIdCol: schema.thundrTransactions.userId,
			typeCol: schema.thundrTransactions.type,
			amountCol: schema.thundrTransactions.amount,
			createdAtCol: schema.thundrTransactions.createdAt,
			betTypes: ["BET"],
			winTypes: ["WIN"],
		},
		{
			table: schema.slotitegrationTransactions,
			userIdCol: schema.slotitegrationTransactions.userId,
			typeCol: schema.slotitegrationTransactions.type,
			amountCol: schema.slotitegrationTransactions.amount,
			createdAtCol: schema.slotitegrationTransactions.createdAt,
			betTypes: ["bet"],
			winTypes: ["win"],
		},
		{
			table: schema.pocketsTransactions,
			userIdCol: schema.pocketsTransactions.userId,
			typeCol: schema.pocketsTransactions.type,
			amountCol: schema.pocketsTransactions.amount,
			createdAtCol: schema.pocketsTransactions.createdAt,
			betTypes: ["DEBIT"],
			winTypes: ["CREDIT"],
		},
	];

	let casinoWagered = 0;
	let casinoWon = 0;

	for (const source of casinoSources) {
		const betConditions = [
			eq(source.userIdCol, userId),
			sql`${source.typeCol} IN ${source.betTypes}`,
		];
		if (fromDate) betConditions.push(gte(source.createdAtCol, fromDate));
		if (toDate) betConditions.push(lte(source.createdAtCol, toDate));

		const [betResult] = await db
			.select({
				total: sql<number>`COALESCE(SUM(${source.amountCol}), 0)`,
			})
			.from(source.table)
			.where(and(...betConditions));

		casinoWagered += Number(betResult?.total ?? 0);

		const winConditions = [
			eq(source.userIdCol, userId),
			sql`${source.typeCol} IN ${source.winTypes}`,
		];
		if (fromDate) winConditions.push(gte(source.createdAtCol, fromDate));
		if (toDate) winConditions.push(lte(source.createdAtCol, toDate));

		const [winResult] = await db
			.select({
				total: sql<number>`COALESCE(SUM(${source.amountCol}), 0)`,
			})
			.from(source.table)
			.where(and(...winConditions));

		casinoWon += Number(winResult?.total ?? 0);
	}

	const totalGamesWon = sportsbookWon + casinoWon;
	const totalGamesLost = sportsbookLost;
	const totalWagered = sportsbookWagered + casinoWagered;
	const grossGamingRevenue = totalWagered - totalGamesWon;

	return c.json({
		success: true,
		data: {
			currentBet: formatAmount(currentBet),
			totalGamesWon: formatAmount(totalGamesWon),
			totalGamesLost: formatAmount(totalGamesLost),
			grossGamingRevenue: formatAmount(grossGamingRevenue),
		},
	});
});

export default adminTicketOverviewRoute;
