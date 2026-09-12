/**
 * Off-peak backfill for accumulator program boosts.
 *
 * Lists Sportsdey users from D1, skips players already marked program_synced
 * in KV (`acc-program-sync-v2:{playerId}`), and calls ensureAccumulatorProgramBoosts
 * for the rest with the same concurrency-8 limit used by live sync.
 *
 * Usage:
 *   node --import tsx src/cli/backfill-accumulator-boosts.ts staging
 *   node --import tsx src/cli/backfill-accumulator-boosts.ts production --execute
 *   node --import tsx src/cli/backfill-accumulator-boosts.ts staging --execute --limit=100 --offset=0
 *
 * Requires PROXY_URL and PROXY_SECRET in the environment (or .env.staging / .env.production).
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
	ACCUMULATOR_SYNC_CONCURRENCY,
	ensureAccumulatorProgramBoosts,
} from "../sportsbook/accumulator-boost-sync";
import {
	accumulatorProgramSyncedKey,
	getAccumulatorKv,
	isAccumulatorProgramSynced,
	type AccumulatorKvNamespace,
} from "../sportsbook/accumulator-boost-kv";
import type { CloudflareBindings } from "../types";

const execFileAsync = promisify(execFile);

const args = process.argv.slice(2);
let envName: "staging" | "production" = "staging";
let execute = false;
let limit = Number.POSITIVE_INFINITY;
let offset = 0;

for (const arg of args) {
	if (arg === "production" || arg === "staging") {
		envName = arg;
	} else if (arg === "--execute") {
		execute = true;
	} else if (arg.startsWith("--limit=")) {
		limit = Number.parseInt(arg.replace("--limit=", ""), 10);
	} else if (arg.startsWith("--offset=")) {
		offset = Number.parseInt(arg.replace("--offset=", ""), 10);
	}
}

const dbName = envName === "production" ? "sportsdey_db" : "staging-db";
const kvBinding = envName === "production" ? "sportsdey_ns" : "staging-kv";

type CliKv = AccumulatorKvNamespace;

function createCliKv(): CliKv {
	return {
		async get(key, type) {
			try {
				const { stdout } = await execFileAsync(
					"npx",
					[
						"wrangler",
						"kv",
						"key",
						"get",
						key,
						"--binding",
						kvBinding,
						"--env",
						envName,
						"--remote",
					],
					{ cwd: process.cwd(), timeout: 60_000 },
				);
				const value = stdout.trim();
				if (!value || value === "Value not found") return null;
				if (type === "json") return JSON.parse(value);
				return value;
			} catch {
				return null;
			}
		},
		async put(key, value, options) {
			const putArgs = [
				"wrangler",
				"kv",
				"key",
				"put",
				key,
				value,
				"--binding",
				kvBinding,
				"--env",
				envName,
				"--remote",
			];
			if (options?.expirationTtl != null) {
				putArgs.push("--expiration-ttl", String(options.expirationTtl));
			}
			await execFileAsync("npx", putArgs, {
				cwd: process.cwd(),
				timeout: 60_000,
			});
		},
	};
}

async function databetFetch(
	env: CloudflareBindings,
	path: string,
	options: {
		method?: string;
		body?: unknown;
	} = {},
): Promise<Response> {
	const proxyUrl = env.PROXY_URL?.trim();
	const proxySecret = env.PROXY_SECRET?.trim();
	if (!proxyUrl || !proxySecret) {
		throw new Error("PROXY_URL and PROXY_SECRET are required");
	}

	const baseUrl = `${proxyUrl.replace(/\/+$/, "")}/${env.NODE_ENV === "staging" ? "sportsbook-staging" : "sportsbook"}${path.startsWith("/") ? path : `/${path}`}`;
	return fetch(baseUrl, {
		method: options.method || "GET",
		headers: {
			"Content-Type": "application/json",
			"X-Proxy-Auth": proxySecret,
		},
		body: options.body ? JSON.stringify(options.body) : undefined,
	});
}

async function fetchUserIds(): Promise<string[]> {
	const sql = "SELECT id FROM user ORDER BY created_at ASC";
	const { stdout } = await execFileAsync(
		"npx",
		[
			"wrangler",
			"d1",
			"execute",
			dbName,
			"--command",
			sql,
			"--remote",
			"--env",
			envName,
			"--json",
		],
		{ cwd: process.cwd(), timeout: 120_000 },
	);

	const parsed = JSON.parse(stdout.trim()) as Array<{
		results?: Array<{ id?: string }>;
	}>;
	const rows = parsed.flatMap((entry) => entry.results ?? []);
	return rows
		.map((row) => row.id)
		.filter((id): id is string => typeof id === "string" && id.length > 0);
}

async function processWithConcurrency<T>(
	items: T[],
	concurrency: number,
	worker: (item: T) => Promise<void>,
): Promise<void> {
	let index = 0;
	async function runNext(): Promise<void> {
		while (index < items.length) {
			const current = items[index++];
			if (current === undefined) return;
			await worker(current);
		}
	}
	await Promise.all(
		Array.from({ length: Math.min(concurrency, items.length) }, () =>
			runNext(),
		),
	);
}

async function main() {
	const proxyUrl = process.env.PROXY_URL?.trim();
	const proxySecret = process.env.PROXY_SECRET?.trim();
	if (!proxyUrl || !proxySecret) {
		console.error(
			"Missing PROXY_URL or PROXY_SECRET. Load .env.staging / .env.production first.",
		);
		process.exit(1);
	}

	const kv = createCliKv();
	const bindings = {
		PROXY_URL: proxyUrl,
		PROXY_SECRET: proxySecret,
		NODE_ENV: envName,
		...(envName === "production"
			? { sportsdey_ns: kv }
			: { "staging-kv": kv }),
	} as CloudflareBindings;

	const allUserIds = await fetchUserIds();
	const slice = allUserIds.slice(offset, offset + limit);
	const pending: string[] = [];

	for (const playerId of slice) {
		if (await isAccumulatorProgramSynced(kv, playerId)) {
			continue;
		}
		pending.push(playerId);
	}

	console.info("Accumulator boost backfill plan", {
		env: envName,
		totalUsers: allUserIds.length,
		candidateSlice: slice.length,
		pendingSync: pending.length,
		concurrency: ACCUMULATOR_SYNC_CONCURRENCY,
		execute,
		kvKeyExample: accumulatorProgramSyncedKey("example-player-id"),
	});

	if (!execute) {
		console.info("Dry run only. Re-run with --execute to sync pending users.");
		return;
	}

	let synced = 0;
	let skipped = 0;
	let failed = 0;

	await processWithConcurrency(
		pending,
		ACCUMULATOR_SYNC_CONCURRENCY,
		async (playerId) => {
			try {
				if (getAccumulatorKv(bindings) == null) {
					throw new Error("KV binding unavailable in CLI env");
				}
				if (await isAccumulatorProgramSynced(kv, playerId)) {
					skipped += 1;
					return;
				}
				const grant = await ensureAccumulatorProgramBoosts(
					databetFetch,
					bindings,
					{ playerId, force: false },
				);
				if (grant.skippedSync) {
					skipped += 1;
					console.info("Skipped player", {
						playerId,
						reason: grant.skipReason,
					});
					return;
				}
				if (grant.failed.length > 0) {
					failed += 1;
					console.error("Partial failure", {
						playerId,
						failed: grant.failed.slice(0, 3),
					});
					return;
				}
				synced += 1;
				console.info("Synced player", {
					playerId,
					created: grant.created.length,
					repaired: grant.repaired.length,
				});
			} catch (error) {
				failed += 1;
				console.error("Backfill error", {
					playerId,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		},
	);

	console.info("Accumulator boost backfill complete", {
		synced,
		skipped,
		failed,
	});
}

void main().catch((error) => {
	console.error(error);
	process.exit(1);
});
