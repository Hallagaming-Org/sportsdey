import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { createMemoryD1 } from "@/test-support/memory-d1";
import {
	handleBalance,
	handleBet,
	handleRefund,
	handleWin,
} from "./adapter";

const USER_ID = "swipegames-user-1";
const SESSION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const START_KOBO = 50_000;

function createDb() {
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
		CREATE TABLE swipegames_sessions (
			session_id text PRIMARY KEY NOT NULL,
			user_id text NOT NULL,
			game_id text NOT NULL,
			gs_id text,
			currency text NOT NULL DEFAULT 'NGN',
			demo integer NOT NULL DEFAULT 0,
			status text NOT NULL DEFAULT 'active',
			created_at integer NOT NULL DEFAULT 0,
			updated_at integer NOT NULL DEFAULT 0
		);
		CREATE TABLE swipegames_transactions (
			id text PRIMARY KEY NOT NULL,
			provider_tx_id text NOT NULL UNIQUE,
			orig_provider_tx_id text,
			user_id text NOT NULL,
			type text NOT NULL,
			play_type text,
			amount integer NOT NULL,
			balance_before integer,
			balance_after integer,
			round_id text NOT NULL,
			session_id text NOT NULL,
			fr_id text,
			game_id text NOT NULL,
			created_at integer NOT NULL DEFAULT 0
		);
	`);
	sqlite
		.prepare(
			`INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
			 VALUES (?, ?, ?, 1, 0, 0)`,
		)
		.run(USER_ID, "Player", "swipe@example.com");
	sqlite
		.prepare(
			`INSERT INTO wallet (id, user_id, balance, frozen_balance, created_at, updated_at)
			 VALUES (?, ?, ?, 0, 0, 0)`,
		)
		.run("wallet-sg", USER_ID, START_KOBO);
	sqlite
		.prepare(
			`INSERT INTO swipegames_sessions
			 (session_id, user_id, game_id, currency, demo, status, created_at, updated_at)
			 VALUES (?, ?, ?, 'NGN', 0, 'active', 0, 0)`,
		)
		.run(SESSION_ID, USER_ID, "sg_catch_97");
	const { DB } = createMemoryD1(sqlite);
	return drizzle(DB, { schema });
}

describe("Swipe Games adapter wallet", () => {
	it("returns balance in main-unit decimal strings", async () => {
		const db = createDb();
		const result = await handleBalance(db, SESSION_ID);
		assert.equal(result.ok, true);
		if (result.ok) assert.equal(result.body.balance, "500.00");
	});

	it("debits a regular bet and is idempotent on txID", async () => {
		const db = createDb();
		const bet = {
			type: "regular" as const,
			sessionID: SESSION_ID,
			amount: "100.10",
			txID: "c27ccade-5a45-4157-a85f-7d023a689ea5",
			roundID: "b78e42f8-2041-482d-9c4b-f2ca79fc75e3",
		};
		const first = await handleBet(db, bet);
		assert.equal(first.ok, true);
		if (first.ok) {
			assert.equal(first.body.balance, "399.90");
			assert.ok(first.body.txID);
		}
		const retry = await handleBet(db, bet);
		assert.equal(retry.ok, true);
		if (first.ok && retry.ok) {
			assert.equal(retry.body.balance, first.body.balance);
			assert.equal(retry.body.txID, first.body.txID);
		}
		const after = await handleBalance(db, SESSION_ID);
		if (after.ok) assert.equal(after.body.balance, "399.90");
	});

	it("returns insufficient_funds without debiting twice", async () => {
		const db = createDb();
		const result = await handleBet(db, {
			type: "regular",
			sessionID: SESSION_ID,
			amount: "10000.00",
			txID: "11111111-1111-4111-8111-111111111111",
			roundID: "b78e42f8-2041-482d-9c4b-f2ca79fc75e3",
		});
		assert.equal(result.ok, false);
		if (!result.ok) {
			assert.equal(result.status, 400);
			assert.equal(result.body.code, "insufficient_funds");
		}
		const after = await handleBalance(db, SESSION_ID);
		if (after.ok) assert.equal(after.body.balance, "500.00");
	});

	it("does not change balance for free-round bet/win; credits regular+frID withdrawal", async () => {
		const db = createDb();
		const freeBet = await handleBet(db, {
			type: "free",
			sessionID: SESSION_ID,
			amount: "1.00",
			txID: "22222222-2222-4222-8222-222222222222",
			roundID: "b78e42f8-2041-482d-9c4b-f2ca79fc75e3",
			frID: "promo-1",
		});
		assert.equal(freeBet.ok, true);
		const freeWin = await handleWin(db, {
			type: "free",
			sessionID: SESSION_ID,
			amount: "50.00",
			txID: "33333333-3333-4333-8333-333333333333",
			roundID: "b78e42f8-2041-482d-9c4b-f2ca79fc75e3",
			frID: "promo-1",
		});
		assert.equal(freeWin.ok, true);
		let balance = await handleBalance(db, SESSION_ID);
		if (balance.ok) assert.equal(balance.body.balance, "500.00");

		const withdrawal = await handleWin(db, {
			type: "regular",
			sessionID: SESSION_ID,
			amount: "25.00",
			txID: "44444444-4444-4444-8444-444444444444",
			roundID: "b78e42f8-2041-482d-9c4b-f2ca79fc75e3",
			frID: "promo-1",
		});
		assert.equal(withdrawal.ok, true);
		if (withdrawal.ok) assert.equal(withdrawal.body.balance, "525.00");
	});

	it("refunds a bet and returns 200 when origTxID is missing", async () => {
		const db = createDb();
		const bet = await handleBet(db, {
			type: "regular",
			sessionID: SESSION_ID,
			amount: "50.00",
			txID: "55555555-5555-4555-8555-555555555555",
			roundID: "b78e42f8-2041-482d-9c4b-f2ca79fc75e3",
		});
		assert.equal(bet.ok, true);

		const refund = await handleRefund(db, {
			sessionID: SESSION_ID,
			txID: "66666666-6666-4666-8666-666666666666",
			origTxID: "55555555-5555-4555-8555-555555555555",
			amount: "50.00",
			roundID: "b78e42f8-2041-482d-9c4b-f2ca79fc75e3",
		});
		assert.equal(refund.ok, true);
		if (refund.ok) assert.equal(refund.body.balance, "500.00");

		const ghost = await handleRefund(db, {
			sessionID: SESSION_ID,
			txID: "77777777-7777-4777-8777-777777777777",
			origTxID: "00000000-0000-4000-8000-000000000000",
			amount: "50.00",
		});
		assert.equal(ghost.ok, true);
		if (ghost.ok) assert.equal(ghost.body.balance, "500.00");
	});

	it("returns 404 for unknown session on bet", async () => {
		const db = createDb();
		const result = await handleBet(db, {
			type: "regular",
			sessionID: "missing-session",
			amount: "1.00",
			txID: "88888888-8888-4888-8888-888888888888",
			roundID: "b78e42f8-2041-482d-9c4b-f2ca79fc75e3",
		});
		assert.equal(result.ok, false);
		if (!result.ok) {
			assert.equal(result.status, 404);
			assert.equal(result.body.code, "session_not_found");
		}
	});
});
