/**
 * Wallet-facing side of bonuses, against a real SQLite DB.
 *
 * `rewards.self-check.ts` covers parsing; this covers the money: that an
 * activated bonus actually lands in the player's bonus wallet (and its cash
 * half in the main wallet), lands exactly once under engine retries, and that
 * a later status change can never push a balance negative.
 */
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, it } from "node:test";
import { createMemoryD1 } from "../../test-support/memory-d1";
import type { CloudflareBindings } from "../../types";
import { resolveBonusStatusWalletDeltas } from "./bonus.service";
import {
	applyBonusStatusWalletChanges,
	creditBonusActivation,
} from "./rewards.service";

const USER_ID = "bonus-credit-user";
const USERBONUS_ID = "userbonus-1";
const START_KOBO = 100_000;

let sqlite: DatabaseSync;
let env: CloudflareBindings;

function mainBalance(): number {
	const row = sqlite
		.prepare("SELECT balance FROM wallet WHERE user_id = ?")
		.get(USER_ID) as { balance: number } | undefined;
	return row?.balance ?? 0;
}

function bonusBalance(): number {
	const row = sqlite
		.prepare("SELECT balance FROM game_wallet WHERE user_id = ?")
		.get(USER_ID) as { balance: number } | undefined;
	return row?.balance ?? 0;
}

/** `node:sqlite` returns null-prototype rows, so re-shape for deep equality. */
function ledger(table: "wallet_transaction" | "game_wallet_transaction") {
	const rows = sqlite
		.prepare(
			`SELECT amount, type, reference FROM ${table}
			 WHERE user_id = ? ORDER BY reference`,
		)
		.all(USER_ID) as Array<{
		amount: number;
		type: string;
		reference: string;
	}>;
	return rows.map((row) => ({
		amount: Number(row.amount),
		type: row.type,
		reference: row.reference,
	}));
}

beforeEach(() => {
	sqlite = new DatabaseSync(":memory:");
	sqlite.exec(`
		CREATE TABLE user (
			id text PRIMARY KEY NOT NULL,
			name text NOT NULL,
			email text NOT NULL UNIQUE,
			email_verified integer NOT NULL DEFAULT 0
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
		CREATE TABLE game_wallet (
			id text PRIMARY KEY NOT NULL,
			user_id text NOT NULL UNIQUE,
			balance integer NOT NULL DEFAULT 0,
			created_at integer NOT NULL DEFAULT 0,
			updated_at integer NOT NULL DEFAULT 0
		);
		CREATE TABLE game_wallet_transaction (
			id text PRIMARY KEY NOT NULL,
			user_id text NOT NULL,
			amount integer NOT NULL,
			type text NOT NULL,
			reference text NOT NULL UNIQUE,
			status text NOT NULL,
			created_at integer NOT NULL DEFAULT 0
		);
	`);
	sqlite
		.prepare(
			"INSERT INTO user (id, name, email, email_verified) VALUES (?, ?, ?, 1)",
		)
		.run(USER_ID, "Bonus Credit", "bonus-credit@example.com");
	sqlite
		.prepare("INSERT INTO wallet (id, user_id, balance) VALUES (?, ?, ?)")
		.run("wallet-bonus-credit", USER_ID, START_KOBO);

	const { DB } = createMemoryD1(sqlite);
	env = { DB } as unknown as CloudflareBindings;
});

describe("bonus activation reaches the player's wallets", () => {
	it("puts the bonus in the bonus wallet and the cash in the main wallet", async () => {
		const result = await creditBonusActivation({
			env,
			userId: USER_ID,
			userbonusId: USERBONUS_ID,
			bonusAmountMajor: 2_000,
			cashAmountMajor: 500,
		});

		assert.equal(result.status, "credited");
		assert.equal(result.credited, true);
		assert.equal(bonusBalance(), 200_000);
		assert.equal(mainBalance(), START_KOBO + 50_000);

		assert.deepEqual(ledger("game_wallet_transaction"), [
			{
				amount: 200_000,
				type: "credit",
				reference: `be_bonus_activate:${USERBONUS_ID}:${USER_ID}:bonus`,
			},
		]);
		assert.deepEqual(ledger("wallet_transaction"), [
			{
				amount: 50_000,
				type: "credit",
				reference: `be_bonus_activate:${USERBONUS_ID}:${USER_ID}:cash`,
			},
		]);
	});

	it("creates a bonus wallet for a player who has never had one", async () => {
		const before = sqlite
			.prepare("SELECT COUNT(*) AS n FROM game_wallet")
			.get() as { n: number };
		assert.equal(Number(before.n), 0);

		await creditBonusActivation({
			env,
			userId: USER_ID,
			userbonusId: USERBONUS_ID,
			bonusAmountMajor: 1_000,
			cashAmountMajor: 0,
		});

		assert.equal(bonusBalance(), 100_000);
		assert.equal(mainBalance(), START_KOBO);
	});

	it("credits once when the engine retries activation", async () => {
		const payload = {
			env,
			userId: USER_ID,
			userbonusId: USERBONUS_ID,
			bonusAmountMajor: 2_000,
			cashAmountMajor: 500,
		};

		await creditBonusActivation(payload);
		const retry = await creditBonusActivation(payload);

		assert.equal(retry.status, "already_credited");
		assert.equal(retry.credited, false);
		assert.equal(bonusBalance(), 200_000);
		assert.equal(mainBalance(), START_KOBO + 50_000);
		assert.equal(ledger("game_wallet_transaction").length, 1);
		assert.equal(ledger("wallet_transaction").length, 1);
	});

	it("skips a zero-amount bonus without writing a ledger row", async () => {
		const result = await creditBonusActivation({
			env,
			userId: USER_ID,
			userbonusId: USERBONUS_ID,
			bonusAmountMajor: 0,
			cashAmountMajor: 0,
		});

		assert.equal(result.status, "skipped");
		assert.equal(mainBalance(), START_KOBO);
		assert.equal(ledger("wallet_transaction").length, 0);
		assert.equal(ledger("game_wallet_transaction").length, 0);
	});

	it("does not credit a player with no wallet row", async () => {
		sqlite.prepare("DELETE FROM wallet WHERE user_id = ?").run(USER_ID);

		const result = await creditBonusActivation({
			env,
			userId: USER_ID,
			userbonusId: USERBONUS_ID,
			bonusAmountMajor: 0,
			cashAmountMajor: 500,
		});

		assert.equal(result.status, "wallet_missing");
		assert.equal(ledger("wallet_transaction").length, 0);
	});
});

describe("bonus status changes applied to wallets", () => {
	it("debits the bonus wallet when the engine consumes bonus funds", async () => {
		await creditBonusActivation({
			env,
			userId: USER_ID,
			userbonusId: USERBONUS_ID,
			bonusAmountMajor: 2_000,
			cashAmountMajor: 0,
		});

		// `updateBonus` sends a positive bonus amount_change for funds leaving
		// the bonus wallet.
		const deltas = resolveBonusStatusWalletDeltas({
			realAmountChange: 0,
			bonusAmountChange: 500,
		});
		assert.equal(deltas.bonusKobo, -50_000);

		const result = await applyBonusStatusWalletChanges({
			env,
			userId: USER_ID,
			bonusId: USERBONUS_ID,
			bonusStatus: "WAGERED",
			realKobo: deltas.realKobo,
			bonusKobo: deltas.bonusKobo,
		});

		assert.equal(result.status, "applied");
		assert.equal(bonusBalance(), 150_000);
	});

	it("clamps a debit so a balance can never go negative", async () => {
		await creditBonusActivation({
			env,
			userId: USER_ID,
			userbonusId: USERBONUS_ID,
			bonusAmountMajor: 100,
			cashAmountMajor: 0,
		});
		assert.equal(bonusBalance(), 10_000);

		await applyBonusStatusWalletChanges({
			env,
			userId: USER_ID,
			bonusId: USERBONUS_ID,
			bonusStatus: "EXPIRED",
			realKobo: 0,
			bonusKobo: -999_999,
		});

		assert.equal(bonusBalance(), 0);
	});

	it("applies a status change once per bonus and status", async () => {
		await creditBonusActivation({
			env,
			userId: USER_ID,
			userbonusId: USERBONUS_ID,
			bonusAmountMajor: 2_000,
			cashAmountMajor: 0,
		});

		const payload = {
			env,
			userId: USER_ID,
			bonusId: USERBONUS_ID,
			bonusStatus: "WAGERED",
			realKobo: 0,
			bonusKobo: -50_000,
		};

		await applyBonusStatusWalletChanges(payload);
		const retry = await applyBonusStatusWalletChanges(payload);

		assert.equal(retry.status, "already_applied");
		assert.equal(bonusBalance(), 150_000);
	});
});
