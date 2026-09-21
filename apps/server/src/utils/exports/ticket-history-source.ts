import { and, count, eq, gte, like, lte, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import type { CloudflareBindings } from "@/types";
import type { ExportFilters, ExportTable } from "@/types/exports";

export const TICKET_EXPORT_HEADERS = [
	"Bet ID",
	"Player Name",
	"Bet Amount",
	"Potential Win",
	"Payout",
	"Game type",
	"Game Name",
	"Provider",
	"Round ID",
	"Odds",
	"Date",
	"Balance Before",
	"Balance After",
	"Status",
] as const;

type TicketExportRow = {
	id: string;
	player_name: string;
	amount: number | null;
	potential_win: number | null;
	payout: number | null;
	game_type: string;
	game_name: string;
	provider: string;
	round_id: string;
	odds: string;
	created_at: number;
	balance_before: number | null;
	balance_after: number | null;
	status: string;
};

function stringFilter(filters: ExportFilters, key: string): string | undefined {
	const value = filters[key];
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function dateFilter(filters: ExportFilters, key: string): Date | undefined {
	const value = stringFilter(filters, key);
	if (!value) return undefined;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDate(value: Date | string | number | null): string {
	if (!value) return "";
	const date =
		value instanceof Date
			? value
			: typeof value === "number"
				? new Date(value)
				: new Date(value);
	return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function formatNaira(value: number | null): string {
	return value === null ? "" : `NGN ${(value / 100).toFixed(2)}`;
}

function pushTicketFilters(
	where: string[],
	binds: unknown[],
	cols: { id: string; name: string; created: string },
	filters: {
		search?: string;
		fromDate?: Date;
		toDate?: Date;
		snapshotAt?: Date;
	},
) {
	if (filters.search) {
		where.push(`(${cols.id} LIKE ? OR ${cols.name} LIKE ?)`);
		const pattern = `%${filters.search}%`;
		binds.push(pattern, pattern);
	}
	if (filters.fromDate) {
		where.push(`${cols.created} >= ?`);
		binds.push(filters.fromDate.getTime());
	}
	if (filters.toDate) {
		where.push(`${cols.created} <= ?`);
		binds.push(filters.toDate.getTime());
	}
	if (filters.snapshotAt) {
		where.push(`${cols.created} <= ?`);
		binds.push(filters.snapshotAt.getTime());
	}
}

function ticketSubquery(
	selectSql: string,
	idCol: string,
	nameCol: string,
	createdCol: string,
	filters: {
		search?: string;
		fromDate?: Date;
		toDate?: Date;
		snapshotAt?: Date;
	},
): { sql: string; binds: unknown[] } {
	const where = ["1=1"];
	const binds: unknown[] = [];
	pushTicketFilters(where, binds, { id: idCol, name: nameCol, created: createdCol }, filters);
	return { sql: `${selectSql} WHERE ${where.join(" AND ")}`, binds };
}

export function buildTicketHistoryPageQuery(input: {
	type: string;
	search?: string;
	fromDate?: Date;
	toDate?: Date;
	snapshotAt?: Date;
	offset: number;
	limit: number;
}): { sql: string; binds: unknown[] } {
	const filters = {
		search: input.search,
		fromDate: input.fromDate,
		toDate: input.toDate,
		snapshotAt: input.snapshotAt,
	};
	const parts: Array<{ sql: string; binds: unknown[] }> = [];
	if (input.type !== "casino") {
		parts.push(
			ticketSubquery(
				`SELECT b.id AS id, u.name AS player_name, b.stake AS amount,
					CASE WHEN b.total_odds_value IS NOT NULL AND TRIM(b.total_odds_value) != ''
						THEN CAST(ROUND(b.stake * CAST(b.total_odds_value AS REAL)) AS INTEGER)
						ELSE NULL END AS potential_win,
					b.settle_amount AS payout, 'Sportsbook' AS game_type, '' AS game_name,
					'' AS provider, '' AS round_id, COALESCE(b.total_odds_value, '') AS odds,
					b.created_at AS created_at, NULL AS balance_before, NULL AS balance_after,
					b.status AS status
				FROM sportsbook_bet b INNER JOIN user u ON u.id = b.user_id`,
				"b.id",
				"u.name",
				"b.created_at",
				filters,
			),
		);
	}
	if (input.type !== "sportsbook") {
		parts.push(
			ticketSubquery(
				`SELECT t.id AS id, u.name AS player_name, t.amount AS amount,
					NULL AS potential_win,
					CASE WHEN t.type = 'WIN' THEN t.amount ELSE NULL END AS payout,
					'Casino' AS game_type,
					CASE LOWER(t.game)
						WHEN 'sportsdey-crash' THEN 'SportsDey Crash'
						WHEN 'spin_and_win' THEN 'Spin and Win'
						ELSE COALESCE(g.name, t.game)
					END AS game_name,
					CASE WHEN LOWER(t.game) IN ('sportsdey-crash', 'spin_and_win')
						THEN 'SportsDey' ELSE 'LuckyWorld' END AS provider,
					COALESCE(t.round_id, '') AS round_id, '' AS odds,
					t.created_at AS created_at, t.balance_before AS balance_before,
					t.balance_after AS balance_after,
					CASE WHEN t.type = 'WIN' THEN 'Won' ELSE 'Active' END AS status
				FROM game_transactions t
				INNER JOIN user u ON u.id = t.user_id
				LEFT JOIN game g ON g.code = t.game`,
				"t.id",
				"u.name",
				"t.created_at",
				filters,
			),
		);
		parts.push(
			ticketSubquery(
				`SELECT t.id AS id, u.name AS player_name, t.amount AS amount,
					NULL AS potential_win,
					CASE WHEN t.type = 'WIN' THEN t.amount ELSE NULL END AS payout,
					'Casino' AS game_type, COALESCE(g.name, t.game_id) AS game_name,
					'Thundr' AS provider, t.round_id AS round_id, '' AS odds,
					t.created_at AS created_at, t.balance_before AS balance_before,
					t.balance_after AS balance_after,
					CASE WHEN t.type = 'WIN' THEN 'Won' ELSE 'Active' END AS status
				FROM thundr_transactions t
				INNER JOIN user u ON u.id = t.user_id
				LEFT JOIN game g ON g.code = t.game_id`,
				"t.id",
				"u.name",
				"t.created_at",
				filters,
			),
		);
		parts.push(
			ticketSubquery(
				`SELECT t.id AS id, u.name AS player_name, t.amount AS amount,
					NULL AS potential_win,
					CASE WHEN LOWER(t.type) = 'win' THEN t.amount ELSE NULL END AS payout,
					'Casino' AS game_type, COALESCE(g.name, t.game_id, '') AS game_name,
					'Slotegrator' AS provider, COALESCE(t.round_id, '') AS round_id, '' AS odds,
					t.created_at AS created_at, t.balance_before AS balance_before,
					t.balance_after AS balance_after,
					CASE WHEN LOWER(t.type) = 'win' THEN 'Won' ELSE 'Active' END AS status
				FROM slotitegration_transactions t
				INNER JOIN user u ON u.id = t.user_id
				LEFT JOIN game g ON g.code = t.game_id`,
				"t.id",
				"u.name",
				"t.created_at",
				filters,
			),
		);
		parts.push(
			ticketSubquery(
				`SELECT t.id AS id, u.name AS player_name, t.amount AS amount,
					NULL AS potential_win,
					CASE WHEN t.type = 'CREDIT' THEN t.amount ELSE NULL END AS payout,
					'Casino' AS game_type,
					CASE LOWER(t.game_code)
						WHEN 'sportsdey-crash' THEN 'SportsDey Crash'
						WHEN 'spin_and_win' THEN 'Spin and Win'
						ELSE ''
					END AS game_name,
					CASE WHEN t.provider = 'hashcodex' THEN 'SportsDey'
						ELSE 'Lagos Rush' END AS provider,
					COALESCE(t.round_id, '') AS round_id, '' AS odds, t.created_at AS created_at,
					t.balance_before AS balance_before, t.balance_after AS balance_after,
					CASE WHEN t.type = 'CREDIT' THEN 'Won' ELSE 'Active' END AS status
				FROM pockets_transactions t
				INNER JOIN user u ON u.id = t.user_id`,
				"t.id",
				"u.name",
				"t.created_at",
				filters,
			),
		);
	}

	const binds = parts.flatMap((part) => part.binds);
	binds.push(input.limit, input.offset);
	return {
		sql: `SELECT * FROM (${parts.map((part) => part.sql).join(" UNION ALL ")}) AS ticket_export
			ORDER BY created_at DESC, id DESC
			LIMIT ? OFFSET ?`,
		binds,
	};
}

function toTableRows(rows: TicketExportRow[]): ExportTable["rows"] {
	return rows.map((row) => [
		row.id,
		row.player_name,
		formatNaira(row.amount),
		row.potential_win === null ? "" : formatNaira(row.potential_win),
		formatNaira(row.payout),
		row.game_type,
		row.game_name,
		row.provider,
		row.round_id,
		row.odds,
		formatDate(row.created_at),
		formatNaira(row.balance_before),
		formatNaira(row.balance_after),
		row.status,
	]);
}

export async function ticketHistoryRows(
	env: CloudflareBindings,
	filters: ExportFilters,
	offset: number,
	limit: number,
	options: { skipCount?: boolean } = {},
): Promise<{ total: number; table: ExportTable }> {
	const db = drizzle(env.DB, { schema });
	const type = stringFilter(filters, "type") ?? "all";
	const search = stringFilter(filters, "search");
	const fromDate = dateFilter(filters, "fromDate");
	const toDate = dateFilter(filters, "toDate");
	const snapshotAt = dateFilter(filters, "snapshotAt");
	const conditions = [];
	if (search)
		conditions.push(
			or(
				like(schema.sportsbookBet.id, `%${search}%`),
				like(schema.user.name, `%${search}%`),
			),
		);
	if (fromDate) conditions.push(gte(schema.sportsbookBet.createdAt, fromDate));
	if (toDate) conditions.push(lte(schema.sportsbookBet.createdAt, toDate));
	if (snapshotAt)
		conditions.push(lte(schema.sportsbookBet.createdAt, snapshotAt));
	const sportsbookWhere = conditions.length ? and(...conditions) : undefined;

	let total = 0;
	if (!options.skipCount) {
		const casinoSearch = (id: typeof schema.gameTransactions.id) =>
			search
				? or(like(id, `%${search}%`), like(schema.user.name, `%${search}%`))
				: undefined;
		const casinoDates = (
			createdAt: typeof schema.gameTransactions.createdAt,
		) =>
			and(
				fromDate ? gte(createdAt, fromDate) : undefined,
				toDate ? lte(createdAt, toDate) : undefined,
				snapshotAt ? lte(createdAt, snapshotAt) : undefined,
			);
		const [sportsbookCount, ...casinoCounts] = await Promise.all([
			type === "casino"
				? Promise.resolve([{ total: 0 }])
				: db
						.select({ total: count() })
						.from(schema.sportsbookBet)
						.innerJoin(
							schema.user,
							eq(schema.user.id, schema.sportsbookBet.userId),
						)
						.where(sportsbookWhere),
			...(type === "sportsbook"
				? [
						Promise.resolve([{ total: 0 }]),
						Promise.resolve([{ total: 0 }]),
						Promise.resolve([{ total: 0 }]),
						Promise.resolve([{ total: 0 }]),
					]
				: [
						db
							.select({ total: count() })
							.from(schema.gameTransactions)
							.innerJoin(
								schema.user,
								eq(schema.user.id, schema.gameTransactions.userId),
							)
							.where(
								and(
									casinoSearch(schema.gameTransactions.id),
									casinoDates(schema.gameTransactions.createdAt),
								),
							),
						db
							.select({ total: count() })
							.from(schema.thundrTransactions)
							.innerJoin(
								schema.user,
								eq(schema.user.id, schema.thundrTransactions.userId),
							)
							.where(
								and(
									search
										? or(
												like(schema.thundrTransactions.id, `%${search}%`),
												like(schema.user.name, `%${search}%`),
											)
										: undefined,
									casinoDates(schema.thundrTransactions.createdAt),
								),
							),
						db
							.select({ total: count() })
							.from(schema.slotitegrationTransactions)
							.innerJoin(
								schema.user,
								eq(schema.user.id, schema.slotitegrationTransactions.userId),
							)
							.where(
								and(
									search
										? or(
												like(
													schema.slotitegrationTransactions.id,
													`%${search}%`,
												),
												like(schema.user.name, `%${search}%`),
											)
										: undefined,
									casinoDates(schema.slotitegrationTransactions.createdAt),
								),
							),
						db
							.select({ total: count() })
							.from(schema.pocketsTransactions)
							.innerJoin(
								schema.user,
								eq(schema.user.id, schema.pocketsTransactions.userId),
							)
							.where(
								and(
									search
										? or(
												like(schema.pocketsTransactions.id, `%${search}%`),
												like(schema.user.name, `%${search}%`),
											)
										: undefined,
									casinoDates(schema.pocketsTransactions.createdAt),
								),
							),
					]),
		]);
		total =
			(sportsbookCount[0]?.total ?? 0) +
			casinoCounts.reduce((sum, result) => sum + (result[0]?.total ?? 0), 0);
	}

	if (limit === 0) {
		return {
			total,
			table: { headers: [...TICKET_EXPORT_HEADERS], rows: [] },
		};
	}

	const page = buildTicketHistoryPageQuery({
		type,
		search,
		fromDate,
		toDate,
		snapshotAt,
		offset,
		limit,
	});
	const result = await env.DB.prepare(page.sql)
		.bind(...page.binds)
		.all<TicketExportRow>();

	return {
		total,
		table: {
			headers: [...TICKET_EXPORT_HEADERS],
			rows: toTableRows(result.results ?? []),
		},
	};
}
