import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { createMemoryD1 } from "../test-support/memory-d1";
import adminRoute from "./admin";
import adminTransactionsRoute from "./admin-transactions";

const ADMIN_TOKEN = "admin-flag-smoke-token";
const USER_ID = "admin-flag-smoke-user";
const TXN_ID = "wtx-flag-deposit";
const OTHER_TXN_ID = "wtx-unflagged-deposit";
const NOW = Date.now();

function createFlagEnv() {
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
	`);

	sqlite
		.prepare(
			`INSERT INTO user (id, name, email, email_verified, mobile_number, created_at, updated_at)
			 VALUES (?, ?, ?, 1, ?, ?, ?)`,
		)
		.run(USER_ID, "Flag Smoke", "flag-smoke@example.com", "+2348000000001", NOW, NOW);
	sqlite
		.prepare(
			`INSERT INTO admin (id, email, password_hash, name, role, created_at, updated_at)
			 VALUES (?, ?, ?, ?, 'super_admin', ?, ?)`,
		)
		.run("admin-flag-smoke", "admin-flag@example.com", "x", "Flag Admin", NOW, NOW);
	sqlite
		.prepare(
			`INSERT INTO admin_session (id, expires_at, token, created_at, updated_at, ip_address, device_name, browser, admin_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.run(
			"admin-session-flag-smoke",
			NOW + 60 * 60 * 1000,
			ADMIN_TOKEN,
			NOW,
			NOW,
			"102.88.12.34",
			"Windows",
			"Chrome",
			"admin-flag-smoke",
		);
	sqlite
		.prepare(
			`INSERT INTO wallet_transaction
			 (id, user_id, amount, type, reference, status, payment_method, balance, metadata, created_at)
			 VALUES (?, ?, 500000, 'credit', ?, 'success', 'paystack', 500000, ?, ?)`,
		)
		.run(TXN_ID, USER_ID, "ref-flag-deposit", JSON.stringify({ provider: "paystack" }), NOW);
	sqlite
		.prepare(
			`INSERT INTO wallet_transaction
			 (id, user_id, amount, type, reference, status, payment_method, balance, metadata, created_at)
			 VALUES (?, ?, 250000, 'credit', ?, 'success', 'paystack', 750000, '{}', ?)`,
		)
		.run(OTHER_TXN_ID, USER_ID, "ref-unflagged-deposit", NOW - 1000);

	const { DB } = createMemoryD1(sqlite);
	return { sqlite, env: { DB } as unknown as { DB: D1Database } };
}

const authHeaders = {
	Authorization: `Bearer ${ADMIN_TOKEN}`,
	"Content-Type": "application/json",
};

describe("admin flag-as-fraud (in-memory, real handlers)", () => {
	it("persists a fraud flag, activity log, summary fields, and list filter", async () => {
		const { sqlite, env } = createFlagEnv();

		const flagRes = await adminTransactionsRoute.request(
			`/wallet-transactions/${TXN_ID}/flag`,
			{
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ reason: "stolen card" }),
			},
			env,
		);
		const flagBody = (await flagRes.json()) as {
			success: boolean;
			data: {
				alreadyFlagged: boolean;
				flagged: boolean;
				flaggedAt: number;
				flaggedByAdminId: string;
				flaggedByAdminName: string;
				flagReason: string | null;
			};
		};
		assert.equal(flagRes.status, 200, JSON.stringify(flagBody));
		assert.equal(flagBody.success, true);
		assert.equal(flagBody.data.alreadyFlagged, false);
		assert.equal(flagBody.data.flagged, true);
		assert.equal(flagBody.data.flaggedByAdminId, "admin-flag-smoke");
		assert.equal(flagBody.data.flaggedByAdminName, "Flag Admin");
		assert.equal(flagBody.data.flagReason, "stolen card");

		const stored = sqlite
			.prepare(`SELECT metadata FROM wallet_transaction WHERE id = ?`)
			.get(TXN_ID) as { metadata: string };
		const storedMeta = JSON.parse(stored.metadata) as {
			provider: string;
			fraudFlag: { flagged: boolean; reason: string };
		};
		assert.equal(storedMeta.provider, "paystack");
		assert.equal(storedMeta.fraudFlag.flagged, true);
		assert.equal(storedMeta.fraudFlag.reason, "stolen card");

		const summaryRes = await adminTransactionsRoute.request(
			`/wallet-transactions/${TXN_ID}/summary`,
			{ method: "GET", headers: authHeaders },
			env,
		);
		const summaryBody = (await summaryRes.json()) as {
			success: boolean;
			data: {
				flagged: boolean;
				flaggedByAdminName: string | null;
				flagReason: string | null;
			};
		};
		assert.equal(summaryRes.status, 200, JSON.stringify(summaryBody));
		assert.equal(summaryBody.data.flagged, true);
		assert.equal(summaryBody.data.flaggedByAdminName, "Flag Admin");
		assert.equal(summaryBody.data.flagReason, "stolen card");

		const listRes = await adminRoute.request(
			"/wallet-transactions?flagged=true&page=1&limit=10",
			{ method: "GET", headers: authHeaders },
			env,
		);
		const listBody = (await listRes.json()) as {
			success: boolean;
			data: {
				transactions: Array<{ transaction_id: string; flagged: boolean }>;
				pagination: { total: number };
			};
		};
		assert.equal(listRes.status, 200, JSON.stringify(listBody));
		assert.equal(listBody.data.pagination.total, 1);
		assert.equal(listBody.data.transactions[0]?.transaction_id, TXN_ID);
		assert.equal(listBody.data.transactions[0]?.flagged, true);

		const activity = sqlite
			.prepare(`SELECT action, target_user_id, details FROM admin_activity_log`)
			.get() as {
			action: string;
			target_user_id: string;
			details: string;
		};
		assert.equal(activity.action, "Flagged transaction as fraud");
		assert.equal(activity.target_user_id, USER_ID);
		assert.equal(JSON.parse(activity.details).transactionId, TXN_ID);

		const again = await adminTransactionsRoute.request(
			`/wallet-transactions/${TXN_ID}/flag`,
			{
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ reason: "should not overwrite" }),
			},
			env,
		);
		const againBody = (await again.json()) as {
			data: { alreadyFlagged: boolean; flagReason: string | null };
		};
		assert.equal(again.status, 200);
		assert.equal(againBody.data.alreadyFlagged, true);
		assert.equal(againBody.data.flagReason, "stolen card");

		const activityCount = sqlite
			.prepare(`SELECT COUNT(*) AS n FROM admin_activity_log`)
			.get() as { n: number };
		assert.equal(Number(activityCount.n), 1);
	});

	it("rejects unauthenticated flag attempts and missing transactions", async () => {
		const { env } = createFlagEnv();

		const unauth = await adminTransactionsRoute.request(
			`/wallet-transactions/${TXN_ID}/flag`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			},
			env,
		);
		assert.equal(unauth.status, 401);

		const missing = await adminTransactionsRoute.request(
			"/wallet-transactions/does-not-exist/flag",
			{
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({}),
			},
			env,
		);
		assert.equal(missing.status, 404);
	});
});
