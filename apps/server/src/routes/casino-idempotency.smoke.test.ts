/**
 * Concurrent duplicate-callback tests for the casino wallet fixes.
 *
 * The bug class is a race: the old code checked for an existing provider
 * transaction, moved money, THEN inserted the ledger row — so two identical
 * callbacks in flight both passed the check and both moved money. These tests
 * fire the same transactionId twice in parallel (Promise.all) against the
 * REAL route handlers over an in-memory D1 and assert money moves exactly once.
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createMemoryD1 } from "../test-support/memory-d1";
import {
	computeHashcodexSignature,
	HASHCODEX_SIGNATURE_HEADER,
} from "../utils/hashcodex-security";
import hallaPocketsRoute from "./halla-pockets";
import hashcodexRoute from "./hashcodex";
import pocketsRoute from "./pockets";
import slotegratorRoute from "./slotegrator";
import thundrRoute from "./thundr";

const USER_ID = "casino-idem-user";
const START_KOBO = 1_000_000; // ₦10,000
const POCKETS_API_KEY = "pockets-idem-key";
const THNDR_SECRET = "thndr-idem-secret";
const THNDR_SESSION = "thndr-idem-session";
const SLOT_MERCHANT_ID = "slot-idem-merchant";
const SLOT_MERCHANT_KEY = "slot-idem-key";
const SLOT_SESSION = "slot-idem-session";
const HASHCODEX_SECRET = "hashcodex-idem-secret";

let sqlite: DatabaseSync;
let env: Record<string, unknown>;
let originalFetch: typeof globalThis.fetch;

function createSchema(db: DatabaseSync) {
	db.exec(`
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
		CREATE TABLE pockets_transactions (
			id text PRIMARY KEY NOT NULL,
			user_id text NOT NULL,
			type text NOT NULL,
			amount integer NOT NULL,
			balance_before integer,
			balance_after integer,
			currency text NOT NULL,
			created_at integer NOT NULL DEFAULT 0
		);
		CREATE TABLE thundr_sessions (
			session_id text PRIMARY KEY NOT NULL,
			user_id text NOT NULL,
			game_id text NOT NULL,
			status text NOT NULL DEFAULT 'active',
			created_at integer NOT NULL DEFAULT 0,
			updated_at integer NOT NULL DEFAULT 0
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
	`);

	db.prepare(
		"INSERT INTO user (id, name, email, email_verified) VALUES (?, ?, ?, 1)",
	).run(USER_ID, "Casino Idem", "casino-idem@example.com");
	db.prepare("INSERT INTO wallet (id, user_id, balance) VALUES (?, ?, ?)").run(
		"wallet-casino-idem",
		USER_ID,
		START_KOBO,
	);
	db.prepare(
		"INSERT INTO thundr_sessions (session_id, user_id, game_id) VALUES (?, ?, ?)",
	).run(THNDR_SESSION, USER_ID, "blackjack");
}

beforeEach(() => {
	sqlite = new DatabaseSync(":memory:");
	createSchema(sqlite);
	const { DB } = createMemoryD1(sqlite);
	env = {
		DB,
		POCKETS_SECRET_KEY: POCKETS_API_KEY,
		THNDR_SERVER_SECRET: THNDR_SECRET,
		SLOTITEGRATION_MERCHANT_ID: SLOT_MERCHANT_ID,
		SLOTITEGRATION_MERCHANT_KEY: SLOT_MERCHANT_KEY,
		HASHCODEX_SERVER_SECRET: HASHCODEX_SECRET,
	};
	// Bonus Engine reporting is background/best-effort; keep it offline.
	originalFetch = globalThis.fetch;
	globalThis.fetch = (async () => {
		throw new Error("outbound fetch disabled in idempotency tests");
	}) as typeof globalThis.fetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	sqlite.close();
});

function walletBalance(): number {
	const row = sqlite
		.prepare("SELECT balance FROM wallet WHERE user_id = ?")
		.get(USER_ID) as { balance: number };
	return row.balance;
}

function countRows(
	table: string,
	where: string,
	...params: Array<string | number>
): number {
	const row = sqlite
		.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`)
		.get(...params) as { n: number };
	return Number(row.n);
}

// ---------------------------------------------------------------------------
// Lagos Rush /pockets/*
// ---------------------------------------------------------------------------

async function postPockets(
	path: "/debit" | "/credit" | "/refund",
	body: Record<string, unknown>,
) {
	return pocketsRoute.request(
		path,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": POCKETS_API_KEY,
			},
			body: JSON.stringify(body),
		},
		env,
	);
}

describe("Lagos Rush /pockets idempotency", () => {
	it("rejects money calls without a transactionId", async () => {
		const res = await postPockets("/credit", {
			playerId: USER_ID,
			amount: 5_000,
			currency: "NGN",
		});
		assert.equal(res.status, 400, await res.text());
		assert.equal(walletBalance(), START_KOBO);
	});

	it("credits once for two parallel identical credit callbacks", async () => {
		const body = {
			playerId: USER_ID,
			amount: 5_000,
			currency: "NGN",
			transactionId: "lr-win-1",
		};
		const [a, b] = await Promise.all([
			postPockets("/credit", body),
			postPockets("/credit", body),
		]);
		assert.equal(a.status, 200, await a.text());
		assert.equal(b.status, 200, await b.text());
		assert.equal(walletBalance(), START_KOBO + 5_000);
		assert.equal(
			countRows("pockets_transactions", "id = ?", "pockets:credit:lr-win-1"),
			1,
		);

		// Sequential replay is an echo, not another credit.
		const retry = await postPockets("/credit", body);
		assert.equal(retry.status, 200, await retry.text());
		assert.equal(walletBalance(), START_KOBO + 5_000);
	});

	it("debits once for two parallel identical debit callbacks", async () => {
		const body = {
			playerId: USER_ID,
			amount: 7_000,
			currency: "NGN",
			transactionId: "lr-bet-1",
		};
		const [a, b] = await Promise.all([
			postPockets("/debit", body),
			postPockets("/debit", body),
		]);
		assert.equal(a.status, 200, await a.text());
		assert.equal(b.status, 200, await b.text());
		assert.equal(walletBalance(), START_KOBO - 7_000);
	});

	it("refunds once for duplicate refund callbacks", async () => {
		const body = {
			playerId: USER_ID,
			amount: 3_000,
			currency: "NGN",
			transactionId: "lr-refund-1",
		};
		const [a, b] = await Promise.all([
			postPockets("/refund", body),
			postPockets("/refund", body),
		]);
		assert.equal(a.status, 200, await a.text());
		assert.equal(b.status, 200, await b.text());
		assert.equal(walletBalance(), START_KOBO + 3_000);
	});

	it("rejects non-integer and non-positive kobo amounts", async () => {
		for (const amount of [10.5, 0, -100]) {
			const res = await postPockets("/credit", {
				playerId: USER_ID,
				amount,
				currency: "NGN",
				transactionId: `lr-bad-${amount}`,
			});
			assert.equal(res.status, 400, await res.text());
		}
		assert.equal(walletBalance(), START_KOBO);
	});
});

describe("Halla /halla/pockets idempotency (Naira units)", () => {
	it("credits ₦50 exactly once for parallel duplicates", async () => {
		const body = {
			playerId: USER_ID,
			amount: 50,
			currency: "NGN",
			transactionId: "halla-win-1",
		};
		const post = () =>
			hallaPocketsRoute.request(
				"/credit",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-api-key": POCKETS_API_KEY,
					},
					body: JSON.stringify(body),
				},
				env,
			);
		const [a, b] = await Promise.all([post(), post()]);
		assert.equal(a.status, 200, await a.text());
		assert.equal(b.status, 200, await b.text());
		assert.equal(walletBalance(), START_KOBO + 5_000);
	});
});

// ---------------------------------------------------------------------------
// Thndr /thndr/transactions
// ---------------------------------------------------------------------------

async function postThundr(tx: Record<string, unknown>) {
	const rawBody = JSON.stringify(tx);
	const signature = createHmac("sha256", THNDR_SECRET)
		.update(rawBody)
		.digest("hex");
	return thundrRoute.request(
		"/transactions",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-server-authorization": signature,
			},
			body: rawBody,
		},
		env,
	);
}

function thundrTx(
	type: string,
	transactionId: string,
	extra: Record<string, unknown> = {},
) {
	return {
		type,
		transactionId,
		requestedAt: new Date().toISOString(),
		userId: USER_ID,
		sessionId: THNDR_SESSION,
		roundId: "round-1",
		currency: "NGN",
		gameId: "blackjack",
		...extra,
	};
}

describe("Thndr /transactions idempotency", () => {
	it("rejects a WIN with no prior BET for the round", async () => {
		const res = await postThundr(
			thundrTx("WIN", "th-win-orphan", { amount: 9_000 }),
		);
		assert.equal(res.status, 403, await res.text());
		assert.equal(walletBalance(), START_KOBO);
	});

	it("debits a BET once for parallel duplicates, credits a WIN once", async () => {
		const bet = thundrTx("BET", "th-bet-1", { amount: 10_000 });
		const [betA, betB] = await Promise.all([postThundr(bet), postThundr(bet)]);
		assert.equal(betA.status, 200, await betA.text());
		assert.equal(betB.status, 200, await betB.text());
		assert.equal(walletBalance(), START_KOBO - 10_000);

		const win = thundrTx("WIN", "th-win-1", { amount: 25_000 });
		const [winA, winB] = await Promise.all([postThundr(win), postThundr(win)]);
		assert.equal(winA.status, 200, await winA.text());
		assert.equal(winB.status, 200, await winB.text());
		assert.equal(walletBalance(), START_KOBO - 10_000 + 25_000);
		assert.equal(
			countRows("thundr_transactions", "transaction_id = ?", "th-win-1"),
			1,
		);
	});

	it("rolls a bet back only once, even with different rollback transactionIds", async () => {
		const bet = thundrTx("BET", "th-bet-rb", { amount: 4_000 });
		assert.equal((await postThundr(bet)).status, 200);
		assert.equal(walletBalance(), START_KOBO - 4_000);

		const rollbackA = thundrTx("ROLLBACK", "th-rb-a", {
			originalTransactionId: "th-bet-rb",
		});
		const rollbackB = thundrTx("ROLLBACK", "th-rb-b", {
			originalTransactionId: "th-bet-rb",
		});
		const [a, b] = await Promise.all([
			postThundr(rollbackA),
			postThundr(rollbackB),
		]);
		assert.equal(a.status, 200, await a.text());
		assert.equal(b.status, 200, await b.text());
		assert.equal(walletBalance(), START_KOBO);

		// A third attempt with yet another id still cannot re-credit.
		const again = await postThundr(
			thundrTx("ROLLBACK", "th-rb-c", {
				originalTransactionId: "th-bet-rb",
			}),
		);
		assert.equal(again.status, 200, await again.text());
		assert.equal(walletBalance(), START_KOBO);
	});

	it("rejects an unsigned request", async () => {
		const res = await thundrRoute.request(
			"/transactions",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(thundrTx("WIN", "th-forged", { amount: 9_000 })),
			},
			env,
		);
		assert.equal(res.status, 403);
		assert.equal(walletBalance(), START_KOBO);
	});
});

// ---------------------------------------------------------------------------
// Slotegrator POST /slotegrator
// ---------------------------------------------------------------------------

async function postSlotegrator(fields: Record<string, string>) {
	const body = new URLSearchParams(fields).toString();
	const timestamp = Math.floor(Date.now() / 1000).toString();
	const nonce = "idem-nonce";
	const allParams: Record<string, string> = {
		...Object.fromEntries(new URLSearchParams(body).entries()),
		"X-Merchant-Id": SLOT_MERCHANT_ID,
		"X-Timestamp": timestamp,
		"X-Nonce": nonce,
	};
	const queryString = Object.keys(allParams)
		.sort()
		.map((key) => `${key}=${allParams[key]}`)
		.join("&");
	const sign = createHmac("sha1", SLOT_MERCHANT_KEY)
		.update(queryString)
		.digest("hex");

	return slotegratorRoute.request(
		"/",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"X-Merchant-Id": SLOT_MERCHANT_ID,
				"X-Timestamp": timestamp,
				"X-Nonce": nonce,
				"X-Sign": sign,
			},
			body,
		},
		env,
	);
}

function slotBet(transactionId: string, amountNaira: string, roundId = "r-1") {
	return {
		action: "bet",
		player_id: USER_ID,
		amount: amountNaira,
		currency: "NGN",
		game_uuid: "slot-game-1",
		transaction_id: transactionId,
		session_id: SLOT_SESSION,
		type: "bet",
		round_id: roundId,
	};
}

describe("Slotegrator callback idempotency", () => {
	it("returns 403 (not 200) on a bad signature and moves no money", async () => {
		const res = await slotegratorRoute.request(
			"/",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					"X-Merchant-Id": SLOT_MERCHANT_ID,
					"X-Timestamp": Math.floor(Date.now() / 1000).toString(),
					"X-Nonce": "n",
					"X-Sign": "forged",
				},
				body: new URLSearchParams(slotBet("forged-tx", "100")).toString(),
			},
			env,
		);
		assert.equal(res.status, 403);
		assert.equal(walletBalance(), START_KOBO);
	});

	it("debits a bet once for parallel duplicates", async () => {
		const fields = slotBet("sl-bet-1", "100");
		const [a, b] = await Promise.all([
			postSlotegrator(fields),
			postSlotegrator(fields),
		]);
		assert.equal(a.status, 200, await a.text());
		assert.equal(b.status, 200, await b.text());
		assert.equal(walletBalance(), START_KOBO - 10_000);
	});

	it("rejects a win with no prior bet", async () => {
		const res = await postSlotegrator({
			action: "win",
			player_id: USER_ID,
			amount: "500",
			currency: "NGN",
			game_uuid: "slot-game-1",
			transaction_id: "sl-win-orphan",
			session_id: SLOT_SESSION,
			type: "win",
			round_id: "r-orphan",
		});
		assert.equal(res.status, 200);
		const body = (await res.json()) as { error_code?: string };
		assert.equal(body.error_code, "INTERNAL_ERROR");
		assert.equal(walletBalance(), START_KOBO);
	});

	it("credits a win once for parallel duplicates", async () => {
		assert.equal(
			(await postSlotegrator(slotBet("sl-bet-2", "100"))).status,
			200,
		);
		const win = {
			action: "win",
			player_id: USER_ID,
			amount: "250",
			currency: "NGN",
			game_uuid: "slot-game-1",
			transaction_id: "sl-win-2",
			session_id: SLOT_SESSION,
			type: "win",
			round_id: "r-1",
		};
		const [a, b] = await Promise.all([
			postSlotegrator(win),
			postSlotegrator(win),
		]);
		assert.equal(a.status, 200, await a.text());
		assert.equal(b.status, 200, await b.text());
		assert.equal(walletBalance(), START_KOBO - 10_000 + 25_000);
	});

	it("refunds the ORIGINAL bet amount once, ignoring the request amount and duplicate refund ids", async () => {
		assert.equal(
			(await postSlotegrator(slotBet("sl-bet-3", "100", "r-3"))).status,
			200,
		);
		assert.equal(walletBalance(), START_KOBO - 10_000);

		const refund = (transactionId: string) => ({
			action: "refund",
			player_id: USER_ID,
			// Lies about the amount — must NOT set the payout.
			amount: "9999",
			currency: "NGN",
			game_uuid: "slot-game-1",
			transaction_id: transactionId,
			session_id: SLOT_SESSION,
			bet_transaction_id: "sl-bet-3",
			type: "refund",
			round_id: "r-3",
		});

		const [a, b] = await Promise.all([
			postSlotegrator(refund("sl-refund-a")),
			postSlotegrator(refund("sl-refund-b")),
		]);
		assert.equal(a.status, 200, await a.text());
		assert.equal(b.status, 200, await b.text());
		// Exactly the ₦100 stake back — once.
		assert.equal(walletBalance(), START_KOBO);

		const again = await postSlotegrator(refund("sl-refund-c"));
		assert.equal(again.status, 200, await again.text());
		assert.equal(walletBalance(), START_KOBO);
	});
});

// ---------------------------------------------------------------------------
// Hashcodex (Sportsdey Crash) — signed wallet + disabled self-credit
// ---------------------------------------------------------------------------

describe("Hashcodex self-credit route", () => {
	it("is disabled and cannot credit a wallet", async () => {
		const res = await hashcodexRoute.request(
			"/deposit",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "credit", amount: 1_000_000 }),
			},
			env,
		);
		assert.equal(res.status, 503);
		assert.equal(walletBalance(), START_KOBO);
	});

	it("requires a logged-in user to launch", async () => {
		const res = await hashcodexRoute.request(
			"/launch",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ gameCode: "sportsdey-crash" }),
			},
			env,
		);
		assert.equal(res.status, 401);
	});
});

describe("Hashcodex signed wallet callback", () => {
	async function postWallet(body: Record<string, unknown>, sign = true) {
		const raw = JSON.stringify(body);
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (sign) {
			headers[HASHCODEX_SIGNATURE_HEADER] = computeHashcodexSignature(
				raw,
				HASHCODEX_SECRET,
			);
		}
		return hashcodexRoute.request(
			"/wallet",
			{ method: "POST", headers, body: raw },
			env,
		);
	}

	it("rejects an unsigned credit", async () => {
		const res = await postWallet(
			{
				playerId: USER_ID,
				action: "credit",
				amount: 500,
				transactionId: "win-unsigned",
				originalTransactionId: "bet-missing",
			},
			false,
		);
		assert.equal(res.status, 401);
		assert.equal(walletBalance(), START_KOBO);
	});

	it("rejects a win with no matching debit", async () => {
		const res = await postWallet({
			playerId: USER_ID,
			action: "credit",
			amount: 50,
			transactionId: "win-orphan",
			originalTransactionId: "bet-never-happened",
			roundId: "round-1",
		});
		assert.equal(res.status, 403);
		assert.equal(walletBalance(), START_KOBO);
	});

	it("debits then credits once; duplicate win does not double-pay", async () => {
		const bet = await postWallet({
			playerId: USER_ID,
			action: "debit",
			amount: 10,
			transactionId: "bet-1",
			roundId: "round-a",
		});
		assert.equal(bet.status, 200, await bet.text());
		assert.equal(walletBalance(), START_KOBO - 1_000);

		const winBody = {
			playerId: USER_ID,
			action: "credit",
			amount: 25,
			transactionId: "win-1",
			originalTransactionId: "bet-1",
			roundId: "round-a",
		};
		const win = await postWallet(winBody);
		assert.equal(win.status, 200, await win.text());
		assert.equal(walletBalance(), START_KOBO - 1_000 + 2_500);

		const [again, parallel] = await Promise.all([
			postWallet(winBody),
			postWallet({ ...winBody, transactionId: "win-1-retry" }),
		]);
		assert.equal(again.status, 200);
		assert.equal(parallel.status, 200);
		assert.equal(walletBalance(), START_KOBO - 1_000 + 2_500);
	});

	it("refunds the original debit amount once", async () => {
		const bet = await postWallet({
			playerId: USER_ID,
			action: "debit",
			amount: 20,
			transactionId: "bet-refund",
			roundId: "round-r",
		});
		assert.equal(bet.status, 200, await bet.text());
		assert.equal(walletBalance(), START_KOBO - 2_000);

		const refundBody = {
			playerId: USER_ID,
			action: "refund",
			amount: 99,
			transactionId: "refund-1",
			originalTransactionId: "bet-refund",
			roundId: "round-r",
		};
		const refund = await postWallet(refundBody);
		assert.equal(refund.status, 200, await refund.text());
		assert.equal(walletBalance(), START_KOBO);

		const again = await postWallet({
			...refundBody,
			transactionId: "refund-2",
		});
		assert.equal(again.status, 200);
		assert.equal(walletBalance(), START_KOBO);
	});
});
