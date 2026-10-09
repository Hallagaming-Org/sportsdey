import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { CloudflareBindings } from "../types";

type D1Database = CloudflareBindings["DB"];

/**
 * Minimal in-memory D1 shim over `node:sqlite` so tests can drive the real
 * Hono handlers and Drizzle queries instead of mocking the data layer.
 */
class MemoryD1Statement {
	constructor(
		private readonly sqlite: DatabaseSync,
		private readonly sql: string,
		private readonly params: SQLInputValue[] = [],
		private readonly onRun?: (sql: string) => void,
	) {}

	bind(...params: unknown[]) {
		return new MemoryD1Statement(
			this.sqlite,
			this.sql,
			params.map((value) =>
				value === undefined ? null : (value as SQLInputValue),
			),
			this.onRun,
		);
	}

	async all() {
		return this.allSync();
	}

	/** Synchronous body of `all()`, so a batch can run without yielding. */
	allSync() {
		this.onRun?.(this.sql);
		const statement = this.sqlite.prepare(this.sql);
		// Like D1, writes report `meta.changes` (what batch callers inspect).
		if (statement.columns().length === 0) {
			const info = statement.run(...this.params);
			return {
				results: [] as Record<string, unknown>[],
				success: true as const,
				meta: { changes: Number(info.changes) },
			};
		}
		const results = statement.all(...this.params) as Record<string, unknown>[];
		return {
			results,
			success: true as const,
			meta: { changes: results.length },
		};
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

	/**
	 * Like D1, a batch is one isolated transaction: any failing statement rolls
	 * back all, and it runs without yielding so concurrent batches on this
	 * single connection cannot interleave inside each other's savepoints.
	 */
	async batch(statements: MemoryD1Statement[]) {
		const results = [];
		this.sqlite.exec("SAVEPOINT memory_d1_batch");
		try {
			for (const statement of statements) {
				results.push(statement.allSync());
			}
		} catch (error) {
			this.sqlite.exec("ROLLBACK TO memory_d1_batch");
			this.sqlite.exec("RELEASE memory_d1_batch");
			throw error;
		}
		this.sqlite.exec("RELEASE memory_d1_batch");
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
