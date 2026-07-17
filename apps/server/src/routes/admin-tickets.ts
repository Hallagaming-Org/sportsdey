import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import * as schema from "@/db/schema";
import { requirePermission } from "@/middleware/admin-permissions";
import { ErrorResponseSchema, successResponseSchema } from "@/schemas";
import { parseQueryDateRange } from "@/utils";
import type { CloudflareBindings } from "../types";

const adminTicketsRoute = new OpenAPIHono<{
	Bindings: CloudflareBindings;
}>();

const MAX_PER_SOURCE = 2000;

function formatAmount(amount: number): string {
	return `₦${(amount / 100).toLocaleString("en-NG")}`;
}

function formatDate(date: Date): string {
	const watDate = new Date(date.getTime() + 60 * 60 * 1000);
	const months = [
		"Jan", "Feb", "Mar", "Apr", "May", "Jun",
		"Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
	];
	const month = months[watDate.getMonth()];
	const day = watDate.getDate();
	const year = watDate.getFullYear();
	const hours = watDate.getHours();
	const minutes = watDate.getMinutes().toString().padStart(2, "0");
	const ampm = hours >= 12 ? "pm" : "am";
	const displayHours = hours % 12 || 12;
	return `${month} ${day}, ${year}, ${displayHours}:${minutes} ${ampm}`;
}

function mapSbOutcome(status: string, settleType: number | null): "Won" | "Active" | "Lost" | "Declined" {
	if (settleType === 1) return "Won";
	if (settleType === 3) return "Lost";
	if (settleType !== null) return "Declined";
	if (status === "created" || status === "accepted") return "Active";
	return "Declined";
}

function mapCasinoOutcome(type: string): "Won" | "Active" | "Lost" {
	switch (type) {
		case "win":
		case "won":
			return "Won";
		default:
			return "Active";
	}
}

const TicketSchema = z.object({
	id: z.string().openapi({ example: "bet_abc123" }),
	userId: z.string().openapi({ example: "usr_xyz789" }),
	playerName: z.string().openapi({ example: "John Doe" }),
	betAmount: z.string().openapi({ example: "₦5,000" }),
	gameType: z.string().openapi({ example: "Sportsbook" }),
	outcome: z.enum(["Won", "Active", "Lost", "Declined"]).openapi({ example: "Active" }),
	createdAt: z.string().openapi({ example: "Jan 15, 2025, 10:30 am" }),
	balanceBefore: z.string().nullable().openapi({ example: "₦10,000" }),
	balanceAfter: z.string().nullable().openapi({ example: "₦5,000" }),
}).openapi("Ticket");

const PaginationSchema = z.object({
	page: z.number().openapi({ example: 1 }),
	limit: z.number().openapi({ example: 10 }),
	total: z.number().openapi({ example: 42 }),
	totalPages: z.number().openapi({ example: 5 }),
}).openapi("Pagination");

const TicketsDataSchema = z.object({
	tickets: z.array(TicketSchema),
	pagination: PaginationSchema,
}).openapi("TicketsData");

const TicketsQuerySchema = z.object({
	page: z.string().optional().openapi({ description: "Page number", example: "1" }),
	limit: z.string().optional().openapi({ description: "Items per page", example: "10" }),
	type: z.enum(["all", "casino", "sportsbook"]).optional().openapi({ description: "Filter by game type", example: "all" }),
	fromDate: z.string().optional().openapi({ description: "Filter start date (YYYY-MM-DD)" }),
	toDate: z.string().optional().openapi({ description: "Filter end date (YYYY-MM-DD)" }),
	search: z.string().optional().openapi({ description: "Search by player name or bet ID" }),
});

const getTicketsRoute = createRoute({
	method: "get",
	path: "/tickets",
	tags: ["Admin - Tickets"],
	summary: "Get all tickets",
	description:
		"Retrieve a paginated list of all tickets across sportsbook and casino. Supports filtering by type, date range, and search.",
	security: [{ BearerAuth: [] }],
	request: {
		query: TicketsQuerySchema,
	},
	responses: {
		200: {
			description: "Tickets retrieved successfully",
			content: {
				"application/json": {
					schema: successResponseSchema(TicketsDataSchema),
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

const GetUserTicketsParamsSchema = z.object({
	userId: z.string().openapi({ description: "User ID", example: "usr_xyz789" }),
});

const GetUserTicketsQuerySchema = z.object({
	page: z.string().optional().openapi({ description: "Page number", example: "1" }),
	limit: z.string().optional().openapi({ description: "Items per page", example: "10" }),
	type: z.enum(["all", "casino", "sportsbook"]).optional().openapi({ description: "Filter by game type", example: "all" }),
	fromDate: z.string().optional().openapi({ description: "Filter start date (YYYY-MM-DD)" }),
	toDate: z.string().optional().openapi({ description: "Filter end date (YYYY-MM-DD)" }),
});

const getUserTicketsRoute = createRoute({
	method: "get",
	path: "/tickets/user/{userId}",
	tags: ["Admin - Tickets"],
	summary: "Get tickets for a user",
	description:
		"Retrieve a paginated list of tickets for a specific user across sportsbook and casino. Supports filtering by type and date range.",
	security: [{ BearerAuth: [] }],
	request: {
		params: GetUserTicketsParamsSchema,
		query: GetUserTicketsQuerySchema,
	},
	responses: {
		200: {
			description: "User tickets retrieved successfully",
			content: {
				"application/json": {
					schema: successResponseSchema(TicketsDataSchema),
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

adminTicketsRoute.openapi(getTicketsRoute, async (c) => {
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

	const url = new URL(c.req.url);
	const rawPage = url.searchParams.get("page") || "1";
	const rawLimit = url.searchParams.get("limit") || "10";
	const rawType = url.searchParams.get("type") || "all";
	const fromDate = url.searchParams.get("fromDate") || undefined;
	const toDate = url.searchParams.get("toDate") || undefined;
	const search = url.searchParams.get("search") || undefined;

	const page = Math.max(1, parseInt(rawPage, 10) || 1);
	const limit = Math.min(100, Math.max(1, parseInt(rawLimit, 10) || 10));
	const type = ["all", "casino", "sportsbook"].includes(rawType)
		? (rawType as "all" | "casino" | "sportsbook")
		: "all";

	const { fromDate: fromBoundary, toDate: toBoundary } =
		parseQueryDateRange({ fromDate, toDate });

	const db = drizzle(c.env.DB, { schema });

	const allTickets: Array<{
		id: string;
		userId: string;
		playerName: string;
		betAmount: number;
		gameType: string;
		outcome: "Won" | "Active" | "Lost" | "Declined";
		createdAt: Date;
		balanceBefore: number | null;
		balanceAfter: number | null;
	}> = [];

	if (type === "all" || type === "sportsbook") {
		const sbConditions: any[] = [];

		if (search) {
			sbConditions.push(
				or(
					like(schema.user.name, `%${search}%`),
					like(schema.sportsbookBet.id, `%${search}%`),
				),
			);
		}

		const sbResults = await db
			.select({
				id: schema.sportsbookBet.id,
				userId: schema.sportsbookBet.userId,
				playerName: schema.user.name,
				betAmount: schema.sportsbookBet.stake,
				outcome: schema.sportsbookBet.status,
				settleType: schema.sportsbookBet.settleType,
				createdAt: schema.sportsbookBet.createdAt,
				balanceBefore: schema.sportsbookBetEvent.balanceBefore,
				balanceAfter: schema.sportsbookBetEvent.balanceAfter,
			})
			.from(schema.sportsbookBet)
			.innerJoin(
				schema.user,
				eq(schema.sportsbookBet.userId, schema.user.id),
			)
			.leftJoin(
				schema.sportsbookBetEvent,
				eq(schema.sportsbookBet.id, schema.sportsbookBetEvent.betId),
			)
			.where(sbConditions.length > 0 ? and(...sbConditions) : undefined)
			.orderBy(desc(schema.sportsbookBet.createdAt))
			.limit(MAX_PER_SOURCE);

		const processedBetIds = new Set<string>();
		for (const r of sbResults) {
			if (processedBetIds.has(r.id)) continue;
			processedBetIds.add(r.id);

			const ts = r.createdAt.getTime();
			if (fromBoundary && ts < fromBoundary.getTime()) continue;
			if (toBoundary && ts > toBoundary.getTime()) continue;

			allTickets.push({
				id: r.id,
				userId: r.userId,
				playerName: r.playerName,
				betAmount: r.betAmount,
				gameType: "Sportsbook",
				outcome: mapSbOutcome(r.outcome, r.settleType),
				createdAt: r.createdAt,
				balanceBefore: r.balanceBefore,
				balanceAfter: r.balanceAfter,
			});
		}
	}

	if (type === "all" || type === "casino") {
		const casinoSources: Array<{
			table: any;
			idCol: any;
			userIdCol: any;
			typeCol: any;
			amountCol: any;
			createdAtCol: any;
			balanceBeforeCol: any;
			balanceAfterCol: any;
		}> = [
			{
				table: schema.gameTransactions,
				idCol: schema.gameTransactions.id,
				userIdCol: schema.gameTransactions.userId,
				typeCol: schema.gameTransactions.type,
				amountCol: schema.gameTransactions.amount,
				createdAtCol: schema.gameTransactions.createdAt,
				balanceBeforeCol: schema.gameTransactions.balanceBefore,
				balanceAfterCol: schema.gameTransactions.balanceAfter,
			},
			{
				table: schema.thundrTransactions,
				idCol: schema.thundrTransactions.id,
				userIdCol: schema.thundrTransactions.userId,
				typeCol: schema.thundrTransactions.type,
				amountCol: schema.thundrTransactions.amount,
				createdAtCol: schema.thundrTransactions.createdAt,
				balanceBeforeCol: schema.thundrTransactions.balanceBefore,
				balanceAfterCol: schema.thundrTransactions.balanceAfter,
			},
			{
				table: schema.slotitegrationTransactions,
				idCol: schema.slotitegrationTransactions.id,
				userIdCol: schema.slotitegrationTransactions.userId,
				typeCol: schema.slotitegrationTransactions.type,
				amountCol: schema.slotitegrationTransactions.amount,
				createdAtCol: schema.slotitegrationTransactions.createdAt,
				balanceBeforeCol: schema.slotitegrationTransactions.balanceBefore,
				balanceAfterCol: schema.slotitegrationTransactions.balanceAfter,
			},
			{
				table: schema.pocketsTransactions,
				idCol: schema.pocketsTransactions.id,
				userIdCol: schema.pocketsTransactions.userId,
				typeCol: schema.pocketsTransactions.type,
				amountCol: schema.pocketsTransactions.amount,
				createdAtCol: schema.pocketsTransactions.createdAt,
				balanceBeforeCol: schema.pocketsTransactions.balanceBefore,
				balanceAfterCol: schema.pocketsTransactions.balanceAfter,
			},
		];

		for (const source of casinoSources) {
			const casConditions: any[] = [];

			if (search) {
				casConditions.push(
					or(
						like(schema.user.name, `%${search}%`),
						like(source.idCol, `%${search}%`),
					),
				);
			}

			const results = await db
				.select({
					id: source.idCol,
					userId: source.userIdCol,
					playerName: schema.user.name,
					betAmount: source.amountCol,
					outcomeType: source.typeCol,
					createdAt: source.createdAtCol,
					balanceBefore: source.balanceBeforeCol,
					balanceAfter: source.balanceAfterCol,
				})
				.from(source.table)
				.innerJoin(
					schema.user,
					eq(source.userIdCol, schema.user.id),
				)
				.where(
					casConditions.length > 0 ? and(...casConditions) : undefined,
				)
				.orderBy(desc(source.createdAtCol))
				.limit(MAX_PER_SOURCE);

			for (const r of results) {
				const ts = r.createdAt.getTime();
				if (fromBoundary && ts < fromBoundary.getTime()) continue;
				if (toBoundary && ts > toBoundary.getTime()) continue;

				allTickets.push({
					id: r.id,
					userId: r.userId,
					playerName: r.playerName,
					betAmount: r.betAmount,
					gameType: "Casino",
					outcome: mapCasinoOutcome(r.outcomeType),
					createdAt: r.createdAt,
					balanceBefore: r.balanceBefore,
					balanceAfter: r.balanceAfter,
				});
			}
		}
	}

	allTickets.sort(
		(a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
	);

	const total = allTickets.length;
	const totalPages = Math.ceil(total / limit) || 1;
	const paginated = allTickets.slice(
		(page - 1) * limit,
		page * limit,
	);

	return c.json({
		success: true,
		data: {
			tickets: paginated.map((t) => ({
				id: t.id,
				userId: t.userId,
				playerName: t.playerName,
				betAmount: formatAmount(t.betAmount),
				gameType: t.gameType,
				outcome: t.outcome,
				createdAt: formatDate(t.createdAt),
				balanceBefore: t.balanceBefore != null ? formatAmount(t.balanceBefore) : null,
				balanceAfter: t.balanceAfter != null ? formatAmount(t.balanceAfter) : null,
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

adminTicketsRoute.openapi(getUserTicketsRoute, async (c) => {
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

	const url = new URL(c.req.url);
	const rawPage = url.searchParams.get("page") || "1";
	const rawLimit = url.searchParams.get("limit") || "10";
	const rawType = url.searchParams.get("type") || "all";
	const fromDate = url.searchParams.get("fromDate") || undefined;
	const toDate = url.searchParams.get("toDate") || undefined;

	const page = Math.max(1, parseInt(rawPage, 10) || 1);
	const limit = Math.min(100, Math.max(1, parseInt(rawLimit, 10) || 10));
	const type = ["all", "casino", "sportsbook"].includes(rawType)
		? (rawType as "all" | "casino" | "sportsbook")
		: "all";

	const { fromDate: fromBoundary, toDate: toBoundary } =
		parseQueryDateRange({ fromDate, toDate });

	const db = drizzle(c.env.DB, { schema });

	const allTickets: Array<{
		id: string;
		userId: string;
		playerName: string;
		betAmount: number;
		gameType: string;
		outcome: "Won" | "Active" | "Lost" | "Declined";
		createdAt: Date;
		balanceBefore: number | null;
		balanceAfter: number | null;
	}> = [];

	if (type === "all" || type === "sportsbook") {
		const sbResults = await db
			.select({
				id: schema.sportsbookBet.id,
				userId: schema.sportsbookBet.userId,
				playerName: schema.user.name,
				betAmount: schema.sportsbookBet.stake,
				outcome: schema.sportsbookBet.status,
				settleType: schema.sportsbookBet.settleType,
				createdAt: schema.sportsbookBet.createdAt,
				balanceBefore: schema.sportsbookBetEvent.balanceBefore,
				balanceAfter: schema.sportsbookBetEvent.balanceAfter,
			})
			.from(schema.sportsbookBet)
			.innerJoin(
				schema.user,
				eq(schema.sportsbookBet.userId, schema.user.id),
			)
			.leftJoin(
				schema.sportsbookBetEvent,
				eq(schema.sportsbookBet.id, schema.sportsbookBetEvent.betId),
			)
			.where(eq(schema.sportsbookBet.userId, userId))
			.orderBy(desc(schema.sportsbookBet.createdAt))
			.limit(MAX_PER_SOURCE);

		const processedBetIds = new Set<string>();
		for (const r of sbResults) {
			if (processedBetIds.has(r.id)) continue;
			processedBetIds.add(r.id);

			const ts = r.createdAt.getTime();
			if (fromBoundary && ts < fromBoundary.getTime()) continue;
			if (toBoundary && ts > toBoundary.getTime()) continue;

			allTickets.push({
				id: r.id,
				userId: r.userId,
				playerName: r.playerName,
				betAmount: r.betAmount,
				gameType: "Sportsbook",
				outcome: mapSbOutcome(r.outcome, r.settleType),
				createdAt: r.createdAt,
				balanceBefore: r.balanceBefore,
				balanceAfter: r.balanceAfter,
			});
		}
	}

	if (type === "all" || type === "casino") {
		const casinoSources: Array<{
			table: any;
			idCol: any;
			userIdCol: any;
			typeCol: any;
			amountCol: any;
			createdAtCol: any;
			balanceBeforeCol: any;
			balanceAfterCol: any;
		}> = [
			{
				table: schema.gameTransactions,
				idCol: schema.gameTransactions.id,
				userIdCol: schema.gameTransactions.userId,
				typeCol: schema.gameTransactions.type,
				amountCol: schema.gameTransactions.amount,
				createdAtCol: schema.gameTransactions.createdAt,
				balanceBeforeCol: schema.gameTransactions.balanceBefore,
				balanceAfterCol: schema.gameTransactions.balanceAfter,
			},
			{
				table: schema.thundrTransactions,
				idCol: schema.thundrTransactions.id,
				userIdCol: schema.thundrTransactions.userId,
				typeCol: schema.thundrTransactions.type,
				amountCol: schema.thundrTransactions.amount,
				createdAtCol: schema.thundrTransactions.createdAt,
				balanceBeforeCol: schema.thundrTransactions.balanceBefore,
				balanceAfterCol: schema.thundrTransactions.balanceAfter,
			},
			{
				table: schema.slotitegrationTransactions,
				idCol: schema.slotitegrationTransactions.id,
				userIdCol: schema.slotitegrationTransactions.userId,
				typeCol: schema.slotitegrationTransactions.type,
				amountCol: schema.slotitegrationTransactions.amount,
				createdAtCol: schema.slotitegrationTransactions.createdAt,
				balanceBeforeCol: schema.slotitegrationTransactions.balanceBefore,
				balanceAfterCol: schema.slotitegrationTransactions.balanceAfter,
			},
			{
				table: schema.pocketsTransactions,
				idCol: schema.pocketsTransactions.id,
				userIdCol: schema.pocketsTransactions.userId,
				typeCol: schema.pocketsTransactions.type,
				amountCol: schema.pocketsTransactions.amount,
				createdAtCol: schema.pocketsTransactions.createdAt,
				balanceBeforeCol: schema.pocketsTransactions.balanceBefore,
				balanceAfterCol: schema.pocketsTransactions.balanceAfter,
			},
		];

		for (const source of casinoSources) {
			const results = await db
				.select({
					id: source.idCol,
					userId: source.userIdCol,
					playerName: schema.user.name,
					betAmount: source.amountCol,
					outcomeType: source.typeCol,
					createdAt: source.createdAtCol,
					balanceBefore: source.balanceBeforeCol,
					balanceAfter: source.balanceAfterCol,
				})
				.from(source.table)
				.innerJoin(
					schema.user,
					eq(source.userIdCol, schema.user.id),
				)
				.where(eq(source.userIdCol, userId))
				.orderBy(desc(source.createdAtCol))
				.limit(MAX_PER_SOURCE);

			for (const r of results) {
				const ts = r.createdAt.getTime();
				if (fromBoundary && ts < fromBoundary.getTime()) continue;
				if (toBoundary && ts > toBoundary.getTime()) continue;

				allTickets.push({
					id: r.id,
					userId: r.userId,
					playerName: r.playerName,
					betAmount: r.betAmount,
					gameType: "Casino",
					outcome: mapCasinoOutcome(r.outcomeType),
					createdAt: r.createdAt,
					balanceBefore: r.balanceBefore,
					balanceAfter: r.balanceAfter,
				});
			}
		}
	}

	allTickets.sort(
		(a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
	);

	const total = allTickets.length;
	const totalPages = Math.ceil(total / limit) || 1;
	const paginated = allTickets.slice(
		(page - 1) * limit,
		page * limit,
	);

	return c.json({
		success: true,
		data: {
			tickets: paginated.map((t) => ({
				id: t.id,
				userId: t.userId,
				playerName: t.playerName,
				betAmount: formatAmount(t.betAmount),
				gameType: t.gameType,
				outcome: t.outcome,
				createdAt: formatDate(t.createdAt),
				balanceBefore: t.balanceBefore != null ? formatAmount(t.balanceBefore) : null,
				balanceAfter: t.balanceAfter != null ? formatAmount(t.balanceAfter) : null,
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

export default adminTicketsRoute;
