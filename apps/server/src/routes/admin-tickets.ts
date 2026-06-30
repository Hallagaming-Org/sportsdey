import { OpenAPIHono } from "@hono/zod-openapi";
import { and, desc, eq, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import * as schema from "@/db/schema";
import { requirePermission } from "@/middleware/admin-permissions";
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
	const months = [
		"Jan", "Feb", "Mar", "Apr", "May", "Jun",
		"Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
	];
	const month = months[date.getMonth()];
	const day = date.getDate();
	const year = date.getFullYear();
	const hours = date.getHours();
	const minutes = date.getMinutes().toString().padStart(2, "0");
	const ampm = hours >= 12 ? "pm" : "am";
	const displayHours = hours % 12 || 12;
	return `${month} ${day}, ${year}, ${displayHours}:${minutes} ${ampm}`;
}

function mapSbOutcome(status: string): "Won" | "Active" | "Lost" {
	switch (status) {
		case "won":
			return "Won";
		case "lost":
		case "cancelled":
		case "void":
			return "Lost";
		default:
			return "Active";
	}
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

adminTicketsRoute.get("/tickets", async (c) => {
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
		playerName: string;
		betAmount: number;
		gameType: string;
		outcome: "Won" | "Active" | "Lost";
		createdAt: Date;
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
				playerName: schema.user.name,
				betAmount: schema.sportsbookBet.stake,
				outcome: schema.sportsbookBet.status,
				createdAt: schema.sportsbookBet.createdAt,
			})
			.from(schema.sportsbookBet)
			.innerJoin(
				schema.user,
				eq(schema.sportsbookBet.userId, schema.user.id),
			)
			.where(sbConditions.length > 0 ? and(...sbConditions) : undefined)
			.orderBy(desc(schema.sportsbookBet.createdAt))
			.limit(MAX_PER_SOURCE);

		for (const r of sbResults) {
			const ts = r.createdAt.getTime();
			if (fromBoundary && ts < fromBoundary.getTime()) continue;
			if (toBoundary && ts > toBoundary.getTime()) continue;

			allTickets.push({
				id: r.id,
				playerName: r.playerName,
				betAmount: r.betAmount,
				gameType: "Sportsbook",
				outcome: mapSbOutcome(r.outcome),
				createdAt: r.createdAt,
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
		}> = [
			{
				table: schema.gameTransactions,
				idCol: schema.gameTransactions.id,
				userIdCol: schema.gameTransactions.userId,
				typeCol: schema.gameTransactions.type,
				amountCol: schema.gameTransactions.amount,
				createdAtCol: schema.gameTransactions.createdAt,
			},
			{
				table: schema.thundrTransactions,
				idCol: schema.thundrTransactions.id,
				userIdCol: schema.thundrTransactions.userId,
				typeCol: schema.thundrTransactions.type,
				amountCol: schema.thundrTransactions.amount,
				createdAtCol: schema.thundrTransactions.createdAt,
			},
			{
				table: schema.slotitegrationTransactions,
				idCol: schema.slotitegrationTransactions.id,
				userIdCol: schema.slotitegrationTransactions.userId,
				typeCol: schema.slotitegrationTransactions.type,
				amountCol: schema.slotitegrationTransactions.amount,
				createdAtCol: schema.slotitegrationTransactions.createdAt,
			},
			{
				table: schema.pocketsTransactions,
				idCol: schema.pocketsTransactions.id,
				userIdCol: schema.pocketsTransactions.userId,
				typeCol: schema.pocketsTransactions.type,
				amountCol: schema.pocketsTransactions.amount,
				createdAtCol: schema.pocketsTransactions.createdAt,
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
					playerName: schema.user.name,
					betAmount: source.amountCol,
					outcomeType: source.typeCol,
					createdAt: source.createdAtCol,
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
					playerName: r.playerName,
					betAmount: r.betAmount,
					gameType: "Casino",
					outcome: mapCasinoOutcome(r.outcomeType),
					createdAt: r.createdAt,
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
				playerName: t.playerName,
				betAmount: formatAmount(t.betAmount),
				gameType: t.gameType,
				outcome: t.outcome,
				createdAt: formatDate(t.createdAt),
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
