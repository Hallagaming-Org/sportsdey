import { exec } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);

let env: "production" | "staging" = "staging";
let execute = false;
for (const arg of args) {
	if (arg === "production" || arg === "staging") {
		env = arg;
	} else if (arg === "--execute") {
		execute = true;
	}
}

const dbName = env === "production" ? "sportsdey_db" : "staging-db";

interface SeedGame {
	name: string;
	code: string;
	categories: string[];
}

const GAMES: SeedGame[] = [
	{ name: "Solitaire", code: "solitaire", categories: ["classic"] },
	{ name: "Blocks", code: "blocks", categories: ["classic"] },
	{ name: "Twenty One", code: "twentyone", categories: ["classic"] },
	{
		name: "Blackjack",
		code: "blackjack",
		categories: ["table-card-games", "classic"],
	},
	{ name: "Slots", code: "slots", categories: ["slots"] },
	{ name: "Plinko", code: "plinko", categories: ["classic", "crash-games"] },
	{ name: "Xcape", code: "XCAPEHB", categories: ["popular", "slots"] },
	{ name: "Eagle", code: "EAGLEHB", categories: ["popular", "crash-games"] },
	{ name: "Lucky Rise", code: "LUCKYRISEHB", categories: ["popular", "slots"] },
	{
		name: "Lagos Rush",
		code: "LAGOSRUSH",
		categories: ["popular", "crash-games"],
	},
	{
		name: "Sportsdey Crash",
		code: "sportsdey-crash",
		categories: ["popular", "crash-games", "original"],
	},
	{ name: "Spin and Win", code: "spin_and_win", categories: ["original"] },
];

function escape(value: string | number | null | undefined): string {
	if (value === null || value === undefined) return "NULL";
	return typeof value === "number"
		? value.toString()
		: `'${String(value).replace(/'/g, "''")}'`;
}

const CATEGORY_META: Record<string, { name: string; slug: string }> = {
	popular: { name: "popular", slug: "popular" },
	slots: { name: "slots", slug: "slots" },
	"crash-games": { name: "crash-games", slug: "crash-games" },
	classic: { name: "classic", slug: "classic" },
	tablecardgames: { name: "table_card_games", slug: "tablecardgames" },
	original: { name: "Original", slug: "original" },
};

function main() {
	const now = Date.now();
	const gameIds = GAMES.map(() => crypto.randomUUID());
	const usedCategories = new Set(GAMES.flatMap((g) => g.categories));

	console.log(`Seeding games in ${env} database...`);
	console.log(`Total games: ${GAMES.length}`);
	console.log(`Categories: ${usedCategories.size}`);

	const categoryValues = [...usedCategories]
		.map((slug) => {
			const meta = CATEGORY_META[slug] ?? { name: slug, slug };
			return `(${slug}, ${meta.name}, ${slug}, ${now})`;
		})
		.join(",\n");

	const gameValues = GAMES.map(
		(game, i) =>
			`(${escape(gameIds[i])}, ${escape(game.name)}, ${escape(game.code)}, NULL, 1, ${now}, ${now})`,
	).join(",\n");

	const gcValues = GAMES.flatMap((game, i) =>
		game.categories.map((cat) => `(${escape(gameIds[i])}, ${escape(cat)})`),
	).join(",\n");

	const categorySql = `INSERT OR IGNORE INTO category (id, name, slug, created_at) VALUES ${categoryValues};`;
	const gameSql = `INSERT OR IGNORE INTO game (id, name, code, image_url, enabled, created_at, updated_at) VALUES ${gameValues};`;
	const gcSql = `INSERT OR IGNORE INTO game_category (game_id, category_id) VALUES ${gcValues};`;

	if (execute) {
		const statements = [categorySql, gameSql, gcSql];
		(async () => {
			for (const [i, statement] of statements.entries()) {
				const tempFile = path.join(os.tmpdir(), `seed-games-${now}-${i}.sql`);
				fs.writeFileSync(tempFile, statement);
				try {
					await new Promise<void>((resolve, reject) => {
						const cmd = `npx wrangler d1 execute ${dbName} --file "${tempFile}" --remote --env ${env}`;
						exec(cmd, { timeout: 120000 }, (error) => {
							try {
								fs.unlinkSync(tempFile);
							} catch {}
							if (error) reject(error);
							else resolve();
						});
					});
					console.log(`Statement ${i + 1}/${statements.length} executed`);
				} catch (err) {
					console.error(`Statement ${i + 1} failed:`, err);
				}
			}
			console.log("\nDone!");
		})();
	} else {
		const combinedSql = [categorySql, gameSql, gcSql].join("\n\n");
		console.log(`\nSQL ready to execute on remote ${env} database`);
		console.log("Please run this command manually:");
		console.log(
			`npx wrangler d1 execute ${dbName} --command "${combinedSql.replace(/"/g, '\\"')}" --remote`,
		);
		console.log("\nOr run with --execute flag to execute automatically.");
	}
}

main();
