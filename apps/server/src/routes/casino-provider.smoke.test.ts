import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { createMemoryD1 } from "../test-support/memory-d1";
import casinoProviderRoute from "./casino-provider";

const USER_ID = "luckyworld-smoke-user";
const SESSION_TOKEN = "luckyworld-smoke-session";
const START_KOBO = 50_000;
const BET_KOBO = 1_000;
const BET_PROVIDER_UNITS = BET_KOBO * 10;

type SqliteDb = DatabaseSync;

function createSmokeEnv(betProviderTxId: string) {
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
		CREATE TABLE wallet (
			id text PRIMARY KEY NOT NULL,
			user_id text NOT NULL UNIQUE,
			balance integer NOT NULL DEFAULT 0,
			frozen_balance integer NOT NULL DEFAULT 0,
			created_at integer NOT NULL DEFAULT 0,
			updated_at integer NOT NULL DEFAULT 0
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
		CREATE TABLE game_sessions (
			session_token text PRIMARY KEY NOT NULL,
			user_id text NOT NULL,
			game text NOT NULL,
			status text NOT NULL DEFAULT 'active',
			created_at integer NOT NULL DEFAULT 0,
			updated_at integer NOT NULL DEFAULT 0
		);
		CREATE TABLE game_transactions (
			id text PRIMARY KEY NOT NULL,
			user_id text NOT NULL,
			provider_tx_id text NOT NULL,
			type text NOT NULL,
			amount integer NOT NULL,
			balance_before integer,
			balance_after integer,
			session_token text NOT NULL,
			game text NOT NULL,
			round_id text,
			created_at integer NOT NULL DEFAULT 0
		);
		CREATE UNIQUE INDEX game_transactions_provider_tx_id_unique
			ON game_transactions (provider_tx_id);
	`);
	sqlite
		.prepare(
			`INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
			 VALUES (?, ?, ?, 1, 0, 0)`,
		)
		.run(USER_ID, "LuckyWorld Smoke", "luckyworld-smoke@example.com");
	sqlite
		.prepare(
			`INSERT INTO wallet (id, user_id, balance, frozen_balance, created_at, updated_at)
			 VALUES (?, ?, ?, 0, 0, 0)`,
		)
		.run("wallet-luckyworld-smoke", USER_ID, START_KOBO);
	sqlite
		.prepare(
			`INSERT INTO game_sessions (session_token, user_id, game, status, created_at, updated_at)
			 VALUES (?, ?, ?, 'active', 0, 0)`,
		)
		.run(SESSION_TOKEN, USER_ID, "XCAPEHB");
	sqlite
		.prepare(
			`INSERT INTO game_transactions
			 (id, user_id, provider_tx_id, type, amount, balance_before, balance_after, session_token, game, created_at)
			 VALUES (?, ?, ?, 'BET', ?, ?, ?, ?, 'XCAPEHB', 0)`,
		)
		.run(
			`bet_${betProviderTxId}`,
			USER_ID,
			betProviderTxId,
			BET_KOBO,
			START_KOBO + BET_KOBO,
			START_KOBO,
			SESSION_TOKEN,
		);

	const { d1, DB } = createMemoryD1(sqlite);
	return { sqlite, d1, env: { DB } };
}

function rollbackBody(betProviderTxId: string) {
	return {
		user_id: USER_ID,
		amount: BET_PROVIDER_UNITS,
		rollback_provider_tx_id: betProviderTxId,
		session_token: SESSION_TOKEN,
		provider: "spribe",
		action: "rollback",
		action_id: "smoke-action",
		game: "XCAPEHB",
	};
}

async function postRollback(
	env: { DB: D1Database },
	betProviderTxId: string,
) {
	return casinoProviderRoute.request(
		"/rollback_spribe",
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(rollbackBody(betProviderTxId)),
		},
		env,
	);
}

function walletBalance(sqlite: SqliteDb): number {
	const row = sqlite
		.prepare(`SELECT balance FROM wallet WHERE user_id = ?`)
		.get(USER_ID) as { balance: number };
	return row.balance;
}

function rollbackRowCount(sqlite: SqliteDb, betProviderTxId: string): number {
	const row = sqlite
		.prepare(
			`SELECT COUNT(*) AS n FROM game_transactions WHERE provider_tx_id = ?`,
		)
		.get(`rollback_${betProviderTxId}`) as { n: number };
	return Number(row.n);
}

describe("LuckyWorld rollback_spribe smoke (in-memory, real handler)", () => {
	it("credits the wallet once and returns 200 on the exact same retry", async () => {
		const betId = "lw-smoke-bet-retry";
		const { sqlite, env } = createSmokeEnv(betId);

		const first = await postRollback(env, betId);
		const firstBody = await first.json();
		assert.equal(first.status, 200, JSON.stringify(firstBody));
		assert.equal(walletBalance(sqlite), START_KOBO + BET_KOBO);
		assert.equal(rollbackRowCount(sqlite, betId), 1);

		const second = await postRollback(env, betId);
		const secondBody = await second.json();
		assert.equal(second.status, 200, JSON.stringify(secondBody));
		assert.equal(walletBalance(sqlite), START_KOBO + BET_KOBO);
		assert.equal(rollbackRowCount(sqlite, betId), 1);
	});

	it("does not double-credit two nearly simultaneous rollbacks of the same bet", async () => {
		const betId = "lw-smoke-bet-concurrent";
		const { sqlite, env } = createSmokeEnv(betId);

		const [a, b] = await Promise.all([
			postRollback(env, betId),
			postRollback(env, betId),
		]);
		const statuses = [a.status, b.status].sort();
		assert.equal(walletBalance(sqlite), START_KOBO + BET_KOBO);
		assert.equal(rollbackRowCount(sqlite, betId), 1);
		assert.ok(
			statuses.includes(200),
			`expected at least one 200, got ${a.status} and ${b.status}`,
		);

		const retry = await postRollback(env, betId);
		assert.equal(retry.status, 200, await retry.text());
		assert.equal(walletBalance(sqlite), START_KOBO + BET_KOBO);
	});

	it("returns 404 for a bet that never existed and does not credit", async () => {
		const betId = "lw-smoke-bet-missing-original";
		const { sqlite, env } = createSmokeEnv(betId);

		const res = await postRollback(env, "does-not-exist");
		const body = await res.json();
		assert.equal(res.status, 404, JSON.stringify(body));
		assert.equal(walletBalance(sqlite), START_KOBO);
	});

	it("releases the claim if creditWallet throws so a retry can still credit once", async () => {
		const betId = "lw-smoke-bet-throw";
		const { sqlite, d1, env } = createSmokeEnv(betId);
		d1.failNextWalletUpdate = true;

		const first = await postRollback(env, betId);
		assert.equal(first.status, 500, await first.text());
		assert.equal(walletBalance(sqlite), START_KOBO);
		assert.equal(rollbackRowCount(sqlite, betId), 0);

		const second = await postRollback(env, betId);
		const secondBody = await second.json();
		assert.equal(second.status, 200, JSON.stringify(secondBody));
		assert.equal(walletBalance(sqlite), START_KOBO + BET_KOBO);
		assert.equal(rollbackRowCount(sqlite, betId), 1);

		const third = await postRollback(env, betId);
		assert.equal(third.status, 200, await third.text());
		assert.equal(walletBalance(sqlite), START_KOBO + BET_KOBO);
	});
});
