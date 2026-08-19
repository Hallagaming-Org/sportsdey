import {
	and,
	count,
	desc,
	eq,
	gte,
	like,
	lte,
	notInArray,
	or,
	sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { getSanityClient } from "@/lib/sanity";
import type { CloudflareBindings } from "@/types";
import type { ExportFilters, ExportSource, ExportTable } from "@/types/exports";

type SourceRows = { total: number; table: ExportTable };

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

function snapshotDate(filters: ExportFilters): Date | undefined {
	return dateFilter(filters, "snapshotAt");
}

function formatDate(value: Date | string | null): string {
	if (!value) return "";
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function formatNaira(value: number | null): string {
	return value === null ? "" : `NGN ${(value / 100).toFixed(2)}`;
}

async function admins(
	env: CloudflareBindings,
	filters: ExportFilters,
	offset: number,
	limit: number,
): Promise<SourceRows> {
	const db = drizzle(env.DB, { schema });
	const search = stringFilter(filters, "search");
	const role = stringFilter(filters, "role");
	const fromDate = dateFilter(filters, "fromDate");
	const toDate = dateFilter(filters, "toDate");
	const snapshotAt = snapshotDate(filters);
	const conditions = [];
	if (search) {
		conditions.push(
			or(
				like(schema.admin.name, `%${search}%`),
				like(schema.admin.email, `%${search}%`),
			),
		);
	}
	if (role && role !== "all")
		conditions.push(eq(schema.admin.role, role as never));
	if (fromDate) conditions.push(gte(schema.admin.createdAt, fromDate));
	if (toDate) conditions.push(lte(schema.admin.createdAt, toDate));
	if (snapshotAt) conditions.push(lte(schema.admin.createdAt, snapshotAt));
	const where = conditions.length ? and(...conditions) : undefined;
	const [{ total }] = await db
		.select({ total: count() })
		.from(schema.admin)
		.where(where);
	const rows =
		limit === 0
			? []
			: await db
					.select({
						id: schema.admin.id,
						name: schema.admin.name,
						email: schema.admin.email,
						role: schema.admin.role,
						createdAt: schema.admin.createdAt,
					})
					.from(schema.admin)
					.where(where)
					.orderBy(desc(schema.admin.createdAt), desc(schema.admin.id))
					.limit(limit)
					.offset(offset);
	return {
		total,
		table: {
			headers: ["User ID", "Admin Name", "Email address", "Date added", "Role"],
			rows: rows.map((row) => [
				row.id,
				row.name,
				row.email,
				formatDate(row.createdAt),
				row.role,
			]),
		},
	};
}

async function users(
	env: CloudflareBindings,
	filters: ExportFilters,
	offset: number,
	limit: number,
): Promise<SourceRows> {
	const db = drizzle(env.DB, { schema });
	const search = stringFilter(filters, "search");
	const status = stringFilter(filters, "status");
	const tab = stringFilter(filters, "tab");
	const fromDate = dateFilter(filters, "fromDate");
	const toDate = dateFilter(filters, "toDate");
	const snapshotAt = snapshotDate(filters);
	const conditions = [];
	if (search) {
		conditions.push(
			or(
				like(schema.user.id, `%${search}%`),
				like(schema.user.name, `%${search}%`),
				like(schema.user.email, `%${search}%`),
			),
		);
	}
	if (status && status !== "all")
		conditions.push(eq(schema.user.verificationStatus, status));
	if (tab === "pending")
		conditions.push(eq(schema.user.verificationStatus, "pending_verification"));
	if (tab === "recent")
		conditions.push(
			gte(
				schema.user.createdAt,
				new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
			),
		);
	if (fromDate) conditions.push(gte(schema.user.createdAt, fromDate));
	if (toDate) conditions.push(lte(schema.user.createdAt, toDate));
	if (snapshotAt) conditions.push(lte(schema.user.createdAt, snapshotAt));
	const where = conditions.length ? and(...conditions) : undefined;
	const [{ total }] = await db
		.select({ total: count() })
		.from(schema.user)
		.leftJoin(schema.wallet, eq(schema.wallet.userId, schema.user.id))
		.where(where);
	const rows =
		limit === 0
			? []
			: await db
					.select({
						id: schema.user.id,
						name: schema.user.name,
						email: schema.user.email,
						balance: schema.wallet.balance,
						status: schema.user.verificationStatus,
						suspended: schema.user.suspended,
						createdAt: schema.user.createdAt,
						lastLoginIp: schema.user.lastLoginIp,
					})
					.from(schema.user)
					.leftJoin(schema.wallet, eq(schema.wallet.userId, schema.user.id))
					.where(where)
					.orderBy(desc(schema.user.createdAt), desc(schema.user.id))
					.limit(limit)
					.offset(offset);
	return {
		total,
		table: {
			headers: [
				"User ID",
				"Player Name",
				"Email address",
				"Registration Date",
				"Registration IP",
				"Wallet Balance",
				"Status",
			],
			rows: rows.map((row) => [
				row.id,
				row.name,
				row.email,
				formatDate(row.createdAt),
				row.lastLoginIp ?? "",
				formatNaira(row.balance ?? 0),
				row.suspended ? "Suspended" : row.status,
			]),
		},
	};
}

async function kyc(
	env: CloudflareBindings,
	filters: ExportFilters,
	offset: number,
	limit: number,
): Promise<SourceRows> {
	const db = drizzle(env.DB, { schema });
	const search = stringFilter(filters, "search");
	const status = stringFilter(filters, "status");
	const fromDate = dateFilter(filters, "fromDate");
	const toDate = dateFilter(filters, "toDate");
	const snapshotAt = snapshotDate(filters);
	const conditions = [];
	if (status && status !== "all") conditions.push(eq(schema.kyc.status, status));
	if (search) {
		const searchPattern = `%${search}%`;
		conditions.push(
			or(
				like(schema.user.name, searchPattern),
				like(schema.user.email, searchPattern),
				like(schema.kyc.fullName, searchPattern),
				like(schema.kyc.identificationType, searchPattern),
			),
		);
	}
	if (fromDate) conditions.push(gte(schema.kyc.submittedAt, fromDate));
	if (toDate) conditions.push(lte(schema.kyc.submittedAt, toDate));
	if (snapshotAt) conditions.push(lte(schema.kyc.submittedAt, snapshotAt));
	const where = conditions.length ? and(...conditions) : undefined;
	const frontFile = alias(schema.userFile, "export_kyc_front_file");
	const backFile = alias(schema.userFile, "export_kyc_back_file");
	const [{ total = 0 }] = await db
		.select({ total: count() })
		.from(schema.kyc)
		.innerJoin(schema.user, eq(schema.kyc.userId, schema.user.id))
		.where(where);
	const rows =
		limit === 0
			? []
			: await db
					.select({
						name: schema.user.name,
						identificationType: schema.kyc.identificationType,
						submittedAt: schema.kyc.submittedAt,
						status: schema.kyc.status,
						frontSize: frontFile.size,
						backSize: backFile.size,
						frontMime: frontFile.mimeType,
						backMime: backFile.mimeType,
					})
					.from(schema.kyc)
					.innerJoin(schema.user, eq(schema.kyc.userId, schema.user.id))
					.leftJoin(frontFile, eq(schema.kyc.frontDocumentId, frontFile.id))
					.leftJoin(backFile, eq(schema.kyc.backDocumentId, backFile.id))
					.where(where)
					.orderBy(desc(schema.kyc.submittedAt), desc(schema.kyc.id))
					.limit(limit)
					.offset(offset);
	return {
		total,
		table: {
			headers: ["Player Name", "Document Name", "Size", "Date Uploaded", "Document Type", "Status"],
			rows: rows.map((row) => [
				row.name,
				row.identificationType,
				`${row.frontSize ?? 0} / ${row.backSize ?? 0}`,
				formatDate(row.submittedAt),
				[row.frontMime, row.backMime].filter(Boolean).join(" / "),
				row.status,
			]),
		},
	};
}

async function transactions(
	env: CloudflareBindings,
	filters: ExportFilters,
	offset: number,
	limit: number,
): Promise<SourceRows> {
	const db = drizzle(env.DB, { schema });
	const search = stringFilter(filters, "search");
	const type = stringFilter(filters, "type");
	const status = stringFilter(filters, "status");
	const fromDate = dateFilter(filters, "fromDate");
	const toDate = dateFilter(filters, "toDate");
	const snapshotAt = snapshotDate(filters);
	const conditions = [];
	if (search)
		conditions.push(like(schema.walletTransaction.reference, `%${search}%`));
	if (type === "deposits")
		conditions.push(eq(schema.walletTransaction.type, "credit"));
	if (type === "withdrawals")
		conditions.push(
			and(
				eq(schema.walletTransaction.type, "debit"),
				eq(schema.walletTransaction.paymentMethod, "paystack"),
			),
		);
	if (type === "payments")
		conditions.push(
			and(
				eq(schema.walletTransaction.type, "debit"),
				eq(schema.walletTransaction.paymentMethod, "bill_payment"),
			),
		);
	if (status === "success")
		conditions.push(
			sql`${schema.walletTransaction.status} in ('success', 'completed')`,
		);
	if (status === "pending")
		conditions.push(
			sql`${schema.walletTransaction.status} in ('pending', 'processing')`,
		);
	if (status === "failed")
		conditions.push(eq(schema.walletTransaction.status, "failed"));
	if (status === "refund")
		conditions.push(
			sql`${schema.walletTransaction.status} in ('refund', 'refunded')`,
		);
	if (fromDate)
		conditions.push(gte(schema.walletTransaction.createdAt, fromDate));
	if (toDate) conditions.push(lte(schema.walletTransaction.createdAt, toDate));
	if (snapshotAt)
		conditions.push(lte(schema.walletTransaction.createdAt, snapshotAt));
	const excluded = [
		"slotegrator games",
		"lucky games",
		"lagos rush",
		"thndr games",
		"sportsbook",
	];
	conditions.push(notInArray(schema.walletTransaction.paymentMethod, excluded));
	const transactionWhere = and(...conditions);
	const [{ total }] = await db
		.select({ total: count() })
		.from(schema.walletTransaction)
		.where(transactionWhere);
	const rows =
		limit === 0
			? []
			: await db
					.select({
						id: schema.walletTransaction.id,
						userId: schema.walletTransaction.userId,
						email: schema.user.email,
						amount: schema.walletTransaction.amount,
						type: schema.walletTransaction.type,
						paymentMethod: schema.walletTransaction.paymentMethod,
						balance: schema.walletTransaction.balance,
						status: schema.walletTransaction.status,
						createdAt: schema.walletTransaction.createdAt,
					})
					.from(schema.walletTransaction)
					.leftJoin(
						schema.user,
						eq(schema.user.id, schema.walletTransaction.userId),
					)
					.where(transactionWhere)
					.orderBy(
						desc(schema.walletTransaction.createdAt),
						desc(schema.walletTransaction.id),
					)
					.limit(limit)
					.offset(offset);
	return {
		total,
		table: {
			headers: [
				"Transaction ID",
				"User ID",
				"User Email",
				"Date & Time",
				"Type",
				"Payment Method",
				"Amount",
				"Balance After",
				"Status",
			],
			rows: rows.map((row) => [
				row.id,
				row.userId,
				row.email ?? "Unknown",
				formatDate(row.createdAt),
				row.type === "credit"
					? "Deposit"
					: row.paymentMethod === "bill_payment"
						? "Payment"
						: "Withdrawal",
				row.paymentMethod,
				formatNaira(row.amount),
				formatNaira(row.balance),
				row.status,
			]),
		},
	};
}

async function ticketHistory(
	env: CloudflareBindings,
	filters: ExportFilters,
	offset: number,
	limit: number,
): Promise<SourceRows> {
	const db = drizzle(env.DB, { schema });
	const type = stringFilter(filters, "type") ?? "all";
	const search = stringFilter(filters, "search");
	const fromDate = dateFilter(filters, "fromDate");
	const toDate = dateFilter(filters, "toDate");
	const snapshotAt = snapshotDate(filters);
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
	const sportsbookCount =
		type === "casino"
			? 0
			: (
					await db
						.select({ total: count() })
						.from(schema.sportsbookBet)
						.innerJoin(
							schema.user,
							eq(schema.user.id, schema.sportsbookBet.userId),
						)
						.where(sportsbookWhere)
				)[0].total;
	const sourceLimit = limit === 0 ? 0 : offset + limit;
	const sports =
		type === "casino" || sourceLimit === 0
			? []
			: await db
					.select({
						id: schema.sportsbookBet.id,
						playerName: schema.user.name,
						stake: schema.sportsbookBet.stake,
						odds: schema.sportsbookBet.totalOdds,
						payout: schema.sportsbookBet.settleAmount,
						status: schema.sportsbookBet.status,
						createdAt: schema.sportsbookBet.createdAt,
					})
					.from(schema.sportsbookBet)
					.innerJoin(
						schema.user,
						eq(schema.user.id, schema.sportsbookBet.userId),
					)
					.where(sportsbookWhere)
					.orderBy(
						desc(schema.sportsbookBet.createdAt),
						desc(schema.sportsbookBet.id),
					)
					.limit(sourceLimit);
	const rows: Array<{
		createdAt: Date;
		values: Array<string | number | null>;
	}> = sports.map((row) => ({
		createdAt: row.createdAt,
		values: [
			row.id,
			row.playerName,
			formatNaira(row.stake),
			row.odds ? formatNaira(Math.round(row.stake * Number(row.odds))) : "",
			formatNaira(row.payout),
			"Sportsbook",
			"",
			"",
			"",
			row.odds ?? "",
			formatDate(row.createdAt),
			"",
			"",
			row.status,
		],
	}));
	let casinoTotal = 0;
	if (type !== "sportsbook") {
		const gameNames = new Map(
			(
				await db
					.select({ code: schema.game.code, name: schema.game.name })
					.from(schema.game)
			).map((game) => [game.code, game.name]),
		);
		const inRange = (date: Date) =>
			(!fromDate || date >= fromDate) &&
			(!toDate || date <= toDate) &&
			(!snapshotAt || date <= snapshotAt);
		const matches = (id: string, name: string) =>
			!search ||
			id.toLowerCase().includes(search.toLowerCase()) ||
			name.toLowerCase().includes(search.toLowerCase());

		const casinoSearch = (id: typeof schema.gameTransactions.id) =>
			search
				? or(like(id, `%${search}%`), like(schema.user.name, `%${search}%`))
				: undefined;
		const casinoDates = (createdAt: typeof schema.gameTransactions.createdAt) =>
			and(
				fromDate ? gte(createdAt, fromDate) : undefined,
				toDate ? lte(createdAt, toDate) : undefined,
				snapshotAt ? lte(createdAt, snapshotAt) : undefined,
			);
		const spribeWhere = and(
			casinoSearch(schema.gameTransactions.id),
			casinoDates(schema.gameTransactions.createdAt),
		);
		const thundrWhere = and(
			search
				? or(
						like(schema.thundrTransactions.id, `%${search}%`),
						like(schema.user.name, `%${search}%`),
					)
				: undefined,
			casinoDates(schema.thundrTransactions.createdAt),
		);
		const slotegratorWhere = and(
			search
				? or(
						like(schema.slotitegrationTransactions.id, `%${search}%`),
						like(schema.user.name, `%${search}%`),
					)
				: undefined,
			casinoDates(schema.slotitegrationTransactions.createdAt),
		);
		const pocketsWhere = and(
			search
				? or(
						like(schema.pocketsTransactions.id, `%${search}%`),
						like(schema.user.name, `%${search}%`),
					)
				: undefined,
			casinoDates(schema.pocketsTransactions.createdAt),
		);
		const casinoCounts = await Promise.all([
			db
				.select({ total: count() })
				.from(schema.gameTransactions)
				.innerJoin(
					schema.user,
					eq(schema.user.id, schema.gameTransactions.userId),
				)
				.where(spribeWhere),
			db
				.select({ total: count() })
				.from(schema.thundrTransactions)
				.innerJoin(
					schema.user,
					eq(schema.user.id, schema.thundrTransactions.userId),
				)
				.where(thundrWhere),
			db
				.select({ total: count() })
				.from(schema.slotitegrationTransactions)
				.innerJoin(
					schema.user,
					eq(schema.user.id, schema.slotitegrationTransactions.userId),
				)
				.where(slotegratorWhere),
			db
				.select({ total: count() })
				.from(schema.pocketsTransactions)
				.innerJoin(
					schema.user,
					eq(schema.user.id, schema.pocketsTransactions.userId),
				)
				.where(pocketsWhere),
		]);
		casinoTotal = casinoCounts.reduce(
			(total, result) => total + result[0].total,
			0,
		);

		const spribe =
			sourceLimit === 0
				? []
				: await db
						.select({
							id: schema.gameTransactions.id,
							playerName: schema.user.name,
							amount: schema.gameTransactions.amount,
							outcome: schema.gameTransactions.type,
							createdAt: schema.gameTransactions.createdAt,
							balanceBefore: schema.gameTransactions.balanceBefore,
							balanceAfter: schema.gameTransactions.balanceAfter,
							gameCode: schema.gameTransactions.game,
						})
						.from(schema.gameTransactions)
						.innerJoin(
							schema.user,
							eq(schema.user.id, schema.gameTransactions.userId),
						)
						.where(spribeWhere)
						.orderBy(
							desc(schema.gameTransactions.createdAt),
							desc(schema.gameTransactions.id),
						)
						.limit(sourceLimit);
		for (const row of spribe) {
			if (!inRange(row.createdAt) || !matches(row.id, row.playerName)) continue;
			rows.push({
				createdAt: row.createdAt,
				values: [
					row.id,
					row.playerName,
					formatNaira(row.amount),
					"",
					row.outcome === "WIN" ? formatNaira(row.amount) : "",
					"Casino",
					gameNames.get(row.gameCode) ?? row.gameCode,
					"Spribe",
					"",
					"",
					formatDate(row.createdAt),
					formatNaira(row.balanceBefore),
					formatNaira(row.balanceAfter),
					row.outcome === "WIN" ? "Won" : "Active",
				],
			});
		}

		const thundr =
			sourceLimit === 0
				? []
				: await db
						.select({
							id: schema.thundrTransactions.id,
							playerName: schema.user.name,
							amount: schema.thundrTransactions.amount,
							outcome: schema.thundrTransactions.type,
							createdAt: schema.thundrTransactions.createdAt,
							balanceBefore: schema.thundrTransactions.balanceBefore,
							balanceAfter: schema.thundrTransactions.balanceAfter,
							roundId: schema.thundrTransactions.roundId,
							gameCode: schema.thundrTransactions.gameId,
						})
						.from(schema.thundrTransactions)
						.innerJoin(
							schema.user,
							eq(schema.user.id, schema.thundrTransactions.userId),
						)
						.where(thundrWhere)
						.orderBy(
							desc(schema.thundrTransactions.createdAt),
							desc(schema.thundrTransactions.id),
						)
						.limit(sourceLimit);
		for (const row of thundr) {
			if (!inRange(row.createdAt) || !matches(row.id, row.playerName)) continue;
			rows.push({
				createdAt: row.createdAt,
				values: [
					row.id,
					row.playerName,
					formatNaira(row.amount),
					"",
					row.outcome === "WIN" ? formatNaira(row.amount) : "",
					"Casino",
					gameNames.get(row.gameCode) ?? row.gameCode,
					"Thundr",
					row.roundId,
					"",
					formatDate(row.createdAt),
					formatNaira(row.balanceBefore),
					formatNaira(row.balanceAfter),
					row.outcome === "WIN" ? "Won" : "Active",
				],
			});
		}

		const slotegrator =
			sourceLimit === 0
				? []
				: await db
						.select({
							id: schema.slotitegrationTransactions.id,
							playerName: schema.user.name,
							amount: schema.slotitegrationTransactions.amount,
							outcome: schema.slotitegrationTransactions.type,
							createdAt: schema.slotitegrationTransactions.createdAt,
							balanceBefore: schema.slotitegrationTransactions.balanceBefore,
							balanceAfter: schema.slotitegrationTransactions.balanceAfter,
							roundId: schema.slotitegrationTransactions.roundId,
							gameCode: schema.slotitegrationTransactions.gameId,
						})
						.from(schema.slotitegrationTransactions)
						.innerJoin(
							schema.user,
							eq(schema.user.id, schema.slotitegrationTransactions.userId),
						)
						.where(slotegratorWhere)
						.orderBy(
							desc(schema.slotitegrationTransactions.createdAt),
							desc(schema.slotitegrationTransactions.id),
						)
						.limit(sourceLimit);
		for (const row of slotegrator) {
			if (!inRange(row.createdAt) || !matches(row.id, row.playerName)) continue;
			rows.push({
				createdAt: row.createdAt,
				values: [
					row.id,
					row.playerName,
					formatNaira(row.amount),
					"",
					row.outcome.toLowerCase() === "win" ? formatNaira(row.amount) : "",
					"Casino",
					row.gameCode ? (gameNames.get(row.gameCode) ?? row.gameCode) : "",
					"Slotegrator",
					row.roundId ?? "",
					"",
					formatDate(row.createdAt),
					formatNaira(row.balanceBefore),
					formatNaira(row.balanceAfter),
					row.outcome.toLowerCase() === "win" ? "Won" : "Active",
				],
			});
		}

		const pockets =
			sourceLimit === 0
				? []
				: await db
						.select({
							id: schema.pocketsTransactions.id,
							playerName: schema.user.name,
							amount: schema.pocketsTransactions.amount,
							outcome: schema.pocketsTransactions.type,
							createdAt: schema.pocketsTransactions.createdAt,
							balanceBefore: schema.pocketsTransactions.balanceBefore,
							balanceAfter: schema.pocketsTransactions.balanceAfter,
						})
						.from(schema.pocketsTransactions)
						.innerJoin(
							schema.user,
							eq(schema.user.id, schema.pocketsTransactions.userId),
						)
						.where(pocketsWhere)
						.orderBy(
							desc(schema.pocketsTransactions.createdAt),
							desc(schema.pocketsTransactions.id),
						)
						.limit(sourceLimit);
		for (const row of pockets) {
			if (!inRange(row.createdAt) || !matches(row.id, row.playerName)) continue;
			rows.push({
				createdAt: row.createdAt,
				values: [
					row.id,
					row.playerName,
					formatNaira(row.amount),
					"",
					row.outcome === "CREDIT" ? formatNaira(row.amount) : "",
					"Casino",
					"",
					"Lagos Rush",
					"",
					"",
					formatDate(row.createdAt),
					formatNaira(row.balanceBefore),
					formatNaira(row.balanceAfter),
					row.outcome === "CREDIT" ? "Won" : "Active",
				],
			});
		}
	}
	rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
	const total = sportsbookCount + casinoTotal;
	return {
		total,
		table: {
			headers: [
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
			],
			rows: rows.slice(offset, offset + limit).map((row) => row.values),
		},
	};
}

async function cms(
	env: CloudflareBindings,
	filters: ExportFilters,
	offset: number,
	limit: number,
): Promise<SourceRows> {
	const client = getSanityClient(env);
	const search = stringFilter(filters, "search");
	const type = stringFilter(filters, "type");
	const includeDrafts = filters.includeDrafts === true;
	let condition = '_type == "news"';
	const params: Record<string, unknown> = {};
	if (!includeDrafts) condition += ' && !(_id in path("drafts.**"))';
	if (search) {
		condition += " && (title match $search || author->name match $search)";
		params.search = `*${search}*`;
	}
	if (type && type !== "all") {
		condition +=
			type === "news"
				? ' && (category != "videos" && category != "ads")'
				: " && category == $type";
		if (type !== "news") params.type = type;
	}
	const fromDate = dateFilter(filters, "fromDate");
	const toDate = dateFilter(filters, "toDate");
	const snapshotAt = snapshotDate(filters);
	if (fromDate) {
		condition += " && publishedAt >= $fromDate";
		params.fromDate = fromDate.toISOString();
	}
	if (toDate) {
		condition += " && publishedAt <= $toDate";
		params.toDate = toDate.toISOString();
	}
	if (snapshotAt) {
		condition += " && publishedAt <= $snapshotAt";
		params.snapshotAt = snapshotAt.toISOString();
	}
	const total = await client.fetch<number>(`count(*[${condition}])`, params);
	const rows =
		limit === 0
			? []
			: await client.fetch<
					Array<{
						_id: string;
						title: string;
						publishedAt: string;
						category?: string;
						author?: { name?: string };
					}>
				>(
					`*[${condition}] | order(publishedAt desc, _id desc) [${offset}...${offset + limit}] {_id, title, publishedAt, category, "author": author->{name}}`,
					params,
				);
	return {
		total,
		table: {
			headers: [
				"Content title",
				"Author Name",
				"Type",
				"Date Uploaded",
				"Status",
			],
			rows: rows.map((row) => [
				row.title,
				row.author?.name ?? "",
				row.category === "videos" || row.category === "ads"
					? row.category
					: "news",
				formatDate(row.publishedAt),
				row._id.startsWith("drafts.") ? "pending" : "verified",
			]),
		},
	};
}

export function rowsForSource(
	source: ExportSource,
	env: CloudflareBindings,
	filters: ExportFilters,
	offset: number,
	limit: number,
): Promise<SourceRows> {
	switch (source) {
		case "admins":
			return admins(env, filters, offset, limit);
		case "users":
			return users(env, filters, offset, limit);
		case "transactions":
			return transactions(env, filters, offset, limit);
		case "ticket-history":
			return ticketHistory(env, filters, offset, limit);
		case "cms":
			return cms(env, filters, offset, limit);
		case "kyc":
			return kyc(env, filters, offset, limit);
	}
}
