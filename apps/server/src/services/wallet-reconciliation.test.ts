import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import type { CloudflareBindings } from "../types";
import {
	getWalletReconciliationOutcome,
	runWalletReconciliation,
} from "./wallet-reconciliation";

type SqlParam = string | number | bigint | null | Uint8Array;

class MemoryD1Statement {
	constructor(
		private readonly sqlite: DatabaseSync,
		private readonly sql: string,
		private readonly params: SqlParam[] = [],
	) {}

	bind(...params: unknown[]) {
		return new MemoryD1Statement(
			this.sqlite,
			this.sql,
			params.map((value) => value as SqlParam),
		);
	}

	async all() {
		const results = this.sqlite.prepare(this.sql).all(...this.params) as Record<
			string,
			unknown
		>[];
		return { results, success: true as const };
	}

	async raw() {
		const statement = this.sqlite.prepare(this.sql);
		const rows = statement.all(...this.params) as Record<string, unknown>[];
		const columns = statement.columns().map((column) => column.name);
		return rows.map((row) => columns.map((name) => row[name]));
	}
}

class MemoryD1 {
	constructor(private readonly sqlite: DatabaseSync) {}

	prepare(sql: string) {
		return new MemoryD1Statement(this.sqlite, sql);
	}
}

function setup() {
	const sqlite = new DatabaseSync(":memory:");
	sqlite.exec(`
		CREATE TABLE wallet (
			id text PRIMARY KEY,
			user_id text NOT NULL UNIQUE,
			balance integer NOT NULL,
			frozen_balance integer NOT NULL DEFAULT 0,
			created_at integer NOT NULL,
			updated_at integer NOT NULL
		);
		CREATE TABLE wallet_transaction (
			id text PRIMARY KEY,
			user_id text NOT NULL,
			amount integer NOT NULL,
			type text NOT NULL,
			reference text,
			status text NOT NULL,
			payment_method text NOT NULL,
			balance integer,
			metadata text,
			created_at integer NOT NULL
		);
		CREATE TABLE swipegames_transactions (
			id text PRIMARY KEY,
			provider_tx_id text NOT NULL UNIQUE,
			user_id text NOT NULL,
			type text NOT NULL,
			amount integer NOT NULL,
			round_id text NOT NULL,
			session_id text NOT NULL,
			game_id text NOT NULL,
			created_at integer NOT NULL
		);
	`);

	const d1 = new MemoryD1(sqlite);
	const env = { DB: d1 } as unknown as CloudflareBindings;
	return { sqlite, env };
}

function addWallet(
	sqlite: DatabaseSync,
	input: {
		userId: string;
		balance: number;
		frozenBalance?: number;
		status?: string;
	},
) {
	const now = Date.now();
	sqlite
		.prepare(
			"INSERT INTO wallet (id, user_id, balance, frozen_balance, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		)
		.run(
			`wallet-${input.userId}`,
			input.userId,
			input.balance,
			input.frozenBalance ?? 0,
			now,
			now,
		);
	sqlite
		.prepare(
			"INSERT INTO wallet_transaction (id, user_id, amount, type, reference, status, payment_method, balance, created_at) VALUES (?, ?, ?, 'credit', ?, ?, 'test', ?, ?)",
		)
		.run(
			`txn-${input.userId}`,
			input.userId,
			input.balance,
			`ref-${input.userId}`,
			input.status ?? "success",
			input.balance,
			now,
		);
}

describe("wallet reconciliation", () => {
	it("counts completed credits the same as success credits", async () => {
		const { sqlite, env } = setup();
		addWallet(sqlite, {
			userId: "completed-credit",
			balance: 25_000,
			status: "completed",
		});

		const report = await runWalletReconciliation(env, {
			userIds: ["completed-credit"],
		});

		assert.equal(report.checkedUsers, 1);
		assert.deepEqual(report.driftedUsers, []);
		assert.equal(getWalletReconciliationOutcome(report), "clean");
	});

	it("reports frozen funds without misclassifying total funds as drift", async () => {
		const { sqlite, env } = setup();
		addWallet(sqlite, {
			userId: "frozen-wallet",
			balance: 25_000,
			frozenBalance: 4_000,
		});

		const report = await runWalletReconciliation(env, {
			userIds: ["frozen-wallet"],
		});

		assert.deepEqual(report.driftedUsers, []);
		assert.deepEqual(report.walletsWithFrozenFunds, [
			{
				userId: "frozen-wallet",
				frozenBalanceKobo: 4_000,
				availableBalanceKobo: 21_000,
				expectedAvailableKobo: 21_000,
			},
		]);
	});

	it("keeps exact one-kobo drift detection", async () => {
		const { sqlite, env } = setup();
		addWallet(sqlite, { userId: "one-kobo", balance: 25_000 });
		sqlite
			.prepare("UPDATE wallet SET balance = balance + 1 WHERE user_id = ?")
			.run("one-kobo");

		const report = await runWalletReconciliation(env, {
			userIds: ["one-kobo"],
		});

		assert.equal(report.driftedUsers[0]?.driftKobo, 1);
		assert.equal(getWalletReconciliationOutcome(report), "drift_detected");
	});

	it("distinguishes an empty run", async () => {
		const { env } = setup();
		const report = await runWalletReconciliation(env, {
			userIds: ["missing-wallet"],
		});

		assert.equal(report.checkedUsers, 0);
		assert.equal(getWalletReconciliationOutcome(report), "no_wallets_checked");
	});
});
