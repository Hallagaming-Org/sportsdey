import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
	and,
	desc,
	eq,
	gte,
	inArray,
	isNotNull,
	lte,
	notInArray,
	sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import * as schema from "@/db/schema";
import { requirePermission } from "@/middleware/admin-permissions";
import { ErrorResponseSchema, successResponseSchema } from "@/schemas";
import { parseQueryDateRange } from "@/utils";
import type { CloudflareBindings } from "../types";

type AdminRouteContext = { Bindings: CloudflareBindings };

const adminOverviewRoute = new OpenAPIHono<AdminRouteContext>();

const OverviewDateQuerySchema = z.object({
	fromDate: z
		.string()
		.optional()
		.openapi({ description: "Filter start date (YYYY-MM-DD)" }),
	toDate: z
		.string()
		.optional()
		.openapi({ description: "Filter end date (YYYY-MM-DD)" }),
});

const OverviewStatsSchema = z.object({
	totalUsers: z.number(),
	activePlayers: z.number(),
	pendingPayouts: z.number(),
	totalIncome: z.number(),
});

const getOverviewStatsRoute = createRoute({
	method: "get",
	path: "/overview/stats",
	tags: ["Admin - Overview"],
	summary: "Get overview statistics",
	description:
		"Retrieve dashboard overview stats: total users, active players, pending payouts, total income.",
	security: [{ BearerAuth: [] }],
	request: {
		query: OverviewDateQuerySchema,
	},
	responses: {
		200: {
			description: "Overview stats retrieved successfully",
			content: {
				"application/json": {
					schema: successResponseSchema(OverviewStatsSchema),
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

const DayActivitySchema = z.object({
	date: z.string(),
	revenue: z.number(),
	bets: z.number(),
	winnings: z.number(),
	totalDeposits: z.number(),
	totalWithdrawals: z.number(),
});

const ActivityResponseSchema = z.object({
	days: z.array(DayActivitySchema),
});

const TicketTrendSchema = z
	.object({
		totalTickets: z.number(),
		wonTickets: z.number(),
		lostTickets: z.number(),
	})
	.openapi("TicketTrend");

const getTicketTrendRoute = createRoute({
	method: "get",
	path: "/overview/ticket-trend",
	tags: ["Admin - Overview"],
	summary: "Get ticket trend counts",
	description:
		"Retrieve total ticket count, won ticket count, and loss count. Losses are limited to explicit Slotegrator and Thndr loss outcomes.",
	security: [{ BearerAuth: [] }],
	request: {
		query: OverviewDateQuerySchema,
	},
	responses: {
		200: {
			description: "Ticket trend counts retrieved successfully",
			content: {
				"application/json": {
					schema: successResponseSchema(TicketTrendSchema),
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

const getActivityRoute = createRoute({
	method: "get",
	path: "/overview/activity",
	tags: ["Admin - Overview"],
	summary: "Get activity trends",
	description:
		"Retrieve activity data for revenue (GGR), settled bets, winnings, deposits, and withdrawals. Defaults to last 7 days.",
	security: [{ BearerAuth: [] }],
	request: {
		query: OverviewDateQuerySchema,
	},
	responses: {
		200: {
			description: "Activity data retrieved successfully",
			content: {
				"application/json": {
					schema: successResponseSchema(ActivityResponseSchema),
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

const TopBetSchema = z.object({
	id: z.string(),
	playerName: z.string(),
	betType: z.string(),
	amount: z.number(),
});

const TopBetsResponseSchema = z.object({
	bets: z.array(TopBetSchema),
});

const getTopBetsRoute = createRoute({
	method: "get",
	path: "/overview/top-bets",
	tags: ["Admin - Overview"],
	summary: "Get top 5 biggest bets",
	description:
		"Retrieve the five biggest bets across sportsbook and casino providers for the selected date range.",
	security: [{ BearerAuth: [] }],
	request: {
		query: OverviewDateQuerySchema,
	},
	responses: {
		200: {
			description: "Top bets retrieved successfully",
			content: {
				"application/json": {
					schema: successResponseSchema(TopBetsResponseSchema),
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

adminOverviewRoute.openapi(getOverviewStatsRoute, async (c) => {
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

	const query = c.req.valid("query");
	const { fromDate, toDate } = parseQueryDateRange({
		fromDate: query.fromDate,
		toDate: query.toDate,
	});

	const db = drizzle(c.env.DB, { schema });

	const userConditions = [];
	if (fromDate) userConditions.push(gte(schema.user.createdAt, fromDate));
	if (toDate) userConditions.push(lte(schema.user.createdAt, toDate));

	const [userCountResult] =
		userConditions.length > 0
			? await db
					.select({ count: sql<number>`COUNT(*)` })
					.from(schema.user)
					.where(and(...userConditions))
			: await db.select({ count: sql<number>`COUNT(*)` }).from(schema.user);

	const totalUsers = Number(userCountResult?.count ?? 0);

	const activeConditions = [];
	if (fromDate)
		activeConditions.push(gte(schema.sportsbookBet.createdAt, fromDate));
	if (toDate)
		activeConditions.push(lte(schema.sportsbookBet.createdAt, toDate));

	const [activePlayersResult] = await db
		.select({
			count: sql<number>`COUNT(DISTINCT ${schema.sportsbookBet.userId})`,
		})
		.from(schema.sportsbookBet)
		.where(activeConditions.length > 0 ? and(...activeConditions) : undefined);

	const activePlayers = Number(activePlayersResult?.count ?? 0);

	const pendingConditions = [
		eq(schema.walletTransaction.type, "debit"),
		eq(schema.walletTransaction.status, "pending"),
		eq(schema.walletTransaction.paymentMethod, "paystack"),
	];
	if (fromDate)
		pendingConditions.push(gte(schema.walletTransaction.createdAt, fromDate));
	if (toDate)
		pendingConditions.push(lte(schema.walletTransaction.createdAt, toDate));

	const [pendingPayoutsResult] = await db
		.select({
			total: sql<number>`COALESCE(SUM(${schema.walletTransaction.amount}), 0)`,
		})
		.from(schema.walletTransaction)
		.where(and(...pendingConditions));

	const pendingPayouts = (pendingPayoutsResult?.total ?? 0) / 100;

	const creditConditions = [
		eq(schema.walletTransaction.type, "credit"),
		eq(schema.walletTransaction.status, "success"),
	];
	if (fromDate)
		creditConditions.push(gte(schema.walletTransaction.createdAt, fromDate));
	if (toDate)
		creditConditions.push(lte(schema.walletTransaction.createdAt, toDate));

	const [totalCreditsResult] = await db
		.select({
			total: sql<number>`COALESCE(SUM(${schema.walletTransaction.amount}), 0)`,
		})
		.from(schema.walletTransaction)
		.where(and(...creditConditions));

	const debitConditions = [
		eq(schema.walletTransaction.type, "debit"),
		eq(schema.walletTransaction.status, "success"),
	];
	if (fromDate)
		debitConditions.push(gte(schema.walletTransaction.createdAt, fromDate));
	if (toDate)
		debitConditions.push(lte(schema.walletTransaction.createdAt, toDate));

	const [totalDebitsResult] = await db
		.select({
			total: sql<number>`COALESCE(SUM(${schema.walletTransaction.amount}), 0)`,
		})
		.from(schema.walletTransaction)
		.where(and(...debitConditions));

	const totalIncome =
		((totalCreditsResult?.total ?? 0) - (totalDebitsResult?.total ?? 0)) / 100;

	return c.json({
		success: true,
		data: {
			totalUsers,
			activePlayers,
			pendingPayouts,
			totalIncome,
		},
	});
});

adminOverviewRoute.openapi(getActivityRoute, async (c) => {
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

	const query = c.req.valid("query");
	const { fromDate: fd, toDate: td } = parseQueryDateRange({
		fromDate: query.fromDate,
		toDate: query.toDate,
	});

	const db = drizzle(c.env.DB, { schema });
	const days: Array<{
		date: string;
		revenue: number;
		bets: number;
		winnings: number;
		totalDeposits: number;
		totalWithdrawals: number;
	}> = [];

	const now = new Date();
	const rangeStart = fd ?? new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
	const rangeEnd = td ?? now;

	const dayCount = Math.min(
		Math.ceil(
			(rangeEnd.getTime() - rangeStart.getTime()) / (24 * 60 * 60 * 1000),
		) + 1,
		31,
	);

	// Gaming metrics must only include settled bets (settle_type set).
	// settle_type 1 = win, 2 = refund, 3 = loss.
	const settledBetConditions = (dayStart: Date, dayEnd: Date) =>
		and(
			isNotNull(schema.sportsbookBet.settleType),
			gte(schema.sportsbookBet.createdAt, dayStart),
			lte(schema.sportsbookBet.createdAt, dayEnd),
		);

	// Non-deposit credit sources (settlements, game credits, internal transfers, bill payments).
	const nonDepositPaymentMethods = [
		"sportsbook",
		"thndr games",
		"slotegrator games",
		"lagos rush",
		"halla",
		"lucky games",
		"bill_payment",
		"hashcodex",
		"wallet_transfer",
	];

	for (let i = dayCount - 1; i >= 0; i--) {
		const dayStart = new Date(rangeEnd.getTime() - i * 24 * 60 * 60 * 1000);
		dayStart.setHours(0, 0, 0, 0);
		const dayEnd = new Date(dayStart);
		dayEnd.setHours(23, 59, 59, 999);

		const dayLabel =
			i === 0
				? "Today"
				: dayStart.toLocaleDateString("en-US", {
						weekday: "short",
					});

		const [betsResult] = await db
			.select({
				betTurnover: sql<number>`COALESCE(SUM(${schema.sportsbookBet.stake}), 0)`,
				winnings: sql<number>`COALESCE(SUM(CASE WHEN ${schema.sportsbookBet.settleType} = 1 THEN ${schema.sportsbookBet.settleAmount} ELSE 0 END), 0)`,
			})
			.from(schema.sportsbookBet)
			.where(settledBetConditions(dayStart, dayEnd));

		const betTurnover = Number(betsResult?.betTurnover ?? 0);
		const winnings = Number(betsResult?.winnings ?? 0);

		const [depositsResult] = await db
			.select({
				total: sql<number>`COALESCE(SUM(${schema.walletTransaction.amount}), 0)`,
			})
			.from(schema.walletTransaction)
			.where(
				and(
					eq(schema.walletTransaction.type, "credit"),
					inArray(schema.walletTransaction.status, ["success", "completed"]),
					notInArray(
						schema.walletTransaction.paymentMethod,
						nonDepositPaymentMethods,
					),
					gte(schema.walletTransaction.createdAt, dayStart),
					lte(schema.walletTransaction.createdAt, dayEnd),
				),
			);

		const [withdrawalsResult] = await db
			.select({
				total: sql<number>`COALESCE(SUM(${schema.walletTransaction.amount}), 0)`,
			})
			.from(schema.walletTransaction)
			.where(
				and(
					eq(schema.walletTransaction.type, "debit"),
					inArray(schema.walletTransaction.status, ["success", "completed"]),
					eq(schema.walletTransaction.paymentMethod, "paystack"),
					gte(schema.walletTransaction.createdAt, dayStart),
					lte(schema.walletTransaction.createdAt, dayEnd),
				),
			);

		days.push({
			date: dayLabel,
			// Rev (GGR) = settled bet turnover - winnings paid
			revenue: (betTurnover - winnings) / 100,
			bets: betTurnover / 100,
			winnings: winnings / 100,
			totalDeposits: (depositsResult?.total ?? 0) / 100,
			totalWithdrawals: (withdrawalsResult?.total ?? 0) / 100,
		});
	}

	return c.json({
		success: true,
		data: { days },
	});
});

adminOverviewRoute.openapi(getTicketTrendRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) return c.json({ success: false, error: "Unauthorized" }, 401);

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
			{ success: false, error: "Forbidden - general permission required" },
			403,
		);
	}

	const query = c.req.valid("query");
	const { fromDate, toDate } = parseQueryDateRange({
		fromDate: query.fromDate,
		toDate: query.toDate,
	});
	const db = drizzle(c.env.DB, { schema });

	const dateConditions = (createdAt: any) => [
		...(fromDate ? [gte(createdAt, fromDate)] : []),
		...(toDate ? [lte(createdAt, toDate)] : []),
	];
	const countRows = async (
		table: any,
		createdAt: any,
		conditions: unknown[] = [],
	) => {
		const whereConditions = [
			...dateConditions(createdAt),
			...(conditions as any[]),
		];
		const [result] = await db
			.select({ count: sql<number>`COUNT(*)` })
			.from(table)
			.where(whereConditions.length > 0 ? and(...whereConditions) : undefined);
		return Number(result?.count ?? 0);
	};

	const totalTickets = await Promise.all([
		countRows(schema.sportsbookBet, schema.sportsbookBet.createdAt),
		countRows(schema.gameTransactions, schema.gameTransactions.createdAt),
		countRows(schema.thundrTransactions, schema.thundrTransactions.createdAt),
		countRows(
			schema.slotitegrationTransactions,
			schema.slotitegrationTransactions.createdAt,
		),
		countRows(schema.pocketsTransactions, schema.pocketsTransactions.createdAt),
		countRows(schema.scorpioTransactions, schema.scorpioTransactions.createdAt),
	]).then((counts) => counts.reduce((total, count) => total + count, 0));

	const wonTickets = await Promise.all([
		countRows(schema.sportsbookBet, schema.sportsbookBet.createdAt, [
			eq(schema.sportsbookBet.settleType, 1),
		]),
		countRows(schema.gameTransactions, schema.gameTransactions.createdAt, [
			eq(schema.gameTransactions.type, "WIN"),
		]),
		countRows(schema.thundrTransactions, schema.thundrTransactions.createdAt, [
			eq(schema.thundrTransactions.type, "WIN"),
		]),
		countRows(
			schema.slotitegrationTransactions,
			schema.slotitegrationTransactions.createdAt,
			[eq(schema.slotitegrationTransactions.type, "win")],
		),
		countRows(
			schema.pocketsTransactions,
			schema.pocketsTransactions.createdAt,
			[eq(schema.pocketsTransactions.type, "CREDIT")],
		),
		countRows(
			schema.scorpioTransactions,
			schema.scorpioTransactions.createdAt,
			[eq(schema.scorpioTransactions.type, "WIN")],
		),
	]).then((counts) => counts.reduce((total, count) => total + count, 0));

	const lostTickets = await Promise.all([
		countRows(schema.thundrTransactions, schema.thundrTransactions.createdAt, [
			eq(schema.thundrTransactions.type, "LOSE"),
		]),
		countRows(
			schema.slotitegrationTransactions,
			schema.slotitegrationTransactions.createdAt,
			[eq(schema.slotitegrationTransactions.type, "loss")],
		),
	]).then((counts) => counts.reduce((total, count) => total + count, 0));

	return c.json({
		success: true,
		data: { totalTickets, wonTickets, lostTickets },
	});
});

adminOverviewRoute.openapi(getTopBetsRoute, async (c) => {
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
		!requirePermission(session, "view_ticket_history")
	) {
		return c.json(
			{
				success: false,
				error: "Forbidden - view_ticket_history permission required",
			},
			403,
		);
	}

	const query = c.req.valid("query");
	const { fromDate, toDate } = parseQueryDateRange({
		fromDate: query.fromDate,
		toDate: query.toDate,
	});
	const db = drizzle(c.env.DB, { schema });
	const dateConditions = (createdAt: any) => [
		...(fromDate ? [gte(createdAt, fromDate)] : []),
		...(toDate ? [lte(createdAt, toDate)] : []),
	];

	const [
		sportsbookBets,
		gameBets,
		thundrBets,
		slotegratorBets,
		pocketsBets,
		scorpioBets,
	] = await Promise.all([
		db
			.select({
				id: schema.sportsbookBet.id,
				playerName: schema.user.name,
				betType: schema.sportsbookBet.betType,
				amount: schema.sportsbookBet.stake,
			})
			.from(schema.sportsbookBet)
			.innerJoin(schema.user, eq(schema.sportsbookBet.userId, schema.user.id))
			.where(
				dateConditions(schema.sportsbookBet.createdAt).length > 0
					? and(...dateConditions(schema.sportsbookBet.createdAt))
					: undefined,
			)
			.orderBy(desc(schema.sportsbookBet.stake))
			.limit(5),
		db
			.select({
				id: schema.gameTransactions.id,
				playerName: schema.user.name,
				amount: schema.gameTransactions.amount,
			})
			.from(schema.gameTransactions)
			.innerJoin(
				schema.user,
				eq(schema.gameTransactions.userId, schema.user.id),
			)
			.where(
				and(
					eq(schema.gameTransactions.type, "BET"),
					...dateConditions(schema.gameTransactions.createdAt),
				),
			)
			.orderBy(desc(schema.gameTransactions.amount))
			.limit(5),
		db
			.select({
				id: schema.thundrTransactions.id,
				playerName: schema.user.name,
				amount: schema.thundrTransactions.amount,
			})
			.from(schema.thundrTransactions)
			.innerJoin(
				schema.user,
				eq(schema.thundrTransactions.userId, schema.user.id),
			)
			.where(
				and(
					eq(schema.thundrTransactions.type, "BET"),
					...dateConditions(schema.thundrTransactions.createdAt),
				),
			)
			.orderBy(desc(schema.thundrTransactions.amount))
			.limit(5),
		db
			.select({
				id: schema.slotitegrationTransactions.id,
				playerName: schema.user.name,
				amount: schema.slotitegrationTransactions.amount,
			})
			.from(schema.slotitegrationTransactions)
			.innerJoin(
				schema.user,
				eq(schema.slotitegrationTransactions.userId, schema.user.id),
			)
			.where(
				and(
					eq(schema.slotitegrationTransactions.type, "bet"),
					...dateConditions(schema.slotitegrationTransactions.createdAt),
				),
			)
			.orderBy(desc(schema.slotitegrationTransactions.amount))
			.limit(5),
		db
			.select({
				id: schema.pocketsTransactions.id,
				playerName: schema.user.name,
				amount: schema.pocketsTransactions.amount,
			})
			.from(schema.pocketsTransactions)
			.innerJoin(
				schema.user,
				eq(schema.pocketsTransactions.userId, schema.user.id),
			)
			.where(
				and(
					eq(schema.pocketsTransactions.type, "DEBIT"),
					...dateConditions(schema.pocketsTransactions.createdAt),
				),
			)
			.orderBy(desc(schema.pocketsTransactions.amount))
			.limit(5),
		db
			.select({
				id: schema.scorpioTransactions.id,
				playerName: schema.user.name,
				amount: schema.scorpioTransactions.amount,
			})
			.from(schema.scorpioTransactions)
			.innerJoin(
				schema.user,
				eq(schema.scorpioTransactions.userId, schema.user.id),
			)
			.where(
				and(
					eq(schema.scorpioTransactions.type, "BET"),
					...dateConditions(schema.scorpioTransactions.createdAt),
				),
			)
			.orderBy(desc(schema.scorpioTransactions.amount))
			.limit(5),
	]);

	const betTypeLabels: Record<number, string> = {
		1: "Single",
		2: "Double",
		3: "Triple",
		4: "Four-Fold",
		5: "Five-Fold",
		6: "Six-Fold",
		7: "Seven-Fold",
		8: "Eight-Fold",
		9: "Nine-Fold",
		10: "Ten-Fold",
	};

	const bets = [
		...sportsbookBets.map((b) => ({
			id: b.id,
			playerName: b.playerName,
			betType: betTypeLabels[b.betType ?? 0] ?? `Accumulator ${b.betType}`,
			amount: (b.amount ?? 0) / 100,
		})),
		...gameBets.map((b) => ({
			...b,
			betType: "ISCRASH",
			amount: b.amount / 100,
		})),
		...thundrBets.map((b) => ({
			...b,
			betType: "Thundr",
			amount: b.amount / 100,
		})),
		...slotegratorBets.map((b) => ({
			...b,
			betType: "Slotegrator",
			amount: b.amount / 100,
		})),
		...pocketsBets.map((b) => ({
			...b,
			betType: "Lagos Rush",
			amount: b.amount / 100,
		})),
		...scorpioBets.map((b) => ({
			...b,
			betType: "Scorpio",
			amount: b.amount / 100,
		})),
	]
		.sort((a, b) => b.amount - a.amount)
		.slice(0, 5);

	return c.json({
		success: true,
		data: { bets },
	});
});

export default adminOverviewRoute;
