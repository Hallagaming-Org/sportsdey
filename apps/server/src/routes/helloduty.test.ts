import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import hellodutyRoute from "./helloduty";

const SECRET = "test-helloduty-secret";
const USER_ID = "usr_helloduty_1";
const OTHER_ID = "usr_helloduty_2";
const NOW = Date.now();

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

	async first() {
		const { results } = await this.all();
		return results[0] ?? null;
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

function createEnv(options?: { dropAltTable?: boolean }) {
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
		CREATE TABLE user_phone_number (
			id text PRIMARY KEY NOT NULL,
			user_id text NOT NULL,
			phone_e164 text NOT NULL UNIQUE,
			created_at integer NOT NULL DEFAULT 0
		);
	`);
	if (options?.dropAltTable) {
		sqlite.exec("DROP TABLE user_phone_number");
	}

	sqlite
		.prepare(
			`INSERT INTO user
			 (id, name, email, email_verified, mobile_number, created_at, updated_at, verification_status, suspended)
			 VALUES (?, ?, ?, 1, ?, ?, ?, 'verified', 0)`,
		)
		.run(USER_ID, "Ada Obi", "ada@example.com", "+2348012345678", NOW, NOW);
	sqlite
		.prepare(
			`INSERT INTO user
			 (id, name, email, email_verified, mobile_number, created_at, updated_at, verification_status, suspended)
			 VALUES (?, ?, ?, 1, ?, ?, ?, 'verified', 0)`,
		)
		.run(OTHER_ID, "Other User", "other@example.com", "+2348099999999", NOW, NOW);

	return {
		sqlite,
		env: {
			DB: new MemoryD1(sqlite),
			HELLODUTY_API_SECRET: SECRET,
		},
	};
}

function mountApp() {
	const app = new OpenAPIHono();
	app.route("/webhooks/helloduty", hellodutyRoute);
	return app;
}

async function post(
	path: string,
	env: { DB: MemoryD1; HELLODUTY_API_SECRET?: string },
	body: unknown,
	headers: Record<string, string> = {},
) {
	const app = mountApp();
	return app.request(
		path,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...headers,
			},
			body: JSON.stringify(body),
		},
		env,
	);
}

describe("POST /webhooks/helloduty/contacts/lookup", () => {
	it("returns 401 when the Worker secret is unbound", async () => {
		const { env } = createEnv();
		const res = await post(
			"/webhooks/helloduty/contacts/lookup",
			{ ...env, HELLODUTY_API_SECRET: "" },
			{ phone: "08012345678" },
			{ Authorization: `Bearer ${SECRET}` },
		);
		assert.equal(res.status, 401);
	});

	it("returns 403 when the bearer does not match", async () => {
		const { env } = createEnv();
		const res = await post(
			"/webhooks/helloduty/contacts/lookup",
			env,
			{ phone: "08012345678" },
			{ Authorization: "Bearer wrong" },
		);
		assert.equal(res.status, 403);
	});

	it("returns 400 for an invalid phone", async () => {
		const { env } = createEnv();
		const res = await post(
			"/webhooks/helloduty/contacts/lookup",
			env,
			{ phone: "abc" },
			{ Authorization: `Bearer ${SECRET}` },
		);
		assert.equal(res.status, 400);
	});

	it("returns 404 when the number is not in the database", async () => {
		const { env } = createEnv();
		const res = await post(
			"/webhooks/helloduty/contacts/lookup",
			env,
			{ phone: "08011112222" },
			{ Authorization: `Bearer ${SECRET}` },
		);
		const json = (await res.json()) as { success: boolean; error: string };
		assert.equal(res.status, 404);
		assert.equal(json.success, false);
		assert.equal(json.error, "Contact not found");
	});

	it("finds a user by local or E.164 primary number", async () => {
		const { env } = createEnv();
		const res = await post(
			"/webhooks/helloduty/contacts/lookup",
			env,
			{ phoneNumber: "08012345678" },
			{ Authorization: `Bearer ${SECRET}` },
		);
		const json = (await res.json()) as {
			success: boolean;
			data: { contact: { id: string; phone: string; name: string } };
		};
		assert.equal(res.status, 200, JSON.stringify(json));
		assert.equal(json.success, true);
		assert.equal(json.data.contact.id, USER_ID);
		assert.equal(json.data.contact.phone, "+2348012345678");
		assert.equal(json.data.contact.name, "Ada Obi");
	});

	it("finds a user by alternative number", async () => {
		const { env, sqlite } = createEnv();
		sqlite
			.prepare(
				`INSERT INTO user_phone_number (id, user_id, phone_e164, created_at)
				 VALUES (?, ?, ?, ?)`,
			)
			.run("alt-1", USER_ID, "+2348077777777", NOW);

		const res = await post(
			"/webhooks/helloduty/contacts/lookup",
			env,
			{ msisdn: "08077777777" },
			{ "X-HelloDuty-Secret": SECRET },
		);
		const json = (await res.json()) as {
			data: { contact: { id: string; alternativePhones: string[] } };
		};
		assert.equal(res.status, 200, JSON.stringify(json));
		assert.equal(json.data.contact.id, USER_ID);
		assert.deepEqual(json.data.contact.alternativePhones, ["+2348077777777"]);
	});

	it("still looks up the primary number when the alt table is missing", async () => {
		const { env } = createEnv({ dropAltTable: true });
		const res = await post(
			"/webhooks/helloduty/contacts/lookup",
			env,
			{ phone: "+2348012345678" },
			{ Authorization: `Bearer ${SECRET}` },
		);
		assert.equal(res.status, 200);
	});
});

describe("POST /webhooks/helloduty/contacts/alternative-number", () => {
	it("returns 404 and does not create a user", async () => {
		const { env, sqlite } = createEnv();
		const before = sqlite.prepare("SELECT COUNT(*) AS n FROM user").get() as {
			n: number;
		};
		const res = await post(
			"/webhooks/helloduty/contacts/alternative-number",
			env,
			{ phone: "08011112222", alternativePhone: "08033334444" },
			{ Authorization: `Bearer ${SECRET}` },
		);
		const after = sqlite.prepare("SELECT COUNT(*) AS n FROM user").get() as {
			n: number;
		};
		assert.equal(res.status, 404);
		assert.equal(after.n, before.n);
	});

	it("saves an alternative number against an existing contact", async () => {
		const { env } = createEnv();
		const res = await post(
			"/webhooks/helloduty/contacts/alternative-number",
			env,
			{ contactId: USER_ID, alternativeNumber: "08033334444" },
			{ Authorization: `Bearer ${SECRET}` },
		);
		const json = (await res.json()) as {
			data: { contact: { alternativePhones: string[] } };
		};
		assert.equal(res.status, 200, JSON.stringify(json));
		assert.deepEqual(json.data.contact.alternativePhones, ["+2348033334444"]);
	});

	it("rejects an alternative that belongs to another user", async () => {
		const { env } = createEnv();
		const res = await post(
			"/webhooks/helloduty/contacts/alternative-number",
			env,
			{ contactId: USER_ID, alternativePhone: "08099999999" },
			{ Authorization: `Bearer ${SECRET}` },
		);
		assert.equal(res.status, 409);
	});

	it("is a no-op when the alternative is already the primary", async () => {
		const { env, sqlite } = createEnv();
		const res = await post(
			"/webhooks/helloduty/contacts/alternative-number",
			env,
			{ contactId: USER_ID, alternativePhone: "+2348012345678" },
			{ Authorization: `Bearer ${SECRET}` },
		);
		const count = sqlite
			.prepare("SELECT COUNT(*) AS n FROM user_phone_number")
			.get() as { n: number };
		assert.equal(res.status, 200);
		assert.equal(count.n, 0);
	});
});
