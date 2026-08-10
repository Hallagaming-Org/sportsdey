import { exec } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

interface CasinoGamesJson {
	[key: string]: string[];
}

const args = process.argv.slice(2);

let env: "production" | "staging" = "staging";
let jsonPath: string | null = null;

for (const arg of args) {
	if (arg === "production" || arg === "staging") {
		env = arg;
	} else if (arg.startsWith("--json=")) {
		jsonPath = arg.replace("--json=", "");
	}
}

const usedDbName = env === "production" ? "sportsdey_db" : "staging-db";

const defaultJsonPath = path.resolve(process.cwd(), "../../../casino_games.json");

function normalizeName(name: string): string {
	return name.toLowerCase().trim().replace(/\s+/g, " ");
}

function slugify(name: string): string {
	return name.toLowerCase().replace(/[\/\s]+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function escape(value: string | number | null | undefined): string {
	if (value === null || value === undefined) return "NULL";
	return typeof value === "number"
		? value.toString()
		: `'${String(value).replace(/'/g, "''")}'`;
}

function executeD1Json<T>(command: string): Promise<T[]> {
	return new Promise((resolve, reject) => {
		const cmd = `npx wrangler d1 execute ${usedDbName} --command ${JSON.stringify(command)} --remote --env ${env} --json`;
		if (env === "production") console.log("Connecting to production database...");
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
					resolve(parseTableOutput(stdout));
				}
			}
		});
	});
}

function parseTableOutput(output: string): any[] {
	const items: any[] = [];
	const lines = output.split("\n");
	let parsing = false;
	const headers: string[] = [];

	for (const line of lines) {
		if (line.includes("┌") || line.includes("─")) {
			parsing = true;
			continue;
		}
		if (parsing && line.includes("|")) {
			const parts = line.split("|").map((p) => p.trim()).filter(Boolean);
			if (headers.length === 0) {
				headers.push(...parts);
			} else {
				const obj: any = {};
				for (let i = 0; i < headers.length && i < parts.length; i++) {
					obj[headers[i]] = parts[i];
				}
				if (Object.keys(obj).length > 0) items.push(obj);
			}
		}
	}
	return items;
}

async function main() {
	const resolvedPath = jsonPath ?? defaultJsonPath;

	if (!fs.existsSync(resolvedPath)) {
		console.error(`JSON file not found: ${resolvedPath}`);
		process.exit(1);
	}

	const raw = fs.readFileSync(resolvedPath, "utf-8");
	const data: CasinoGamesJson = JSON.parse(raw);

	const categories = Object.entries(data).filter(([key]) => key !== "popular");
	const popularGames = data.popular ?? [];

	console.log(`Loaded ${categories.length} categories from ${resolvedPath}`);
	console.log(`Backfilling categories on ${env} (db: ${usedDbName})...`);

	console.log("\nFetching all games from database...");
	const games = await executeD1Json<{ id: string; name: string }>("SELECT id, name FROM game");
	console.log(`Found ${games.length} games in database`);

	if (games.length === 0) {
		console.log("No games in database.");
		return;
	}

	const now = Date.now();
	const timestamp = now;

	const categoryInserts: string[] = [];
	const allCategoryEntries: { gameName: string; categorySlug: string }[] = [];

	for (const [cat, gameList] of categories) {
		const slug = slugify(cat);
		categoryInserts.push(
			`(${escape(slug)}, ${escape(cat)}, ${escape(slug)}, ${timestamp})`,
		);
		for (const gameName of gameList) {
			allCategoryEntries.push({ gameName: normalizeName(gameName), categorySlug: slug });
		}
	}

	for (const gameName of popularGames) {
		allCategoryEntries.push({ gameName: normalizeName(gameName), categorySlug: "popular" });
	}

	if (!categories.some(([k]) => k === "popular")) {
		categoryInserts.push(
			`(${escape("popular")}, ${escape("Popular")}, ${escape("popular")}, ${timestamp})`,
		);
	}

	const nameToId = new Map<string, string>();
	for (const game of games) {
		nameToId.set(normalizeName(game.name), game.id);
	}

	const matched: { gameId: string; categorySlug: string }[] = [];
	const unmatchedNames: string[] = [];

	for (const entry of allCategoryEntries) {
		const gameId = nameToId.get(entry.gameName);
		if (gameId) {
			matched.push({ gameId, categorySlug: entry.categorySlug });
		} else {
			unmatchedNames.push(entry.gameName);
		}
	}

	console.log(`Matched: ${matched.length} games`);
	const uniqueUnmatched = [...new Set(unmatchedNames)];
	if (uniqueUnmatched.length > 0) {
		console.log(`Unmatched: ${uniqueUnmatched.length} unique names`);
	}

	if (matched.length === 0) {
		console.log("No games matched. Nothing to insert.");
		return;
	}

	const uniquePairs = new Set<string>();
	const gameCategoryValues: string[] = [];
	for (const { gameId, categorySlug } of matched) {
		const key = `${gameId}:${categorySlug}`;
		if (uniquePairs.has(key)) continue;
		uniquePairs.add(key);
		gameCategoryValues.push(
			`(${escape(gameId)}, ${escape(categorySlug)})`,
		);
	}

	if (!categories.some(([k]) => k === "others")) {
		categoryInserts.push(
			`(${escape("others")}, ${escape("Others")}, ${escape("others")}, ${timestamp})`,
		);
	}

	console.log(`\nExecuting category inserts...`);

	const catSql = `INSERT OR IGNORE INTO category (id, name, slug, created_at) VALUES ${categoryInserts.join(",\n")};`;
	const gcSql = `INSERT OR IGNORE INTO game_category (game_id, category_id) VALUES ${gameCategoryValues.join(",\n")};`;

	const timestampSuffix = Date.now();
	const statements = [catSql, gcSql];

	for (let i = 0; i < statements.length; i++) {
		const statement = statements[i];
		const tempFile = path.join(
			os.tmpdir(),
			`backfill-categories-${timestampSuffix}-${i}.sql`,
		);
		fs.writeFileSync(tempFile, statement);

		try {
			await new Promise<void>((resolve, reject) => {
				const cmd = `npx wrangler d1 execute ${usedDbName} --file "${tempFile}" --remote --env ${env}`;
				console.log(`Executing batch ${i + 1}/${statements.length}...`);
				exec(cmd, { timeout: 120000 }, (error, stdout, stderr) => {
					try { fs.unlinkSync(tempFile); } catch {}
					if (error) {
						console.error(`Batch ${i + 1} failed:`, error.message);
						if (stderr) console.error(stderr);
						reject(error);
					} else {
						console.log(stdout);
						resolve();
					}
				});
			});
		} catch (err) {
			console.error(`Failed to execute batch ${i + 1}:`, err);
		}
	}

	console.log(`\nMarking uncategorized games as "others"...`);

	const othersSql = `INSERT OR IGNORE INTO category (id, name, slug, created_at) VALUES ('others', 'Others', 'others', ${timestamp});`;
	const othersTemp = path.join(os.tmpdir(), `backfill-others-${timestampSuffix}.sql`);
	fs.writeFileSync(othersTemp, othersSql);
	try {
		await new Promise<void>((resolve, reject) => {
			exec(
				`npx wrangler d1 execute ${usedDbName} --file "${othersTemp}" --remote --env ${env}`,
				{ timeout: 120000 },
				(error) => {
					try { fs.unlinkSync(othersTemp); } catch {}
					if (error) reject(error);
					else resolve();
				},
			);
		});
	} catch {}

	const orphansSql = `INSERT OR IGNORE INTO game_category (game_id, category_id)
SELECT g.id, 'others'
FROM game g
WHERE g.id NOT IN (SELECT game_id FROM game_category);`;
	const orphansTemp = path.join(os.tmpdir(), `backfill-orphans-${timestampSuffix}.sql`);
	fs.writeFileSync(orphansTemp, orphansSql);
	try {
		await new Promise<void>((resolve, reject) => {
			exec(
				`npx wrangler d1 execute ${usedDbName} --file "${orphansTemp}" --remote --env ${env}`,
				{ timeout: 120000 },
				(error, stdout) => {
					try { fs.unlinkSync(orphansTemp); } catch {}
					if (error) reject(error);
					else {
						console.log(stdout);
						resolve();
					}
				},
			);
		});
	} catch (err) {
		console.error("Failed to mark others:", err);
	}

	console.log(`\nDone! ${uniquePairs.size} game-category associations created, plus "others" for uncategorized games.`);
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
