import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

interface DropboxFileEntry {
	name: string;
	id: string;
}

interface DropboxListResponse {
	entries: Array<{
		[".tag"]: string;
		name: string;
		path_lower: string;
		id: string;
	}>;
	cursor: string;
	has_more: boolean;
}

interface TargetGamesResult {
	norm: Set<string>;
	orig: Map<string, string>;
}

const args = process.argv.slice(2);

let env: "production" | "staging" = "production";
let concurrency = 3;
let batchSize = 10;
let countOnly = false;
let gamesFile: string | undefined;
let gamesList: string[] | undefined;
let showMatches = false;
const RATE_LIMIT_DELAY = 200;

for (const arg of args) {
	if (arg === "production" || arg === "staging") {
		env = arg;
	} else if (arg.startsWith("--concurrency=")) {
		concurrency = Number.parseInt(arg.replace("--concurrency=", ""), 10);
	} else if (arg.startsWith("--batch-size=")) {
		batchSize = Number.parseInt(arg.replace("--batch-size=", ""), 10);
	} else if (arg === "--count") {
		countOnly = true;
	} else if (arg.startsWith("--games-file=")) {
		gamesFile = arg.replace("--games-file=", "");
	} else if (arg === "--show-matches") {
		showMatches = true;
	} else if (arg.startsWith("--games=")) {
		gamesList = arg
			.replace("--games=", "")
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
	}
}

const envFile = env === "production" ? ".env.production" : ".env.staging";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const DROPBOX_ACCESS_TOKEN = process.env.DROPBOX_ACCESS_TOKEN;
const DROPBOX_SHARED_LINK = process.env.DROPBOX_SHARED_LINK;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

if (
	!DROPBOX_ACCESS_TOKEN ||
	!DROPBOX_SHARED_LINK ||
	!R2_ACCESS_KEY_ID ||
	!R2_SECRET_ACCESS_KEY ||
	!R2_ENDPOINT ||
	!R2_BUCKET_NAME ||
	!R2_PUBLIC_URL
) {
	console.error("Error: Missing required environment variables.");
	console.error(
		"Required: DROPBOX_ACCESS_TOKEN, DROPBOX_SHARED_LINK, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME, R2_PUBLIC_URL",
	);
	process.exit(1);
}

const r2Client = new S3Client({
	region: "auto",
	endpoint: R2_ENDPOINT,
	credentials: {
		accessKeyId: R2_ACCESS_KEY_ID,
		secretAccessKey: R2_SECRET_ACCESS_KEY,
	},
});

const DROPBOX_API_BASE = "https://api.dropboxapi.com/2";
const DROPBOX_CONTENT_BASE = "https://content.dropboxapi.com/2";

async function dropboxFetch(
	url: string,
	options: RequestInit,
	retries = 3,
): Promise<Response> {
	for (let attempt = 0; attempt < retries; attempt++) {
		const response = await fetch(url, options);

		if (response.ok) return response;

		if (response.status === 429) {
			const delay = Math.min(
				1000 * 2 ** attempt + Math.random() * 1000,
				30_000,
			);
			console.warn(
				`Rate limited, retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${retries})`,
			);
			await new Promise((r) => setTimeout(r, delay));
			continue;
		}

		const text = await response.text();
		throw new Error(
			`Dropbox API request failed: ${response.status} ${response.statusText}\n${text}`,
		);
	}

	throw new Error(`Dropbox API request failed after ${retries} retries`);
}

async function listDropboxFiles(): Promise<DropboxFileEntry[]> {
	const allFiles: DropboxFileEntry[] = [];
	let cursor: string | undefined;
	let hasMore = true;

	while (hasMore) {
		const url = cursor
			? `${DROPBOX_API_BASE}/files/list_folder/continue`
			: `${DROPBOX_API_BASE}/files/list_folder`;

		const body = cursor
			? JSON.stringify({ cursor })
			: JSON.stringify({
					path: "",
					shared_link: { url: DROPBOX_SHARED_LINK },
					recursive: false,
				});

		const response = await dropboxFetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${DROPBOX_ACCESS_TOKEN}`,
				"Content-Type": "application/json",
			},
			body,
		});

		const data = (await response.json()) as DropboxListResponse;

		for (const entry of data.entries) {
			if (entry[".tag"] === "file") {
				allFiles.push({
					name: entry.name,
					id: entry.id,
				});
			}
		}

		cursor = data.cursor;
		hasMore = data.has_more;
		console.log(
			`Listed ${data.entries.filter((e) => e[".tag"] === "file").length} files (total: ${allFiles.length})${hasMore ? ", more pages..." : ""}`,
		);
	}

	return allFiles;
}

async function downloadDropboxFile(
	pathLower: string,
): Promise<{ data: ArrayBuffer; mimeType: string }> {
	const response = await dropboxFetch(
		`${DROPBOX_CONTENT_BASE}/sharing/get_shared_link_file`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${DROPBOX_ACCESS_TOKEN}`,
				"Dropbox-API-Arg": JSON.stringify({
					url: DROPBOX_SHARED_LINK,
					path: pathLower,
				}),
			},
		},
	);

	const mimeType =
		response.headers.get("Content-Type") || "application/octet-stream";
	const data = await response.arrayBuffer();
	return { data, mimeType };
}

async function uploadToR2(
	key: string,
	data: ArrayBuffer,
	mimeType: string,
): Promise<void> {
	await r2Client.send(
		new PutObjectCommand({
			Bucket: R2_BUCKET_NAME,
			Key: key,
			Body: new Uint8Array(data),
			ContentType: mimeType || "application/octet-stream",
		}),
	);
}

async function getExistingNames(): Promise<Set<string>> {
	const usedDbName = env === "production" ? "sportsdey_db" : "staging-db";

	const { exec } = await import("node:child_process");

	return new Promise((resolve) => {
		exec(
			`npx wrangler d1 execute ${usedDbName} --command "SELECT name FROM gdrive_file" --remote --json --env ${env}`,
			(error, stdout) => {
				if (error) {
					console.log(
						"Could not fetch existing files, proceeding without duplicate check",
					);
					console.log("Error:", error.message);
					resolve(new Set());
					return;
				}

				const names = new Set<string>();

				const jsonMatch = stdout.match(/\{[\s\S]*\}/);
				if (jsonMatch) {
					try {
						const parsed = JSON.parse(jsonMatch[0]);
						const rows = parsed.results ?? [];
						for (const row of rows) {
							if (row.name) {
								names.add(normalizeName(row.name));
							}
						}
						console.log(`Found ${names.size} existing files in database`);
						resolve(names);
						return;
					} catch {
						// fall through to text parsing
					}
				}

				for (const line of stdout.trim().split("\n")) {
					const trimmed = line.trim();
					const cleaned = trimmed
						.replace(/[│┌┐└┘├┤┬┴┼─┃\s]+/g, " ")
						.trim();
					if (
						cleaned &&
						!cleaned.includes("name") &&
						!cleaned.includes("─") &&
						!cleaned.includes("┌") &&
						!cleaned.match(/^[─┌┐└┘├┤┬┴┼┃│\s]+$/)
					) {
						names.add(normalizeName(cleaned));
					}
				}

				console.log(`Found ${names.size} existing files in database`);
				resolve(names);
			},
		);
	});
}

async function loadTargetGames(
	filePath?: string,
	inlineList?: string[],
): Promise<TargetGamesResult | null> {
	const norm = new Set<string>();
	const orig = new Map<string, string>();

	if (filePath) {
		const fileStream = fs.createReadStream(filePath);
		const rl = readline.createInterface({
			input: fileStream,
			crlfDelay: Infinity,
		});
		for await (const line of rl) {
			const trimmed = line.trim();
			if (trimmed && !trimmed.startsWith("#")) {
				const normalized = normalizeName(trimmed);
				norm.add(normalized);
				if (!orig.has(normalized)) {
					orig.set(normalized, trimmed);
				}
			}
		}
	}

	if (inlineList) {
		for (const name of inlineList) {
			if (name) {
				const normalized = normalizeName(name);
				norm.add(normalized);
				if (!orig.has(normalized)) {
					orig.set(normalized, name);
				}
			}
		}
	}

	console.log(`Loaded ${norm.size} target games`);
	return norm.size > 0 ? { norm, orig } : null;
}

async function processBatch(
	batch: DropboxFileEntry[],
	batchNum: number,
	totalBatches: number,
	existingNames: Set<string>,
): Promise<string[]> {
	const timestamp = Date.now();
	const usedDbName = env === "production" ? "sportsdey_db" : "staging-db";
	const { exec } = await import("node:child_process");
	const processed: string[] = [];
	const insertStatements: string[] = [];

	for (let i = 0; i < batch.length; i++) {
		const file = batch[i];
		if (!file) continue;

		const normalizedName = normalizeName(file.name);

		if (existingNames.has(normalizedName)) {
			console.log(
				`  [${i + 1}/${batch.length}] Skipping (already in DB): ${file.name}`,
			);
			continue;
		}

		try {
			console.log(`  [${i + 1}/${batch.length}] Downloading: ${file.name}`);
			const { data, mimeType } = await downloadDropboxFile(`/${file.name}`);

			const key = `gdrive-files/${file.name}`;
			console.log(`  [${i + 1}/${batch.length}] Uploading: ${file.name}`);
			await uploadToR2(key, data, mimeType);

			const imageUrl = `${R2_PUBLIC_URL}/sportsdey-prod/${key}`;
			const id = crypto.randomUUID();
			insertStatements.push(
				`INSERT INTO gdrive_file (id, name, image_url, created_at) VALUES (${escape(id)}, ${escape(normalizedName)}, ${escape(imageUrl)}, ${timestamp});`,
			);

			existingNames.add(normalizedName);
			processed.push(normalizedName);
			console.log(
				`  [${i + 1}/${batch.length}] Prepared: ${file.name}`,
			);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unknown error";
			console.error(
				`  [${i + 1}/${batch.length}] Failed: ${file.name} - ${message}`,
			);
		}

		await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY));
	}

	if (insertStatements.length > 0) {
		const sql = insertStatements.join("\n");
		const tempFile = path.join(
			os.tmpdir(),
			`sync-dropbox-${timestamp}-batch-${batchNum}.sql`,
		);
		fs.writeFileSync(tempFile, sql);

		try {
			await new Promise<void>((resolve, reject) => {
				const cmd = `npx wrangler d1 execute ${usedDbName} --file "${tempFile}" --remote --env ${env}`;
				exec(cmd, { timeout: 120000 }, (error) => {
					try {
						fs.unlinkSync(tempFile);
					} catch {}
					if (error) reject(error);
					else resolve();
				});
			});
			console.log(
				`  Batch ${batchNum}/${totalBatches}: ${insertStatements.length} records inserted into DB`,
			);
		} catch (err) {
			console.error(
				`  Batch ${batchNum} DB insert failed:`,
				err,
			);
		}
	}

	console.log(`  Batch ${batchNum}/${totalBatches} complete`);
	return processed;
}

async function queryD1Json<T>(command: string): Promise<T[]> {
	const usedDbName = env === "production" ? "sportsdey_db" : "staging-db";
	const { exec } = await import("node:child_process");

	return new Promise((resolve, reject) => {
		const cmd = `npx wrangler d1 execute ${usedDbName} --command ${JSON.stringify(command)} --remote --env ${env} --json`;
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
					if (entry && entry.results) {
						results.push(...entry.results);
					}
				}
				resolve(results);
			} catch {
				resolve([]);
			}
		});
	});
}

async function main() {
	if (countOnly) {
		const allFiles = await listDropboxFiles();
		const targetGames = await loadTargetGames(gamesFile, gamesList);
		const matchingFiles = targetGames
			? allFiles.filter((f) => {
					const fileClean = cleanName(f.name);
					for (const [_, original] of targetGames.orig) {
						if (gameFileSimilarity(cleanName(original), fileClean) >= 0.6) return true;
					}
					return false;
				})
			: allFiles;
		const existingNames = await getExistingNames();
		const newFiles = matchingFiles.filter(
			(f) => !existingNames.has(normalizeName(f.name)),
		);
		console.log(newFiles.length);
		return;
	}

	console.log(`Syncing files from Dropbox to R2 (${env} environment)...`);
	console.log(`Concurrency: ${concurrency}, Batch size: ${batchSize}`);
	console.log("");

	const targetGames = await loadTargetGames(gamesFile, gamesList);
	if (targetGames) {
		console.log(`Filtering to ${targetGames.norm.size} target games`);
	}

	console.log("Listing files from Dropbox shared folder...");
	const allFiles = await listDropboxFiles();
	console.log(`Total files in shared folder: ${allFiles.length}`);
	console.log("");

	let filesToProcess = allFiles;
	const matchLog: Array<{ game: string; file: string }> = [];

	if (targetGames) {
		filesToProcess = allFiles.filter((f) => {
			const fileClean = cleanName(f.name);
			for (const [_, original] of targetGames.orig) {
				const gameClean = cleanName(original);
				if (gameFileSimilarity(gameClean, fileClean) >= 0.6) {
					if (showMatches) matchLog.push({ game: original, file: f.name });
					return true;
				}
			}
			return false;
		});
		console.log(`Files matching target games: ${filesToProcess.length}`);
		console.log("");
		if (filesToProcess.length === 0) {
			console.log("No matching files found in Dropbox for target games.");
			return;
		}
	}

	if (showMatches && matchLog.length > 0) {
		console.log("Game to Dropbox file matches:");
		for (const { game, file } of matchLog) {
			console.log(`  ${game} -> ${file}`);
		}
		console.log("");
	}

	const existingNames = await getExistingNames();
	const newFiles = filesToProcess.filter(
		(f) => !existingNames.has(normalizeName(f.name)),
	);
	console.log(`New files to upload: ${newFiles.length}`);
	console.log(`Already skipped (in DB): ${filesToProcess.length - newFiles.length}`);
	console.log("");

	const processedNames: string[] = [];

	if (newFiles.length === 0) {
		console.log("No new files to upload.");
	} else {
		const totalBatches = Math.ceil(newFiles.length / batchSize);
		console.log(
			`Processing ${newFiles.length} files in ${totalBatches} batches of ${batchSize}`,
		);
		console.log("");

		for (let i = 0; i < newFiles.length; i += batchSize) {
			const batch = newFiles.slice(i, i + batchSize);
			const batchNum = Math.floor(i / batchSize) + 1;
			console.log(
				`\n--- Batch ${batchNum}/${totalBatches} (${batch.length} files) ---`,
			);
			const processed = await processBatch(
				batch,
				batchNum,
				totalBatches,
				existingNames,
			);
			processedNames.push(...processed);
		}

		console.log("\nAll uploads complete.");
	}

	if (targetGames) {
		await verifyRequiredGames(targetGames);
	}

	console.log("\nDone!");
}

async function verifyRequiredGames(
	targetGames: TargetGamesResult,
): Promise<void> {
	console.log("--- Required Games Verification ---");

	const gdriveFiles = await queryD1Json<{ name: string; image_url: string }>(
		"SELECT name, image_url FROM gdrive_file",
	);

	const games = await queryD1Json<{
		id: string;
		name: string;
		image_url: string | null;
	}>("SELECT id, name, image_url FROM game");

	let withImage = 0;
	let inGdriveOnly = 0;
	let missing = 0;
	const missingList: string[] = [];
	const inGdriveOnlyList: string[] = [];

	for (const [normalized, original] of targetGames.orig) {
		const gameClean = cleanName(original);

		const hasGdrive = gdriveFiles.some(
			(f) => gameFileSimilarity(gameClean, cleanName(f.name)) >= 0.6,
		);

		const gameEntry = games.find(
			(g) => gameFileSimilarity(gameClean, cleanName(g.name)) >= 0.6,
		);

		if (hasGdrive && gameEntry && gameEntry.image_url) {
			withImage++;
		} else if (hasGdrive && !gameEntry) {
			inGdriveOnly++;
			inGdriveOnlyList.push(original);
		} else if (!hasGdrive) {
			missing++;
			missingList.push(original);
		}
	}

	console.log(`Total required games: ${targetGames.norm.size}`);
	console.log(`  Games with image set: ${withImage}`);
	console.log(`  Games with gdrive_file but not in game table: ${inGdriveOnly}`);
	console.log(`  Games missing from gdrive_file: ${missing}`);

	if (missingList.length > 0) {
		console.log("\nMissing from gdrive_file (no image in Dropbox/R2):");
		for (const name of missingList) {
			console.log(`  - ${name}`);
		}
	}

	if (inGdriveOnlyList.length > 0) {
		console.log(
			"\nIn gdrive_file but not matched to a game (check game table):",
		);
		for (const name of inGdriveOnlyList) {
			console.log(`  - ${name}`);
		}
	}

	console.log("");
}

function normalizeName(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/\.[^.]+$/, "")
		.replace(/[-_]+/g, " ")
		.replace(/\s+/g, " ");
}

function cleanName(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/\.[^.]+$/, "")
		.replace(/[-_]+/g, " ")
		.replace(/\s+/g, " ")
		.replace(/\d{3,4}\s*x\s*\d{3,4}/g, "")
		.replace(/\(\d+\)/g, "")
		.replace(/['";:&]/g, "")
		.trim()
		.replace(/\s+/g, " ");
}

const TYPO_OVERRIDES = new Map<string, string>([
	["clover reels 40", "clever reels 40"],
	["3 coin golden peakcock", "3 coin peacock"],
	["book of futuria", "book of futura"],
	["chessy road", "cheesy road"],
	["cash baloon", "cash balloon"],
	["joker;s fortune", "joker's fortune"],
	["jackpot football", "jakpot football"],
	["pilot chicken mobile", "pilot chinken"],
	["coin of lighting", "coin of lightning"],
	["always fruit 27 classic series", "always fruits 27"],
	["draculars fortune halloween edition", "dracula s fortune"],
	["dream diamondds hold n link", "dreams diamond"],
	["flaming luck 27 classic series", "27 flaming luck"],
	["genies chest hold link", "genie s chest"],
	["hot rocket 5x 3x 2x", "h0t rocket"],
	["hot triple seven hold win", "hot triplr sevens special"],
	["keno party", "keno"],
	["the big lap rapid link", "the big lad"],
	["volcano fruits mobile", "volcano"],
]);

function applyOverrides(name: string): string {
	for (const [key, replacement] of TYPO_OVERRIDES) {
		if (name.includes(key)) {
			return name.replace(key, replacement);
		}
	}
	return name;
}

function diceSimilarity(a: string, b: string): number {
	const s1 = a.replace(/\s+/g, "");
	const s2 = b.replace(/\s+/g, "");
	const bigramsA = new Set<string>();
	const bigramsB = new Set<string>();
	for (let i = 0; i < s1.length - 1; i++) bigramsA.add(s1.slice(i, i + 2));
	for (let i = 0; i < s2.length - 1; i++) bigramsB.add(s2.slice(i, i + 2));
	let intersection = 0;
	for (const bg of bigramsA) {
		if (bigramsB.has(bg)) intersection++;
	}
	return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

function gameFileSimilarity(gameName: string, fileName: string): number {
	const effectiveGame = applyOverrides(gameName);
	return diceSimilarity(effectiveGame, fileName);
}

function escape(value: string | number | null | undefined): string {
	if (value === null || value === undefined) {
		return "NULL";
	}
	return typeof value === "number"
		? value.toString()
		: `'${String(value).replace(/'/g, "''")}'`;
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
