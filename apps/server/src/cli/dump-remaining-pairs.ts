import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	buildCategoryInserts,
	escape,
	executeD1Json,
	fetchExistingGames,
	loadCasinoJson,
	matchGames,
} from "./categorize-utils";

async function main() {
	const jsonPath = path.resolve(
		path.dirname(fileURLToPath(import.meta.url)),
		"casino_games.json",
	);
	const data = loadCasinoJson(jsonPath);
	const { allCategoryEntries } = buildCategoryInserts(data, Date.now());
	const games = await fetchExistingGames("sportsdey_db", "production", {
		remote: true,
	});
	const existing = await executeD1Json<{
		game_id: string;
		category_id: string;
	}>(dbNameCommand(), "production", "SELECT game_id, category_id FROM game_category", {
		remote: true,
	});
	const existingKeys = new Set(
		existing.map((r) => `${r.game_id}:${r.category_id}`),
	);
	const { matched } = matchGames(allCategoryEntries, games);
	const unique: { gameId: string; categorySlug: string }[] = [];
	const seen = new Set<string>();
	for (const p of matched) {
		const k = `${p.gameId}:${p.categorySlug}`;
		if (seen.has(k) || existingKeys.has(k)) continue;
		seen.add(k);
		unique.push(p);
	}
	const byCat: Record<string, number> = {};
	for (const p of unique) byCat[p.categorySlug] = (byCat[p.categorySlug] || 0) + 1;
	console.log("remaining", unique.length);
	console.log("by cat", byCat);
	const batch2 = unique.slice(15, 30);
	console.log("batch2 sample", batch2.slice(0, 5));
	const sql = batch2
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
	fs.writeFileSync("/tmp/batch2-test.sql", sql);
	console.log("wrote /tmp/batch2-test.sql");
}

function dbNameCommand() {
	return "sportsdey_db";
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
