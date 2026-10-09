/**
 * Bonus value reaching wallets a player can use, end to end through the real
 * Hono handlers and a real SQLite DB running the production migration.
 * Only Bonus Engine (and the OPay API) are stubbed.
 *
 *   activate → locked bonus in the main wallet → spent on a casino bet after
 *   real cash → winnings locked pro rata → withdrawals capped → COMPLETED
 *   unlocks; cancel claws back; tournament prizes, loyalty redemptions and
 *   lost mission callbacks pay once; deposits from every provider report;
 *   failed reports survive in the outbox; a rejected token is refreshed.
 */
import assert from "node:assert/strict";
import {
	generateKeyPairSync,
	type KeyObject,
	sign as nodeSign,
} from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, it } from "node:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
	drainBonusEngineOutbox,
	reconcileLoyaltyRedemptions,
	reconcileMissionRewards,
} from "@/services/bonus-engine";
import { applyBonusWalletMigration } from "../test-support/bonus-wallet-schema";
import { createMemoryD1 } from "../test-support/memory-d1";
import type { CloudflareBindings } from "../types";
import bonusRoute from "./bonus";
import bonusEngineCallbackRoute from "./bonus-engine-callbacks";
import loyaltyRoute from "./loyalty";
import missionRoute from "./mission";
import opayRoute from "./opay";
import pocketsRoute from "./pockets";
import walletRoute from "./wallet";

const USER_ID = "wallet-e2e-user";
const FRIEND_ID = "wallet-e2e-friend";
const START_KOBO = 100_000;
const POCKETS_API_KEY = "pockets-wallet-e2e";
const ENGINE = "https://bonus-engine.test";
const USERBONUS_ID = "ub-wallet-e2e";
const MISSION_ID = "mission-wallet-e2e";

const engineKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const merchantKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = (key: KeyObject, type: "pkcs8" | "spki") =>
	key.export({ type, format: "pem" } as never).toString();

type EngineCall = {
	path: string;
	body: Record<string, unknown>;
	token: string;
};
type EngineHandler = (
	body: Record<string, unknown>,
	call: EngineCall,
) => {
	status?: number;
	json: unknown;
};

let sqlite: DatabaseSync;
let env: Record<string, unknown>;
let engineCalls: EngineCall[];
let engineHandlers: Record<string, EngineHandler>;
let tokensMinted: number;
let opayStatus: string;
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
			provider text,
			game_code text,
			round_id text,
			created_at integer NOT NULL DEFAULT 0
		);
		CREATE TABLE opay_transaction (
			id text PRIMARY KEY NOT NULL,
			user_id text NOT NULL,
			reference text NOT NULL UNIQUE,
			order_no text UNIQUE,
			amount integer NOT NULL,
			status text NOT NULL DEFAULT 'initiated',
			cashier_url text,
			raw_callback_payload text,
			created_at integer NOT NULL DEFAULT 0,
			updated_at integer NOT NULL DEFAULT 0
		);
	`);
	applyBonusWalletMigration(db);

	for (const [id, name] of [
		[USER_ID, "Wallet E2E"],
		[FRIEND_ID, "Friend"],
	] as const) {
		db.prepare(
			"INSERT INTO user (id, name, email, email_verified) VALUES (?, ?, ?, 1)",
		).run(id, name, `${id}@example.com`);
	}
	db.prepare("INSERT INTO wallet (id, user_id, balance) VALUES (?, ?, ?)").run(
		"wallet-player",
		USER_ID,
		START_KOBO,
	);
	db.prepare("INSERT INTO wallet (id, user_id, balance) VALUES (?, ?, 0)").run(
		"wallet-friend",
		FRIEND_ID,
	);
}

function jsonResponse(json: unknown, status = 200) {
	return new Response(JSON.stringify(json), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function stubFetch() {
	originalFetch = globalThis.fetch;
	globalThis.fetch = (async (
		input: Parameters<typeof fetch>[0],
		init?: RequestInit,
	) => {
		const url = new URL(typeof input === "string" ? input : String(input));
		if (url.origin === ENGINE) {
			const path = url.pathname;
			const body = JSON.parse(
				typeof init?.body === "string" ? init.body : "{}",
			);
			if (path === "/access_token") {
				tokensMinted += 1;
				return jsonResponse({ token: `token-${tokensMinted}` });
			}
			const headers = new Headers(init?.headers);
			const call = { path, body, token: headers.get("Token") ?? "" };
			engineCalls.push(call);
			const handler = engineHandlers[path];
			if (!handler) return jsonResponse({ status: 200, message: "SUCCESS" });
			const result = handler(body, call);
			return jsonResponse(result.json, result.status ?? 200);
		}
		if (url.hostname.endsWith("opaycheckout.com")) {
			return jsonResponse({ code: "00000", data: { status: opayStatus } });
		}
		return jsonResponse({});
	}) as typeof fetch;
}

/** Runs a request like the Worker would, then lets `waitUntil` work finish. */
async function call(
	app: { request: OpenAPIHono["request"] },
	path: string,
	init?: RequestInit,
) {
	const pending: Promise<unknown>[] = [];
	const executionCtx = {
		waitUntil: (promise: Promise<unknown>) => pending.push(promise),
		passThroughOnException: () => {},
		props: {},
	};
	const response = await app.request(
		path,
		init,
		env as unknown as CloudflareBindings,
		executionCtx as never,
	);
	await Promise.all(pending);
	return response;
}

function asPlayer<T extends OpenAPIHono<{ Bindings: CloudflareBindings }>>(
	route: T,
) {
	const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>();
	app.use("*", async (c, next) => {
		c.set("user", {
			id: USER_ID,
			name: "Wallet E2E",
			email: `${USER_ID}@example.com`,
		} as never);
		await next();
	});
	app.route("/", route);
	return app;
}

const json = (body: unknown): RequestInit => ({
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify(body),
});

function signedCallback(
	path: string,
	payload: unknown,
	privateKey = engineKeys.privateKey,
) {
	const body = JSON.stringify(payload);
	return call(bonusEngineCallbackRoute, path, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Signature: nodeSign("RSA-SHA256", Buffer.from(body), privateKey).toString(
				"base64",
			),
		},
		body,
	});
}

function lagosRush(
	path: "/debit" | "/credit",
	amountKobo: number,
	transactionId: string,
) {
	return call(pocketsRoute, path, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": POCKETS_API_KEY,
		},
		body: JSON.stringify({
			playerId: USER_ID,
			amount: amountKobo,
			currency: "NGN",
			transactionId,
		}),
	});
}

function wallet(userId = USER_ID) {
	const row = sqlite
		.prepare("SELECT balance, bonus_balance FROM wallet WHERE user_id = ?")
		.get(userId) as { balance: number; bonus_balance: number };
	return { balance: Number(row.balance), bonus: Number(row.bonus_balance) };
}

function walletRows(referenceLike: string) {
	return (
		sqlite
			.prepare(
				"SELECT amount, type, reference, payment_method FROM wallet_transaction WHERE reference LIKE ? ORDER BY reference",
			)
			.all(referenceLike) as Array<Record<string, unknown>>
	).map((row) => ({ ...row, amount: Number(row.amount) }));
}

function engineCallsTo(path: string) {
	return engineCalls.filter((entry) => entry.path === path);
}

function offerAssignment(bonusAmount: number, cashAmount = 0) {
	engineHandlers["/getall_User_bonus"] = () => ({
		json: {
			status: 200,
			message: "SUCCESS",
			data: [
				{
					_id: USERBONUS_ID,
					bonus_amount: bonusAmount,
					cash_amount: cashAmount,
					status: "PENDING",
				},
			],
		},
	});
	engineHandlers["/activate_bonus"] = () => ({
		json: {
			status: 200,
			message: "BONUS ACTIVATED",
			data: { real_wallet_balance: 999_999 },
		},
	});
}

beforeEach(() => {
	sqlite = new DatabaseSync(":memory:");
	createSchema(sqlite);
	const { DB } = createMemoryD1(sqlite);
	env = {
		DB,
		POCKETS_SECRET_KEY: POCKETS_API_KEY,
		BONUS_ENGINE_BASE_URL: ENGINE,
		BONUS_ENGINE_CLIENT_ID: "client-wallet-e2e",
		BONUS_ENGINE_PROJECT_ID: "project-wallet-e2e",
		BONUS_ENGINE_CLIENT_SECRET: "secret-wallet-e2e",
		BONUS_ENGINE_PRIVATE_KEY: pem(merchantKeys.privateKey, "pkcs8"),
		BONUS_ENGINE_CALLBACK_PUBLIC_KEY: pem(engineKeys.publicKey, "spki"),
		BONUS_ENGINE_CURRENCY: "NGN",
		OPAY_MERCHANT_ID: "opay-merchant",
		OPAY_PUBLIC_KEY: "opay-public",
		OPAY_PRIVATE_KEY: "opay-private",
	};
	engineCalls = [];
	engineHandlers = {};
	tokensMinted = 0;
	opayStatus = "SUCCESS";
	stubFetch();
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	sqlite.close();
});

describe("a bonus is credited, playable, and withdrawable only once wagered", () => {
	it("runs the whole lifecycle through the real routes", async () => {
		offerAssignment(1_000);
		const bonusApp = asPlayer(bonusRoute);
		const walletApp = asPlayer(walletRoute);

		// 1. Activate: ₦1,000 bonus lands locked in the main wallet.
		const activated = await call(
			bonusApp,
			"/activate",
			json({ userbonus_id: USERBONUS_ID }),
		);
		assert.equal(activated.status, 200, await activated.clone().text());
		const activatedBody = (await activated.json()) as {
			data: Record<string, number>;
		};
		assert.equal(activatedBody.data.bonus_wallet_balance, 1_000);
		assert.equal(activatedBody.data.real_wallet_balance, START_KOBO / 100);
		assert.deepEqual(wallet(), {
			balance: START_KOBO + 100_000,
			bonus: 100_000,
		});

		const view = (await (await call(walletApp, "/")).json()) as {
			data: Record<string, number>;
		};
		assert.equal(view.data.balance, 1_000);
		assert.equal(view.data.bonusBalance, 1_000);
		assert.equal(view.data.withdrawableBalance, 1_000);
		assert.equal(view.data.totalBalance, 2_000);

		// 2. A casino stake bigger than the cash uses the bonus after the cash.
		const bet = await lagosRush("/debit", 200_000, "lr-bet-1");
		assert.equal(bet.status, 200, await bet.clone().text());
		assert.deepEqual(wallet(), { balance: 0, bonus: 0 });
		const betReport = engineCallsTo("/bet")[0]?.body;
		assert.equal(betReport?.real_bet_amount, 1_000);
		assert.equal(betReport?.bonus_bet_amount, 1_000);

		// 3. The win is half bonus-funded, so half of it stays locked.
		const win = await lagosRush("/credit", 300_000, "lr-win-1");
		assert.equal(win.status, 200, await win.clone().text());
		assert.deepEqual(wallet(), { balance: 300_000, bonus: 150_000 });
		const resultReport = engineCallsTo("/betResult")[0]?.body;
		assert.equal(resultReport?.real_win_amount, 1_500);
		assert.equal(resultReport?.bonus_win_amount, 1_500);
		assert.equal(engineCallsTo("/bet").length, 1, "bet reported once");
		assert.equal(engineCallsTo("/betResult").length, 1, "result reported once");

		// 4. Locked funds cannot leave: a transfer above withdrawable is refused
		// and the recipient gets nothing.
		const tooMuch = await call(
			walletApp,
			"/transfer",
			json({ recipientWalletId: "wallet-friend", amount: 2_000 }),
		);
		assert.equal(tooMuch.status, 400);
		assert.equal(wallet(FRIEND_ID).balance, 0);

		const ok = await call(
			walletApp,
			"/transfer",
			json({ recipientWalletId: "wallet-friend", amount: 1_000 }),
		);
		assert.equal(ok.status, 200, await ok.clone().text());
		assert.equal(wallet(FRIEND_ID).balance, 100_000);
		assert.deepEqual(wallet(), { balance: 200_000, bonus: 150_000 });

		// 5. Wagering complete: the engine converts the bonus funds to cash.
		const completed = await signedCallback(
			"/bonus-engine/callback/updateBonus",
			{
				bonus_id: USERBONUS_ID,
				user_id: USER_ID,
				bonus_status: "COMPLETED",
				real_amount_change: 1_500,
				bonus_amount_change: 1_500,
				real_wallet_balance: 1,
				bonus_wallet_balance: 1,
			},
		);
		assert.equal(completed.status, 200, await completed.clone().text());
		const ack = (await completed.json()) as { data: Record<string, number> };
		assert.equal(ack.data.real_wallet_balance, 2_000);
		assert.equal(ack.data.bonus_wallet_balance, 0);
		assert.deepEqual(wallet(), { balance: 200_000, bonus: 0 });

		const afterView = (await (await call(walletApp, "/")).json()) as {
			data: Record<string, number>;
		};
		assert.equal(afterView.data.withdrawableBalance, 2_000);
	});

	it("re-reads the assignment after activation when the list lagged", async () => {
		let listed = false;
		engineHandlers["/getall_User_bonus"] = () => ({
			json: {
				status: 200,
				data: listed
					? [{ _id: USERBONUS_ID, bonus_amount: 300, status: "ACTIVE" }]
					: [],
			},
		});
		engineHandlers["/activate_bonus"] = () => {
			listed = true;
			return { json: { status: 200, message: "BONUS ACTIVATED" } };
		};
		const response = await call(
			asPlayer(bonusRoute),
			"/activate",
			json({ userbonus_id: USERBONUS_ID }),
		);
		assert.equal(response.status, 200);
		assert.equal(wallet().bonus, 30_000);
	});

	it("claws the bonus back when the player cancels it, once across both paths", async () => {
		offerAssignment(1_000);
		const bonusApp = asPlayer(bonusRoute);
		await call(bonusApp, "/activate", json({ userbonus_id: USERBONUS_ID }));
		engineHandlers["/cancel_bonus"] = () => ({
			json: { status: 200, message: "BONUS CANCELLED", data: {} },
		});

		const cancelled = await call(
			bonusApp,
			"/cancel",
			json({ userbonus_id: USERBONUS_ID }),
		);
		assert.equal(cancelled.status, 200, await cancelled.clone().text());
		assert.deepEqual(wallet(), { balance: START_KOBO, bonus: 0 });

		await signedCallback("/bonus-engine/callback/updateBonus", {
			bonus_id: USERBONUS_ID,
			user_id: USER_ID,
			bonus_status: "CANCELLED",
			real_amount_change: 0,
			bonus_amount_change: 1_000,
		});
		assert.deepEqual(wallet(), { balance: START_KOBO, bonus: 0 });
		const snapshot = sqlite
			.prepare("SELECT status FROM bonus_engine_user_bonus WHERE bonus_id = ?")
			.get(USERBONUS_ID) as { status: string };
		assert.equal(snapshot.status, "CANCELLED");
	});

	it("credits an allocated active bonus once even if the player also activates", async () => {
		const allocation = await signedCallback(
			"/bonus-engine/callback/bonusAllocation",
			{
				user_id: USER_ID,
				bonus_data: {
					_id: USERBONUS_ID,
					bonus_amount: 500,
					cash_amount: 100,
					user_action: "ACTIVATED",
					status: "ACTIVE",
				},
			},
		);
		assert.equal(allocation.status, 200, await allocation.clone().text());
		assert.deepEqual(wallet(), { balance: START_KOBO + 60_000, bonus: 50_000 });

		offerAssignment(500, 100);
		await call(
			asPlayer(bonusRoute),
			"/activate",
			json({ userbonus_id: USERBONUS_ID }),
		);
		assert.deepEqual(wallet(), { balance: START_KOBO + 60_000, bonus: 50_000 });
	});
});

describe("tournament prizes", () => {
	it("pays each winner once, as cash, and survives engine retries", async () => {
		const payload = {
			tournament_id: "t-1",
			winners: [
				{ player_id: USER_ID, prize: 1_500.5, rank: 1 },
				{ player_id: { user_id: FRIEND_ID }, prize: 200, rank: 2 },
			],
		};
		const first = await signedCallback(
			"/gamification/callback/tournament/end",
			payload,
		);
		assert.equal(first.status, 200, await first.clone().text());
		const retry = await signedCallback(
			"/gamification/callback/tournament/end",
			payload,
		);
		assert.equal(retry.status, 200);

		assert.equal(wallet().balance, START_KOBO + 150_050);
		assert.equal(wallet(FRIEND_ID).balance, 20_000);
		assert.deepEqual(walletRows("be_tournament_prize:%"), [
			{
				amount: 20_000,
				type: "credit",
				reference: `be_tournament_prize:t-1:${FRIEND_ID}`,
				payment_method: "bonus_engine_tournament",
			},
			{
				amount: 150_050,
				type: "credit",
				reference: `be_tournament_prize:t-1:${USER_ID}`,
				payment_method: "bonus_engine_tournament",
			},
		]);
		const ackBody = (await retry.json()) as { data: { duplicate: boolean } };
		assert.equal(ackBody.data.duplicate, true);
	});

	it("asks the engine to retry when a winner has no wallet yet", async () => {
		sqlite.prepare("DELETE FROM wallet WHERE user_id = ?").run(FRIEND_ID);
		const payload = {
			tournament_id: "t-2",
			winners: [
				{ player_id: USER_ID, prize: 100, rank: 1 },
				{ player_id: FRIEND_ID, prize: 50, rank: 2 },
			],
		};
		const first = await signedCallback(
			"/gamification/callback/tournament/end",
			payload,
		);
		assert.equal(first.status, 502);

		sqlite
			.prepare(
				"INSERT INTO wallet (id, user_id, balance) VALUES ('wallet-friend', ?, 0)",
			)
			.run(FRIEND_ID);
		const retry = await signedCallback(
			"/gamification/callback/tournament/end",
			payload,
		);
		assert.equal(retry.status, 200);
		assert.equal(wallet().balance, START_KOBO + 10_000);
		assert.equal(wallet(FRIEND_ID).balance, 5_000);
	});

	it("leaves bonus and free-bet prizes to the engine instead of paying cash", async () => {
		engineHandlers["/tournament/list"] = () => ({
			json: {
				status: 200,
				data: [
					{
						_id: "t-bonus",
						tournament_win_type: "bonus",
						prize_configs: [{ price_amount_type: ["fix"] }],
					},
					{
						_id: "t-freebets",
						tournament_win_type: "real",
						prize_configs: [{ price_amount_type: ["free_bets"] }],
					},
					{
						_id: "t-cash",
						tournament_win_type: "real",
						prize_configs: [{ price_amount_type: ["fix"] }],
					},
				],
			},
		});
		for (const tournamentId of ["t-bonus", "t-freebets"]) {
			const response = await signedCallback(
				"/gamification/callback/tournament/end",
				{
					tournament_id: tournamentId,
					winners: [{ player_id: USER_ID, prize: 500, rank: 1 }],
				},
			);
			assert.equal(response.status, 200);
		}
		assert.equal(wallet().balance, START_KOBO);

		const cash = await signedCallback("/gamification/callback/tournament/end", {
			tournament_id: "t-cash",
			winners: [{ player_id: USER_ID, prize: 500, rank: 1 }],
		});
		const body = (await cash.json()) as { data: { prize_kind: string } };
		assert.equal(body.data.prize_kind, "cash");
		assert.equal(wallet().balance, START_KOBO + 50_000);
	});

	it("asks the engine to retry when the tournament config cannot be read", async () => {
		engineHandlers["/tournament/list"] = () => ({
			status: 500,
			json: { message: "down" },
		});
		const response = await signedCallback(
			"/gamification/callback/tournament/end",
			{
				tournament_id: "t-x",
				winners: [{ player_id: USER_ID, prize: 500, rank: 1 }],
			},
		);
		assert.equal(response.status, 502);
		assert.equal(wallet().balance, START_KOBO);
	});

	it("rejects an end callback without winners and ACKs rank updates", async () => {
		const missing = await signedCallback(
			"/gamification/callback/tournament/end",
			{
				tournament_id: "t-3",
			},
		);
		assert.equal(missing.status, 410);

		const ranks = await signedCallback(
			"/gamification/callback/tournament/rank-update",
			{
				tournament_id: "t-3",
				users: [{ player_id: USER_ID, rank: 1 }],
				tournament_status: "ACTIVE",
			},
		);
		assert.equal(ranks.status, 200);
		assert.equal(wallet().balance, START_KOBO);
	});
});

describe("mission rewards", () => {
	it("records rewards it cannot grant instead of silently dropping them", async () => {
		const errors: string[] = [];
		const originalError = console.error;
		console.error = (...args: unknown[]) =>
			errors.push(args.map(String).join(" "));
		try {
			const response = await signedCallback(
				"/gamification/callback/mission/complete",
				{
					mission_id: MISSION_ID,
					player_id: USER_ID,
					reward: { type: "Free Spins", value: 20 },
				},
			);
			assert.equal(response.status, 200);
		} finally {
			console.error = originalError;
		}
		assert.equal(wallet().balance, START_KOBO);
		assert.ok(
			errors.some((line) => line.includes("bonus_engine_reward_unfulfilled")),
		);
	});

	it("pays a mission whose complete callback was lost, once", async () => {
		engineHandlers["/mission/list"] = () => ({
			json: {
				status: 200,
				data: [
					{
						_id: MISSION_ID,
						mission_triggers: [
							{ parameters: { rewards: [{ type: "Real Cash", amount: 250 }] } },
						],
					},
				],
			},
		});
		engineHandlers["/mission/progress"] = () => ({
			json: {
				status: 200,
				data: { progress_percentage: 100, mission_status: "COMPLETED" },
			},
		});

		const list = await call(asPlayer(missionRoute), "/list");
		const body = (await list.json()) as {
			data: Array<Record<string, unknown>>;
		};
		assert.equal(body.data[0]?.mission_status, "COMPLETED");
		assert.equal(body.data[0]?.reward_status, "pending");
		const row = sqlite
			.prepare(
				"SELECT completed_at, engine_completed_at FROM bonus_engine_mission_progress",
			)
			.get() as {
			completed_at: number | null;
			engine_completed_at: number | null;
		};
		assert.equal(
			row.completed_at,
			null,
			"polling must not claim the reward was paid",
		);
		assert.ok(row.engine_completed_at);

		// Inside the grace window the callback still gets its chance.
		const early = await reconcileMissionRewards(
			env as unknown as CloudflareBindings,
		);
		assert.equal(early.reconciled, 0);

		const later = new Date(Date.now() + 11 * 60 * 1000);
		const reconciled = await reconcileMissionRewards(
			env as unknown as CloudflareBindings,
			{ now: later },
		);
		assert.equal(reconciled.reconciled, 1);
		assert.equal(wallet().balance, START_KOBO + 25_000);

		// The callback arriving late cannot pay a second time.
		await signedCallback("/gamification/callback/mission/complete", {
			mission_id: MISSION_ID,
			player_id: USER_ID,
			reward: { type: "Real Cash", value: 250 },
		});
		assert.equal(wallet().balance, START_KOBO + 25_000);
		assert.equal(walletRows("be_mission_reward:%").length, 1);
	});
});

describe("loyalty redemption", () => {
	function offerLoyalty(campaign: Record<string, unknown>) {
		engineHandlers["/loyalty/lists"] = () => ({
			json: {
				success: true,
				data: [
					{
						_id: "loyalty-1",
						loyalty_status: "ACTIVE",
						redeem_levels_type: "cash",
						redeem_levels_value: 1_000,
						point_value_type: "cash",
						point_value: 50,
						...campaign,
					},
				],
			},
		});
	}

	it("credits the cash reward to the wallet once", async () => {
		offerLoyalty({});
		engineHandlers["/loyalty/redeem"] = () => ({
			json: {
				success: true,
				data: { total_points: 0, redeemed_points: 1_000 },
			},
		});
		const response = await call(
			asPlayer(loyaltyRoute),
			"/redeem",
			json({ points_to_redeem: 1_000, loyalty_id: "loyalty-1" }),
		);
		assert.equal(response.status, 200, await response.clone().text());
		const body = (await response.json()) as {
			data: { reward: { status: string; amount: number } };
		};
		assert.deepEqual(
			{ status: body.data.reward.status, amount: body.data.reward.amount },
			{ status: "credited", amount: 50 },
		);
		assert.equal(wallet().balance, START_KOBO + 5_000);
		assert.equal(walletRows("be_loyalty_redeem:%").length, 1);

		// The cron finds nothing left to do.
		const reconciled = await reconcileLoyaltyRedemptions(
			env as unknown as CloudflareBindings,
			{ now: new Date(Date.now() + 120_000) },
		);
		assert.equal(reconciled.credited, 0);
		assert.equal(wallet().balance, START_KOBO + 5_000);
	});

	it("credits nothing and spends no points when the engine refuses", async () => {
		offerLoyalty({});
		engineHandlers["/loyalty/redeem"] = () => ({
			status: 400,
			json: {
				success: false,
				status: 400,
				message: "Not enough loyalty points to redeem.",
			},
		});
		const response = await call(
			asPlayer(loyaltyRoute),
			"/redeem",
			json({ points_to_redeem: 1_000, loyalty_id: "loyalty-1" }),
		);
		assert.equal(response.status, 400);
		assert.equal(wallet().balance, START_KOBO);
		const row = sqlite
			.prepare("SELECT status FROM bonus_engine_loyalty_redemption")
			.get() as { status: string };
		assert.equal(row.status, "failed");
	});

	it("does not call the engine when the reward cannot be priced", async () => {
		engineHandlers["/loyalty/lists"] = () => ({
			status: 500,
			json: { message: "down" },
		});
		const response = await call(
			asPlayer(loyaltyRoute),
			"/redeem",
			json({ points_to_redeem: 1_000, loyalty_id: "loyalty-1" }),
		);
		assert.equal(response.status, 502);
		assert.equal(engineCallsTo("/loyalty/redeem").length, 0);
	});

	it("leaves non-cash rewards to the engine", async () => {
		offerLoyalty({ redeem_levels_type: "freebet" });
		engineHandlers["/loyalty/redeem"] = () => ({
			json: { success: true, data: {} },
		});
		const response = await call(
			asPlayer(loyaltyRoute),
			"/redeem",
			json({ points_to_redeem: 1_000, loyalty_id: "loyalty-1" }),
		);
		const body = (await response.json()) as {
			data: { reward: { status: string } };
		};
		assert.equal(body.data.reward.status, "engine_fulfilled");
		assert.equal(wallet().balance, START_KOBO);
	});

	it("finishes a credit the engine accepted but the wallet missed", async () => {
		sqlite
			.prepare(
				`INSERT INTO bonus_engine_loyalty_redemption
				 (id, user_id, loyalty_id, points, reward_type, reward_kobo, status, updated_at)
				 VALUES ('redemption-stuck', ?, 'loyalty-1', 1000, 'cash', 5000, 'redeemed', 0)`,
			)
			.run(USER_ID);
		const first = await reconcileLoyaltyRedemptions(
			env as unknown as CloudflareBindings,
		);
		const second = await reconcileLoyaltyRedemptions(
			env as unknown as CloudflareBindings,
		);
		assert.equal(first.credited, 1);
		assert.equal(second.credited, 0);
		assert.equal(wallet().balance, START_KOBO + 5_000);
	});
});

describe("deposits from every provider reach the engine", () => {
	it("reports a confirmed OPay deposit exactly once", async () => {
		sqlite
			.prepare(
				"INSERT INTO opay_transaction (id, user_id, reference, order_no, amount, status) VALUES ('op-1', ?, 'opay-ref-1', 'order-1', 50000, 'initiated')",
			)
			.run(USER_ID);
		sqlite
			.prepare(
				"INSERT INTO wallet_transaction (id, user_id, amount, type, reference, status, payment_method) VALUES ('wt-op-1', ?, 50000, 'credit', 'opay-ref-1', 'pending', 'opay')",
			)
			.run(USER_ID);

		const opayApp = asPlayer(opayRoute);
		const first = await call(opayApp, "/status/opay-ref-1");
		assert.equal(first.status, 200, await first.clone().text());
		sqlite.prepare("UPDATE opay_transaction SET status = 'pending'").run();
		await call(opayApp, "/status/opay-ref-1");

		assert.equal(wallet().balance, START_KOBO + 50_000);
		const deposits = engineCallsTo("/deposit");
		assert.equal(deposits.length, 1);
		assert.equal(deposits[0]?.body.amount, 500);
		assert.equal(deposits[0]?.body.transaction_id, "opay-ref-1");
	});
});

describe("reports survive a Bonus Engine outage", () => {
	it("parks a failed bet report and delivers it later", async () => {
		engineHandlers["/bet"] = () => ({ status: 503, json: { message: "down" } });
		const bet = await lagosRush("/debit", 10_000, "lr-outage-1");
		assert.equal(bet.status, 200, "the player's bet never waits on the engine");
		assert.equal(wallet().balance, START_KOBO - 10_000);

		const parked = sqlite
			.prepare("SELECT kind, status FROM bonus_engine_outbox")
			.all();
		assert.equal(parked.length, 1);

		engineHandlers["/bet"] = () => ({
			json: { status: 200, message: "Bet placed successfully" },
		});
		const drained = await drainBonusEngineOutbox(
			env as unknown as CloudflareBindings,
			{
				now: new Date(Date.now() + 10 * 60 * 1000),
			},
		);
		assert.equal(drained.delivered, 1);
		assert.equal(
			sqlite.prepare("SELECT * FROM bonus_engine_outbox").all().length,
			0,
		);
	});

	it("dead-letters a report the engine permanently rejects", async () => {
		engineHandlers["/bet"] = () => ({ status: 503, json: { message: "down" } });
		await lagosRush("/debit", 10_000, "lr-outage-2");
		engineHandlers["/bet"] = () => ({
			status: 400,
			json: { status: 400, message: "DUPLICATE_BET" },
		});
		const drained = await drainBonusEngineOutbox(
			env as unknown as CloudflareBindings,
			{
				now: new Date(Date.now() + 10 * 60 * 1000),
			},
		);
		assert.equal(drained.dead, 1);
		const row = sqlite
			.prepare("SELECT status FROM bonus_engine_outbox")
			.get() as {
			status: string;
		};
		assert.equal(row.status, "dead");
	});
});

describe("access tokens", () => {
	it("drops a rejected cached token and retries once with a fresh one", async () => {
		const store = new Map<string, string>([
			["bonus-engine:access-token:project-wallet-e2e", "revoked-token"],
		]);
		env.sportsdey_ns = {
			get: async (key: string) => store.get(key) ?? null,
			put: async (key: string, value: string) => void store.set(key, value),
			delete: async (key: string) => void store.delete(key),
		};
		engineHandlers["/mission/list"] = (_body, request) =>
			request.token === "revoked-token"
				? { status: 401, json: { status: 401, message: "Invalid token" } }
				: { json: { status: 200, data: [] } };

		const response = await call(asPlayer(missionRoute), "/list");
		assert.equal(response.status, 200, await response.clone().text());
		assert.equal(tokensMinted, 1);
		assert.equal(
			store.get("bonus-engine:access-token:project-wallet-e2e"),
			"token-1",
		);
	});
});

describe("callback key misconfiguration", () => {
	it("rejects callbacks and says the callback key is our own merchant key", async () => {
		env.BONUS_ENGINE_CALLBACK_PUBLIC_KEY = pem(merchantKeys.publicKey, "spki");
		const errors: string[] = [];
		const originalError = console.error;
		console.error = (...args: unknown[]) =>
			errors.push(args.map(String).join(" "));
		try {
			const response = await signedCallback(
				"/gamification/callback/mission/complete",
				{
					mission_id: MISSION_ID,
					player_id: USER_ID,
					reward: { type: "Real Cash", value: 10 },
				},
			);
			assert.equal(response.status, 413);
		} finally {
			console.error = originalError;
		}
		assert.equal(wallet().balance, START_KOBO);
		const diagnostic = errors.find((line) =>
			line.includes("bonus_engine_callback_signature_invalid"),
		);
		assert.ok(diagnostic, "expected a signature diagnostic");
		assert.match(diagnostic, /"callbackKeyIsMerchantKey":true/);
	});
});
