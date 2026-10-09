/**
 * Wallet-facing side of bonuses, against a real SQLite DB running the real
 * `0036` migration (columns, ledgers and the bonus-spend trigger).
 *
 * Bonus funds live in the main wallet as a locked part: playable on any game,
 * not withdrawable until the engine reports the bonus COMPLETED. This covers
 * that a bonus lands exactly once, is spent after real cash, that winnings of
 * bonus-funded stakes stay locked, that status changes unlock / forfeit the
 * right amounts once, and that the main ledger always explains the balance.
 */
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, it } from "node:test";
import { debitWallet, debitWithdrawableWallet } from "../../db/atomic-wallet";
import { readWalletFunds } from "../../db/bonus-wallet";
import { applyBonusWalletMigration } from "../../test-support/bonus-wallet-schema";
import { createMemoryD1 } from "../../test-support/memory-d1";
import type { CloudflareBindings } from "../../types";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../db/schema";
import {
	captureBonusStakeSplit,
	lockBonusShareOfResult,
} from "./bonus-stake.service";
import {
	applyBonusStatusWalletChanges,
	creditBonusActivation,
	forfeitCancelledBonus,
} from "./rewards.service";

const USER_ID = "bonus-credit-user";
const USERBONUS_ID = "userbonus-1";
const START_KOBO = 100_000;

let sqlite: DatabaseSync;
let env: CloudflareBindings;

function createBaseSchema(db: DatabaseSync) {
	db.exec(`
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
	`);
	db.prepare(
		"INSERT INTO user (id, name, email, email_verified) VALUES (?, ?, ?, 1)",
	).run(USER_ID, "Bonus Credit", "bonus-credit@example.com");
	db.prepare("INSERT INTO wallet (id, user_id, balance) VALUES (?, ?, ?)").run(
		"wallet-bonus-credit",
		USER_ID,
		START_KOBO,
	);
}

function useDatabase(db: DatabaseSync) {
	sqlite = db;
	const { DB } = createMemoryD1(db);
	env = { DB } as unknown as CloudflareBindings;
}

function wallet() {
	const row = sqlite
		.prepare(
			"SELECT balance, bonus_balance, frozen_balance, last_debit_kobo, last_debit_bonus_kobo FROM wallet WHERE user_id = ?",
		)
		.get(USER_ID) as
		| {
				balance: number;
				bonus_balance: number;
				frozen_balance: number;
				last_debit_kobo: number;
				last_debit_bonus_kobo: number;
		  }
		| undefined;
	return {
		balance: Number(row?.balance ?? 0),
		bonus: Number(row?.bonus_balance ?? 0),
		frozen: Number(row?.frozen_balance ?? 0),
		lastDebitBonus: Number(row?.last_debit_bonus_kobo ?? 0),
	};
}

async function withdrawable(): Promise<number> {
	return (await readWalletFunds(env.DB, USER_ID))?.withdrawableKobo ?? 0;
}

/** Same sign rules as `wallet-reconciliation.ts`. */
function ledgerSum(): number {
	const row = sqlite
		.prepare(
			`SELECT COALESCE(SUM(CASE
				WHEN type IN ('credit','refund','deposit') AND status = 'success' THEN amount
				WHEN type IN ('debit','withdrawal','withdraw') AND status NOT IN ('rejected','failed') THEN -amount
				ELSE 0 END), 0) AS total
			 FROM wallet_transaction WHERE user_id = ?`,
		)
		.get(USER_ID) as { total: number };
	return Number(row.total);
}

/** The wallet started with START_KOBO that predates any ledger row. */
function assertLedgerExplainsBalance() {
	assert.equal(wallet().balance, START_KOBO + ledgerSum());
}

function references(table: "wallet_transaction" | "bonus_wallet_ledger") {
	return (
		sqlite
			.prepare(
				`SELECT reference FROM ${table} WHERE user_id = ? ORDER BY reference`,
			)
			.all(USER_ID) as Array<{ reference: string }>
	).map((row) => row.reference);
}

/** Simulates a provider stake debit (the path every casino adapter uses). */
async function stake(amountKobo: number) {
	const db = drizzle(env.DB, { schema });
	const result = await debitWallet(db, USER_ID, amountKobo);
	assert.ok(result, `stake of ${amountKobo} should succeed`);
	sqlite
		.prepare(
			"INSERT INTO wallet_transaction (id, user_id, amount, type, reference, status, payment_method) VALUES (?, ?, ?, 'debit', ?, 'success', 'casino')",
		)
		.run(
			crypto.randomUUID(),
			USER_ID,
			amountKobo,
			`stake:${crypto.randomUUID()}`,
		);
}

/** Simulates a provider win credit with its ledger row. */
function creditWin(amountKobo: number) {
	sqlite
		.prepare("UPDATE wallet SET balance = balance + ? WHERE user_id = ?")
		.run(amountKobo, USER_ID);
	sqlite
		.prepare(
			"INSERT INTO wallet_transaction (id, user_id, amount, type, reference, status, payment_method) VALUES (?, ?, ?, 'credit', ?, 'success', 'casino')",
		)
		.run(
			crypto.randomUUID(),
			USER_ID,
			amountKobo,
			`win:${crypto.randomUUID()}`,
		);
}

function markActive(bonusId: string) {
	sqlite
		.prepare(
			"INSERT OR REPLACE INTO bonus_engine_user_bonus (user_id, bonus_id, status, payload_json) VALUES (?, ?, 'ACTIVE', '{}')",
		)
		.run(USER_ID, bonusId);
}

async function activate(
	bonusAmountMajor: number,
	cashAmountMajor = 0,
	id = USERBONUS_ID,
) {
	markActive(id);
	return creditBonusActivation({
		env,
		userId: USER_ID,
		userbonusId: id,
		bonusAmountMajor,
		cashAmountMajor,
	});
}

beforeEach(() => {
	const db = new DatabaseSync(":memory:");
	createBaseSchema(db);
	applyBonusWalletMigration(db);
	useDatabase(db);
});

describe("bonus activation lands in the main wallet, locked", () => {
	it("locks bonus_amount and pays cash_amount as withdrawable cash", async () => {
		const result = await activate(2_000, 500);

		assert.equal(result.status, "credited");
		assert.equal(result.credited, true);
		assert.deepEqual(wallet(), {
			balance: START_KOBO + 250_000,
			bonus: 200_000,
			frozen: 0,
			lastDebitBonus: 0,
		});
		assert.equal(await withdrawable(), START_KOBO + 50_000);
		assert.deepEqual(references("wallet_transaction"), [
			`be_bonus_activate:${USERBONUS_ID}:${USER_ID}:bonus`,
			`be_bonus_activate:${USERBONUS_ID}:${USER_ID}:cash`,
		]);
		assert.deepEqual(references("bonus_wallet_ledger"), [
			`be_bonus_activate:${USERBONUS_ID}:${USER_ID}:bonus`,
		]);
		assertLedgerExplainsBalance();
	});

	it("credits once when the engine retries activation", async () => {
		await activate(2_000, 500);
		const retry = await activate(2_000, 500);

		assert.equal(retry.status, "already_credited");
		assert.equal(retry.credited, false);
		assert.equal(wallet().balance, START_KOBO + 250_000);
		assert.equal(wallet().bonus, 200_000);
		assert.equal(references("wallet_transaction").length, 2);
		assertLedgerExplainsBalance();
	});

	it("credits once under two parallel activations", async () => {
		const [first, second] = await Promise.all([
			activate(1_000),
			activate(1_000),
		]);
		assert.deepEqual([first.status, second.status].sort(), [
			"already_credited",
			"credited",
		]);
		assert.equal(wallet().bonus, 100_000);
		assertLedgerExplainsBalance();
	});

	it("skips a zero-amount bonus without writing a ledger row", async () => {
		const result = await activate(0, 0);
		assert.equal(result.status, "skipped");
		assert.equal(wallet().balance, START_KOBO);
		assert.equal(references("wallet_transaction").length, 0);
	});

	it("does not credit a player with no wallet row", async () => {
		sqlite.prepare("DELETE FROM wallet WHERE user_id = ?").run(USER_ID);
		const result = await activate(100, 500);
		assert.equal(result.status, "wallet_missing");
		assert.equal(references("wallet_transaction").length, 0);
		assert.equal(references("bonus_wallet_ledger").length, 0);
	});
});

describe("game_wallet migration", () => {
	it("moves existing bonus funds into the locked balance and keeps old references", async () => {
		const db = new DatabaseSync(":memory:");
		createBaseSchema(db);
		db.exec(`
			CREATE TABLE game_wallet (
				id text PRIMARY KEY NOT NULL, user_id text NOT NULL UNIQUE,
				balance integer NOT NULL DEFAULT 0,
				created_at integer NOT NULL DEFAULT 0, updated_at integer NOT NULL DEFAULT 0
			);
			CREATE TABLE game_wallet_transaction (
				id text PRIMARY KEY NOT NULL, user_id text NOT NULL, amount integer NOT NULL,
				type text NOT NULL, reference text NOT NULL UNIQUE, status text NOT NULL,
				created_at integer NOT NULL DEFAULT 0
			);
		`);
		db.prepare(
			"INSERT INTO game_wallet (id, user_id, balance) VALUES ('gw', ?, 30000)",
		).run(USER_ID);
		db.prepare(
			"INSERT INTO game_wallet_transaction (id, user_id, amount, type, reference, status) VALUES ('gwt', ?, 30000, 'credit', ?, 'completed')",
		).run(USER_ID, `be_bonus_activate:legacy-bonus:${USER_ID}:bonus`);

		applyBonusWalletMigration(db);
		useDatabase(db);

		assert.equal(wallet().balance, START_KOBO + 30_000);
		assert.equal(wallet().bonus, 30_000);
		assert.equal(await withdrawable(), START_KOBO);
		const gameWallet = db.prepare("SELECT balance FROM game_wallet").get() as {
			balance: number;
		};
		assert.equal(Number(gameWallet.balance), 0);
		assertLedgerExplainsBalance();

		// An engine retry of the legacy activation must not pay it again.
		const retry = await activate(300, 0, "legacy-bonus");
		assert.equal(retry.status, "already_credited");
		assert.equal(wallet().bonus, 30_000);
	});
});

describe("bonus funds are spent after real cash", () => {
	it("leaves the bonus locked while real cash covers the stake", async () => {
		await activate(2_000);
		await stake(60_000);
		assert.equal(wallet().bonus, 200_000);
		assert.equal(wallet().lastDebitBonus, 0);
		assert.equal(await withdrawable(), START_KOBO - 60_000);
	});

	it("draws on bonus funds once real cash runs out and records the share", async () => {
		await activate(2_000);
		await stake(150_000); // 100,000 real + 50,000 bonus
		assert.equal(wallet().balance, 150_000);
		assert.equal(wallet().bonus, 150_000);
		assert.equal(wallet().lastDebitBonus, 50_000);
		assert.equal(await withdrawable(), 0);

		const spend = sqlite
			.prepare("SELECT amount FROM bonus_wallet_ledger WHERE kind = 'spend'")
			.all() as Array<{ amount: number }>;
		assert.deepEqual(
			spend.map((row) => Number(row.amount)),
			[-50_000],
		);
		assertLedgerExplainsBalance();
	});

	it("never lets money leave the platform out of locked bonus or frozen stakes", async () => {
		await activate(2_000);
		sqlite
			.prepare("UPDATE wallet SET frozen_balance = 20000 WHERE user_id = ?")
			.run(USER_ID);
		const db = drizzle(env.DB, { schema });

		assert.equal(await withdrawable(), START_KOBO - 20_000);
		assert.equal(
			await debitWithdrawableWallet(db, USER_ID, START_KOBO - 19_999),
			undefined,
		);
		assert.ok(await debitWithdrawableWallet(db, USER_ID, START_KOBO - 20_000));
		assert.equal(wallet().bonus, 200_000);
	});
});

describe("winnings of bonus-funded stakes stay locked", () => {
	beforeEach(() => {
		sqlite
			.prepare("UPDATE wallet SET balance = 10000 WHERE user_id = ?")
			.run(USER_ID);
	});

	function setRealBalance() {
		// The wallet started at 10,000 real for these cases.
		return 10_000;
	}

	it("locks the bonus share of a win and records the split", async () => {
		const real = setRealBalance();
		await activate(900); // 90,000 locked
		await stake(40_000); // 10,000 real + 30,000 bonus → 75%

		const split = await captureBonusStakeSplit({
			env,
			userId: USER_ID,
			betRef: "bet-1",
			stakeKobo: 40_000,
		});
		assert.deepEqual(split, { realKobo: 10_000, bonusKobo: 30_000 });

		creditWin(80_000);
		const result = await lockBonusShareOfResult({
			env,
			userId: USER_ID,
			betRef: "bet-1",
			resultRef: "bet-1:result",
			amountKobo: 80_000,
		});
		assert.deepEqual(result, { realKobo: 20_000, bonusKobo: 60_000 });
		assert.equal(wallet().balance, real + 90_000 - 40_000 + 80_000);
		assert.equal(wallet().bonus, 60_000 + 60_000);
		assert.equal(await withdrawable(), 20_000);

		// A redelivered result locks nothing more.
		await lockBonusShareOfResult({
			env,
			userId: USER_ID,
			betRef: "bet-1",
			resultRef: "bet-1:result",
			amountKobo: 80_000,
		});
		assert.equal(wallet().bonus, 120_000);
	});

	it("falls back to the latest stake's share when the result id differs", async () => {
		await activate(900);
		await stake(40_000);
		creditWin(40_000);
		const result = await lockBonusShareOfResult({
			env,
			userId: USER_ID,
			betRef: "win-tx-not-the-bet-id",
			resultRef: "win-tx-not-the-bet-id:result",
			amountKobo: 40_000,
		});
		assert.equal(result.bonusKobo, 30_000); // 30,000 of the 40,000 stake
	});

	it("does not guess when linking is required (sportsbook)", async () => {
		await activate(900);
		await stake(40_000);
		creditWin(40_000);
		const result = await lockBonusShareOfResult({
			env,
			userId: USER_ID,
			betRef: "unknown-bet",
			resultRef: "unknown-bet:settle",
			amountKobo: 40_000,
			allowLatestDebitFallback: false,
		});
		assert.deepEqual(result, { realKobo: 40_000, bonusKobo: 0 });
	});

	it("locks nothing for a stake paid fully with real cash", async () => {
		await activate(900);
		await stake(5_000);
		const split = await captureBonusStakeSplit({
			env,
			userId: USER_ID,
			betRef: "bet-real",
			stakeKobo: 5_000,
		});
		assert.deepEqual(split, { realKobo: 5_000, bonusKobo: 0 });
		creditWin(50_000);
		const result = await lockBonusShareOfResult({
			env,
			userId: USER_ID,
			betRef: "bet-real",
			resultRef: "bet-real:result",
			amountKobo: 50_000,
		});
		assert.equal(result.bonusKobo, 0);
		assert.equal(wallet().bonus, 90_000);
	});
});

describe("updateBonus status changes", () => {
	it("COMPLETED unlocks the converted amount and forfeits what is above the cap", async () => {
		await activate(2_000);
		const result = await applyBonusStatusWalletChanges({
			env,
			userId: USER_ID,
			bonusId: USERBONUS_ID,
			bonusStatus: "COMPLETED",
			realAmountChangeMajor: 1_500,
			bonusAmountChangeMajor: 2_000,
		});

		assert.equal(result.status, "applied");
		assert.equal(result.unlockedKobo, 150_000);
		assert.equal(result.forfeitedKobo, 50_000);
		assert.equal(wallet().balance, START_KOBO + 150_000);
		assert.equal(wallet().bonus, 0);
		assert.equal(await withdrawable(), START_KOBO + 150_000);
		assertLedgerExplainsBalance();
	});

	it("applies a terminal status once even if the engine resends it", async () => {
		await activate(2_000);
		const payload = {
			env,
			userId: USER_ID,
			bonusId: USERBONUS_ID,
			bonusStatus: "COMPLETED",
			realAmountChangeMajor: 1_000,
			bonusAmountChangeMajor: 2_000,
		};
		await applyBonusStatusWalletChanges(payload);
		const retry = await applyBonusStatusWalletChanges(payload);
		assert.equal(retry.status, "already_applied");
		assert.equal(wallet().balance, START_KOBO + 100_000);
		assertLedgerExplainsBalance();
	});

	it("never mints cash: conversion is capped by what is still locked", async () => {
		await activate(2_000);
		await stake(250_000); // all real + 150,000 of the bonus
		assert.equal(wallet().bonus, 50_000);
		await applyBonusStatusWalletChanges({
			env,
			userId: USER_ID,
			bonusId: USERBONUS_ID,
			bonusStatus: "COMPLETED",
			realAmountChangeMajor: 2_000,
			bonusAmountChangeMajor: 2_000,
		});
		assert.equal(wallet().balance, 50_000);
		assert.equal(wallet().bonus, 0);
		assertLedgerExplainsBalance();
	});

	for (const [status, sign] of [
		["CANCELLED", 1],
		["CANCELED", -1],
		["EXPIRED", 1],
		["LOST", -1],
	] as const) {
		it(`${status} forfeits the bonus whatever the sign convention (${sign})`, async () => {
			await activate(2_000);
			const result = await applyBonusStatusWalletChanges({
				env,
				userId: USER_ID,
				bonusId: USERBONUS_ID,
				bonusStatus: status,
				realAmountChangeMajor: 0,
				bonusAmountChangeMajor: sign * 2_000,
			});
			assert.equal(result.forfeitedKobo, 200_000);
			assert.equal(wallet().balance, START_KOBO);
			assert.equal(wallet().bonus, 0);
			assertLedgerExplainsBalance();
		});
	}

	it("falls back to the bonus's own funds when a terminal status has no amounts", async () => {
		await activate(2_000);
		const result = await applyBonusStatusWalletChanges({
			env,
			userId: USER_ID,
			bonusId: USERBONUS_ID,
			bonusStatus: "EXPIRED",
			realAmountChangeMajor: 0,
			bonusAmountChangeMajor: 0,
		});
		assert.equal(result.forfeitedKobo, 200_000);
		assert.equal(wallet().balance, START_KOBO);
	});

	it("never takes real cash on a negative real_amount_change", async () => {
		await activate(1_000);
		await applyBonusStatusWalletChanges({
			env,
			userId: USER_ID,
			bonusId: USERBONUS_ID,
			bonusStatus: "LOST",
			realAmountChangeMajor: -900,
			bonusAmountChangeMajor: 1_000,
		});
		assert.equal(wallet().balance, START_KOBO);
		assert.equal(await withdrawable(), START_KOBO);
	});

	it("ACTIVE grants the bonus under the activation key (no double credit)", async () => {
		await activate(1_000);
		const result = await applyBonusStatusWalletChanges({
			env,
			userId: USER_ID,
			bonusId: USERBONUS_ID,
			bonusStatus: "ACTIVE",
			realAmountChangeMajor: 0,
			bonusAmountChangeMajor: 1_000,
		});
		assert.equal(result.status, "already_applied");
		assert.equal(wallet().bonus, 100_000);
	});

	it("moves nothing for a status it does not understand", async () => {
		await activate(1_000);
		const result = await applyBonusStatusWalletChanges({
			env,
			userId: USER_ID,
			bonusId: USERBONUS_ID,
			bonusStatus: "WAGERED",
			realAmountChangeMajor: 50,
			bonusAmountChangeMajor: 500,
		});
		assert.equal(result.status, "skipped");
		assert.equal(wallet().bonus, 100_000);
	});

	it("never forfeits stakes frozen for pending sportsbook bets", async () => {
		await activate(2_000);
		sqlite
			.prepare("UPDATE wallet SET frozen_balance = 250000 WHERE user_id = ?")
			.run(USER_ID);
		await applyBonusStatusWalletChanges({
			env,
			userId: USER_ID,
			bonusId: USERBONUS_ID,
			bonusStatus: "EXPIRED",
			realAmountChangeMajor: 0,
			bonusAmountChangeMajor: 2_000,
		});
		// 300,000 balance − 250,000 frozen leaves 50,000 forfeitable.
		assert.equal(wallet().balance, 250_000);
		assert.ok(wallet().balance >= wallet().frozen);
	});
});

describe("player cancel claws the bonus back", () => {
	it("forfeits the bonus and its locked winnings, once across both paths", async () => {
		sqlite
			.prepare("UPDATE wallet SET balance = 0 WHERE user_id = ?")
			.run(USER_ID);
		await activate(1_000);
		await stake(50_000);
		await captureBonusStakeSplit({
			env,
			userId: USER_ID,
			betRef: "b",
			stakeKobo: 50_000,
		});
		creditWin(200_000);
		await lockBonusShareOfResult({
			env,
			userId: USER_ID,
			betRef: "b",
			resultRef: "b:result",
			amountKobo: 200_000,
		});
		assert.equal(wallet().bonus, 250_000);

		const cancel = await forfeitCancelledBonus({
			env,
			userId: USER_ID,
			bonusId: USERBONUS_ID,
		});
		assert.equal(cancel.forfeitedKobo, 250_000);
		assert.equal(wallet().balance, 0);

		// The engine's own CANCELLED callback afterwards changes nothing.
		const engine = await applyBonusStatusWalletChanges({
			env,
			userId: USER_ID,
			bonusId: USERBONUS_ID,
			bonusStatus: "CANCELLED",
			realAmountChangeMajor: 0,
			bonusAmountChangeMajor: 2_500,
		});
		assert.equal(engine.status, "already_applied");
		assert.equal(wallet().balance, 0);
	});

	it("only forfeits this bonus's grant when another bonus is active", async () => {
		await activate(1_000, 0, "bonus-a");
		await activate(500, 0, "bonus-b");
		await forfeitCancelledBonus({ env, userId: USER_ID, bonusId: "bonus-a" });
		assert.equal(wallet().bonus, 50_000);
		assert.equal(wallet().balance, START_KOBO + 50_000);
		assertLedgerExplainsBalance();
	});
});
