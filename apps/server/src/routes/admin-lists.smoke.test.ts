import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import adminRoute from "./admin";
import adminActivityRoute from "./admin-activity";
import adminTicketsRoute from "./admin-tickets";
import userRoute from "./user";
import { recordActivityForSession } from "@/utils/admin-activity-log";

const ADMIN_TOKEN = "admin-list-smoke-token";
const USER_ID = "admin-list-smoke-user";
const NOW = Date.now();

type SqliteDb = DatabaseSync;

class MemoryD1Statement {
	constructor(
		private readonly sqlite: SqliteDb,
		private readonly sql: string,
		private readonly params: unknown[] = [],
	) {}

	bind(...params: unknown[]) {
		return new MemoryD1Statement(
			this.sqlite,
			this.sql,
			params.map((value) => (value === undefined ? null : value)),
		);
	}

	async all() {
		const statement = this.sqlite.prepare(this.sql);
		const results = statement.all(...this.params) as Record<string, unknown>[];
		return { results, success: true as const };
	}

	async run() {
		const statement = this.sqlite.prepare(this.sql);
		const info = statement.run(...this.params);
		return {
			success: true as const,
			meta: {
				changes: info.changes,
				last_row_id: Number(info.lastInsertRowid),
			},
		};
	}

	async raw() {
		const statement = this.sqlite.prepare(this.sql);
		const rows = statement.all(...this.params) as Record<string, unknown>[];
		const columns = statement.columns().map((column) => column.name);
		return rows.map((row) => columns.map((name) => row[name]));
	}

	async first() {
		const { results } = await this.all();
		return results[0] ?? null;
	}
}

class MemoryD1 {
	constructor(private readonly sqlite: SqliteDb) {}

	prepare(sql: string) {
		return new MemoryD1Statement(this.sqlite, sql);
	}

	async batch(statements: MemoryD1Statement[]) {
		const results = [];
		for (const statement of statements) {
			results.push(await statement.all());
		}
		return results;
	}
}

function createListEnv() {
	const sqlite = new DatabaseSync(":memory:");
	sqlite.exec(`
		CREATE TABLE user (
			id text PRIMARY KEY NOT NULL,
			name text NOT NULL,
			email text NOT NULL UNIQUE,
			email_verified integer NOT NULL DEFAULT 0,
			image text,
			country text,
			mobile_number text,
			created_at integer NOT NULL DEFAULT 0,
			updated_at integer NOT NULL DEFAULT 0,
			verification_status text NOT NULL DEFAULT 'not_verified',
			suspended integer NOT NULL DEFAULT 0,
			last_login_ip text,
			profile_self_edited_at integer,
			dob text
		);
		CREATE TABLE admin (
			id text PRIMARY KEY NOT NULL,
			email text NOT NULL UNIQUE,
			password_hash text NOT NULL,
			name text NOT NULL,
			mobile_number text,
			image text,
			role text NOT NULL DEFAULT 'admin',
			permissions text,
			created_at integer NOT NULL DEFAULT 0,
			updated_at integer NOT NULL DEFAULT 0
		);
		CREATE TABLE admin_session (
			id text PRIMARY KEY NOT NULL,
			expires_at integer NOT NULL,
			token text NOT NULL UNIQUE,
			created_at integer NOT NULL DEFAULT 0,
			updated_at integer NOT NULL DEFAULT 0,
			last_active_at integer,
			ip_address text,
			user_agent text,
			device_name text,
			browser text,
			admin_id text NOT NULL
		);
		CREATE TABLE admin_activity_log (
			id text PRIMARY KEY NOT NULL,
			admin_id text NOT NULL,
			admin_name text NOT NULL,
			admin_email text NOT NULL,
			admin_role text NOT NULL,
			action text NOT NULL,
			target_user_id text,
			target_user_name text,
			target_user_email text,
			target_user_username text,
			details text,
			session_id text,
			ip_address text,
			device text,
			browser text,
			created_at integer NOT NULL DEFAULT 0
		);
		CREATE TABLE wallet_transaction (
			id text PRIMARY KEY NOT NULL,
			user_id text NOT NULL,
			amount integer NOT NULL,
			type text NOT NULL,
			reference text UNIQUE,
			status text NOT NULL,
			payment_method text NOT NULL DEFAULT 'card',
			recipient_wallet_id text,
			recipient_name text,
			balance integer,
			metadata text,
			created_at integer NOT NULL DEFAULT 0
		);
		CREATE TABLE sportsbook_bet (
			id text PRIMARY KEY NOT NULL,
			request_id text UNIQUE,
			user_id text NOT NULL,
			stake integer NOT NULL,
			total_odds_value text,
			bet_type integer,
			bet_freebet_id text,
			bet_boost_id text,
			status text NOT NULL,
			settle_amount integer,
			settle_type integer,
			bet_data text,
			cash_out_order_ids text,
			created_at integer NOT NULL DEFAULT 0,
			updated_at integer NOT NULL DEFAULT 0
		);
		CREATE TABLE sportsbook_bet_event (
			id text PRIMARY KEY NOT NULL,
			bet_id text NOT NULL,
			request_id text UNIQUE,
			event_type text NOT NULL,
			event_data text,
			balance_before integer,
			balance_after integer,
			created_at integer NOT NULL DEFAULT 0
		);
		CREATE TABLE game_transactions (
			id text PRIMARY KEY NOT NULL,
			user_id text NOT NULL,
			provider_tx_id text NOT NULL UNIQUE,
			type text NOT NULL,
			amount integer NOT NULL,
			balance_before integer,
			balance_after integer,
			session_token text NOT NULL,
			game text NOT NULL,
			round_id text,
			created_at integer NOT NULL DEFAULT 0
		);
		CREATE TABLE thundr_transactions (
			id text PRIMARY KEY NOT NULL,
			transaction_id text NOT NULL UNIQUE,
			user_id text NOT NULL,
			type text NOT NULL,
			amount integer NOT NULL,
			balance_before integer,
			balance_after integer,
			round_id text NOT NULL,
			game_id text NOT NULL,
			session_id text NOT NULL,
			original_transaction_id text,
			created_at integer NOT NULL DEFAULT 0
		);
		CREATE TABLE slotitegration_transactions (
			id text PRIMARY KEY NOT NULL,
			transaction_id text NOT NULL UNIQUE,
			user_id text NOT NULL,
			type text NOT NULL,
			amount integer NOT NULL,
			balance_before integer,
			balance_after integer,
			currency text NOT NULL,
			round_id text,
			game_id text,
			session_id text NOT NULL,
			original_transaction_id text,
			created_at integer NOT NULL DEFAULT 0
		);
		CREATE TABLE pockets_transactions (
			id text PRIMARY KEY NOT NULL,
			user_id text NOT NULL,
			type text NOT NULL,
			amount integer NOT NULL,
			balance_before integer,
			balance_after integer,
			currency text NOT NULL,
			provider text,
			game_code text,
			round_id text,
			created_at integer NOT NULL DEFAULT 0
		);
		CREATE TABLE scorpio_transactions (
			id text PRIMARY KEY NOT NULL,
			transaction_id text NOT NULL UNIQUE,
			reference_id text,
			user_id text NOT NULL,
			type text NOT NULL,
			amount integer NOT NULL,
			balance_before integer,
			balance_after integer,
			round_id text NOT NULL,
			provider_id integer,
			game_code text,
			currency text NOT NULL,
			created_at integer NOT NULL DEFAULT 0
		);
		CREATE TABLE game (
			id text PRIMARY KEY NOT NULL,
			name text NOT NULL,
			code text NOT NULL,
			image_url text,
			provider_id text,
			provider_name text,
			is_live_game integer NOT NULL DEFAULT 0,
			free_spin integer NOT NULL DEFAULT 0,
			enabled integer NOT NULL DEFAULT 1,
			created_at integer NOT NULL DEFAULT 0,
			updated_at integer NOT NULL DEFAULT 0
		);
	`);

	sqlite
		.prepare(
			`INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
			 VALUES (?, ?, ?, 1, ?, ?)`,
		)
		.run(USER_ID, "List Smoke", "list-smoke@example.com", NOW, NOW);
	sqlite
		.prepare(
			`INSERT INTO admin (id, email, password_hash, name, role, created_at, updated_at)
			 VALUES (?, ?, ?, ?, 'super_admin', ?, ?)`,
		)
		.run("admin-list-smoke", "admin-list@example.com", "x", "Admin", NOW, NOW);
	sqlite
		.prepare(
			`INSERT INTO admin_session (id, expires_at, token, created_at, updated_at, ip_address, device_name, browser, admin_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.run(
			"admin-session-list-smoke",
			NOW + 60 * 60 * 1000,
			ADMIN_TOKEN,
			NOW,
			NOW,
			"102.88.12.34",
			"Windows",
			"Chrome",
			"admin-list-smoke",
		);

	for (let i = 0; i < 25; i++) {
		sqlite
			.prepare(
				`INSERT INTO wallet_transaction
				 (id, user_id, amount, type, reference, status, payment_method, balance, metadata, created_at)
				 VALUES (?, ?, 1000, 'credit', ?, 'success', 'paystack', 1000, '{}', ?)`,
			)
			.run(`wtx-${i}`, USER_ID, `ref-${i}`, NOW - i * 1000);
	}
	sqlite
		.prepare(
			`INSERT INTO wallet_transaction
			 (id, user_id, amount, type, reference, status, payment_method, balance, metadata, created_at)
			 VALUES (?, ?, 500, 'debit', 'sportsbook-hidden', 'success', 'sportsbook', 500, '{}', ?)`,
		)
		.run("wtx-sportsbook", USER_ID, NOW);

	for (let i = 0; i < 15; i++) {
		const betId = `bet-${i}`;
		sqlite
			.prepare(
				`INSERT INTO sportsbook_bet
				 (id, user_id, stake, total_odds_value, status, settle_amount, settle_type, created_at, updated_at)
				 VALUES (?, ?, 1000, '2.00', 'accepted', NULL, NULL, ?, ?)`,
			)
			.run(betId, USER_ID, NOW - i * 1000, NOW);
		sqlite
			.prepare(
				`INSERT INTO sportsbook_bet_event
				 (id, bet_id, event_type, balance_before, balance_after, created_at)
				 VALUES (?, ?, 'place', 2000, 1000, ?)`,
			)
			.run(`event-${i}`, betId, NOW - i * 1000);
	}

	const d1 = new MemoryD1(sqlite);
	return { sqlite, env: { DB: d1 } as unknown as { DB: D1Database } };
}

async function adminGet(
	route:
		| typeof adminRoute
		| typeof adminActivityRoute
		| typeof adminTicketsRoute,
	path: string,
	env: { DB: D1Database },
) {
	return route.request(
		path,
		{ method: "GET", headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } },
		env,
	);
}

describe("admin paginated lists smoke (in-memory, real handlers)", () => {
	it("records the admin actor and target user for a manual wallet adjustment", async () => {
		const { env } = createListEnv();
		await recordActivityForSession(
			env,
			"admin-list-smoke",
			"Manually debited user wallet",
			{
				targetUser: {
					id: USER_ID,
					name: "List Smoke",
					email: "list-smoke@example.com",
					username: "+2348000000000",
				},
				details: {
					transactionType: "debit",
					amount: 250,
					currency: "NGN",
					reason: "Manual correction",
					transactionId: "manual-txn-1",
					balanceAfter: 750,
				},
			},
		);

		const response = await adminGet(adminActivityRoute, "/activity", env);
		const body = (await response.json()) as {
			success: boolean;
			data: {
				activities: Array<{
					userId: string;
					fullName: string;
					status: string;
					targetUser: { id: string; email: string | null } | null;
					details: { amount?: number; transactionType?: string } | null;
				}>;
			};
		};

		assert.equal(response.status, 200, JSON.stringify(body));
		const [activity] = body.data.activities;
		assert.equal(activity?.userId, "admin-list-smoke");
		assert.equal(activity?.fullName, "Admin");
		assert.equal(activity?.status, "online");
		assert.equal(activity?.targetUser?.id, USER_ID);
		assert.equal(activity?.targetUser?.email, "list-smoke@example.com");
		assert.equal(activity?.details?.transactionType, "debit");
		assert.equal(activity?.details?.amount, 250);

		const detailResponse = await adminGet(
			adminActivityRoute,
			`/activity/${activity?.id}`,
			env,
		);
		const detailBody = (await detailResponse.json()) as {
			success: boolean;
			data: {
				activity: {
					module: string;
					ipAddress: string | null;
					device: string | null;
					browser: string | null;
				};
			};
		};
		assert.equal(detailResponse.status, 200, JSON.stringify(detailBody));
		assert.equal(detailBody.data.activity.module, "Wallet");
		assert.equal(detailBody.data.activity.ipAddress, "102.88.12.34");
		assert.equal(detailBody.data.activity.device, "Windows");
		assert.equal(detailBody.data.activity.browser, "Chrome");
	});

	it("shows every user wallet movement with its debit amount, purpose, and balance", async () => {
		const { env, sqlite } = createListEnv();
		sqlite
			.prepare(
				`INSERT INTO wallet_transaction
				 (id, user_id, amount, type, reference, status, payment_method, balance, metadata, created_at)
				 VALUES (?, ?, 2500, 'debit', 'manual-debit', 'success', 'manual', 2500, ?, ?)`,
			)
			.run(
				"manual-debit",
				USER_ID,
				JSON.stringify({
					reason: "Duplicate deposit correction",
					processedBy: "admin-id-not-exposed-in-purpose",
				}),
				NOW + 1,
			);

		const response = await adminGet(
			userRoute,
			`/${USER_ID}/wallet/transactions?page=1&limit=50`,
			env,
		);
		const body = (await response.json()) as {
			success: boolean;
			data: {
				transactions: Array<{
					id: string;
					direction: string;
					amount: number;
					walletEffect: number;
					balanceAfter: number | null;
					purpose: string;
					paymentMethod: string;
				}>;
				total: number;
			};
		};

		assert.equal(response.status, 200, JSON.stringify(body));
		assert.equal(body.success, true);
		assert.equal(body.data.total, 27);

		const sportsbookDebit = body.data.transactions.find(
			(transaction) => transaction.id === "wtx-sportsbook",
		);
		assert.equal(sportsbookDebit?.id, "wtx-sportsbook");
		assert.equal(sportsbookDebit?.direction, "debit");
		assert.equal(sportsbookDebit?.amount, 5);
		assert.equal(sportsbookDebit?.walletEffect, -5);
		assert.equal(sportsbookDebit?.balanceAfter, 5);
		assert.equal(sportsbookDebit?.purpose, "Sportsbook wallet debit");
		assert.equal(sportsbookDebit?.paymentMethod, "sportsbook");

		const manualDebit = body.data.transactions.find(
			(transaction) => transaction.id === "manual-debit",
		);
		assert.equal(manualDebit?.direction, "debit");
		assert.equal(manualDebit?.amount, 25);
		assert.equal(
			manualDebit?.purpose,
			"Manual debit: Duplicate deposit correction",
		);
	});

	it("pages wallet transactions without loading excluded sportsbook rows", async () => {
		const { env } = createListEnv();

		const page1 = await adminGet(
			adminRoute,
			"/wallet-transactions?page=1&limit=10",
			env,
		);
		const page1Body = (await page1.json()) as {
			success: boolean;
			data: {
				transactions: Array<{ payment_method: string }>;
				pagination: {
					page: number;
					limit: number;
					total: number;
					totalPages: number;
				};
			};
		};
		assert.equal(page1.status, 200, JSON.stringify(page1Body));
		assert.equal(page1Body.success, true);
		assert.equal(page1Body.data.transactions.length, 10);
		assert.equal(page1Body.data.pagination.total, 25);
		assert.equal(page1Body.data.pagination.totalPages, 3);
		assert.equal(
			page1Body.data.transactions.some(
				(tx) => tx.payment_method === "sportsbook",
			),
			false,
		);

		const page3 = await adminGet(
			adminRoute,
			"/wallet-transactions?page=3&limit=10",
			env,
		);
		const page3Body = (await page3.json()) as {
			data: { transactions: unknown[]; pagination: { page: number } };
		};
		assert.equal(page3.status, 200, JSON.stringify(page3Body));
		assert.equal(page3Body.data.transactions.length, 5);
		assert.equal(page3Body.data.pagination.page, 3);
	});

	it("keeps wallet /all on the unpaginated cap path", async () => {
		const { env } = createListEnv();
		const res = await adminGet(adminRoute, "/wallet-transactions/all", env);
		const body = (await res.json()) as {
			success: boolean;
			data: {
				transactions: unknown[];
				pagination: { page: number; total: number; totalPages: number };
			};
		};
		assert.equal(res.status, 200, JSON.stringify(body));
		assert.equal(body.data.transactions.length, 25);
		assert.equal(body.data.pagination.page, 1);
		assert.equal(body.data.pagination.total, 25);
		assert.equal(body.data.pagination.totalPages, 1);
	});

	it("pages tickets and still serves /tickets/all", async () => {
		const { env } = createListEnv();

		const page1 = await adminGet(
			adminTicketsRoute,
			"/tickets?page=1&limit=10&type=sportsbook",
			env,
		);
		const page1Body = (await page1.json()) as {
			success: boolean;
			data: {
				tickets: unknown[];
				pagination: {
					page: number;
					limit: number;
					total: number;
					totalPages: number;
				};
			};
		};
		assert.equal(page1.status, 200, JSON.stringify(page1Body));
		assert.equal(page1Body.data.tickets.length, 10);
		assert.equal(page1Body.data.pagination.total, 15);
		assert.equal(page1Body.data.pagination.totalPages, 2);

		const allRes = await adminGet(
			adminTicketsRoute,
			"/tickets/all?type=sportsbook",
			env,
		);
		const allBody = (await allRes.json()) as {
			data: { tickets: unknown[]; pagination: { page: number; total: number } };
		};
		assert.equal(allRes.status, 200, JSON.stringify(allBody));
		assert.equal(allBody.data.tickets.length, 15);
		assert.equal(allBody.data.pagination.page, 1);
		assert.equal(allBody.data.pagination.total, 15);
	});

	it("returns a display bet type and the real sportsbook selection count", async () => {
		const { env, sqlite } = createListEnv();
		sqlite
			.prepare(
				`UPDATE sportsbook_bet
				 SET bet_type = ?, bet_data = ?
				 WHERE id = ?`,
			)
			.run(
				2,
				JSON.stringify({
					bet_odds: [
						{
							match_id: "event-one",
							market_id: "20",
							odd_id: "1",
							odd_ratio: "1.50",
						},
						{
							match_id: "event-two",
							market_id: "201",
							odd_id: "2",
							odd_ratio: "2.00",
						},
					],
				}),
				"bet-0",
			);

		const response = await adminGet(adminTicketsRoute, "/tickets/bet-0", env);
		const body = (await response.json()) as {
			success: boolean;
			data: {
				betType: string;
				betTypeCode: number | null;
				selectionCount: number;
				selection: number;
				selections: Array<{ market: string | null; pick: string | null }>;
			};
		};

		assert.equal(response.status, 200, JSON.stringify(body));
		assert.equal(body.success, true);
		assert.equal(body.data.betType, "Multiple");
		assert.equal(body.data.betTypeCode, 2);
		assert.equal(body.data.selectionCount, 2);
		assert.equal(body.data.selection, 2);
		assert.equal(body.data.selections.length, 2);
		const firstSelection = body.data.selections.at(0);
		assert.equal(firstSelection != null && "market" in firstSelection, true);
		assert.equal(firstSelection != null && "pick" in firstSelection, true);
	});

	it("accepts an encoded sportsbook ticket ID that contains a slash", async () => {
		const { env, sqlite } = createListEnv();
		const ticketId = "dWk/75ecRHmF5hYEMVZ2FGqdhUUH0JEAACm7TwJL";
		sqlite
			.prepare(
				`INSERT INTO sportsbook_bet
				 (id, user_id, stake, status, created_at, updated_at)
				 VALUES (?, ?, 1000, 'accepted', ?, ?)`,
			)
			.run(ticketId, USER_ID, NOW, NOW);

		const response = await adminGet(
			adminTicketsRoute,
			`/tickets/${encodeURIComponent(ticketId)}`,
			env,
		);
		const body = (await response.json()) as { success: boolean; data?: { id: string } };

		assert.equal(response.status, 200, JSON.stringify(body));
		assert.equal(body.success, true);
		assert.equal(body.data?.id, ticketId);
	});

	it("type=all still queries casino tables without failing", async () => {
		const { env } = createListEnv();
		const res = await adminGet(
			adminTicketsRoute,
			"/tickets?page=1&limit=10&type=all",
			env,
		);
		const body = (await res.json()) as {
			data: { tickets: unknown[]; pagination: { total: number } };
		};
		assert.equal(res.status, 200, JSON.stringify(body));
		assert.equal(body.data.tickets.length, 10);
		assert.equal(body.data.pagination.total, 15);
	});
});
