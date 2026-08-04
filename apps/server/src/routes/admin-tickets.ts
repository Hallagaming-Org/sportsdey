import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq, like, lt, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import * as schema from "@/db/schema";
import { requirePermission } from "@/middleware/admin-permissions";
import { ErrorResponseSchema, successResponseSchema } from "@/schemas";
import { parseQueryDateRange } from "@/utils";
import { fetchWithTimeout } from "@/utils/fetch-with-timeout";
import type { CloudflareBindings } from "../types";
import { getFixtureTitlesByIds } from "@/utils/fixtures";

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
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
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

function mapSbOutcome(
	status: string,
	settleType: number | null,
): "Won" | "Active" | "Lost" | "Declined" {
	if (settleType === 1) return "Won";
	if (settleType === 3) return "Lost";
	if (settleType !== null) return "Declined";
	if (status === "created" || status === "accepted") return "Active";
	return "Declined";
}

function mapCasinoOutcome(type: string): "Won" | "Active" | "Lost" | "Declined" {
	switch (type) {
		case "WIN":
		case "win":
		case "won":
		case "CREDIT":
			return "Won";
		case "CANCEL":
		case "cancel":
		case "REFUND":
		case "refund":
			return "Declined";
		case "BET":
		case "bet":
		case "DEBIT":
		case "debit":
			return "Active";
		default:
			return "Active";
	}
}

const TicketSchema = z
	.object({
		id: z.string().openapi({ example: "bet_abc123" }),
		userId: z.string().openapi({ example: "usr_xyz789" }),
		playerName: z.string().openapi({ example: "John Doe" }),
		betAmount: z.string().openapi({ example: "₦5,000" }),
		potentialWin: z.string().nullable().openapi({ example: "₦12,500" }),
		payout: z.string().nullable().openapi({ example: "₦25,000" }),
		odds: z.string().nullable().openapi({ example: "2.5" }),
		gameType: z.string().openapi({ example: "Sportsbook" }),
		outcome: z
			.enum(["Won", "Active", "Lost", "Declined"])
			.openapi({ example: "Active" }),
		createdAt: z.string().openapi({ example: "Jan 15, 2025, 10:30 am" }),
		balanceBefore: z.string().nullable().openapi({ example: "₦10,000" }),
		balanceAfter: z.string().nullable().openapi({ example: "₦5,000" }),
		roundId: z.string().nullable().openapi({ example: "round_abc123" }),
		provider: z.string().nullable().openapi({ example: "Thundr" }),
		gameName: z.string().nullable().openapi({ example: "Aviator" }),
	})
	.openapi("Ticket");

const PaginationSchema = z
	.object({
		page: z.number().openapi({ example: 1 }),
		limit: z.number().openapi({ example: 10 }),
		total: z.number().openapi({ example: 42 }),
		totalPages: z.number().openapi({ example: 5 }),
	})
	.openapi("Pagination");

const TicketsDataSchema = z
	.object({
		tickets: z.array(TicketSchema),
		pagination: PaginationSchema,
	})
	.openapi("TicketsData");

const TicketsQuerySchema = z.object({
	page: z
		.string()
		.optional()
		.openapi({ description: "Page number", example: "1" }),
	limit: z
		.string()
		.optional()
		.openapi({ description: "Items per page", example: "10" }),
	type: z
		.enum(["all", "casino", "sportsbook"])
		.optional()
		.openapi({ description: "Filter by game type", example: "all" }),
	fromDate: z
		.string()
		.optional()
		.openapi({ description: "Filter start date (YYYY-MM-DD)" }),
	toDate: z
		.string()
		.optional()
		.openapi({ description: "Filter end date (YYYY-MM-DD)" }),
	search: z
		.string()
		.optional()
		.openapi({ description: "Search by player name or bet ID" }),
});




const GetUserTicketsParamsSchema = z.object({
	userId: z.string().openapi({ description: "User ID", example: "usr_xyz789" }),
});

const GetUserTicketsQuerySchema = z.object({
	page: z
		.string()
		.optional()
		.openapi({ description: "Page number", example: "1" }),
	limit: z
		.string()
		.optional()
		.openapi({ description: "Items per page", example: "10" }),
	type: z
		.enum(["all", "casino", "sportsbook"])
		.optional()
		.openapi({ description: "Filter by game type", example: "all" }),
	fromDate: z
		.string()
		.optional()
		.openapi({ description: "Filter start date (YYYY-MM-DD)" }),
	toDate: z
		.string()
		.optional()
		.openapi({ description: "Filter end date (YYYY-MM-DD)" }),
});



const GetTicketByIdParamsSchema = z.object({
	id: z.string().openapi({ description: "Ticket (bet) ID", example: "bet_abc123" }),
});

const TicketSelectionSchema = z
	.object({
		matchId: z.string().nullable().openapi({ example: "1:1" }),
		match: z.string().openapi({ example: "Arsenal vs Chelsea" }),
		marketId: z.string().nullable().openapi({ example: "20" }),
		oddId: z.string().nullable().openapi({ example: "1" }),
		odds: z.string().nullable().openapi({ example: "1.75" }),
		oddStatus: z.number().nullable().openapi({ example: 1 }),
	})
	.openapi("TicketSelection");

const TicketPlayerSchema = z
	.object({
		id: z.string().openapi({ example: "usr_xyz789" }),
		name: z.string().openapi({ example: "George Jones" }),
		email: z.string().openapi({ example: "george@example.com" }),
		image: z.string().nullable(),
		mobileNumber: z.string().nullable(),
		verified: z.boolean(),
		balanceBefore: z.string().nullable().openapi({ example: "₦225,000" }),
		balanceAfter: z.string().nullable().openapi({ example: "₦400,000" }),
	})
	.openapi("TicketPlayer");

const TicketDetailSchema = z
	.object({
		id: z.string(),
		gameType: z.enum(["Sportsbook", "Casino"]),
		status: z.string(),
		betType: z.number().nullable(),
		outcome: z.enum(["Won", "Active", "Lost", "Declined"]),
		stake: z.string().openapi({ example: "₦50,000" }),
		potentialWin: z.string().nullable().openapi({ example: "₦225,000" }),
		actualPayout: z.string().nullable().openapi({ example: "₦225,000" }),
		profit: z.string().nullable().openapi({ example: "+₦175,000" }),
		totalOdds: z.string().nullable().openapi({ example: "4.52" }),
		cashedOut: z.boolean(),
		createdAt: z.string(),
		settledAt: z.string().nullable(),
		player: TicketPlayerSchema,
		selections: z.array(TicketSelectionSchema).optional(),
		provider: z.string().nullable().optional(),
		gameName: z.string().nullable().optional(),
		roundId: z.string().nullable().optional(),
	})
	.openapi("TicketDetail");



//Ticket Route creattion  
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


// Get user tickets route
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

// Get ticket by ID route
const getTicketByIdRoute = createRoute({
	method: "get",
	path: "/tickets/{id}",
	tags: ["Admin - Tickets"],
	summary: "Get a single ticket by ID",
	description:
		"Retrieve full details for a single ticket (sportsbook bet or casino round), including player info and, for sportsbook tickets, match selections.",
	security: [{ BearerAuth: [] }],
	request: {
		params: GetTicketByIdParamsSchema,
	},
	responses: {
		200: {
			description: "Ticket retrieved successfully",
			content: {
				"application/json": {
					schema: successResponseSchema(TicketDetailSchema),
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
		404: {
			description: "Ticket not found",
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

	const { fromDate: fromBoundary, toDate: toBoundary } = parseQueryDateRange({
		fromDate,
		toDate,
	});

	const db = drizzle(c.env.DB, { schema });

	const allTickets: Array<{
		id: string;
		userId: string;
		playerName: string;
		betAmount: number;
		totalOdds: string | null;
		payout: number | null;
		gameType: string;
		outcome: "Won" | "Active" | "Lost" | "Declined";
		createdAt: Date;
		balanceBefore: number | null;
		balanceAfter: number | null;
		roundId: string | null;
		provider: string | null;
		gameCode: string | null;
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
				totalOdds: schema.sportsbookBet.totalOdds,
				settleAmount: schema.sportsbookBet.settleAmount,
				outcome: schema.sportsbookBet.status,
				settleType: schema.sportsbookBet.settleType,
				createdAt: schema.sportsbookBet.createdAt,
				balanceBefore: schema.sportsbookBetEvent.balanceBefore,
				balanceAfter: schema.sportsbookBetEvent.balanceAfter,
			})
			.from(schema.sportsbookBet)
			.innerJoin(schema.user, eq(schema.sportsbookBet.userId, schema.user.id))
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
				totalOdds: r.totalOdds,
				payout: r.settleAmount,
				gameType: "Sportsbook",
				outcome: mapSbOutcome(r.outcome, r.settleType),
				createdAt: r.createdAt,
				balanceBefore: r.balanceBefore,
				balanceAfter: r.balanceAfter,
				roundId: null,
				provider: null,
				gameCode: null,
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
			roundIdCol: any;
			gameIdCol: any;
			winTypes: string[];
			provider: string;
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
				roundIdCol: null,
				gameIdCol: schema.gameTransactions.game,
				winTypes: ["WIN"],
				provider: "ICRASH",
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
				roundIdCol: schema.thundrTransactions.roundId,
				gameIdCol: schema.thundrTransactions.gameId,
				winTypes: ["WIN"],
				provider: "Thndr",
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
				roundIdCol: schema.slotitegrationTransactions.roundId,
				gameIdCol: schema.slotitegrationTransactions.gameId,
				winTypes: ["win"],
				provider: "Slotegrator",
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
				roundIdCol: null,
				gameIdCol: null,
				winTypes: ["CREDIT"],
				provider: "Lagos Rush",
			},
			{
				table: schema.scorpioTransactions,
				idCol: schema.scorpioTransactions.id,
				userIdCol: schema.scorpioTransactions.userId,
				typeCol: schema.scorpioTransactions.type,
				amountCol: schema.scorpioTransactions.amount,
				createdAtCol: schema.scorpioTransactions.createdAt,
				balanceBeforeCol: schema.scorpioTransactions.balanceBefore,
				balanceAfterCol: schema.scorpioTransactions.balanceAfter,
				roundIdCol: schema.scorpioTransactions.roundId,
				gameIdCol: schema.scorpioTransactions.gameCode,
				winTypes: ["WIN"],
				provider: "Scorpio",
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

			const selectCols: any = {
				id: source.idCol,
				userId: source.userIdCol,
				playerName: schema.user.name,
				betAmount: source.amountCol,
				outcomeType: source.typeCol,
				createdAt: source.createdAtCol,
				balanceBefore: source.balanceBeforeCol,
				balanceAfter: source.balanceAfterCol,
			};
			if (source.roundIdCol) {
				selectCols.roundId = source.roundIdCol;
			}
			if (source.gameIdCol) {
				selectCols.gameCode = source.gameIdCol;
			}

			const results = await db
				.select(selectCols)
				.from(source.table)
				.innerJoin(schema.user, eq(source.userIdCol, schema.user.id))
				.where(casConditions.length > 0 ? and(...casConditions) : undefined)
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
					totalOdds: null,
					payout: source.winTypes.includes(r.outcomeType) ? r.betAmount : null,
					gameType: "Casino",
					outcome: mapCasinoOutcome(r.outcomeType),
					createdAt: r.createdAt,
					balanceBefore: r.balanceBefore,
					balanceAfter: r.balanceAfter,
					roundId: r.roundId ?? null,
					provider: source.provider,
					gameCode: r.gameCode ?? null,
				});
			}
		}
	}

	allTickets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

	const total = allTickets.length;
	const totalPages = Math.ceil(total / limit) || 1;
	const paginated = allTickets.slice((page - 1) * limit, page * limit);

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

	const ticketsWithNames = await Promise.all(
		paginated.map(async (t) => {
			let gameName: string | null = null;
			if (t.gameCode) {
				gameName = await getGameName(t.gameCode);
			}
			return {
				id: t.id,
				userId: t.userId,
				playerName: t.playerName,
				betAmount: formatAmount(t.betAmount),
				odds: t.totalOdds,
				potentialWin:
					t.gameType === "Sportsbook" && t.totalOdds
						? formatAmount(
								Math.round(t.betAmount * Number.parseFloat(t.totalOdds)),
							)
						: null,
				payout: t.payout != null ? formatAmount(t.payout) : null,
				gameType: t.gameType,
				outcome: t.outcome,
				createdAt: formatDate(t.createdAt),
				balanceBefore:
					t.balanceBefore != null ? formatAmount(t.balanceBefore) : null,
				balanceAfter:
					t.balanceAfter != null ? formatAmount(t.balanceAfter) : null,
				roundId: t.roundId,
				provider: t.provider,
				gameName,
			};
		}),
	);

	return c.json({
		success: true,
		data: {
			tickets: ticketsWithNames,
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

	const { fromDate: fromBoundary, toDate: toBoundary } = parseQueryDateRange({
		fromDate,
		toDate,
	});

	const db = drizzle(c.env.DB, { schema });

	const allTickets: Array<{
		id: string;
		userId: string;
		playerName: string;
		betAmount: number;
		totalOdds: string | null;
		payout: number | null;
		gameType: string;
		outcome: "Won" | "Active" | "Lost" | "Declined";
		createdAt: Date;
		balanceBefore: number | null;
		balanceAfter: number | null;
		roundId: string | null;
		provider: string | null;
		gameCode: string | null;
	}> = [];

	if (type === "all" || type === "sportsbook") {
		const sbResults = await db
			.select({
				id: schema.sportsbookBet.id,
				userId: schema.sportsbookBet.userId,
				playerName: schema.user.name,
				betAmount: schema.sportsbookBet.stake,
				totalOdds: schema.sportsbookBet.totalOdds,
				settleAmount: schema.sportsbookBet.settleAmount,
				outcome: schema.sportsbookBet.status,
				settleType: schema.sportsbookBet.settleType,
				createdAt: schema.sportsbookBet.createdAt,
				balanceBefore: schema.sportsbookBetEvent.balanceBefore,
				balanceAfter: schema.sportsbookBetEvent.balanceAfter,
			})
			.from(schema.sportsbookBet)
			.innerJoin(schema.user, eq(schema.sportsbookBet.userId, schema.user.id))
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
				totalOdds: r.totalOdds,
				payout: r.settleAmount,
				gameType: "Sportsbook",
				outcome: mapSbOutcome(r.outcome, r.settleType),
				createdAt: r.createdAt,
				balanceBefore: r.balanceBefore,
				balanceAfter: r.balanceAfter,
				roundId: null,
				provider: null,
				gameCode: null,
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
			roundIdCol: any;
			gameIdCol: any;
			winTypes: string[];
			provider: string;
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
				roundIdCol: null,
				gameIdCol: schema.gameTransactions.game,
				winTypes: ["WIN"],
				provider: "Spribe",
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
				roundIdCol: schema.thundrTransactions.roundId,
				gameIdCol: schema.thundrTransactions.gameId,
				winTypes: ["WIN"],
				provider: "Thundr",
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
				roundIdCol: schema.slotitegrationTransactions.roundId,
				gameIdCol: schema.slotitegrationTransactions.gameId,
				winTypes: ["win"],
				provider: "Slotegrator",
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
				roundIdCol: null,
				gameIdCol: null,
				winTypes: ["CREDIT"],
				provider: "Lagos Rush",
			},
			{
				table: schema.scorpioTransactions,
				idCol: schema.scorpioTransactions.id,
				userIdCol: schema.scorpioTransactions.userId,
				typeCol: schema.scorpioTransactions.type,
				amountCol: schema.scorpioTransactions.amount,
				createdAtCol: schema.scorpioTransactions.createdAt,
				balanceBeforeCol: schema.scorpioTransactions.balanceBefore,
				balanceAfterCol: schema.scorpioTransactions.balanceAfter,
				roundIdCol: schema.scorpioTransactions.roundId,
				gameIdCol: schema.scorpioTransactions.gameCode,
				winTypes: ["WIN"],
				provider: "Scorpio",
			},
		];

		for (const source of casinoSources) {
			const selectCols: any = {
				id: source.idCol,
				userId: source.userIdCol,
				playerName: schema.user.name,
				betAmount: source.amountCol,
				outcomeType: source.typeCol,
				createdAt: source.createdAtCol,
				balanceBefore: source.balanceBeforeCol,
				balanceAfter: source.balanceAfterCol,
			};
			if (source.roundIdCol) {
				selectCols.roundId = source.roundIdCol;
			}
			if (source.gameIdCol) {
				selectCols.gameCode = source.gameIdCol;
			}

			const results = await db
				.select(selectCols)
				.from(source.table)
				.innerJoin(schema.user, eq(source.userIdCol, schema.user.id))
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
					totalOdds: null,
					payout: source.winTypes.includes(r.outcomeType) ? r.betAmount : null,
					gameType: "Casino",
					outcome: mapCasinoOutcome(r.outcomeType),
					createdAt: r.createdAt,
					balanceBefore: r.balanceBefore,
					balanceAfter: r.balanceAfter,
					roundId: r.roundId ?? null,
					provider: source.provider,
					gameCode: r.gameCode ?? null,
				});
			}
		}
	}

	allTickets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

	const total = allTickets.length;
	const totalPages = Math.ceil(total / limit) || 1;
	const paginated = allTickets.slice((page - 1) * limit, page * limit);

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

	const ticketsWithNames = await Promise.all(
		paginated.map(async (t) => {
			let gameName: string | null = null;
			if (t.gameCode) {
				gameName = await getGameName(t.gameCode);
			}
			return {
				id: t.id,
				userId: t.userId,
				playerName: t.playerName,
				betAmount: formatAmount(t.betAmount),
				potentialWin:
					t.gameType === "Sportsbook" && t.totalOdds
						? formatAmount(
								Math.round(t.betAmount * Number.parseFloat(t.totalOdds)),
							)
						: null,
				payout: t.payout != null ? formatAmount(t.payout) : null,
				odds: t.totalOdds,
				gameType: t.gameType,
				outcome: t.outcome,
				createdAt: formatDate(t.createdAt),
				balanceBefore:
					t.balanceBefore != null ? formatAmount(t.balanceBefore) : null,
				balanceAfter:
					t.balanceAfter != null ? formatAmount(t.balanceAfter) : null,
				roundId: t.roundId,
				provider: t.provider,
				gameName,
			};
		}),
	);

	return c.json({
		success: true,
		data: {
			tickets: ticketsWithNames,
			pagination: {
				page,
				limit,
				total,
				totalPages,
			},
		},
	});
});

adminTicketsRoute.openapi(getTicketByIdRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized", details: null }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session || (session.role !== "admin" && session.role !== "super_admin")) {
		return c.json({ success: false, error: "Forbidden - admin only", details: null }, 403);
	}

	if (session.role !== "super_admin" && !requirePermission(session, "view_ticket_history")) {
		return c.json(
			{ success: false, error: "Forbidden - view_ticket_history permission required", details: null },
			403,
		);
	}

	const { id } = c.req.valid("param");
	const db = drizzle(c.env.DB, { schema });

	
	const bet = await db
		.select({
			id: schema.sportsbookBet.id,
			userId: schema.sportsbookBet.userId,
			stake: schema.sportsbookBet.stake,
			totalOdds: schema.sportsbookBet.totalOdds,
			betType: schema.sportsbookBet.betType,
			status: schema.sportsbookBet.status,
			settleAmount: schema.sportsbookBet.settleAmount,
			settleType: schema.sportsbookBet.settleType,
			betData: schema.sportsbookBet.betData,
			cashOutOrderIds: schema.sportsbookBet.cashOutOrderIds,
			createdAt: schema.sportsbookBet.createdAt,
			updatedAt: schema.sportsbookBet.updatedAt,
			playerName: schema.user.name,
			playerEmail: schema.user.email,
			playerImage: schema.user.image,
			playerVerificationStatus: schema.user.verificationStatus,
			playerMobileNumber: schema.user.mobileNumber,
		})
		.from(schema.sportsbookBet)
		.innerJoin(schema.user, eq(schema.sportsbookBet.userId, schema.user.id))
		.where(eq(schema.sportsbookBet.id, id))
		.get();

	if (bet) {
		const events = await db
			.select({
				eventType: schema.sportsbookBetEvent.eventType,
				balanceBefore: schema.sportsbookBetEvent.balanceBefore,
				balanceAfter: schema.sportsbookBetEvent.balanceAfter,
				createdAt: schema.sportsbookBetEvent.createdAt,
			})
			.from(schema.sportsbookBetEvent)
			.where(eq(schema.sportsbookBetEvent.betId, id))
			.orderBy(schema.sportsbookBetEvent.createdAt);


		const wasCashedOut = events.some((e) => e.eventType === "cash_out_accepted");
		const balanceBefore = events[0]?.balanceBefore ?? null;
		const balanceAfter = events[events.length - 1]?.balanceAfter ?? null;

		let rawSelections: Array<Record<string, any>> = [];
		try {
			const parsed = bet.betData ? JSON.parse(bet.betData) : null;
			if (parsed && Array.isArray(parsed.bet_odds)) {
				rawSelections = parsed.bet_odds;
			}
		} catch {
			rawSelections = [];
		}

		const sportEventIds = Array.from(
			new Set(rawSelections.map((s) => s.match_id).filter(Boolean)),
		) as string[];

		const titleById = await getFixtureTitlesByIds(c.env, sportEventIds);

		const selections = rawSelections.map((s) => {
			const title = s.match_id ? titleById.get(s.match_id) : undefined;
			return {
				matchId: s.match_id ?? null,
				match: title ?? (s.match_id ?? "Unknown match"),
				marketId: s.market_id ?? null,
				oddId: s.odd_id ?? null,
				odds: s.odd_ratio ?? null,
				oddStatus: s.odd_status ?? null,
			};
		});

		const totalOddsNum = bet.totalOdds ? parseFloat(bet.totalOdds) : null;
		const potentialWin = totalOddsNum ? bet.stake * totalOddsNum : null;
		const actualPayout = bet.settleAmount ?? null;
		const profit = actualPayout != null ? actualPayout - bet.stake : null;

		return c.json({
			success: true,
			data: {
				id: bet.id,
				gameType: "Sportsbook" as const,
				status: bet.status,
				betType: bet.betType,
				outcome: mapSbOutcome(bet.status, bet.settleType),
				stake: formatAmount(bet.stake),
				potentialWin: potentialWin != null ? formatAmount(Math.round(potentialWin)) : null,
				actualPayout: actualPayout != null ? formatAmount(actualPayout) : null,
				profit: profit != null ? formatAmount(profit) : null,
				totalOdds: bet.totalOdds,
				cashedOut: wasCashedOut,
				createdAt: formatDate(bet.createdAt),
				settledAt: bet.status !== "created" && bet.status !== "accepted" ? formatDate(bet.updatedAt) : null,
				player: {
					id: bet.userId,
					name: bet.playerName,
					email: bet.playerEmail,
					image: bet.playerImage,
					mobileNumber: bet.playerMobileNumber,
					verified: bet.playerVerificationStatus === "verified",
					balanceBefore: balanceBefore != null ? formatAmount(balanceBefore) : null,
					balanceAfter: balanceAfter != null ? formatAmount(balanceAfter) : null,
				},
				selections,
			},
		});
	}

	
	const casinoSources: Array<{
		table: any;
		idCol: any;
		userIdCol: any;
		typeCol: any;
		amountCol: any;
		createdAtCol: any;
		balanceBeforeCol: any;
		balanceAfterCol: any;
		roundIdCol: any;
		gameIdCol: any;
		winTypes: string[];
		provider: string;
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
			roundIdCol: null,
			gameIdCol: schema.gameTransactions.game,
			winTypes: ["WIN"],
			provider: "ICRASH",
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
			roundIdCol: schema.thundrTransactions.roundId,
			gameIdCol: schema.thundrTransactions.gameId,
			winTypes: ["WIN"],
			provider: "Thndr",
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
			roundIdCol: schema.slotitegrationTransactions.roundId,
			gameIdCol: schema.slotitegrationTransactions.gameId,
			winTypes: ["win"],
			provider: "Slotegrator",
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
			roundIdCol: null,
			gameIdCol: null,
			winTypes: ["CREDIT"],
			provider: "Lagos Rush",
		},
		{
			table: schema.scorpioTransactions,
			idCol: schema.scorpioTransactions.id,
			userIdCol: schema.scorpioTransactions.userId,
			typeCol: schema.scorpioTransactions.type,
			amountCol: schema.scorpioTransactions.amount,
			createdAtCol: schema.scorpioTransactions.createdAt,
			balanceBeforeCol: schema.scorpioTransactions.balanceBefore,
			balanceAfterCol: schema.scorpioTransactions.balanceAfter,
			roundIdCol: schema.scorpioTransactions.roundId,
			gameIdCol: schema.scorpioTransactions.gameCode,
			winTypes: ["WIN"],
			provider: "Scorpio",
		},
	];

	for (const source of casinoSources) {
		const selectCols: any = {
			id: source.idCol,
			userId: source.userIdCol,
			playerName: schema.user.name,
			playerEmail: schema.user.email,
			playerImage: schema.user.image,
			playerVerificationStatus: schema.user.verificationStatus,
			playerMobileNumber: schema.user.mobileNumber,
			betAmount: source.amountCol,
			outcomeType: source.typeCol,
			createdAt: source.createdAtCol,
			balanceBefore: source.balanceBeforeCol,
			balanceAfter: source.balanceAfterCol,
		};
		if (source.roundIdCol) selectCols.roundId = source.roundIdCol;
		if (source.gameIdCol) selectCols.gameCode = source.gameIdCol;

		const row = await db
			.select(selectCols)
			.from(source.table)
			.innerJoin(schema.user, eq(source.userIdCol, schema.user.id))
			.where(eq(source.idCol, id))
			.get();

		if (row) {
			let gameName: string | null = null;
			if (row.gameCode) {
				const [g] = await db
					.select({ name: schema.game.name })
					.from(schema.game)
					.where(eq(schema.game.code, row.gameCode))
					.limit(1);
				gameName = g?.name ?? null;
			}
			const isWin = source.winTypes.includes(row.outcomeType);
			let stakeAmount = row.betAmount;

			if (isWin && source.roundIdCol && row.roundId) {
				const betType =
					source.provider === "Slotegrator" ? "bet" : "BET";
				const [priorBet] = await db
					.select({ amount: source.amountCol })
					.from(source.table)
					.where(
						and(
							eq(source.userIdCol, row.userId),
							eq(source.roundIdCol, row.roundId),
							eq(source.typeCol, betType),
							lt(source.createdAtCol, row.createdAt),
						),
					)
					.orderBy(desc(source.createdAtCol))
					.limit(1);

				if (priorBet) stakeAmount = priorBet.amount;
			}

			return c.json({
				success: true,
				data: {
					id: row.id,
					gameType: "Casino" as const,
					status: row.outcomeType,
					betType: null,
					outcome: mapCasinoOutcome(row.outcomeType),
					stake: formatAmount(stakeAmount),
					potentialWin: null,
					actualPayout: source.winTypes.includes(row.outcomeType)
						? formatAmount(row.betAmount)
						: null,
					profit: source.winTypes.includes(row.outcomeType)
						? formatAmount(row.betAmount - stakeAmount)
						: null,
					totalOdds: null,
					cashedOut: false,
					createdAt: formatDate(row.createdAt),
					settledAt: formatDate(row.createdAt),
					player: {
						id: row.userId,
						name: row.playerName,
						email: row.playerEmail,
						image: row.playerImage,
						mobileNumber: row.playerMobileNumber,
						verified: row.playerVerificationStatus === "verified",
						balanceBefore:
							row.balanceBefore != null
								? formatAmount(row.balanceBefore)
								: null,
						balanceAfter:
							row.balanceAfter != null
								? formatAmount(row.balanceAfter)
								: null,
					},
					provider: source.provider,
					gameName,
					roundId: row.roundId ?? null,
				},
			});
		}
	}

	return c.json({ success: false, error: "Ticket not found", details: null }, 404);
});

export default adminTicketsRoute;
