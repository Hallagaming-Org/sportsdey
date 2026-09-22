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

/** Strip punctuation so "Adrenaline Rush xcrash" matches "Adrenaline Rush: XCrash". */
export function flexibleName(name: string): string {
	return normalizeName(name)
		.replace(/[^a-z0-9]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
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
	const cmd = `npx wrangler d1 execute ${dbName} --command ${JSON.stringify(command)} ${remoteFlag} --env ${env} --json`;
	let lastError: Error | null = null;
	for (let attempt = 1; attempt <= 6; attempt++) {
		try {
			return await new Promise<T[]>((resolve, reject) => {
				exec(cmd, { timeout: 300000 }, (error, stdout) => {
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
		} catch (err) {
			lastError = err as Error;
			console.warn(`  D1 query failed attempt ${attempt}/6: ${lastError.message.slice(0, 180)}`);
			await sleep(Math.min(20000, 2000 * attempt));
		}
	}
	throw lastError ?? new Error("D1 execute failed");
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
	const pageSize = 1000;
	const all: { id: string; name: string }[] = [];
	for (let offset = 0; ; offset += pageSize) {
		const rows = await executeD1Json<{ id: string; name: string }>(
			dbName,
			env,
			`SELECT id, name FROM game ORDER BY id LIMIT ${pageSize} OFFSET ${offset}`,
			options,
		);
		all.push(...rows);
		if (rows.length < pageSize) break;
	}
	return all;
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
	const nameToIds = new Map<string, string[]>();
	const flexibleToIds = new Map<string, string[]>();

	const add = (map: Map<string, string[]>, key: string, id: string) => {
		if (!key) return;
		const list = map.get(key) ?? [];
		if (!list.includes(id)) list.push(id);
		map.set(key, list);
	};

	for (const game of games) {
		add(nameToIds, normalizeName(game.name), game.id);
		add(flexibleToIds, flexibleName(game.name), game.id);
	}

	const matched: { gameId: string; categorySlug: string }[] = [];
	const unmatched: string[] = [];

	for (const entry of allCategoryEntries) {
		const ids =
			nameToIds.get(entry.gameName) ??
			flexibleToIds.get(flexibleName(entry.gameName)) ??
			[];
		if (ids.length > 0) {
			for (const gameId of ids) {
				matched.push({ gameId, categorySlug: entry.categorySlug });
			}
		} else {
			unmatched.push(entry.gameName);
		}
	}

	return { matched, unmatched };
}

export function uniqueGameCategoryPairs(
	matched: { gameId: string; categorySlug: string }[],
): { gameId: string; categorySlug: string }[] {
	const uniquePairs = new Set<string>();
	const values: { gameId: string; categorySlug: string }[] = [];
	for (const { gameId, categorySlug } of matched) {
		const key = `${gameId}:${categorySlug}`;
		if (uniquePairs.has(key)) continue;
		uniquePairs.add(key);
		values.push({ gameId, categorySlug });
	}
	return values;
}

export function gameCategoryBatchInsertSql(
	pairs: { gameId: string; categorySlug: string }[],
): string {
	const unions = pairs
		.map(
			(p, i) =>
				i === 0
					? `SELECT ${escape(p.gameId)} AS game_id, ${escape(p.categorySlug)} AS category_id`
					: `SELECT ${escape(p.gameId)}, ${escape(p.categorySlug)}`,
		)
		.join(" UNION ALL ");
	return `INSERT INTO game_category (game_id, category_id) SELECT x.game_id, x.category_id FROM (${unions}) x WHERE NOT EXISTS (SELECT 1 FROM game_category gc WHERE gc.game_id = x.game_id AND gc.category_id = x.category_id)`;
}

export function gameCategoryInsertSql(pair: {
	gameId: string;
	categorySlug: string;
}): string {
	return gameCategoryBatchInsertSql([pair]);
}

/** @deprecated use uniqueGameCategoryPairs + gameCategoryInsertSql */
export function buildDeduplicatedGameCategoryValues(
	matched: { gameId: string; categorySlug: string }[],
): string[] {
	return uniqueGameCategoryPairs(matched).map(gameCategoryInsertSql);
}

function sleep(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}

export async function executeSqlFile(
	dbName: string,
	env: string,
	sql: string,
	label: string,
	suffix: string,
	index: number,
	options: {
		remote?: boolean;
		throwOnError?: boolean;
		timeoutMs?: number;
		retries?: number;
		preferFile?: boolean;
	} = {},
): Promise<void> {
	const remote = options.remote !== false;
	const throwOnError = options.throwOnError !== false;
	const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000;
	const retries = options.retries ?? 8;
	const tempFile = path.join(os.tmpdir(), `${suffix}-${Date.now()}-${index}.sql`);
	fs.writeFileSync(tempFile, sql);
	try {
		for (let attempt = 1; attempt <= retries; attempt++) {
			try {
				await new Promise<void>((resolve, reject) => {
					const remoteFlag = remote ? "--remote" : "--local";
					const flatSql = sql.replace(/\s+/g, " ").trim();
					const useCommand =
						!options.preferFile && flatSql.length < 20_000;
					const cmd = useCommand
						? `npx wrangler d1 execute ${dbName} --command ${JSON.stringify(flatSql)} ${remoteFlag} --env ${env}`
						: `npx wrangler d1 execute ${dbName} --file "${tempFile}" ${remoteFlag} --env ${env}`;
					console.log(
						`Executing ${label} (${remote ? "remote" : "local"}, attempt ${attempt}/${retries})...`,
					);
					exec(cmd, { timeout: timeoutMs }, (error, stdout, stderr) => {
						if (error) {
							const timedOut = error.killed && error.signal === "SIGTERM";
							reject(
								new Error(
									`${timedOut ? `timed out at ${timeoutMs}ms` : error.message}\n${stderr || ""}`.slice(
										0,
										500,
									),
								),
							);
						} else {
							console.log(stdout);
							resolve();
						}
					});
				});
				return;
			} catch (err) {
				console.warn(`  ${label} failed attempt ${attempt}: ${(err as Error).message}`);
				if (attempt === retries) throw err;
				await sleep(Math.min(45000, 3000 * attempt));
			}
		}
	} catch (err) {
		console.error(`Failed to execute ${label}:`, err);
		if (throwOnError) throw err;
	} finally {
		try {
			fs.unlinkSync(tempFile);
		} catch {}
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

	console.log("Fetching existing game_category links...");
	const dbCategories = await executeD1Json<{
		id: string;
		slug: string;
	}>(dbName, env, "SELECT id, slug FROM category", { remote });
	function resolveCategoryId(fromJsonSlug: string): string | null {
		const exactId = dbCategories.find((c) => c.id === fromJsonSlug);
		if (exactId) return exactId.id;
		const bySlug = dbCategories.find((c) => c.slug === fromJsonSlug);
		if (bySlug) return bySlug.id;
		const stripped = fromJsonSlug.replace(/-/g, "");
		const byStripped = dbCategories.find(
			(c) => c.id === stripped || c.slug === stripped,
		);
		return byStripped?.id ?? null;
	}

	const existingLinks = await executeD1Json<{
		game_id: string;
		category_id: string;
	}>(dbName, env, "SELECT game_id, category_id FROM game_category", {
		remote,
	});
	const existingKeys = new Set(
		existingLinks.map((r) => `${r.game_id}:${r.category_id}`),
	);
	console.log(`Existing category links: ${existingKeys.size}`);

	const newPairs = uniqueGameCategoryPairs(matched)
		.map((pair) => ({
			gameId: pair.gameId,
			categorySlug: resolveCategoryId(pair.categorySlug) ?? pair.categorySlug,
		}))
		.filter((pair) => {
			if (!dbCategories.some((c) => c.id === pair.categorySlug)) {
				console.warn(`  unresolved category: ${pair.categorySlug}`);
				return false;
			}
			return !existingKeys.has(`${pair.gameId}:${pair.categorySlug}`);
		});
	console.log(`New pairs to insert: ${newPairs.length}`);
	const categorySql = `INSERT OR IGNORE INTO category (id, name, slug, created_at) VALUES ${categoryInserts.join(", ")};`;

	const suffix = "categorize";
	const execOpts = { remote };
	await executeSqlFile(dbName, env, categorySql, "category inserts", suffix, 0, {
		...execOpts,
		throwOnError: false,
	});

	const GC_BATCH = 50;
	const failedBatches: number[] = [];
	const insertOpts = { ...execOpts, preferFile: true, retries: 6 };
	for (let i = 0; i < newPairs.length; i += GC_BATCH) {
		const chunk = newPairs.slice(i, i + GC_BATCH);
		const batchNo = i / GC_BATCH + 1;
		const gameCategorySql = chunk
			.map(
				(p) =>
					`INSERT INTO game_category (game_id, category_id) SELECT ${escape(p.gameId)}, ${escape(p.categorySlug)} WHERE NOT EXISTS (SELECT 1 FROM game_category WHERE game_id = ${escape(p.gameId)} AND category_id = ${escape(p.categorySlug)});`,
			)
			.join("\n");
		try {
			await executeSqlFile(
				dbName,
				env,
				gameCategorySql,
				`game_category inserts batch ${batchNo}`,
				suffix,
				batchNo,
				{ ...insertOpts, throwOnError: true },
			);
		} catch {
			console.warn(`  skipping batch ${batchNo} for later retry`);
			failedBatches.push(i);
		}
		await sleep(3000);
	}

	for (const i of failedBatches) {
		const chunk = newPairs.slice(i, i + GC_BATCH);
		const batchNo = i / GC_BATCH + 1;
		const gameCategorySql = chunk
			.map(
				(p) =>
					`INSERT INTO game_category (game_id, category_id) SELECT ${escape(p.gameId)}, ${escape(p.categorySlug)} WHERE NOT EXISTS (SELECT 1 FROM game_category WHERE game_id = ${escape(p.gameId)} AND category_id = ${escape(p.categorySlug)});`,
			)
			.join("\n");
		await executeSqlFile(
			dbName,
			env,
			gameCategorySql,
			`game_category retry batch ${batchNo}`,
			suffix,
			1000 + batchNo,
			{ ...insertOpts, throwOnError: false, retries: 6 },
		);
		await sleep(5000);
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

	const orphansSql = `INSERT OR IGNORE INTO game_category (game_id, category_id) SELECT g.id, 'others' FROM game g WHERE g.id NOT IN (SELECT game_id FROM game_category)`;
	await executeSqlFile(dbName, env, orphansSql, "orphans marking", suffix, 901, execOpts);

	await executeSqlFile(
		dbName,
		env,
		`DELETE FROM game_category WHERE category_id = 'others' AND game_id IN (SELECT game_id FROM (SELECT game_id FROM game_category WHERE category_id != 'others'))`,
		"drop others from categorized games",
		suffix,
		902,
		execOpts,
	);

	console.log("\nDone! Categories synced.");
}
