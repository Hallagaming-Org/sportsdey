/**
 * Apply casino_games_sheet.json onto a remote D1.
 * Exact title match only (normalizeName). Slot/Slots/Video Slot already merged in the JSON.
 *
 * Usage: pnpm exec tsx src/cli/apply-sheet-categories.ts production
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
	normalizeName,
} from "./categorize-utils";

const envArg = process.argv[2] === "staging" ? "staging" : "production";
const dbName = envArg === "production" ? "sportsdey_db" : "staging-db";
const jsonPath = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"casino_games_sheet.json",
);

function sleep(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}

function matchExact(
	entries: { gameName: string; categorySlug: string }[],
	games: { id: string; name: string }[],
): { matched: { gameId: string; categorySlug: string }[]; unmatched: string[] } {
	const nameToIds = new Map<string, string[]>();
	for (const game of games) {
		const key = normalizeName(game.name);
		if (!key) continue;
		const list = nameToIds.get(key) ?? [];
		if (!list.includes(game.id)) list.push(game.id);
		nameToIds.set(key, list);
	}

	const matched: { gameId: string; categorySlug: string }[] = [];
	const unmatched: string[] = [];
	for (const entry of entries) {
		const ids = nameToIds.get(entry.gameName) ?? [];
		if (ids.length === 0) {
			unmatched.push(entry.gameName);
			continue;
		}
		for (const gameId of ids) {
			matched.push({ gameId, categorySlug: entry.categorySlug });
		}
	}
	return { matched, unmatched };
}

async function runSql(
	sql: string,
	label: string,
	retries = 10,
): Promise<boolean> {
	const tempFile = path.join(
		os.tmpdir(),
		`apply-sheet-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`,
	);
	fs.writeFileSync(tempFile, sql);
	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			await new Promise<void>((resolve, reject) => {
				const cmd = `npx wrangler d1 execute ${dbName} --file ${JSON.stringify(tempFile)} --remote --env ${envArg}`;
				console.log(`${label} (attempt ${attempt}/${retries})...`);
				exec(cmd, { timeout: 180000 }, (error, stdout, stderr) => {
					if (error) {
						reject(new Error(`${stderr || ""}\n${error.message}`.slice(0, 400)));
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
			console.warn(`  ${label} failed attempt ${attempt}: ${(err as Error).message}`);
			await sleep(Math.min(45000, 3000 * attempt));
		}
	}
	console.error(`  GIVING UP on ${label}. SQL kept at ${tempFile}`);
	return false;
}

async function main() {
	console.log(`Env=${envArg} db=${dbName}`);
	console.log(`Sheet JSON: ${jsonPath}`);

	const data = loadCasinoJson(jsonPath);
	const timestamp = Date.now();
	const { categoryInserts, allCategoryEntries, categories } =
		buildCategoryInserts(data, timestamp);

	console.log("Sheet categories:");
	for (const [cat, games] of categories) {
		console.log(`  ${cat}: ${games.length}`);
	}

	const dbCategories = await executeD1Json<{
		id: string;
		name: string;
		slug: string;
	}>(dbName, envArg, "SELECT id, name, slug FROM category", { remote: true });
	console.log(
		`DB categories: ${dbCategories.map((c) => `${c.id}(slug=${c.slug})`).join(", ")}`,
	);

	const missingInserts: string[] = [];
	for (const tuple of categoryInserts) {
		missingInserts.push(tuple);
	}
	if (missingInserts.length > 0) {
		await runSql(
			`INSERT OR IGNORE INTO category (id, name, slug, created_at) VALUES ${missingInserts.join(",\n")};`,
			"ensure categories",
		);
	}

	const dbCategoriesAfter = await executeD1Json<{
		id: string;
		name: string;
		slug: string;
	}>(dbName, envArg, "SELECT id, name, slug FROM category", { remote: true });

	function resolveCategoryId(fromJsonSlug: string): string | null {
		const exactId = dbCategoriesAfter.find((c) => c.id === fromJsonSlug);
		if (exactId) return exactId.id;
		const bySlug = dbCategoriesAfter.find((c) => c.slug === fromJsonSlug);
		if (bySlug) return bySlug.id;
		const stripped = fromJsonSlug.replace(/-/g, "");
		const byStripped = dbCategoriesAfter.find(
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

	const { matched, unmatched } = matchExact(allCategoryEntries, games);
	const uniqueUnmatched = [...new Set(unmatched)];
	console.log(`Exact matched pairs: ${matched.length}`);
	console.log(`Unique unmatched sheet titles: ${uniqueUnmatched.length}`);
	for (const name of uniqueUnmatched) {
		console.log(`  UNMATCHED\t${name}`);
	}

	const uniquePairs: { gameId: string; categoryId: string }[] = [];
	const seen = new Set<string>();
	const recategorizedIds = new Set<string>();
	let unresolved = 0;
	for (const pair of matched) {
		const categoryId = resolveCategoryId(pair.categorySlug);
		if (!categoryId) {
			unresolved++;
			console.warn(`  unresolved category slug: ${pair.categorySlug}`);
			continue;
		}
		recategorizedIds.add(pair.gameId);
		const key = `${pair.gameId}:${categoryId}`;
		if (seen.has(key) || existingKeys.has(key)) continue;
		seen.add(key);
		uniquePairs.push({ gameId: pair.gameId, categoryId });
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
				({ gameId, categoryId }) =>
					`INSERT INTO game_category (game_id, category_id)
SELECT ${escape(gameId)}, ${escape(categoryId)}
WHERE NOT EXISTS (
  SELECT 1 FROM game_category
  WHERE game_id = ${escape(gameId)} AND category_id = ${escape(categoryId)}
);`,
			)
			.join("\n");
		const ok = await runSql(sql, `game_category batch ${batchNo}`);
		if (!ok) failedBatches.push(batchNo);
		await sleep(800);
	}

	const othersId =
		dbCategoriesAfter.find((c) => c.slug === "others" || c.id === "others")
			?.id ?? "others";
	if (recategorizedIds.size > 0) {
		const ids = [...recategorizedIds];
		const ID_BATCH = 40;
		for (let i = 0; i < ids.length; i += ID_BATCH) {
			const chunk = ids.slice(i, i + ID_BATCH);
			const inList = chunk.map((id) => escape(id)).join(", ");
			await runSql(
				`DELETE FROM game_category
WHERE category_id = ${escape(othersId)}
AND game_id IN (${inList});`,
				`drop others from sheet matches batch ${i / ID_BATCH + 1}`,
			);
		}
	}

	if (failedBatches.length) {
		console.error(`Failed batches (need re-run): ${failedBatches.join(", ")}`);
		process.exit(2);
	}
	console.log("Done. Production sheet categories applied (exact names only).");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
