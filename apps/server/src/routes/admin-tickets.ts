import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
	and,
	count,
	desc,
	eq,
	gte,
	inArray,
	like,
	lt,
	lte,
	or,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import * as schema from "@/db/schema";
import { requirePermission } from "@/middleware/admin-permissions";
import { ErrorResponseSchema, successResponseSchema } from "@/schemas";
import { parseQueryDateRange } from "@/utils";
import { fetchWithTimeout } from "@/utils/fetch-with-timeout";
import { getFixtureTitlesByIds, matchDisplayName } from "@/utils/fixtures";
import type { CloudflareBindings } from "../types";

const adminTicketsRoute = new OpenAPIHono<{
	Bindings: CloudflareBindings;
}>();

/** Safety cap for unpaginated list responses (Workers memory / response size). */
const MAX_UNPAGINATED_ROWS = 10_000;

function formatAmount(amount: number): string {
	return `₦${(amount / 100).toLocaleString("en-NG")}`;
}

/** Prefer accept-event balances (real debit); fall back to place/freeze when not yet accepted. */
function pickSportsbookEventBalances(
	events: Array<{
		eventType: string;
		balanceBefore: number | null;
		balanceAfter: number | null;
	}>,
): { balanceBefore: number | null; balanceAfter: number | null } {
	const accept = events.find((e) => e.eventType === "accept");
	if (accept) {
		return {
			balanceBefore: accept.balanceBefore,
			balanceAfter: accept.balanceAfter,
		};
	}
	const place = events.find((e) => e.eventType === "place");
	const fallback = place ?? events[0];
	return {
		balanceBefore: fallback?.balanceBefore ?? null,
		balanceAfter: fallback?.balanceAfter ?? null,
	};
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

function mapCasinoOutcome(
	type: string,
): "Won" | "Active" | "Lost" | "Declined" {
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

const TicketsDataSchema = z
	.object({
		tickets: z.array(TicketSchema),
		pagination: z.object({
			page: z.number(),
			limit: z.number(),
			total: z.number(),
			totalPages: z.number(),
		}),
	})
	.openapi("TicketsData");

const TicketsQuerySchema = z.object({
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
	page: z
		.string()
		.optional()
		.openapi({ description: "Page number (default 1)" }),
	limit: z
		.string()
		.optional()
		.openapi({ description: "Items per page (default 10, max 100)" }),
});

const GetUserTicketsParamsSchema = z.object({
	userId: z.string().openapi({ description: "User ID", example: "usr_xyz789" }),
});

const GetUserTicketsQuerySchema = z.object({
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
	id: z
		.string()
		.openapi({ description: "Ticket (bet) ID", example: "bet_abc123" }),
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

const BetBuilderSelectionSchema = z
	.object({
		matchId: z.string().nullable().openapi({ example: "1:1" }),
		match: z.string().openapi({ example: "Arsenal vs Chelsea" }),
		ratio: z.string().nullable().openapi({ example: "1.6" }),
		status: z.number().nullable().openapi({ example: 1 }),
		legs: z.array(TicketSelectionSchema).openapi({
			description: "Individual odds combined within this bet builder group",
		}),
	})
	.openapi("BetBuilderSelection");

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
		betBuilderSelections: z.array(BetBuilderSelectionSchema).optional(),
		provider: z.string().nullable().optional(),
		gameName: z.string().nullable().optional(),
		multiplier: z.string().nullable().optional(),
		betTime: z.string().nullable().optional(),
		sessionId: z.string().nullable().optional(),
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
		"Paginated tickets across sportsbook and casino. Use GET /admin/tickets/all for the full unpaginated set.",
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
		"Retrieve all tickets for a specific user across sportsbook and casino (no pagination, capped at 10,000). Supports filtering by type and date range.",
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

const handleGetTicketsList = async (
	c: Parameters<Parameters<typeof adminTicketsRoute.openapi>[1]>[0],
) => {
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
	const rawType = url.searchParams.get("type") || "all";
	const fromDate = url.searchParams.get("fromDate") || undefined;
	const toDate = url.searchParams.get("toDate") || undefined;
	const search = url.searchParams.get("search") || undefined;

	const unpaginated =
		c.req.path.endsWith("/tickets/all") || c.req.path.endsWith("/tickets/all/");
	const page = Math.max(
		1,
		Number.parseInt(url.searchParams.get("page") || "1", 10) || 1,
	);
	const parsedLimit = Number.parseInt(
		url.searchParams.get("limit") || "10",
		10,
	);
	const limit = Math.min(
		100,
		Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 10),
	);
	const perSourceLimit = unpaginated
		? MAX_UNPAGINATED_ROWS
		: Math.min(MAX_UNPAGINATED_ROWS, page * limit);
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
	let listTotal = 0;

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

		if (!unpaginated) {
			if (fromBoundary) {
				sbConditions.push(gte(schema.sportsbookBet.createdAt, fromBoundary));
			}
			if (toBoundary) {
				sbConditions.push(lte(schema.sportsbookBet.createdAt, toBoundary));
			}
		}

		const sbWhere = sbConditions.length > 0 ? and(...sbConditions) : undefined;

		if (unpaginated) {
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
					eventType: schema.sportsbookBetEvent.eventType,
					balanceBefore: schema.sportsbookBetEvent.balanceBefore,
					balanceAfter: schema.sportsbookBetEvent.balanceAfter,
				})
				.from(schema.sportsbookBet)
				.innerJoin(schema.user, eq(schema.sportsbookBet.userId, schema.user.id))
				.leftJoin(
					schema.sportsbookBetEvent,
					eq(schema.sportsbookBet.id, schema.sportsbookBetEvent.betId),
				)
				.where(sbWhere)
				.orderBy(desc(schema.sportsbookBet.createdAt))
				.limit(perSourceLimit);

			const eventsByBetId = new Map<
				string,
				Array<{
					eventType: string;
					balanceBefore: number | null;
					balanceAfter: number | null;
				}>
			>();
			const betRows = new Map<(typeof sbResults)[number]["id"], (typeof sbResults)[number]>();
			for (const r of sbResults) {
				if (!betRows.has(r.id)) betRows.set(r.id, r);
				if (r.eventType == null) continue;
				const list = eventsByBetId.get(r.id) ?? [];
				list.push({
					eventType: r.eventType,
					balanceBefore: r.balanceBefore,
					balanceAfter: r.balanceAfter,
				});
				eventsByBetId.set(r.id, list);
			}

			for (const r of betRows.values()) {
				const ts = r.createdAt.getTime();
				if (fromBoundary && ts < fromBoundary.getTime()) continue;
				if (toBoundary && ts > toBoundary.getTime()) continue;

				const balances = pickSportsbookEventBalances(
					eventsByBetId.get(r.id) ?? [],
				);

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
					balanceBefore: balances.balanceBefore,
					balanceAfter: balances.balanceAfter,
					roundId: null,
					provider: null,
					gameCode: null,
				});
			}
		} else {
			const [sbCountRow, sbResults] = await Promise.all([
				db
					.select({ total: count() })
					.from(schema.sportsbookBet)
					.innerJoin(
						schema.user,
						eq(schema.sportsbookBet.userId, schema.user.id),
					)
					.where(sbWhere)
					.then((rows) => rows[0]),
				db
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
					})
					.from(schema.sportsbookBet)
					.innerJoin(
						schema.user,
						eq(schema.sportsbookBet.userId, schema.user.id),
					)
					.where(sbWhere)
					.orderBy(desc(schema.sportsbookBet.createdAt))
					.limit(perSourceLimit),
			]);
			listTotal += Number(sbCountRow?.total ?? 0);

			const betIds = sbResults.map((r) => r.id);
			const eventsByBetId = new Map<
				string,
				Array<{
					eventType: string;
					balanceBefore: number | null;
					balanceAfter: number | null;
				}>
			>();
			if (betIds.length > 0) {
				const eventRows = await db
					.select({
						betId: schema.sportsbookBetEvent.betId,
						eventType: schema.sportsbookBetEvent.eventType,
						balanceBefore: schema.sportsbookBetEvent.balanceBefore,
						balanceAfter: schema.sportsbookBetEvent.balanceAfter,
					})
					.from(schema.sportsbookBetEvent)
					.where(inArray(schema.sportsbookBetEvent.betId, betIds));
				for (const event of eventRows) {
					const list = eventsByBetId.get(event.betId) ?? [];
					list.push({
						eventType: event.eventType,
						balanceBefore: event.balanceBefore,
						balanceAfter: event.balanceAfter,
					});
					eventsByBetId.set(event.betId, list);
				}
			}

			for (const r of sbResults) {
				const balances = pickSportsbookEventBalances(
					eventsByBetId.get(r.id) ?? [],
				);
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
					balanceBefore: balances.balanceBefore,
					balanceAfter: balances.balanceAfter,
					roundId: null,
					provider: null,
					gameCode: null,
				});
			}
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
				provider: "ISCRASH",
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

			if (!unpaginated) {
				if (fromBoundary) {
					casConditions.push(gte(source.createdAtCol, fromBoundary));
				}
				if (toBoundary) {
					casConditions.push(lte(source.createdAtCol, toBoundary));
				}
			}

			const casWhere =
				casConditions.length > 0 ? and(...casConditions) : undefined;

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
				.where(casWhere)
				.orderBy(desc(source.createdAtCol))
				.limit(perSourceLimit);

			if (!unpaginated) {
				const [casCountRow] = await db
					.select({ total: count() })
					.from(source.table)
					.innerJoin(schema.user, eq(source.userIdCol, schema.user.id))
					.where(casWhere);
				listTotal += Number(casCountRow?.total ?? 0);
			}

			for (const r of results) {
				if (unpaginated) {
					const ts = r.createdAt.getTime();
					if (fromBoundary && ts < fromBoundary.getTime()) continue;
					if (toBoundary && ts > toBoundary.getTime()) continue;
				}

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

	const rowsForNames = unpaginated
		? allTickets.slice(0, MAX_UNPAGINATED_ROWS)
		: allTickets.slice((page - 1) * limit, page * limit);

	// Resolve game names with chunked IN queries — one query per 100 unique
	// codes instead of one per row.
	const gameNameByCode = new Map<string, string | null>();
	const uniqueGameCodes = [
		...new Set(
			rowsForNames
				.map((t) => t.gameCode)
				.filter((code): code is string => Boolean(code)),
		),
	];
	const GAME_CODE_CHUNK = 100;
	for (let i = 0; i < uniqueGameCodes.length; i += GAME_CODE_CHUNK) {
		const chunk = uniqueGameCodes.slice(i, i + GAME_CODE_CHUNK);
		const rows = await db
			.select({ code: schema.game.code, name: schema.game.name })
			.from(schema.game)
			.where(inArray(schema.game.code, chunk));
		for (const row of rows) {
			gameNameByCode.set(row.code, row.name ?? null);
		}
	}

	const ticketsWithNames = rowsForNames.map((t) => {
		const gameName = t.gameCode
			? (gameNameByCode.get(t.gameCode) ?? null)
			: null;
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
	});

	if (unpaginated) {
		return c.json({
			success: true,
			data: paginateTicketRows(ticketsWithNames, url, true),
		});
	}

	const totalPages = Math.max(1, Math.ceil(listTotal / limit) || 1);
	return c.json({
		success: true,
		data: {
			tickets: ticketsWithNames,
			pagination: {
				page,
				limit,
				total: listTotal,
				totalPages,
			},
		},
	});
};

const getTicketsAllRoute = createRoute({
	method: "get",
	path: "/tickets/all",
	tags: ["Admin - Tickets"],
	summary: "Get every ticket (unpaginated)",
	description:
		"New endpoint: full ticket list in one response (capped at 10,000). Does not change GET /admin/tickets, which stays paginated.",
	security: [{ BearerAuth: [] }],
	request: {
		query: TicketsQuerySchema.omit({ page: true, limit: true }),
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

function paginateTicketRows(
	tickets: Array<Record<string, unknown>>,
	url: URL,
	unpaginated: boolean,
) {
	const total = tickets.length;
	if (unpaginated) {
		return {
			tickets,
			pagination: {
				page: 1,
				limit: total,
				total,
				totalPages: 1,
			},
		};
	}
	const page = Math.max(
		1,
		Number.parseInt(url.searchParams.get("page") || "1", 10) || 1,
	);
	const parsedLimit = Number.parseInt(
		url.searchParams.get("limit") || "10",
		10,
	);
	const limit = Math.min(
		100,
		Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 10),
	);
	const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
	return {
		tickets: tickets.slice((page - 1) * limit, page * limit),
		pagination: { page, limit, total, totalPages },
	};
}

adminTicketsRoute.openapi(getTicketsRoute, handleGetTicketsList);
adminTicketsRoute.openapi(getTicketsAllRoute, handleGetTicketsList);

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
	const rawType = url.searchParams.get("type") || "all";
	const fromDate = url.searchParams.get("fromDate") || undefined;
	const toDate = url.searchParams.get("toDate") || undefined;

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
				eventType: schema.sportsbookBetEvent.eventType,
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
			.limit(MAX_UNPAGINATED_ROWS);

		const eventsByBetId = new Map<
			string,
			Array<{
				eventType: string;
				balanceBefore: number | null;
				balanceAfter: number | null;
			}>
		>();
		const betRows = new Map<(typeof sbResults)[number]["id"], (typeof sbResults)[number]>();
		for (const r of sbResults) {
			if (!betRows.has(r.id)) betRows.set(r.id, r);
			if (r.eventType == null) continue;
			const list = eventsByBetId.get(r.id) ?? [];
			list.push({
				eventType: r.eventType,
				balanceBefore: r.balanceBefore,
				balanceAfter: r.balanceAfter,
			});
			eventsByBetId.set(r.id, list);
		}

		for (const r of betRows.values()) {
			const ts = r.createdAt.getTime();
			if (fromBoundary && ts < fromBoundary.getTime()) continue;
			if (toBoundary && ts > toBoundary.getTime()) continue;

			const balances = pickSportsbookEventBalances(
				eventsByBetId.get(r.id) ?? [],
			);

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
				balanceBefore: balances.balanceBefore,
				balanceAfter: balances.balanceAfter,
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
				.limit(MAX_UNPAGINATED_ROWS);

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

	const capped = allTickets.slice(0, MAX_UNPAGINATED_ROWS);

	const gameNameByCode = new Map<string, string | null>();
	const uniqueGameCodes = [
		...new Set(
			capped
				.map((t) => t.gameCode)
				.filter((code): code is string => Boolean(code)),
		),
	];
	const GAME_CODE_CHUNK = 100;
	for (let i = 0; i < uniqueGameCodes.length; i += GAME_CODE_CHUNK) {
		const chunk = uniqueGameCodes.slice(i, i + GAME_CODE_CHUNK);
		const rows = await db
			.select({ code: schema.game.code, name: schema.game.name })
			.from(schema.game)
			.where(inArray(schema.game.code, chunk));
		for (const row of rows) {
			gameNameByCode.set(row.code, row.name ?? null);
		}
	}

	const ticketsWithNames = capped.map((t) => {
		const gameName = t.gameCode
			? (gameNameByCode.get(t.gameCode) ?? null)
			: null;
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
	});

	return c.json({
		success: true,
		data: {
			tickets: ticketsWithNames,
			pagination: {
				page: 1,
				limit: ticketsWithNames.length,
				total: ticketsWithNames.length,
				totalPages: 1,
			},
		},
	});
});

adminTicketsRoute.openapi(getTicketByIdRoute, async (c) => {
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

		const wasCashedOut = events.some(
			(e) => e.eventType === "cash_out_accepted",
		);
		const balanceBefore = events[0]?.balanceBefore ?? null;
		const balanceAfter = events[events.length - 1]?.balanceAfter ?? null;

		let rawSelections: Array<Record<string, any>> = [];
		let rawBetBuilderOdds: Array<Record<string, any>> = [];
		let rawBetData: any = null;
		try {
			if (bet.betData) {
				rawBetData = JSON.parse(bet.betData);

				if (rawBetData && Array.isArray(rawBetData.bet_odds)) {
					rawSelections = rawBetData.bet_odds;
				}

				if (rawBetData && Array.isArray(rawBetData.bet_builder_odds)) {
					rawBetBuilderOdds = rawBetData.bet_builder_odds;
				}

				console.log(
					`[getTicketById] Found ${rawSelections.length} selections, ${rawBetBuilderOdds.length} bet builder odds`,
				);
			}
		} catch (error) {
			console.error("[getTicketById] Failed to parse betData:", error);
			rawSelections = [];
			rawBetBuilderOdds = [];
		}

		const regularMatchIds = rawSelections
			.map((s) => s.match_id)
			.filter(Boolean);
		const builderGroupMatchIds = rawBetBuilderOdds
			.map((b) => b.match_id)
			.filter(Boolean);
		const builderLegMatchIds = rawBetBuilderOdds.flatMap((b) =>
			Array.isArray(b.odds)
				? b.odds.map((o: any) => o.match_id).filter(Boolean)
				: [],
		);

		const sportEventIds = Array.from(
			new Set([
				...regularMatchIds,
				...builderGroupMatchIds,
				...builderLegMatchIds,
			]),
		) as string[];

		const titleById = await getFixtureTitlesByIds(c.env, sportEventIds);

		const selections = rawSelections.map((s) => {
			const matchId = s.match_id;
			const title = matchId ? titleById.get(matchId) : undefined;

			return {
				matchId: matchId ?? null,
				match: matchDisplayName(title, matchId),
				marketId: s.market_id ?? null,
				oddId: s.odd_id ?? null,
				odds: s.odd_ratio ?? null,
				oddStatus: s.odd_status ?? null,
			};
		});

		const betBuilderSelections = rawBetBuilderOdds.map((builder) => {
			const groupMatchId = builder.match_id;
			const groupTitle = groupMatchId ? titleById.get(groupMatchId) : undefined;

			const legs = Array.isArray(builder.odds)
				? builder.odds.map((o: any) => {
						const legMatchId = o.match_id;
						const legTitle = legMatchId ? titleById.get(legMatchId) : undefined;
						return {
							matchId: legMatchId ?? null,
							match: matchDisplayName(legTitle, legMatchId),
							marketId: o.market_id ?? null,
							oddId: o.odd_id ?? null,
							odds: o.odd_ratio ?? null,
							oddStatus: o.odd_status ?? null,
						};
					})
				: [];

			return {
				matchId: groupMatchId ?? null,
				match: matchDisplayName(groupTitle, groupMatchId),
				ratio: builder.ratio ?? null,
				status: builder.status ?? null,
				legs,
			};
		});

		const totalOddsNum = bet.totalOdds
			? Number.parseFloat(bet.totalOdds)
			: null;
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
				potentialWin:
					potentialWin != null ? formatAmount(Math.round(potentialWin)) : null,
				actualPayout: actualPayout != null ? formatAmount(actualPayout) : null,
				profit: profit != null ? formatAmount(profit) : null,
				totalOdds: bet.totalOdds,
				cashedOut: wasCashedOut,
				createdAt: formatDate(bet.createdAt),
				settledAt:
					bet.status !== "created" && bet.status !== "accepted"
						? formatDate(bet.updatedAt)
						: null,
				player: {
					id: bet.userId,
					name: bet.playerName,
					email: bet.playerEmail,
					image: bet.playerImage,
					mobileNumber: bet.playerMobileNumber,
					verified: bet.playerVerificationStatus === "verified",
					balanceBefore:
						balanceBefore != null ? formatAmount(balanceBefore) : null,
					balanceAfter:
						balanceAfter != null ? formatAmount(balanceAfter) : null,
				},
				selections,
				betBuilderSelections,
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
		sessionTokenCol: any;
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
			sessionTokenCol: schema.gameTransactions.sessionToken,
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
			sessionTokenCol: schema.thundrTransactions.sessionId,
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
			sessionTokenCol: schema.slotitegrationTransactions.sessionId,
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
			sessionTokenCol: null,
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
			sessionToken: source.sessionTokenCol,
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
				const betType = source.provider === "Slotegrator" ? "bet" : "BET";
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
					multiplier:
						isWin && stakeAmount > 0
							? `${(row.betAmount / stakeAmount).toFixed(2)}x`
							: null,
					totalOdds: null,
					cashedOut: false,
					betTime: formatDate(betCreatedAt ?? row.createdAt),
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
							row.balanceAfter != null ? formatAmount(row.balanceAfter) : null,
					},
					provider: source.provider,
					gameName,
					roundId: row.roundId ?? null,
					sessionId: row.sessionToken ?? null,
				},
			});
		}
	}

	return c.json(
		{ success: false, error: "Ticket not found", details: null },
		404,
	);
});

export default adminTicketsRoute;
