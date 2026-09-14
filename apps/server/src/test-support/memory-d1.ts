import type { DatabaseSync } from "node:sqlite";

/**
 * Minimal in-memory D1 shim over `node:sqlite` so tests can drive the real
 * Hono handlers and Drizzle queries instead of mocking the data layer.
 */
class MemoryD1Statement {
	constructor(
		private readonly sqlite: DatabaseSync,
		private readonly sql: string,
		private readonly params: unknown[] = [],
		private readonly onRun?: (sql: string) => void,
	) {}

	bind(...params: unknown[]) {
		return new MemoryD1Statement(
			this.sqlite,
			this.sql,
			params.map((value) => (value === undefined ? null : value)),
			this.onRun,
		);
	}

	async all() {
		this.onRun?.(this.sql);
		const statement = this.sqlite.prepare(this.sql);
		const results = statement.all(...this.params) as Record<string, unknown>[];
		return { results, success: true as const };
	}

	async run() {
		this.onRun?.(this.sql);
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
		this.onRun?.(this.sql);
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

export class MemoryD1 {
	/** Simulates a transient D1 failure on the next wallet balance UPDATE. */
	failNextWalletUpdate = false;

	constructor(private readonly sqlite: DatabaseSync) {}

	prepare(sql: string) {
		return new MemoryD1Statement(this.sqlite, sql, [], (nextSql) => {
			if (
				this.failNextWalletUpdate &&
				/\bupdate\b/i.test(nextSql) &&
				/\bwallet\b/i.test(nextSql) &&
				!/\bgame_transactions\b/i.test(nextSql)
			) {
				this.failNextWalletUpdate = false;
				throw new Error("D1_ERROR: simulated wallet update failure");
			}
		});
	}

	async batch(statements: MemoryD1Statement[]) {
		const results = [];
		for (const statement of statements) {
			results.push(await statement.all());
		}
		return results;
	}
}

export function createMemoryD1(sqlite: DatabaseSync): {
	d1: MemoryD1;
	DB: D1Database;
} {
	const d1 = new MemoryD1(sqlite);
	return { d1, DB: d1 as unknown as D1Database };
}
