/**
 * Prediction Market SSO handoff: POST /handoff/code issues a single-use code,
 * POST /public/handoff/exchange redeems it server-to-server.
 *
 * Every rejection answers with the same 401 body, so these tests assert the
 * side effects instead: whether the code survived, and whether a user came back.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, it } from "node:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import { createMemoryD1 } from "../test-support/memory-d1";
import { handoffKey } from "../utils/handoff";
import handoffRoute, { handoffPublicRoute } from "./handoff";

const USER_ID = "handoff-user";
const CLIENT_ID = "handoff-client-id";
const CLIENT_SECRET = "handoff-client-secret";

let sqlite: DatabaseSync;
let kv: Map<string, string>;
let env: Record<string, unknown>;

/** Enough of the KV surface for the handoff endpoints; TTL is not simulated. */
function createMemoryKv(store: Map<string, string>) {
	return {
		async get(key: string) {
			return store.has(key) ? (store.get(key) as string) : null;
		},
		async put(key: string, value: string) {
			store.set(key, value);
		},
		async delete(key: string) {
			store.delete(key);
		},
	};
}

/** The token the partner signs with: sha256(clientId + clientSecret), hex. */
function partnerToken(clientId: string, clientSecret: string): string {
	return createHash("sha256")
		.update(`${clientId}${clientSecret}`)
		.digest("hex");
}

beforeEach(() => {
	sqlite = new DatabaseSync(":memory:");
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
	`);
	sqlite
		.prepare(
			"INSERT INTO user (id, name, email, email_verified) VALUES (?, ?, ?, 1)",
		)
		.run(USER_ID, "Handoff User", "handoff@example.com");

	kv = new Map();
	const { DB } = createMemoryD1(sqlite);
	env = {
		DB,
		sportsdey_ns: createMemoryKv(kv),
		PREDICTION_SPORTSDEY_CLIENT_ID: CLIENT_ID,
		PREDICTION_SPORTSDEY_CLIENT_SECRET: CLIENT_SECRET,
	};
});

afterEach(() => {
	sqlite.close();
});

function issuerWithUser(userId: string | null) {
	const app = new OpenAPIHono();
	app.use("*", async (c, next) => {
		c.set("user", userId ? { id: userId } : null);
		await next();
	});
	app.route("/", handoffRoute);
	return app;
}

/** Reads the body once — a Response can only be consumed a single time. */
async function expectOk(res: Response, status = 200) {
	const raw = await res.text();
	assert.equal(res.status, status, raw);
	return JSON.parse(raw) as { data: Record<string, unknown> };
}

async function issueCode(
	userId: string = USER_ID,
	overrides: Record<string, unknown> = {},
) {
	const res = await issuerWithUser(userId).request(
		"/code",
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		},
		{ ...env, ...overrides },
	);
	const body = await expectOk(res);
	return body.data as { code: string; hashedClientId: string };
}

function exchange(
	body: Record<string, unknown>,
	overrides: Record<string, unknown> = {},
) {
	return handoffPublicRoute.request(
		"/exchange",
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		},
		{ ...env, ...overrides },
	);
}

describe("handoff code issue", () => {
	it("rejects an unauthenticated caller", async () => {
		const res = await issuerWithUser(null).request(
			"/code",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			},
			env,
		);
		assert.equal(res.status, 401);
		assert.equal(kv.size, 0);
	});

	it("issues a 64-hex code and hands back the hashed client id only", async () => {
		const { code, hashedClientId } = await issueCode();

		assert.match(code, /^[0-9a-f]{64}$/);
		assert.equal(
			hashedClientId,
			createHash("sha256").update(CLIENT_ID).digest("hex"),
		);
		// The browser must never receive the exchange token.
		assert.notEqual(hashedClientId, partnerToken(CLIENT_ID, CLIENT_SECRET));
		assert.ok(kv.has(handoffKey(code)));
	});
});

describe("handoff exchange", () => {
	it("returns the user and consumes the code", async () => {
		const { code } = await issueCode();

		const res = await exchange({
			code,
			sso_exchange_token: partnerToken(CLIENT_ID, CLIENT_SECRET),
		});
		// Shape must stay `data.user` — the partner reads it from the OpenAPI doc.
		const body = await expectOk(res);
		const user = body.data.user as Record<string, unknown>;
		assert.equal(user.id, USER_ID);
		assert.equal(user.email, "handoff@example.com");

		// Single use: the code is gone and a replay fails.
		assert.equal(kv.has(handoffKey(code)), false);
		const replay = await exchange({
			code,
			sso_exchange_token: partnerToken(CLIENT_ID, CLIENT_SECRET),
		});
		assert.equal(replay.status, 401);
	});

	it("accepts the partner token when the stored credentials have stray whitespace", async () => {
		const padded = {
			PREDICTION_SPORTSDEY_CLIENT_ID: `${CLIENT_ID}\n`,
			PREDICTION_SPORTSDEY_CLIENT_SECRET: ` ${CLIENT_SECRET}\n`,
		};
		const { code, hashedClientId } = await issueCode(USER_ID, padded);

		// The hashed client id must not shift because of the padding either.
		assert.equal(
			hashedClientId,
			createHash("sha256").update(CLIENT_ID).digest("hex"),
		);

		const res = await exchange(
			{ code, sso_exchange_token: partnerToken(CLIENT_ID, CLIENT_SECRET) },
			padded,
		);
		await expectOk(res);
	});

	it("rejects a wrong token without burning the code", async () => {
		const { code } = await issueCode();

		const res = await exchange({
			code,
			sso_exchange_token: partnerToken(CLIENT_ID, "wrong-secret"),
		});
		assert.equal(res.status, 401);
		// A wrong token must not consume the code — the real client can retry.
		assert.ok(kv.has(handoffKey(code)));

		const retry = await exchange({
			code,
			sso_exchange_token: partnerToken(CLIENT_ID, CLIENT_SECRET),
		});
		await expectOk(retry);
	});

	it("rejects the browser's hashedClientId used as the exchange token", async () => {
		const { code, hashedClientId } = await issueCode();

		const res = await exchange({ code, sso_exchange_token: hashedClientId });
		assert.equal(res.status, 401);
	});

	it("rejects a malformed code before touching KV", async () => {
		const res = await exchange({
			code: "not-a-hex-code",
			sso_exchange_token: partnerToken(CLIENT_ID, CLIENT_SECRET),
		});
		assert.equal(res.status, 401);
	});

	it("rejects an unknown code", async () => {
		const res = await exchange({
			code: "a".repeat(64),
			sso_exchange_token: partnerToken(CLIENT_ID, CLIENT_SECRET),
		});
		assert.equal(res.status, 401);
	});

	it("rejects a code whose user no longer exists", async () => {
		const { code } = await issueCode();
		sqlite.prepare("DELETE FROM user WHERE id = ?").run(USER_ID);

		const res = await exchange({
			code,
			sso_exchange_token: partnerToken(CLIENT_ID, CLIENT_SECRET),
		});
		assert.equal(res.status, 401);
	});

	it("reports misconfiguration as 500, not as rejected credentials", async () => {
		const { code } = await issueCode();

		const res = await exchange(
			{ code, sso_exchange_token: partnerToken(CLIENT_ID, CLIENT_SECRET) },
			{ PREDICTION_SPORTSDEY_CLIENT_SECRET: "" },
		);
		assert.equal(res.status, 500);
	});
});
