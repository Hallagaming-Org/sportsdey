/**
 * Resilient production categorize:
 * - dedupe game_category
 * - skip pairs already present
 * - small batches + retries; continue on hard failure
 *
 * Usage: pnpm exec tsx src/cli/categorize-games-resilient.ts production
 */
import { exec } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	buildCategoryInserts,
	escape,
	executeD1Json,
	fetchExistingGames,
	loadCasinoJson,
	matchGames,
	slugify,
} from "./categorize-utils";

const envArg = process.argv[2] === "staging" ? "staging" : "production";
const dbName = envArg === "production" ? "sportsdey_db" : "staging-db";
const jsonPath = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"casino_games.json",
);

function sleep(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}

async function runSql(
	sql: string,
	label: string,
	retries = 10,
): Promise<boolean> {
	const tempFile = path.join(
		os.tmpdir(),
		`categorize-resilient-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`,
	);
	fs.writeFileSync(tempFile, sql);
	let lastError: unknown;
	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			await new Promise<void>((resolve, reject) => {
				const cmd = `npx wrangler d1 execute ${dbName} --file ${JSON.stringify(tempFile)} --remote --env ${envArg}`;
				console.log(`${label} (attempt ${attempt}/${retries})...`);
				exec(cmd, { timeout: 180000 }, (error, stdout, stderr) => {
					if (error) {
						const msg = `${stderr || ""}\n${error.message}`;
						reject(new Error(msg.slice(0, 400)));
					} else {
						const written = stdout.match(/"Rows written":\s*(\d+)/);
						if (written) console.log(`  rows written: ${written[1]}`);
						resolve();
					}
				});
			});
			try {
				fs.unlinkSync(tempFile);
			} catch {}
			return true;
		} catch (err) {
			lastError = err;
			console.warn(`  ${label} failed attempt ${attempt}: ${(err as Error).message}`);
			await sleep(Math.min(45000, 3000 * attempt));
		}
	}
	console.error(`  GIVING UP on ${label}. Temp SQL kept at ${tempFile}`);
	console.error(lastError);
	return false;
}

async function main() {
	console.log(`Env=${envArg} db=${dbName}`);

	console.log("Deduplicating game_category...");
	await runSql(
		`DELETE FROM game_category
WHERE rowid NOT IN (
  SELECT MIN(rowid) FROM game_category GROUP BY game_id, category_id
);`,
		"dedupe",
	);

	const data = loadCasinoJson(jsonPath);
	const timestamp = Date.now();
	const { categoryInserts, allCategoryEntries, categories } = buildCategoryInserts(
		data,
		timestamp,
	);
	if (!categories.some(([k]) => slugify(k) === "others")) {
		categoryInserts.push(
			`(${escape("others")}, ${escape("Others")}, ${escape("others")}, ${timestamp})`,
		);
	}

	// Categories already exist in prod with legacy ids (e.g. id=crashgames, slug=crash-games).
	// Do not INSERT OR IGNORE by slugify(id) — that conflicts UNIQUE(slug). Resolve against DB.
	const dbCategories = await executeD1Json<{
		id: string;
		name: string;
		slug: string;
	}>(dbName, envArg, "SELECT id, name, slug FROM category", { remote: true });
	console.log(
		`DB categories: ${dbCategories.map((c) => `${c.id}(slug=${c.slug})`).join(", ")}`,
	);

	function resolveCategoryId(fromJsonSlug: string): string | null {
		const exactId = dbCategories.find((c) => c.id === fromJsonSlug);
		if (exactId) return exactId.id;
		const bySlug = dbCategories.find((c) => c.slug === fromJsonSlug);
		if (bySlug) return bySlug.id;
		const stripped = fromJsonSlug.replace(/-/g, "");
		const byStripped = dbCategories.find(
			(c) => c.id === stripped || c.slug === stripped,
		);
		if (byStripped) return byStripped.id;
		return null;
	}

	const games = await fetchExistingGames(dbName, envArg, { remote: true });
	console.log(`DB games: ${games.length}`);

	const existing = await executeD1Json<{ game_id: string; category_id: string }>(
		dbName,
		envArg,
		"SELECT game_id, category_id FROM game_category",
		{ remote: true },
	);
	const existingKeys = new Set(
		existing.map((r) => `${r.game_id}:${r.category_id}`),
	);
	console.log(`Existing category links: ${existingKeys.size}`);

	const { matched, unmatched } = matchGames(allCategoryEntries, games);
	console.log(`Matched pairs (from JSON): ${matched.length}`);
	console.log(`Unique unmatched names: ${new Set(unmatched).size}`);

	const uniquePairs: { gameId: string; categorySlug: string }[] = [];
	const seen = new Set<string>();
	let unresolved = 0;
	for (const pair of matched) {
		const categoryId = resolveCategoryId(pair.categorySlug);
		if (!categoryId) {
			unresolved++;
			console.warn(`  unresolved category slug: ${pair.categorySlug}`);
			continue;
		}
		const key = `${pair.gameId}:${categoryId}`;
		if (seen.has(key) || existingKeys.has(key)) continue;
		seen.add(key);
		uniquePairs.push({ gameId: pair.gameId, categorySlug: categoryId });
	}
	console.log(`Unresolved category refs: ${unresolved}`);
	console.log(`Pairs still to insert: ${uniquePairs.length}`);

	const failedBatches: number[] = [];
	const GC_BATCH = 15;
	for (let i = 0; i < uniquePairs.length; i += GC_BATCH) {
		const chunk = uniquePairs.slice(i, i + GC_BATCH);
		const batchNo = i / GC_BATCH + 1;
		const sql = chunk
			.map(
				({ gameId, categorySlug }) =>
					`INSERT INTO game_category (game_id, category_id)
SELECT ${escape(gameId)}, ${escape(categorySlug)}
WHERE NOT EXISTS (
  SELECT 1 FROM game_category
  WHERE game_id = ${escape(gameId)} AND category_id = ${escape(categorySlug)}
);`,
			)
			.join("\n");
		const ok = await runSql(sql, `game_category batch ${batchNo}`);
		if (!ok) failedBatches.push(batchNo);
		await sleep(800);
	}

	console.log('Marking uncategorized as "others"...');
	await runSql(
		`INSERT OR IGNORE INTO category (id, name, slug, created_at) VALUES ('others', 'Others', 'others', ${Date.now()});`,
		"others category",
	);
	await runSql(
		`INSERT INTO game_category (game_id, category_id)
SELECT g.id, 'others'
FROM game g
WHERE NOT EXISTS (
  SELECT 1 FROM game_category gc WHERE gc.game_id = g.id
);`,
		"orphans marking",
	);

	console.log("\nFinal dedupe...");
	await runSql(
		`DELETE FROM game_category
WHERE rowid NOT IN (
  SELECT MIN(rowid) FROM game_category GROUP BY game_id, category_id
);`,
		"final dedupe",
	);

	if (failedBatches.length) {
		console.error(`Failed batches (need re-run): ${failedBatches.join(", ")}`);
		process.exit(2);
	}
	console.log("Done! Categories synced.");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
