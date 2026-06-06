import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";

const GAME_TYPES = [
	"Table/Card Games",
	"Crash Games",
	"Slots",
	"Classic",
	"Arcade",
	"Bingo",
	"Dice",
	"Scratch",
	"Jackpot",
	"Lottery",
	"Roulette",
] as const;

function normalizeName(name: string): string {
	return name.toLowerCase().trim().replace(/\s+/g, " ");
}

function parseCasinoGamesFile(filePath: string): Map<string, string> {
	const content = fs.readFileSync(filePath, "utf-8");
	const lines = content.split("\n");
	const map = new Map<string, string>();
	const sortedTypes = [...GAME_TYPES].sort((a, b) => b.length - a.length);

	for (const line of lines) {
		const trimmed = line.trimEnd();
		if (
			!trimmed ||
			trimmed.startsWith("CASINO") ||
			trimmed.startsWith("=") ||
			trimmed.startsWith("GAME TITLE") ||
			trimmed.startsWith("-")
		) {
			continue;
		}

		for (const type of sortedTypes) {
			if (trimmed.endsWith(type)) {
				const name = normalizeName(trimmed.slice(0, -type.length));
				if (name && !map.has(name)) {
					map.set(name, type.toLowerCase());
				}
				break;
			}
		}
	}

	console.log(`Loaded ${map.size} game categories from ${filePath}`);
	return map;
}

function getCategory(
	gameName: string,
	categoryMap: Map<string, string>,
): string | null {
	const normalized = normalizeName(gameName);
	return categoryMap.get(normalized) ?? null;
}

const args = process.argv.slice(2);

let env: "production" | "staging" = "staging";
let txtPath: string | null = null;
let dbName = "staging-db";

const defaultTxtPath = path.resolve(
	process.cwd(),
	"../../Casino_Games_Condensed.txt",
);

for (const arg of args) {
	if (arg === "production" || arg === "staging") {
		env = arg;
	} else if (arg.startsWith("--txt-path=")) {
		txtPath = arg.replace("--txt-path=", "");
	} else if (arg.startsWith("--db=")) {
		dbName = arg.replace("--db=", "");
	}
}

const envFile = env === "production" ? ".env.production" : ".env.staging";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const usedDbName =
	dbName || (env === "production" ? "sportsdey_db" : "staging-db");

interface GameRow {
	id: string;
	name: string;
}

async function main() {
	const resolvedTxtPath = txtPath ?? defaultTxtPath;
	if (!fs.existsSync(resolvedTxtPath)) {
		console.error(`Error: Casino games file not found at ${resolvedTxtPath}`);
		console.error("Use --txt-path=<path> to specify the correct location");
		process.exit(1);
	}

	const categoryMap = parseCasinoGamesFile(resolvedTxtPath);
	console.log(`Backfilling categories on ${env} (db: ${usedDbName})...`);

	const { exec } = await import("node:child_process");

	const games: GameRow[] = await new Promise((resolve, reject) => {
		exec(
			`npx wrangler d1 execute ${usedDbName} --command "SELECT id, name FROM game WHERE category IS NULL" --remote --env ${env} --json`,
			{ timeout: 60000 },
			(error, stdout) => {
				if (error) {
					console.error("Failed to query games:", error.message);
					reject(error);
					return;
				}

				const output = stdout ?? "";
				const parsed: GameRow[] = [];

				try {
					const json = JSON.parse(output);
					const wrapper = Array.isArray(json) ? json[0] : json;
					const rows = wrapper?.results ?? [];
					for (const row of rows) {
						if (row.id && row.name) {
							parsed.push({ id: row.id, name: row.name });
						}
					}
				} catch {
					const lines = output.trim().split("\n");
					for (const line of lines) {
						const match = line.match(/^([a-f0-9-]{32,})\|(.+)/);
						if (match) {
							parsed.push({ id: match[1], name: match[2] });
						}
					}
				}

				console.log(`Found ${parsed.length} uncategorized games`);
				resolve(parsed);
			},
		);
	});

	if (games.length === 0) {
		console.log("No uncategorized games found.");
		return;
	}

	const batchSize = 100;
	const timestamp = Date.now();
	let updated = 0;

	for (let i = 0; i < games.length; i += batchSize) {
		const batch = games.slice(i, i + batchSize);
		const cases: string[] = [];
		const ids: string[] = [];

		for (const game of batch) {
			const cat = getCategory(game.name, categoryMap);
			if (cat) {
				cases.push(
					`WHEN '${game.id.replace(/'/g, "''")}' THEN '${cat.replace(/'/g, "''")}'`,
				);
				ids.push(game.id);
			}
		}

		if (cases.length === 0) continue;

		const updateSql = `UPDATE game SET category = CASE id ${cases.join(" ")} END, updated_at = ${timestamp} WHERE id IN (${ids.map((id) => `'${id.replace(/'/g, "''")}'`).join(",")});`;

		const batchNum = Math.floor(i / batchSize) + 1;
		const tempFile = path.join(
			os.tmpdir(),
			`backfill-categories-${timestamp}-${batchNum}.sql`,
		);
		fs.writeFileSync(tempFile, updateSql);

		try {
			await new Promise((resolve, reject) => {
				const cmd = `npx wrangler d1 execute ${usedDbName} --file "${tempFile}" --remote --env ${env}`;
				exec(cmd, { timeout: 120000 }, (error, _stdout, _stderr) => {
					try {
						fs.unlinkSync(tempFile);
					} catch {}
					if (error) reject(error);
					else resolve(undefined);
				});
			});
			updated += cases.length;
			console.log(
				`Batch ${batchNum}: ${cases.length} games categorized (${updated} total)`,
			);
		} catch (err) {
			console.error(`Batch ${batchNum} failed:`, err);
		}
	}

	console.log(`\nDone! Categorized ${updated} games.`);
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
