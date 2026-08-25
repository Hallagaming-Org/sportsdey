import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import betHistoryRoute from "./bet-history";

const USER_ID = "ticket-labels-smoke-user";
const TICKET_ID = "ticket-labels-smoke-bet";
const MATCH_A = "evt-forest-leeds";
const MATCH_B = "evt-birmingham-brentford";
const MATCH_C = "evt-carrarese-mantova";

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

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

const MARKETS: Record<string, unknown> = {
	"20": {
		id: 20,
		outcomes: [
			{ name: "1", value: "{$competitor1}" },
			{ name: "2", value: "draw" },
			{ name: "3", value: "{$competitor2}" },
		],
		localizations: [{ locale: "en", template: "1x2" }],
		specifiers: [],
	},
	"17": {
		id: 17,
		outcomes: [
			{ name: "1", value: "{$competitor1} ({+hcp})" },
			{ name: "2", value: "{$competitor2} ({-hcp})" },
		],
		localizations: [{ locale: "en", template: "Map handicap" }],
		specifiers: [{ name: "hcp", value: "decimal" }],
	},
	"201": {
		id: 201,
		outcomes: [
			{ name: "1", value: "yes" },
			{ name: "2", value: "no" },
		],
		localizations: [{ locale: "en", template: "Both Teams to Score" }],
		specifiers: [],
	},
	"349": {
		id: 349,
		outcomes: [
			{ name: "1", value: "2:0" },
			{ name: "2", value: "2:1" },
		],
		localizations: [{ locale: "en", template: "Correct map score" }],
		specifiers: [],
	},
	"398": {
		id: 398,
		outcomes: [
			{ name: "1", value: "over {total}" },
			{ name: "2", value: "under {total}" },
		],
		localizations: [{ locale: "en", template: "Total goals" }],
		specifiers: [{ name: "total", value: "decimal" }],
	},
};

describe("bet-history ticket labels smoke (in-memory, real handler)", () => {
	const originalFetch = globalThis.fetch;
	const requestedUrls: string[] = [];

	before(() => {
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url =
				typeof input === "string"
					? input
					: input instanceof URL
						? input.href
						: input.url;
			requestedUrls.push(url);
			const marketMatch = url.match(/\/v2\/markets\/(\d+)/);
			if (marketMatch?.[1] && MARKETS[marketMatch[1]]) {
				return jsonResponse({ data: { market: MARKETS[marketMatch[1]] } });
			}
			if (url.includes("sport-events-fixtures")) {
				return jsonResponse({
					data: {
						sportEventsByIds: [
							{
								id: MATCH_A,
								fixture: { title: "Nottingham Forest vs Leeds United" },
							},
							{
								id: MATCH_B,
								fixture: { title: "Birmingham City vs Brentford FC" },
							},
							{
								id: MATCH_C,
								fixture: { title: "Carrarese vs Mantova FC" },
							},
						],
					},
				});
			}
			return jsonResponse({ error: `unexpected fetch: ${url}` }, 500);
		}) as typeof fetch;
	});

	after(() => {
		globalThis.fetch = originalFetch;
	});

	it("labels every selection pick, not only Over 1.5", async () => {
		requestedUrls.length = 0;
		const sqlite = new DatabaseSync(":memory:");
		sqlite.exec(`
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
		`);
		const betData = {
			bet_odds: [
				{
					odd_id: "1",
					odd_ratio: "1.300000",
					market_id: "398t1_5",
					match_id: MATCH_A,
					odd_status: 0,
				},
				{
					odd_id: "2",
					odd_ratio: "1.900000",
					market_id: "398t2_5",
					match_id: MATCH_A,
					odd_status: 0,
				},
				{
					odd_id: "2",
					odd_ratio: "2.100000",
					market_id: "201",
					match_id: MATCH_B,
					odd_status: 0,
				},
				{
					odd_id: "1",
					odd_ratio: "2.350000",
					market_id: "20",
					match_id: MATCH_C,
					odd_status: 0,
				},
				{
					odd_id: "3",
					odd_ratio: "2.800000",
					market_id: "20",
					match_id: MATCH_C,
					odd_status: 0,
				},
				{
					odd_id: "2",
					odd_ratio: "1.850000",
					market_id: "17h-1_5",
					match_id: MATCH_C,
					odd_status: 0,
				},
			],
			bet_builder_odds: [
				{
					match_id: MATCH_B,
					odds: [
						{
							odd_id: "1",
							odd_ratio: "3.400000",
							market_id: "349",
							match_id: MATCH_B,
							odd_status: 0,
						},
					],
				},
			],
		};
		sqlite
			.prepare(
				`INSERT INTO sportsbook_bet
				 (id, user_id, stake, total_odds_value, bet_type, status, bet_data, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				TICKET_ID,
				USER_ID,
				50000,
				"10.95",
				2,
				"accepted",
				JSON.stringify(betData),
				Date.now(),
				Date.now(),
			);

		const app = new OpenAPIHono();
		app.use("*", async (c, next) => {
			c.set("user", { id: USER_ID });
			await next();
		});
		app.route("/", betHistoryRoute);

		const env = {
			DB: new MemoryD1(sqlite),
			NODE_ENV: "staging",
			PROXY_URL: "https://proxy.example.test",
			PROXY_SECRET: "smoke-secret",
		};

		const res = await app.request(`/${TICKET_ID}`, { method: "GET" }, env);
		const body = await res.json();
		assert.equal(res.status, 200, JSON.stringify(body));
		assert.equal(body.success, true);

		const picks = body.data.selections.map(
			(row: { market: string; pick: string; odds: string }) => ({
				market: row.market,
				pick: row.pick,
				odds: row.odds,
			}),
		);
		assert.deepEqual(picks, [
			{ market: "Total goals", pick: "Over 1.5", odds: "1.3" },
			{ market: "Total goals", pick: "Under 2.5", odds: "1.9" },
			{ market: "Both Teams to Score", pick: "No", odds: "2.1" },
			{ market: "1x2", pick: "Carrarese", odds: "2.35" },
			{ market: "1x2", pick: "Mantova FC", odds: "2.8" },
			{ market: "Map handicap", pick: "Mantova FC (+1.5)", odds: "1.85" },
			{ market: "Correct map score", pick: "2:0", odds: "3.4" },
		]);

		for (const row of body.data.selections) {
			assert.equal(String(row.market ?? "").startsWith("Market "), false);
			assert.equal(String(row.pick ?? "").startsWith("@"), false);
			assert.ok(row.market, JSON.stringify(row));
			assert.ok(row.pick, JSON.stringify(row));
		}

		assert.ok(
			requestedUrls.some((url) =>
				url.includes("/sportsbook-staging/v2/markets/20"),
			),
			`1x2 dictionary fetched: ${requestedUrls.join(", ")}`,
		);
		assert.ok(
			requestedUrls.some((url) =>
				url.includes("/sportsbook-staging/sport-events-fixtures"),
			),
			`staging fixtures fetched: ${requestedUrls.join(", ")}`,
		);
	});
});
