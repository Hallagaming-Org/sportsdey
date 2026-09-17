import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import swipegamesRoute from "@/routes/swipegames";
import { createMemoryD1 } from "@/test-support/memory-d1";
import { queryParamsToCanonicalJSON, toCanonicalJSON } from "./canonical-json";

const INTEGRATION_KEY = "integration-test-key";
const SESSION_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const USER_ID = "swipegames-user-1";

function env(DB: D1Database = {} as D1Database) {
	return {
		SWIPEGAMES_CID: "cid",
		SWIPEGAMES_EXT_CID: "sportsdey",
		SWIPEGAMES_API_KEY: "outbound-key",
		SWIPEGAMES_INTEGRATION_API_KEY: INTEGRATION_KEY,
		SWIPEGAMES_ENV: "staging",
		DB,
		sportsdey_ns: {
			get: async () => null,
			put: async () => undefined,
		},
	};
}

function memoryEnv() {
	const sqlite = new DatabaseSync(":memory:");
	sqlite.exec(`
		CREATE TABLE user (
			id text PRIMARY KEY NOT NULL,
			name text NOT NULL,
			email text NOT NULL UNIQUE,
			email_verified integer NOT NULL DEFAULT 0,
			image text, country text, mobile_number text,
			created_at integer NOT NULL DEFAULT 0,
			updated_at integer NOT NULL DEFAULT 0,
			verification_status text NOT NULL DEFAULT 'not_verified',
			suspended integer NOT NULL DEFAULT 0,
			last_login_ip text, profile_self_edited_at integer, dob text
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
	`);
	sqlite
		.prepare(
			`INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
			 VALUES (?, 'Player', 'sg@example.com', 1, 0, 0)`,
		)
		.run(USER_ID);
	sqlite
		.prepare(
			`INSERT INTO wallet (id, user_id, balance, frozen_balance, created_at, updated_at)
			 VALUES ('w1', ?, 50000, 0, 0, 0)`,
		)
		.run(USER_ID);
	sqlite
		.prepare(
			`INSERT INTO swipegames_sessions
			 (session_id, user_id, game_id, currency, demo, status, created_at, updated_at)
			 VALUES (?, ?, 'sg_catch_97', 'NGN', 0, 'active', 0, 0)`,
		)
		.run(SESSION_ID, USER_ID);
	const { DB } = createMemoryD1(sqlite);
	return env(DB);
}

describe("Swipe Games reverse-call signature gate", () => {
	it("rejects POST /bet with a bad signature without touching the wallet", async () => {
		const app = new OpenAPIHono();
		app.route("/swipegames", swipegamesRoute);
		const canonical = toCanonicalJSON({
			amount: "1.00",
			roundID: "b78e42f8-2041-482d-9c4b-f2ca79fc75e3",
			sessionID: "sess",
			txID: "c27ccade-5a45-4157-a85f-7d023a689ea5",
			type: "regular",
		});
		const response = await app.request(
			"/swipegames/bet",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-request-sign": "deadbeef",
				},
				body: canonical,
			},
			env(),
		);
		assert.equal(response.status, 401);
		const json = (await response.json()) as { message: string };
		assert.equal(json.message, "Invalid signature");
	});

	it("rejects GET /balance with a bad signature", async () => {
		const app = new OpenAPIHono();
		app.route("/swipegames", swipegamesRoute);
		const response = await app.request(
			"/swipegames/balance?sessionID=abc",
			{
				method: "GET",
				headers: { "x-request-sign": "00".repeat(32) },
			},
			env(),
		);
		assert.equal(response.status, 401);
	});

	it("GET /balance is reachable with a valid signature", async () => {
		const app = new OpenAPIHono();
		app.route("/swipegames", swipegamesRoute);
		const params = { sessionID: SESSION_ID };
		const signature = createHmac("sha256", INTEGRATION_KEY)
			.update(queryParamsToCanonicalJSON(params))
			.digest("hex");
		const response = await app.request(
			`/swipegames/balance?sessionID=${SESSION_ID}`,
			{ method: "GET", headers: { "x-request-sign": signature } },
			memoryEnv(),
		);
		assert.equal(response.status, 200);
		const json = (await response.json()) as { balance: string };
		assert.equal(json.balance, "500.00");
	});

	it("GET /games is reachable without credentials", async () => {
		const app = new OpenAPIHono();
		app.route("/swipegames", swipegamesRoute);
		const response = await app.request(
			"/swipegames/games",
			{ method: "GET" },
			{
				DB: {} as D1Database,
				sportsdey_ns: { get: async () => null, put: async () => undefined },
			},
		);
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), []);
	});
});
