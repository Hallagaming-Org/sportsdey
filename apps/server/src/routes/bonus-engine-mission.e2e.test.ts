/**
 * End-to-end mission flow against the real handlers and a real SQLite DB:
 *
 *   provider bet callback → POST /bet body → mission.progress-update callback
 *   → progress row → mission list merge (progress bar) → mission.complete
 *   → Real Cash credited to the player wallet (once).
 *
 * Bonus Engine itself is the only stub: `fetch` is replaced so we can assert
 * the exact outbound `POST /bet` payload, which is what the engine matches
 * Admin mission rules against.
 */
import assert from "node:assert/strict";
import { createHmac, generateKeyPairSync, sign as nodeSign } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
	BONUS_ENGINE_NATIVE_PROVIDER_ID,
	mergeMissionListWithLocalProgress,
} from "@/services/bonus-engine";
import { createMemoryD1 } from "../test-support/memory-d1";
import bonusEngineCallbackRoute from "./bonus-engine-callbacks";
import hallaPocketsRoute from "./halla-pockets";
import pocketsRoute from "./pockets";
import slotegratorRoute from "./slotegrator";

const USER_ID = "mission-e2e-user";
const MISSION_ID = "mission-e2e-lagos-rush";
const START_KOBO = 500_000;
const POCKETS_API_KEY = "pockets-e2e-key";
const SLOTEGRATOR_GAME_UUID = "1f0c9a20-e2e-4c1a-9f0a-slotegrator";
const SLOTEGRATOR_MERCHANT_ID = "merchant-e2e";
const SLOTEGRATOR_MERCHANT_KEY = "merchant-key-e2e";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
	modulusLength: 2048,
});
const CALLBACK_PUBLIC_KEY_PEM = publicKey
	.export({ type: "spki", format: "pem" })
	.toString();

type BetReport = Record<string, unknown>;

let sqlite: DatabaseSync;
let env: Record<string, unknown>;
let betReports: BetReport[];
let betResultReports: BetReport[];
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
		CREATE TABLE bonus_engine_callback_event (
			id text PRIMARY KEY NOT NULL,
			idempotency_key text NOT NULL UNIQUE,
			event_type text NOT NULL,
			payload_json text NOT NULL,
			processed_at integer NOT NULL DEFAULT 0
		);
		CREATE TABLE bonus_engine_mission_progress (
			user_id text NOT NULL,
			mission_id text NOT NULL,
			progress_percentage real NOT NULL DEFAULT 0,
			completed_at integer,
			reward_json text,
			updated_at integer NOT NULL DEFAULT 0,
			PRIMARY KEY (user_id, mission_id)
		);
	`);

	db.prepare(
		"INSERT INTO user (id, name, email, email_verified) VALUES (?, ?, ?, 1)",
	).run(USER_ID, "Mission E2E", "mission-e2e@example.com");
	db.prepare("INSERT INTO wallet (id, user_id, balance) VALUES (?, ?, ?)").run(
		"wallet-mission-e2e",
		USER_ID,
		START_KOBO,
	);

	// Lagos Rush as `pnpm games:seed` writes it: provider metadata from the
	// native catalog, so Admin can target it and reports match.
	db.prepare(
		`INSERT INTO game (id, name, code, provider_id, provider_name, enabled)
		 VALUES (?, ?, ?, ?, ?, 1)`,
	).run(
		"game-row-lagos-rush",
		"Lagos Rush",
		"LAGOSRUSH",
		BONUS_ENGINE_NATIVE_PROVIDER_ID.LAGOS_RUSH,
		"Lagos Rush",
	);
	// A Slotegrator row, whose provider id comes from the catalog sync.
	db.prepare(
		`INSERT INTO game (id, name, code, provider_id, provider_name, enabled)
		 VALUES (?, ?, ?, ?, ?, 1)`,
	).run(
		SLOTEGRATOR_GAME_UUID,
		"Book of Dead",
		SLOTEGRATOR_GAME_UUID,
		"982",
		"Play'n GO",
	);
	// A Halla row seeded before provider metadata existed (provider_id NULL),
	// to prove the native catalog still resolves it.
	db.prepare(
		"INSERT INTO game (id, name, code, enabled) VALUES (?, ?, ?, 1)",
	).run("game-row-halla-bomb", "Halla Bomb", "HALLABOMB");
}

/** Captures outbound Bonus Engine calls and answers them like the engine would. */
function stubBonusEngineFetch() {
	originalFetch = globalThis.fetch;
	globalThis.fetch = (async (
		input: Parameters<typeof globalThis.fetch>[0],
		init?: Parameters<typeof globalThis.fetch>[1],
	) => {
		const url = typeof input === "string" ? input : String(input);
		const body = typeof init?.body === "string" ? init.body : "{}";

		if (url.includes("access_token")) {
			return new Response(JSON.stringify({ token: "stub-access-token" }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}
		if (url.includes("/betResult")) {
			betResultReports.push(JSON.parse(body) as BetReport);
			return new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}
		if (url.includes("/bet")) {
			betReports.push(JSON.parse(body) as BetReport);
			return new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}
		if (url.includes("/mission/progress")) {
			return new Response(
				JSON.stringify({
					success: true,
					data: { progress_percentage: 40, current: 2, target: 5 },
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		}
		if (url.includes("/mission/list")) {
			return new Response(
				JSON.stringify({
					success: true,
					data: [{ _id: MISSION_ID, title: "Play Lagos Rush" }],
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		}
		throw new Error(`unexpected outbound fetch: ${url}`);
	}) as typeof globalThis.fetch;
}

function signCallback(bodyString: string): string {
	return nodeSign(
		"RSA-SHA256",
		Buffer.from(bodyString, "utf8"),
		privateKey,
	).toString("base64");
}

/**
 * Posts a Slotegrator wallet callback with a valid HMAC-SHA1 `X-Sign`, built
 * the same way `verifySlotitegrationSignature` recomputes it.
 */
async function postSlotegratorBet(fields: Record<string, string>) {
	const body = new URLSearchParams(fields).toString();
	const timestamp = Math.floor(Date.now() / 1000).toString();
	const nonce = "e2e-nonce";
	const allParams: Record<string, string> = {
		...Object.fromEntries(new URLSearchParams(body).entries()),
		"X-Merchant-Id": SLOTEGRATOR_MERCHANT_ID,
		"X-Timestamp": timestamp,
		"X-Nonce": nonce,
	};
	const queryString = Object.keys(allParams)
		.sort()
		.map((key) => `${key}=${allParams[key]}`)
		.join("&");
	const sign = createHmac("sha1", SLOTEGRATOR_MERCHANT_KEY)
		.update(queryString)
		.digest("hex");

	return slotegratorRoute.request(
		"/",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"X-Merchant-Id": SLOTEGRATOR_MERCHANT_ID,
				"X-Timestamp": timestamp,
				"X-Nonce": nonce,
				"X-Sign": sign,
			},
			body,
		},
		env,
	);
}

async function postCallback(path: string, payload: unknown) {
	const bodyString = JSON.stringify(payload);
	return bonusEngineCallbackRoute.request(
		path,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Signature: signCallback(bodyString),
			},
			body: bodyString,
		},
		env,
	);
}

function walletBalance(): number {
	const row = sqlite
		.prepare("SELECT balance FROM wallet WHERE user_id = ?")
		.get(USER_ID) as { balance: number };
	return row.balance;
}

function missionRewardTransactions(): Array<{
	amount: number;
	reference: string;
	payment_method: string;
}> {
	return sqlite
		.prepare(
			`SELECT amount, reference, payment_method FROM wallet_transaction
			 WHERE user_id = ? AND reference LIKE 'be_mission_reward:%'
			 ORDER BY reference`,
		)
		.all(USER_ID) as never;
}

function progressRow():
	| { progress_percentage: number; completed_at: number | null }
	| undefined {
	return sqlite
		.prepare(
			`SELECT progress_percentage, completed_at FROM bonus_engine_mission_progress
			 WHERE user_id = ? AND mission_id = ?`,
		)
		.get(USER_ID, MISSION_ID) as
		| { progress_percentage: number; completed_at: number | null }
		| undefined;
}

beforeEach(() => {
	betReports = [];
	betResultReports = [];
	sqlite = new DatabaseSync(":memory:");
	createSchema(sqlite);
	const { DB } = createMemoryD1(sqlite);
	env = {
		DB,
		POCKETS_SECRET_KEY: POCKETS_API_KEY,
		SLOTITEGRATION_MERCHANT_ID: SLOTEGRATOR_MERCHANT_ID,
		SLOTITEGRATION_MERCHANT_KEY: SLOTEGRATOR_MERCHANT_KEY,
		BONUS_ENGINE_BASE_URL: "https://bonus-engine.test",
		BONUS_ENGINE_CLIENT_ID: "client-e2e",
		BONUS_ENGINE_PROJECT_ID: "project-e2e",
		BONUS_ENGINE_CLIENT_SECRET: "secret-e2e",
		BONUS_ENGINE_PRIVATE_KEY: privateKey
			.export({ type: "pkcs8", format: "pem" })
			.toString(),
		BONUS_ENGINE_CALLBACK_PUBLIC_KEY: CALLBACK_PUBLIC_KEY_PEM,
		BONUS_ENGINE_CURRENCY: "NGN",
	};
	stubBonusEngineFetch();
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	sqlite.close();
});

describe("mission progress end-to-end (real handlers, stubbed engine)", () => {
	it("reports a Lagos Rush bet with the ids Admin configures against", async () => {
		const response = await pocketsRoute.request(
			"/debit",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": POCKETS_API_KEY,
				},
				body: JSON.stringify({
					playerId: USER_ID,
					amount: 20_000,
					currency: "NGN",
				}),
			},
			env,
		);

		assert.equal(response.status, 200, await response.text());
		assert.equal(walletBalance(), START_KOBO - 20_000);

		assert.equal(betReports.length, 1, "expected exactly one POST /bet");
		const report = betReports[0];
		assert.equal(report?.product_type, "casino");
		assert.equal(report?.user_id, USER_ID);
		assert.equal(
			report?.provider_id,
			BONUS_ENGINE_NATIVE_PROVIDER_ID.LAGOS_RUSH,
		);
		assert.equal(report?.game_id, "LAGOSRUSH");
		// 20,000 kobo staked must report as 200 naira, not 20,000.
		assert.equal(report?.real_bet_amount, 200);
		assert.equal(report?.bonus_bet_amount, 0);
		assert.equal(report?.bet_type, "normal");
		assert.equal(report?.internal_bet_id, report?.bet_id);
		assert.equal(report?.amount, undefined);
		assert.equal(report?.currency, "NGN");
		assert.equal(report?.client_id, "client-e2e");
		assert.equal(report?.project_id, "project-e2e");
		assert.equal(report?.sport_id, undefined);
		assert.equal(report?.league_id, undefined);
		assert.equal(progressRow()?.progress_percentage, 40);
	});

	it("reports a Lagos Rush win on POST /betResult", async () => {
		const response = await pocketsRoute.request(
			"/credit",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": POCKETS_API_KEY,
				},
				body: JSON.stringify({
					playerId: USER_ID,
					amount: 50_000,
					currency: "NGN",
				}),
			},
			env,
		);

		assert.equal(response.status, 200, await response.text());
		assert.equal(betResultReports.length, 1);
		assert.equal(betResultReports[0]?.isWin, 1);
		assert.equal(betResultReports[0]?.isRollback, 0);
		assert.equal(betResultReports[0]?.total_win_amount, 500);
		assert.equal(betResultReports[0]?.user_id, USER_ID);
	});

	it("reports a Halla bet at provider level when no game code is sent", async () => {
		const response = await hallaPocketsRoute.request(
			"/debit",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": POCKETS_API_KEY,
				},
				body: JSON.stringify({
					playerId: USER_ID,
					amount: 150,
					currency: "NGN",
				}),
			},
			env,
		);

		assert.equal(response.status, 200, await response.text());
		assert.equal(betReports.length, 1);
		assert.equal(
			betReports[0]?.provider_id,
			BONUS_ENGINE_NATIVE_PROVIDER_ID.HALLA,
		);
		assert.equal(betReports[0]?.game_id, undefined);
		// Halla speaks naira already, so the amount passes through untouched.
		assert.equal(betReports[0]?.real_bet_amount, 150);
	});

	it("reports a Slotegrator bet with the synced provider id", async () => {
		const response = await postSlotegratorBet({
			action: "bet",
			player_id: USER_ID,
			amount: "75.5",
			currency: "NGN",
			game_uuid: SLOTEGRATOR_GAME_UUID,
			transaction_id: "slotegrator-e2e-tx-1",
			session_id: "slotegrator-e2e-session",
			type: "bet",
		});

		assert.equal(response.status, 200, await response.text());
		assert.equal(betReports.length, 1);
		assert.equal(betReports[0]?.provider_id, "982");
		assert.equal(betReports[0]?.game_id, SLOTEGRATOR_GAME_UUID);
		// Slotegrator already speaks major units.
		assert.equal(betReports[0]?.real_bet_amount, 75.5);
	});

	it("reports a bet for a game missing from the catalog, not silently dropping it", async () => {
		const response = await postSlotegratorBet({
			action: "bet",
			player_id: USER_ID,
			amount: "10",
			currency: "NGN",
			game_uuid: "uuid-not-in-our-catalog",
			transaction_id: "slotegrator-e2e-tx-unknown",
			session_id: "slotegrator-e2e-session",
			type: "bet",
		});

		assert.equal(response.status, 200, await response.text());
		assert.equal(betReports.length, 1);
		assert.equal(betReports[0]?.provider_id, "casino");
		assert.equal(betReports[0]?.game_id, "uuid-not-in-our-catalog");
	});

	it("still debits the player when Bonus Engine is down", async () => {
		globalThis.fetch = (async () => {
			throw new Error("bonus engine unreachable");
		}) as typeof globalThis.fetch;

		const response = await pocketsRoute.request(
			"/debit",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": POCKETS_API_KEY,
				},
				body: JSON.stringify({
					playerId: USER_ID,
					amount: 20_000,
					currency: "NGN",
				}),
			},
			env,
		);

		assert.equal(response.status, 200, await response.text());
		assert.equal(walletBalance(), START_KOBO - 20_000);
	});

	it("moves the progress bar from a progress-update callback", async () => {
		assert.equal(progressRow(), undefined);

		const response = await postCallback(
			"/gamification/callback/mission/progress-update",
			{
				mission_id: MISSION_ID,
				player_id: USER_ID,
				progress_percentage: 40,
			},
		);
		assert.equal(response.status, 200, await response.text());
		assert.equal(progressRow()?.progress_percentage, 40);

		// The engine list is the campaign definition; the merge is what the UI
		// renders, so the bar only moves if the snapshot overlays onto it.
		const merged = mergeMissionListWithLocalProgress({
			missions: [{ _id: MISSION_ID, title: "Play Lagos Rush" }],
			progress: [
				{
					missionId: MISSION_ID,
					progressPercentage: 40,
					completedAt: null,
					rewardJson: null,
				},
			],
		});
		assert.equal(merged[0]?.progress_percentage, 40);
	});

	it("never moves the bar backwards on a late lower-percentage callback", async () => {
		await postCallback("/gamification/callback/mission/progress-update", {
			mission_id: MISSION_ID,
			player_id: USER_ID,
			progress_percentage: 80,
		});
		assert.equal(progressRow()?.progress_percentage, 80);

		await postCallback("/gamification/callback/mission/progress-update", {
			mission_id: MISSION_ID,
			player_id: USER_ID,
			progress_percentage: 25,
		});
		assert.equal(progressRow()?.progress_percentage, 80);
	});

	it("credits Real Cash to the wallet on mission complete", async () => {
		const response = await postCallback(
			"/gamification/callback/mission/complete",
			{
				mission_id: MISSION_ID,
				player_id: USER_ID,
				reward: { type: "Real Cash", value: 500 },
			},
		);

		assert.equal(response.status, 200, await response.text());
		// 500 naira reward → 50,000 kobo on top of the starting balance.
		assert.equal(walletBalance(), START_KOBO + 50_000);

		const credits = missionRewardTransactions();
		assert.equal(credits.length, 1);
		assert.equal(credits[0]?.amount, 50_000);
		assert.equal(
			credits[0]?.reference,
			`be_mission_reward:${MISSION_ID}:${USER_ID}`,
		);

		assert.equal(progressRow()?.progress_percentage, 100);
		assert.ok(progressRow()?.completed_at, "expected completed_at to be set");
	});

	it("does not double-credit when the engine retries mission complete", async () => {
		const payload = {
			mission_id: MISSION_ID,
			player_id: USER_ID,
			reward: { type: "Real Cash", value: 500 },
		};

		const first = await postCallback(
			"/gamification/callback/mission/complete",
			payload,
		);
		assert.equal(first.status, 200, await first.text());

		const retry = await postCallback(
			"/gamification/callback/mission/complete",
			payload,
		);
		assert.equal(retry.status, 200, await retry.text());

		assert.equal(walletBalance(), START_KOBO + 50_000);
		assert.equal(missionRewardTransactions().length, 1);
	});

	it("credits nothing when the reward is Points rather than Real Cash", async () => {
		const response = await postCallback(
			"/gamification/callback/mission/complete",
			{
				mission_id: MISSION_ID,
				player_id: USER_ID,
				reward: { type: "Points", value: 500 },
			},
		);

		assert.equal(response.status, 200, await response.text());
		assert.equal(walletBalance(), START_KOBO);
		assert.equal(missionRewardTransactions().length, 0);
	});

	it("keeps progress and credit keyed per player", async () => {
		sqlite
			.prepare(
				"INSERT INTO user (id, name, email, email_verified) VALUES (?, ?, ?, 1)",
			)
			.run("other-player", "Other", "other-e2e@example.com");
		sqlite
			.prepare("INSERT INTO wallet (id, user_id, balance) VALUES (?, ?, ?)")
			.run("wallet-other", "other-player", 1_000);

		await postCallback("/gamification/callback/mission/complete", {
			mission_id: MISSION_ID,
			player_id: "other-player",
			reward: { type: "Real Cash", value: 500 },
		});

		// The other player's completion must not touch our player's wallet.
		assert.equal(walletBalance(), START_KOBO);
		assert.equal(missionRewardTransactions().length, 0);
		assert.equal(progressRow(), undefined);
	});

	it("rejects an unsigned callback without touching the wallet", async () => {
		const response = await bonusEngineCallbackRoute.request(
			"/gamification/callback/mission/complete",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					mission_id: MISSION_ID,
					player_id: USER_ID,
					reward: { type: "Real Cash", value: 500 },
				}),
			},
			env,
		);

		assert.equal(response.status, 413);
		assert.equal(walletBalance(), START_KOBO);
		assert.equal(missionRewardTransactions().length, 0);
	});
});
