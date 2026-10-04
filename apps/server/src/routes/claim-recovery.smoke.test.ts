import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { createMemoryD1 } from "../test-support/memory-d1";
import sportsbookRoute from "./sportsbook";
import walletRoute from "./wallet";

const executionCtx = {
	waitUntil(promise: Promise<unknown>) {
		void promise.catch(() => undefined);
	},
	passThroughOnException() {},
};

const USER_ID = "claim-recovery-user";
const START_KOBO = 10_000;
const DEPOSIT_KOBO = 2_500;
const STAKE_KOBO = 1_500;
const DEPOSIT_REF = "pay_claim_recovery_1";
const SESSION_ID = "sb-session-claim-recovery";
const BET_ID = "sb-bet-claim-recovery";

function createSqlite() {
	const sqlite = new DatabaseSync(":memory:");
	sqlite.exec(`
		CREATE TABLE user (
			id text PRIMARY KEY NOT NULL,
			name text NOT NULL,
			email text NOT NULL UNIQUE,
			email_verified integer NOT NULL DEFAULT 0,
			created_at integer NOT NULL DEFAULT 0,
			updated_at integer NOT NULL DEFAULT 0
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
		CREATE TABLE sportsbook_session (
			id text PRIMARY KEY NOT NULL,
			user_id text NOT NULL,
			created_at integer NOT NULL DEFAULT 0,
			updated_at integer NOT NULL DEFAULT 0
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
	`);
	sqlite
		.prepare(
			`INSERT INTO user (id, name, email, email_verified) VALUES (?, ?, ?, 1)`,
		)
		.run(USER_ID, "Claim Recovery", "claim-recovery@example.com");
	sqlite
		.prepare(
			`INSERT INTO wallet (id, user_id, balance, frozen_balance) VALUES (?, ?, ?, ?)`,
		)
		.run("wallet-claim-recovery", USER_ID, START_KOBO, STAKE_KOBO);
	return sqlite;
}

function walletRow(sqlite: DatabaseSync) {
	return sqlite
		.prepare(`SELECT balance, frozen_balance AS frozen FROM wallet WHERE user_id = ?`)
		.get(USER_ID) as { balance: number; frozen: number };
}

function depositStatus(sqlite: DatabaseSync) {
	return (
		sqlite
			.prepare(`SELECT status FROM wallet_transaction WHERE reference = ?`)
			.get(DEPOSIT_REF) as { status: string } | undefined
	)?.status;
}

function betStatus(sqlite: DatabaseSync) {
	return (
		sqlite
			.prepare(`SELECT status FROM sportsbook_bet WHERE id = ?`)
			.get(BET_ID) as { status: string } | undefined
	)?.status;
}

function acceptDebitCount(sqlite: DatabaseSync) {
	const row = sqlite
		.prepare(
			`SELECT COUNT(*) AS n FROM wallet_transaction
			 WHERE type = 'debit' AND payment_method = 'sportsbook'
			 AND reference LIKE ?`,
		)
		.get(`sb_accept_${BET_ID}_%`) as { n: number };
	return Number(row.n);
}

describe("CR8 deposit claim recovery", () => {
	const originalFetch = globalThis.fetch;

	before(() => {
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/transaction/verify/")) {
				return new Response(
					JSON.stringify({
						status: true,
						message: "Verified",
						data: {
							reference: DEPOSIT_REF,
							amount: DEPOSIT_KOBO,
							currency: "NGN",
							status: "success",
							metadata: {},
							customer: { email: "claim-recovery@example.com" },
							channel: "card",
							fees: 0,
							authorization: { card_type: "visa", last4: "4242" },
						},
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			}
			return new Response("not-mocked", { status: 404 });
		}) as typeof fetch;
	});

	after(() => {
		globalThis.fetch = originalFetch;
	});

	function seedDeposit(sqlite: DatabaseSync) {
		sqlite
			.prepare(
				`INSERT INTO wallet_transaction
				 (id, user_id, amount, type, reference, status, payment_method)
				 VALUES (?, ?, ?, 'credit', ?, 'pending', 'card')`,
			)
			.run("wtx-deposit-1", USER_ID, DEPOSIT_KOBO, DEPOSIT_REF);
	}

	it("moves a post-claim wallet failure to needs_retry and credits on the next verify", async () => {
		const sqlite = createSqlite();
		seedDeposit(sqlite);
		const { d1, DB } = createMemoryD1(sqlite);
		const env = {
			DB,
			PAYSTACK_SECRET_KEY: "sk_test_claim_recovery",
			CORS_ORIGIN: "https://stagingweb.sportsdey.com",
		};
		d1.failNextWalletUpdate = true;

		const first = await walletRoute.request(
			`/callback?reference=${DEPOSIT_REF}`,
			{ method: "GET" },
			env,
			executionCtx,
		);
		const firstBody = await first.text();
		assert.equal(first.status, 500, firstBody);
		assert.match(firstBody, /Deposit credit failed after claim/);
		assert.equal(depositStatus(sqlite), "needs_retry");
		assert.equal(walletRow(sqlite).balance, START_KOBO);

		const second = await walletRoute.request(
			`/callback?reference=${DEPOSIT_REF}`,
			{ method: "GET" },
			env,
			executionCtx,
		);
		assert.equal(second.status, 200, await second.text());
		assert.equal(depositStatus(sqlite), "success");
		assert.equal(walletRow(sqlite).balance, START_KOBO + DEPOSIT_KOBO);

		const third = await walletRoute.request(
			`/callback?reference=${DEPOSIT_REF}`,
			{ method: "GET" },
			env,
			executionCtx,
		);
		assert.equal(third.status, 200, await third.text());
		assert.equal(walletRow(sqlite).balance, START_KOBO + DEPOSIT_KOBO);
	});

	it("repairs a stale processing deposit instead of returning 200 with no credit", async () => {
		const sqlite = createSqlite();
		seedDeposit(sqlite);
		sqlite
			.prepare(`UPDATE wallet_transaction SET status = 'processing' WHERE reference = ?`)
			.run(DEPOSIT_REF);
		const { DB } = createMemoryD1(sqlite);

		const res = await walletRoute.request(
			`/callback?reference=${DEPOSIT_REF}`,
			{ method: "GET" },
			{
				DB,
				PAYSTACK_SECRET_KEY: "sk_test_claim_recovery",
				CORS_ORIGIN: "https://stagingweb.sportsdey.com",
			},
			executionCtx,
		);
		assert.equal(res.status, 200, await res.text());
		assert.equal(depositStatus(sqlite), "success");
		assert.equal(walletRow(sqlite).balance, START_KOBO + DEPOSIT_KOBO);
	});
});

describe("CR9 bet accept claim recovery", () => {
	function seedBet(sqlite: DatabaseSync) {
		sqlite
			.prepare(
				`INSERT INTO sportsbook_session (id, user_id) VALUES (?, ?)`,
			)
			.run(SESSION_ID, USER_ID);
		sqlite
			.prepare(
				`INSERT INTO sportsbook_bet
				 (id, request_id, user_id, stake, status, bet_type)
				 VALUES (?, ?, ?, ?, 'created', 1)`,
			)
			.run(BET_ID, "place-req-1", USER_ID, STAKE_KOBO);
	}

	function acceptBody(requestId: string) {
		return {
			request_id: requestId,
			bet_id: BET_ID,
			bet_player_id: USER_ID,
			bet_stake: String(STAKE_KOBO / 100),
			total_odds_value: "2.00",
			bet_odds: [],
		};
	}

	async function postAccept(
		env: { DB: D1Database },
		requestId: string,
	) {
		return sportsbookRoute.request(
			"/bet/accept",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Foreign-Params": JSON.stringify({ session_id: SESSION_ID }),
				},
				body: JSON.stringify(acceptBody(requestId)),
			},
			env,
			executionCtx,
		);
	}

	it("releases the claim after a post-claim wallet error so retry can take the stake", async () => {
		const sqlite = createSqlite();
		seedBet(sqlite);
		const { d1, DB } = createMemoryD1(sqlite);
		d1.failNextWalletUpdate = true;

		const first = await postAccept({ DB }, "accept-req-fail");
		const firstBody = await first.json();
		assert.equal(first.status, 500, JSON.stringify(firstBody));
		assert.equal(firstBody.error.data.code, "accept_failed_after_claim");
		assert.equal(betStatus(sqlite), "created");
		assert.equal(acceptDebitCount(sqlite), 0);
		assert.equal(walletRow(sqlite).balance, START_KOBO);
		assert.equal(walletRow(sqlite).frozen, STAKE_KOBO);

		const second = await postAccept({ DB }, "accept-req-fail");
		assert.equal(second.status, 204, await second.text());
		assert.equal(betStatus(sqlite), "accepted");
		assert.equal(acceptDebitCount(sqlite), 1);
		assert.equal(walletRow(sqlite).balance, START_KOBO - STAKE_KOBO);
		assert.equal(walletRow(sqlite).frozen, 0);
	});

	it("surfaces accepted-without-debit instead of a generic 400", async () => {
		const sqlite = createSqlite();
		seedBet(sqlite);
		sqlite
			.prepare(`UPDATE sportsbook_bet SET status = 'accepted' WHERE id = ?`)
			.run(BET_ID);
		const { DB } = createMemoryD1(sqlite);

		const res = await postAccept({ DB }, "accept-req-stuck");
		const body = await res.json();
		assert.equal(res.status, 409, JSON.stringify(body));
		assert.equal(body.error.data.code, "accepted_without_debit");
		assert.equal(acceptDebitCount(sqlite), 0);
		assert.equal(walletRow(sqlite).balance, START_KOBO);
	});
});
