import { exec } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

interface GdriveFile {
	name: string;
	image_url: string;
}

interface GameRecord {
	id: string;
	name: string;
}

const args = process.argv.slice(2);

let env: "production" | "staging" = "staging";

for (const arg of args) {
	if (arg === "production" || arg === "staging") {
		env = arg;
	}
}

const usedDbName = env === "production" ? "sportsdey_db" : "staging-db";

function normalizeName(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/\.[^.]+$/, "")
		.replace(/[-_]+/g, " ")
		.replace(/\s+/g, " ");
}

function escape(value: string | number | null | undefined): string {
	if (value === null || value === undefined) {
		return "NULL";
	}
	return typeof value === "number"
		? value.toString()
		: `'${String(value).replace(/'/g, "''")}'`;
}

function executeD1(command: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const cmd = `npx wrangler d1 execute ${usedDbName} --command ${JSON.stringify(command)} --remote --env ${env}`;
		exec(cmd, { timeout: 120000 }, (error, stdout) => {
			if (error) {
				reject(error);
			} else {
				resolve(stdout);
			}
		});
	});
}

function executeD1Json<T>(command: string): Promise<T[]> {
	return new Promise((resolve, reject) => {
		const cmd = `npx wrangler d1 execute ${usedDbName} --command ${JSON.stringify(command)} --remote --env ${env} --json`;
		exec(cmd, { timeout: 120000 }, (error, stdout) => {
			if (error) {
				reject(error);
			} else {
				try {
					const topLevel = JSON.parse(stdout.trim());
					const entries = Array.isArray(topLevel) ? topLevel : [topLevel];
					const results: T[] = [];
					for (const entry of entries) {
						if (entry && entry.results) {
							results.push(...entry.results);
						}
					}
					resolve(results);
				} catch {
					resolve([]);
				}
			}
		});
	});
}

async function main() {
	console.log(`Matching game images from gdrive_file (${env} environment)...`);
	console.log(`Database: ${usedDbName}`);
	console.log("");

	console.log("Fetching gdrive_file records...");
	const gdriveFiles = await executeD1Json<GdriveFile>(
		"SELECT name, image_url FROM gdrive_file",
	);
	console.log(`Found ${gdriveFiles.length} gdrive_file records`);

	if (gdriveFiles.length === 0) {
		console.log("No files in gdrive_file table.");
		return;
	}

	console.log("Fetching all games...");
	const games = await executeD1Json<GameRecord>("SELECT id, name FROM game");
	console.log(`Found ${games.length} games in database`);

	if (games.length === 0) {
		console.log("No games in database.");
		return;
	}

	const gdriveLookup = new Map<string, string>();
	for (const f of gdriveFiles) {
		const key = normalizeName(f.name);
		if (f.name !== key) {
			console.log(`  Normalizing gdrive name: "${f.name}" -> "${key}"`);
		}
		if (!gdriveLookup.has(key)) {
			gdriveLookup.set(key, f.image_url);
		}
	}

	console.log(`Unique normalized names from gdrive_file: ${gdriveLookup.size}`);
	console.log("");

	const matches: Array<{ gameId: string; gameName: string; imageUrl: string }> =
		[];
	const unmatched: string[] = [];

	for (const game of games) {
		const key = normalizeName(game.name);
		if (game.name !== key) {
			console.log(`  Normalizing game name: "${game.name}" -> "${key}"`);
		}
		const imageUrl = gdriveLookup.get(key);
		if (imageUrl) {
			matches.push({
				gameId: game.id,
				gameName: game.name,
				imageUrl,
			});
		} else {
			unmatched.push(game.name);
		}
	}

	console.log(`Matched: ${matches.length}`);
	console.log(`Unmatched: ${unmatched.length}`);
	console.log("");

	if (unmatched.length > 0) {
		console.log("Unmatched games (no corresponding gdrive_file found):");
		for (const name of unmatched) {
			console.log(`  - ${name}`);
		}
		console.log("");
	}

	if (matches.length === 0) {
		console.log("No matches found.");
		return;
	}

	console.log("Matches found:");
	for (const m of matches) {
		console.log(`  ${m.gameName} -> ${m.imageUrl}`);
	}
	console.log("");

	console.log("Generating SQL for database update...");

	const batchSize = 100;
	const timestamp = Date.now();
	const totalBatches = Math.ceil(matches.length / batchSize);
	let updated = 0;

	for (let i = 0; i < matches.length; i += batchSize) {
		const batch = matches.slice(i, i + batchSize);
		const batchNum = Math.floor(i / batchSize) + 1;

		const updateSql = batch
			.map(
				(m) =>
					`UPDATE game SET image_url = ${escape(m.imageUrl)}, updated_at = ${timestamp} WHERE id = ${escape(m.gameId)};`,
			)
			.join("\n");

		const tempFile = path.join(
			os.tmpdir(),
			`match-games-${timestamp}-${batchNum}.sql`,
		);
		fs.writeFileSync(tempFile, updateSql);

		try {
			await new Promise<void>((resolve, reject) => {
				const cmd = `npx wrangler d1 execute ${usedDbName} --file "${tempFile}" --remote --env ${env}`;
				exec(cmd, { timeout: 120000 }, (error) => {
					try {
						fs.unlinkSync(tempFile);
					} catch {}
					if (error) {
						reject(error);
					} else {
						resolve();
					}
				});
			});
			updated += batch.length;
			console.log(
				`Batch ${batchNum}/${totalBatches}: ${updated} games updated`,
			);
		} catch (err) {
			console.error(`Batch ${batchNum} failed:`, err);
		}
	}

	console.log(`\nDone! Updated ${updated} games with images.`);
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
