import { exec } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { nativeCasinoProviderByGameCode } from "../services/bonus-engine/casino-catalog.constant";

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

/**
 * Resolves the Bonus Engine provider that owns a seeded game so `game` rows
 * carry `provider_id` / `provider_name` like Slotegrator's synced rows do.
 * Without these, the game is invisible to Bonus Engine Admin dropdowns and its
 * bets cannot satisfy a mission rule.
 */
function providerForCode(code: string) {
	return nativeCasinoProviderByGameCode(code);
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
	{ name: "Plinko", code: "plinko", categories: ["arcade"] },
	{ name: "Xcape", code: "XCAPEHB", categories: ["popular", "slots"] },
	{ name: "Eagle", code: "EAGLEHB", categories: ["popular", "crash-games"] },
	{ name: "Lucky Rise", code: "LUCKYRISEHB", categories: ["popular", "slots"] },
	{
		name: "Lagos Rush",
		code: "LAGOSRUSH",
		categories: ["popular", "crash-games"],
	},
	{
		name: "Halla Bomb",
		code: "HALLABOMB",
		categories: ["popular", "original", "arcade"],
	},
	{
		name: "Halla Dice",
		code: "HALLADICE",
		categories: ["popular", "original", "dice"],
	},
	{
		name: "Halla Metronite",
		code: "HALLAMETRONITE",
		categories: ["popular", "original", "arcade"],
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
	"table-card-games": { name: "table_card_games", slug: "tablecardgames" },
	tablecardgames: { name: "table_card_games", slug: "tablecardgames" },
	original: { name: "Original", slug: "original" },
	arcade: { name: "arcade", slug: "arcade" },
	dice: { name: "dice", slug: "dice" },
};

function executeD1(command: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const tempFile = path.join(
			os.tmpdir(),
			`seed-games-${Date.now()}-${crypto.randomUUID()}.sql`,
		);
		fs.writeFileSync(tempFile, command);
		const cmd = `npx wrangler d1 execute ${dbName} --file ${JSON.stringify(tempFile)} --remote --env ${env}`;
		exec(cmd, { timeout: 120000 }, (error) => {
			try {
				fs.unlinkSync(tempFile);
			} catch {}
			if (error) reject(error);
			else resolve();
		});
	});
}

function executeD1Json<T>(command: string): Promise<T[]> {
	return new Promise((resolve, reject) => {
		const cmd = `npx wrangler d1 execute ${dbName} --command ${JSON.stringify(command)} --remote --env ${env} --json`;
		exec(cmd, { timeout: 120000 }, (error, stdout) => {
			if (error) {
				reject(error);
				return;
			}
			try {
				const topLevel = JSON.parse(stdout.trim());
				const entries = Array.isArray(topLevel) ? topLevel : [topLevel];
				const results: T[] = [];
				for (const entry of entries) {
					if (entry?.results) results.push(...entry.results);
				}
				resolve(results);
			} catch {
				resolve([]);
			}
		});
	});
}

async function main() {
	const now = Date.now();
	const usedCategories = new Set(GAMES.flatMap((g) => g.categories));
	const codes = GAMES.map((g) => g.code);

	// A game with no provider is invisible to Bonus Engine Admin, so missions
	// can never be built for it. Fail here rather than seed a dead row.
	const orphans = GAMES.filter((game) => !providerForCode(game.code));
	if (orphans.length > 0) {
		console.error(
			`These game codes have no Bonus Engine provider — add them to a provider's gameCodes in services/bonus-engine/casino-catalog.constant.ts:\n  ${orphans
				.map((game) => `${game.code} (${game.name})`)
				.join("\n  ")}`,
		);
		process.exit(1);
	}

	console.log(`Seeding games in ${env} database...`);
	console.log(`Total games: ${GAMES.length}`);
	console.log(`Categories: ${usedCategories.size}`);

	const existing = await executeD1Json<{ id: string; code: string }>(
		`SELECT id, code FROM game WHERE code IN (${codes.map((c) => escape(c)).join(", ")}) ORDER BY created_at ASC`,
	);

	/** Prefer the oldest row when duplicates already exist. */
	const existingByCode = new Map<string, string>();
	for (const row of existing) {
		if (!existingByCode.has(row.code)) {
			existingByCode.set(row.code, row.id);
		}
	}

	const resolved = GAMES.map((game) => {
		const existingId = existingByCode.get(game.code);
		return {
			...game,
			id: existingId ?? crypto.randomUUID(),
			isNew: !existingId,
		};
	});

	const toInsert = resolved.filter((g) => g.isNew);
	const toUpdate = resolved.filter((g) => !g.isNew);

	console.log(`Existing: ${toUpdate.length}, new: ${toInsert.length}`);

	const categoryValues = [...usedCategories]
		.map((slug) => {
			const meta = CATEGORY_META[slug] ?? { name: slug, slug };
			// category.id must match game_category.category_id (the seed key).
			return `(${escape(slug)}, ${escape(meta.name)}, ${escape(slug)}, ${now})`;
		})
		.join(",\n");

	const statements: string[] = [
		`INSERT OR IGNORE INTO category (id, name, slug, created_at) VALUES ${categoryValues};`,
	];

	if (toInsert.length > 0) {
		const gameValues = toInsert
			.map((game) => {
				const provider = providerForCode(game.code);
				return `(${escape(game.id)}, ${escape(game.name)}, ${escape(game.code)}, NULL, ${escape(provider?.uniqueId)}, ${escape(provider?.name)}, 1, ${now}, ${now})`;
			})
			.join(",\n");
		statements.push(
			`INSERT INTO game (id, name, code, image_url, provider_id, provider_name, enabled, created_at, updated_at) VALUES ${gameValues};`,
		);
	}

	for (const game of toUpdate) {
		const provider = providerForCode(game.code);
		// Never null out provider metadata a catalog sync may have written.
		const providerSet = provider
			? `provider_id = ${escape(provider.uniqueId)}, provider_name = ${escape(provider.name)}, `
			: "";
		statements.push(
			`UPDATE game SET name = ${escape(game.name)}, ${providerSet}enabled = 1, updated_at = ${now} WHERE id = ${escape(game.id)};`,
		);
	}

	for (const game of resolved) {
		for (const cat of game.categories) {
			statements.push(
				`INSERT INTO game_category (game_id, category_id)
SELECT ${escape(game.id)}, ${escape(cat)}
WHERE NOT EXISTS (
  SELECT 1 FROM game_category
  WHERE game_id = ${escape(game.id)} AND category_id = ${escape(cat)}
);`,
			);
		}
	}

	if (!execute) {
		console.log(`\nSQL ready (${statements.length} statements) for remote ${env}`);
		console.log("Or run with --execute flag to execute automatically.");
		for (const [i, statement] of statements.entries()) {
			console.log(`\n-- ${i + 1}/${statements.length}\n${statement}`);
		}
		return;
	}

	for (const [i, statement] of statements.entries()) {
		try {
			await executeD1(statement);
			console.log(`Statement ${i + 1}/${statements.length} executed`);
		} catch (err) {
			console.error(`Statement ${i + 1} failed:`, err);
			throw err;
		}
	}
	console.log("\nDone!");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
