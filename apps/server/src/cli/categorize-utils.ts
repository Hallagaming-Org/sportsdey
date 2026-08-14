import { exec } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface CasinoGamesJson {
	[key: string]: string[];
}

export interface CategoryEntry {
	gameName: string;
	categorySlug: string;
}

export function normalizeName(name: string): string {
	return name.toLowerCase().trim().replace(/\s+/g, " ");
}

export function slugify(name: string): string {
	return name.toLowerCase().replace(/[\/\s]+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function escape(value: string | number | null | undefined): string {
	if (value === null || value === undefined) return "NULL";
	return typeof value === "number"
		? value.toString()
		: `'${String(value).replace(/'/g, "''")}'`;
}

export function loadCasinoJson(jsonPath: string): CasinoGamesJson {
	if (!fs.existsSync(jsonPath)) {
		console.error(`JSON file not found: ${jsonPath}`);
		process.exit(1);
	}
	const raw = fs.readFileSync(jsonPath, "utf-8");
	return JSON.parse(raw);
}

export async function executeD1Json<T>(
	dbName: string,
	env: string,
	command: string,
	options: { remote?: boolean } = {},
): Promise<T[]> {
	const remoteFlag = options.remote === false ? "--local" : "--remote";
	return new Promise((resolve, reject) => {
		const cmd = `npx wrangler d1 execute ${dbName} --command ${JSON.stringify(command)} ${remoteFlag} --env ${env} --json`;
		exec(cmd, { timeout: 120000 }, (error, stdout) => {
			if (error) {
				reject(new Error(`D1 execute failed: ${error.message}`));
			} else {
				try {
					const trimmed = stdout.trim();
					const topLevel = JSON.parse(trimmed);
					const entries = Array.isArray(topLevel) ? topLevel : [topLevel];
					const results: T[] = [];
					for (const entry of entries) {
						if (entry && entry.results) {
							results.push(...entry.results);
						}
					}
					resolve(results);
				} catch {
					console.warn("Could not parse JSON, trying table output...");
					resolve(parseTableOutput(stdout) as T[]);
				}
			}
		});
	});
}

export function parseTableOutput(output: string): { id: string; name: string }[] {
	const games: { id: string; name: string }[] = [];
	const lines = output.split("\n");
	let parsing = false;
	for (const line of lines) {
		if (line.includes("├") || line.includes("└") || line.includes("─")) {
			parsing = true;
			continue;
		}
		if (parsing && line.includes("|")) {
			const parts = line.split("|").map((p) => p.trim());
			if (parts.length >= 3 && parts[1] && parts[2]) {
				games.push({ id: parts[1], name: parts[2] });
			}
		}
	}
	return games;
}

export async function fetchExistingGames(
	dbName: string,
	env: string,
	options: { remote?: boolean } = {},
): Promise<{ id: string; name: string }[]> {
	return executeD1Json<{ id: string; name: string }>(
		dbName,
		env,
		"SELECT id, name FROM game",
		options,
	);
}

export function buildCategoryInserts(
	data: CasinoGamesJson,
	timestamp: number,
): {
	categoryInserts: string[];
	allCategoryEntries: CategoryEntry[];
	categories: [string, string[]][];
} {
	const categories = Object.entries(data).filter(([key]) => key !== "popular");
	const popularGames = data.popular ?? [];

	const categoryInserts: string[] = [];
	const allCategoryEntries: CategoryEntry[] = [];

	for (const [cat, games] of categories) {
		const slug = slugify(cat);
		categoryInserts.push(
			`(${escape(slug)}, ${escape(cat)}, ${escape(slug)}, ${timestamp})`,
		);
		for (const gameName of games) {
			allCategoryEntries.push({ gameName: normalizeName(gameName), categorySlug: slug });
		}
	}

	for (const gameName of popularGames) {
		allCategoryEntries.push({ gameName: normalizeName(gameName), categorySlug: "popular" });
	}

	if (!categories.some(([k]) => slugify(k) === "popular")) {
		categoryInserts.push(
			`(${escape("popular")}, ${escape("Popular")}, ${escape("popular")}, ${timestamp})`,
		);
	}

	return { categoryInserts, allCategoryEntries, categories };
}

export function matchGames(
	allCategoryEntries: CategoryEntry[],
	games: { id: string; name: string }[],
): { matched: { gameId: string; categorySlug: string }[]; unmatched: string[] } {
	const nameToId = new Map<string, string>();
	for (const game of games) {
		const normalized = normalizeName(game.name);
		if (!nameToId.has(normalized)) {
			nameToId.set(normalized, game.id);
		}
	}

	const matched: { gameId: string; categorySlug: string }[] = [];
	const unmatched: string[] = [];

	for (const entry of allCategoryEntries) {
		const gameId = nameToId.get(entry.gameName);
		if (gameId) {
			matched.push({ gameId, categorySlug: entry.categorySlug });
		} else {
			unmatched.push(entry.gameName);
		}
	}

	return { matched, unmatched };
}

export function buildDeduplicatedGameCategoryValues(
	matched: { gameId: string; categorySlug: string }[],
): string[] {
	const uniquePairs = new Set<string>();
	const values: string[] = [];
	for (const { gameId, categorySlug } of matched) {
		const key = `${gameId}:${categorySlug}`;
		if (uniquePairs.has(key)) continue;
		uniquePairs.add(key);
		values.push(`(${escape(gameId)}, ${escape(categorySlug)})`);
	}
	return values;
}

export async function executeSqlFile(
	dbName: string,
	env: string,
	sql: string,
	label: string,
	suffix: string,
	index: number,
	options: { remote?: boolean; throwOnError?: boolean; timeoutMs?: number } = {},
): Promise<void> {
	const remote = options.remote !== false;
	const throwOnError = options.throwOnError !== false;
	const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000;
	const tempFile = path.join(os.tmpdir(), `${suffix}-${Date.now()}-${index}.sql`);
	fs.writeFileSync(tempFile, sql);
	try {
		await new Promise<void>((resolve, reject) => {
			const remoteFlag = remote ? "--remote" : "--local";
			const cmd = `npx wrangler d1 execute ${dbName} --file "${tempFile}" ${remoteFlag} --env ${env}`;
			console.log(`Executing ${label} (${remote ? "remote" : "local"})...`);
			exec(cmd, { timeout: timeoutMs }, (error, stdout, stderr) => {
				try {
					fs.unlinkSync(tempFile);
				} catch {}
				if (error) {
					const timedOut = error.killed && error.signal === "SIGTERM";
					console.error(
						`${label} failed${timedOut ? ` after timing out at ${timeoutMs}ms` : ""}:`,
						error.message,
					);
					if (stderr) console.error(stderr);
					reject(error);
				} else {
					console.log(stdout);
					resolve();
				}
			});
		});
	} catch (err) {
		console.error(`Failed to execute ${label}:`, err);
		if (throwOnError) throw err;
	}
}

export async function categorizeGamesFromJson(
	dbName: string,
	env: string,
	jsonPath: string,
	options: { remote?: boolean } = {},
): Promise<void> {
	console.log(`Loading categories from ${jsonPath}...`);
	const data = loadCasinoJson(jsonPath);
	const timestamp = Date.now();
	const remote = options.remote !== false;

	const { categoryInserts, allCategoryEntries, categories } = buildCategoryInserts(data, timestamp);

	if (!categories.some(([k]) => slugify(k) === "others")) {
		categoryInserts.push(
			`(${escape("others")}, ${escape("Others")}, ${escape("others")}, ${timestamp})`,
		);
	}

	console.log(`Loaded ${categories.length} categories`);
	for (const [cat, games] of categories) {
		console.log(`  ${cat}: ${games.length} games`);
	}
	const popularCount = data.popular?.length ?? 0;
	if (popularCount > 0) {
		console.log(`  popular: ${popularCount} games`);
	}

	console.log(`\nFetching existing games from database (${remote ? "remote" : "local"})...`);
	const games = await fetchExistingGames(dbName, env, { remote });
	console.log(`Found ${games.length} games in database`);

	if (games.length === 0) {
		console.log("No games in database. Nothing to categorize.");
		return;
	}

	const { matched, unmatched } = matchGames(allCategoryEntries, games);
	console.log(`Matched: ${matched.length} games`);
	if (unmatched.length > 0) {
		const unique = [...new Set(unmatched)];
		console.log(`Unique unmatched names: ${unique.length}`);
		if (unique.length <= 30) {
			for (const name of unique) {
				console.log(`  - ${name}`);
			}
		}
	}

	if (matched.length === 0) {
		console.log("No games matched. Nothing to insert.");
		return;
	}

	const gameCategoryValues = buildDeduplicatedGameCategoryValues(matched);
	const categorySql = `INSERT OR IGNORE INTO category (id, name, slug, created_at) VALUES ${categoryInserts.join(",\n")};`;

	const suffix = "categorize";
	const execOpts = { remote };
	await executeSqlFile(dbName, env, categorySql, "category inserts", suffix, 0, execOpts);

	const GC_BATCH = 100;
	for (let i = 0; i < gameCategoryValues.length; i += GC_BATCH) {
		const chunk = gameCategoryValues.slice(i, i + GC_BATCH);
		const gameCategorySql = `INSERT OR IGNORE INTO game_category (game_id, category_id) VALUES ${chunk.join(",\n")};`;
		await executeSqlFile(
			dbName,
			env,
			gameCategorySql,
			`game_category inserts batch ${i / GC_BATCH + 1}`,
			suffix,
			1 + i / GC_BATCH,
			execOpts,
		);
	}

	console.log('\nMarking uncategorized games as "others"...');
	await executeSqlFile(
		dbName,
		env,
		`INSERT OR IGNORE INTO category (id, name, slug, created_at) VALUES ('others', 'Others', 'others', ${Date.now()});`,
		"others category",
		suffix,
		900,
		execOpts,
	);

	const orphansSql = `INSERT OR IGNORE INTO game_category (game_id, category_id)
SELECT g.id, 'others'
FROM game g
WHERE g.id NOT IN (SELECT game_id FROM game_category);`;
	await executeSqlFile(dbName, env, orphansSql, "orphans marking", suffix, 901, execOpts);

	console.log("\nDone! Categories synced.");
}
