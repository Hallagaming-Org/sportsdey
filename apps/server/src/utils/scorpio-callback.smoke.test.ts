import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import {
	normalizeScorpioCallbackBody,
	ScorpioCallbackRequestSchema,
} from "@/schemas/scorpio";
import { processScorpioCallback } from "./scorpio-callback";

const USER_ID = "2c4KYV5MF8JemOoQS4E5ZrFZcV8EEHaC";
const PLAYER_CODE = 100254310;
const START_KOBO = 2_000_000;

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

function createSmokeDb() {
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
		CREATE TABLE scorpio_players (
			user_id text PRIMARY KEY NOT NULL,
			player_code integer NOT NULL,
			created_at integer NOT NULL DEFAULT 0,
			updated_at integer NOT NULL DEFAULT 0
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
	`);
	sqlite
		.prepare(
			`INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
			 VALUES (?, ?, ?, 1, 0, 0)`,
		)
		.run(USER_ID, "Casino Manager", "casino-manager@example.com");
	sqlite
		.prepare(
			`INSERT INTO wallet (id, user_id, balance, frozen_balance, created_at, updated_at)
			 VALUES (?, ?, ?, 0, 0, 0)`,
		)
		.run("wallet-smoke", USER_ID, START_KOBO);
	sqlite
		.prepare(
			`INSERT INTO scorpio_players (user_id, player_code, created_at, updated_at)
			 VALUES (?, ?, 0, 0)`,
		)
		.run(USER_ID, PLAYER_CODE);

	const db = drizzle(new MemoryD1(sqlite) as unknown as D1Database, {
		schema,
	});
	return { sqlite, db };
}

async function runCallback(
	db: ReturnType<typeof createSmokeDb>["db"],
	body: Record<string, unknown>,
) {
	const parsed = ScorpioCallbackRequestSchema.safeParse(body);
	const payload = parsed.success
		? (parsed.data as unknown as Record<string, unknown>)
		: (normalizeScorpioCallbackBody(body) as Record<string, unknown>);
	return processScorpioCallback(db, payload);
}

describe("scorpio seamless wallet smoke (in-memory, no live money)", () => {
	it("returns balance for player code and user id, rejects unknown players", async () => {
		const { db } = createSmokeDb();

		const byCode = await runCallback(db, {
			command: "balance",
			playerId: String(PLAYER_CODE),
			currency: "NGN",
		});
		assert.deepEqual(byCode, { balance: 20000, statusCode: "OK" });

		const byUser = await runCallback(db, {
			command: "balance",
			playerId: USER_ID,
			currency: "NGN",
		});
		assert.deepEqual(byUser, { balance: 20000, statusCode: "OK" });

		const missing = await runCallback(db, {
			command: "balance",
			playerId: "not-a-real-player",
			currency: "NGN",
		});
		assert.equal(typeof missing.balance, "number");
		assert.equal(missing.statusCode, "ERR_INVALID_PLAYER_ID");
	});

	it("debits a bet, credits a win, and is idempotent on replay", async () => {
		const { db } = createSmokeDb();

		const bet = await runCallback(db, {
			command: "bet",
			playerId: String(PLAYER_CODE),
			transactionId: "SMOKE_BET_1",
			roundId: "SMOKE_ROUND_1",
			providerId: 2,
			providerName: "Pragmatic",
			gameCode: "vs20olympgate",
			gameName: "Gates of Olympus",
			currency: "NGN",
			amount: 100,
			isCall: false,
			isRoundFinished: false,
		});
		assert.deepEqual(bet, { balance: 19900, statusCode: "OK" });

		const betReplay = await runCallback(db, {
			command: "bet",
			playerId: String(PLAYER_CODE),
			transactionId: "SMOKE_BET_1",
			roundId: "SMOKE_ROUND_1",
			providerId: 2,
			providerName: "Pragmatic",
			gameCode: "vs20olympgate",
			gameName: "Gates of Olympus",
			currency: "NGN",
			amount: 100,
		});
		assert.deepEqual(betReplay, { balance: 19900, statusCode: "OK" });

		const win = await runCallback(db, {
			command: "win",
			playerId: String(PLAYER_CODE),
			transactionId: "SMOKE_WIN_1",
			roundId: "SMOKE_ROUND_1",
			providerId: 2,
			providerName: "Pragmatic",
			gameCode: "vs20olympgate",
			gameName: "Gates of Olympus",
			currency: "NGN",
			amount: 250,
			isCall: false,
			isRoundFinished: true,
		});
		assert.deepEqual(win, { balance: 20150, statusCode: "OK" });
	});

	it("accepts live-like NGN payloads (string ids, 0/1 flags, missing command)", async () => {
		const { db } = createSmokeDb();

		const liveBet = {
			playerId: PLAYER_CODE,
			transactionId: "SPTRX_SMOKE_21",
			roundId: 778899,
			providerId: "2",
			providerName: "Pragmatic Play",
			gameCode: "vs20olympgate",
			gameName: "Gates of Olympus",
			currency: "NGN",
			amount: "10.5",
			isCall: 0,
			isRoundFinished: 1,
		};

		const parsed = ScorpioCallbackRequestSchema.safeParse(liveBet);
		assert.equal(parsed.success, true, parsed.success ? "" : parsed.error.message);

		const bet = await runCallback(db, liveBet);
		assert.deepEqual(bet, { balance: 19989.5, statusCode: "OK" });
	});

	it("refunds a bet on cancel and rejects a second cancel of the same round", async () => {
		const { db } = createSmokeDb();

		const bet = await runCallback(db, {
			command: "bet",
			playerId: USER_ID,
			transactionId: "SMOKE_BET_CANCEL",
			roundId: "SMOKE_ROUND_CANCEL",
			providerId: 2,
			providerName: "Pragmatic",
			gameCode: "vs20olympgate",
			gameName: "Gates of Olympus",
			currency: "NGN",
			amount: 50,
		});
		assert.deepEqual(bet, { balance: 19950, statusCode: "OK" });

		const cancel = await runCallback(db, {
			command: "cancel",
			playerId: USER_ID,
			transactionId: "SMOKE_CANCEL_1",
			referenceId: "SMOKE_BET_CANCEL",
			roundId: "SMOKE_ROUND_CANCEL",
			providerId: 2,
			providerName: "Pragmatic",
			gameCode: "vs20olympgate",
			gameName: "Gates of Olympus",
			currency: "NGN",
			amount: 50,
		});
		assert.deepEqual(cancel, { balance: 20000, statusCode: "OK" });

		const cancelReplay = await runCallback(db, {
			command: "cancel",
			playerId: USER_ID,
			transactionId: "SMOKE_CANCEL_1",
			referenceId: "SMOKE_BET_CANCEL",
			roundId: "SMOKE_ROUND_CANCEL",
			providerId: 2,
			providerName: "Pragmatic",
			gameCode: "vs20olympgate",
			gameName: "Gates of Olympus",
			currency: "NGN",
			amount: 50,
		});
		assert.deepEqual(cancelReplay, { balance: 20000, statusCode: "OK" });

		const secondCancel = await runCallback(db, {
			command: "cancel",
			playerId: USER_ID,
			transactionId: "SMOKE_CANCEL_2",
			referenceId: "SMOKE_BET_CANCEL",
			roundId: "SMOKE_ROUND_CANCEL",
			providerId: 2,
			providerName: "Pragmatic",
			gameCode: "vs20olympgate",
			gameName: "Gates of Olympus",
			currency: "NGN",
			amount: 50,
		});
		assert.equal(secondCancel.statusCode, "ERR_TRANSACTION_ROLLED_BACK");
		assert.equal(secondCancel.balance, 20000);
	});

	it("rejects an oversized bet without changing the wallet", async () => {
		const { db } = createSmokeDb();

		const poor = await runCallback(db, {
			command: "bet",
			playerId: USER_ID,
			transactionId: "SMOKE_BET_TOO_BIG",
			roundId: "SMOKE_ROUND_POOR",
			providerId: 2,
			providerName: "Pragmatic",
			gameCode: "vs20olympgate",
			gameName: "Gates of Olympus",
			currency: "NGN",
			amount: 999_999,
		});
		assert.equal(poor.statusCode, "ERR_NOT_ENOUGH_MONEY");
		assert.equal(poor.balance, 20000);

		const after = await runCallback(db, {
			command: "balance",
			playerId: USER_ID,
			currency: "NGN",
		});
		assert.deepEqual(after, { balance: 20000, statusCode: "OK" });
	});
});
