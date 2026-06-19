import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";

interface GameItem {
	uuid: string;
	name: string;
	image: string;
	type: string;
	provider: string;
	provider_id: number;
	technology: string;
	has_lobby: number;
	is_mobile: number;
	has_freespins: number;
	has_tables: number;
	label: string;
}

interface GamesApiResponse {
	items: GameItem[];
	_links: {
		self: { href: string };
		first: { href: string };
		last: { href: string };
		next: { href: string } | null;
	};
	_meta: {
		totalCount: number;
		pageCount: number;
		currentPage: number;
		perPage: number;
	};
}

const args = process.argv.slice(2);

let env: "production" | "staging" = "staging";
let limit = 0; // 0 means all pages
let dbName: string;
let txtPath: string | null = null;
let categorize = false;

const defaultTxtPath = path.resolve(
	process.cwd(),
	"../../Casino_Games_Condensed.txt",
);

for (const arg of args) {
	if (arg === "production" || arg === "staging") {
		env = arg;
	} else if (/^\d+$/.test(arg)) {
		limit = Number.parseInt(arg, 10);
	} else if (arg.startsWith("--db=")) {
		dbName = arg.replace("--db=", "");
	} else if (arg.startsWith("--txt-path=")) {
		txtPath = arg.replace("--txt-path=", "");
	} else if (arg === "--categorize") {
		categorize = true;
	}
}

const envFile = env === "production" ? ".env.production" : ".env.staging";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const slotegratorApiUrl =
	env === "production"
		? process.env.SLOTEGRATOR_API_URL ||
			"https://slotegrator.com/api/index.php/v1"
		: process.env.SLOTEGRATOR_API_URL ||
			"https://staging.slotegrator.com/api/index.php/v1";

const merchantKey =
	env === "production"
		? process.env.SLOTITEGRATION_MERCHANT_KEY
		: process.env.SLOTITEGRATION_MERCHANT_KEY;

const merchantId =
	env === "production"
		? process.env.SLOTITEGRATION_MERCHANT_ID
		: process.env.SLOTITEGRATION_MERCHANT_ID;

if (!merchantKey || !merchantId) {
	console.error(
		"Error: Missing SLOTITEGRATION_MERCHANT_KEY or SLOTITEGRATION_MERCHANT_ID",
	);
	console.error(
		"Please set these environment variables or pass them as arguments",
	);
	process.exit(1);
}

function escape(value: string | number | null | undefined): string {
	if (value === null || value === undefined) {
		return "NULL";
	}
	return typeof value === "number"
		? value.toString()
		: `'${String(value).replace(/'/g, "''")}'`;
}

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
	"Popular/Hot Casino",
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
					map.set(name, type.toLowerCase().replace(/\s+/g, "-"));
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
	return categoryMap.get(normalized) ?? "others";
}

async function generateXSign(
	queryString: string,
	merchantKey: string,
): Promise<string> {
	const cryptoMod = await import("node:crypto");
	return cryptoMod
		.createHmac("sha1", merchantKey)
		.update(queryString)
		.digest("hex");
}

async function fetchGames(
	page: number,
	perPage: number,
): Promise<GamesApiResponse> {
	const timestamp = Math.floor(Date.now() / 1000).toString();
	const nonce = crypto.randomUUID();

	const queryParams: Record<string, string> = {
		page: page.toString(),
		per_page: perPage.toString(),
	};

	const sortedKeys = Object.keys(queryParams).sort();
	const params = new URLSearchParams();
	for (const key of sortedKeys) {
		params.set(key, queryParams[key]);
	}
	const queryString = params.toString();

	const allParams: Record<string, string> = {
		...queryParams,
		"filter[is_mobile]": "1",
		"X-Merchant-Id": merchantId,
		"X-Timestamp": timestamp,
		"X-Nonce": nonce,
	};

	const sortedAllKeys = Object.keys(allParams).sort();
	const allParamsList = new URLSearchParams();
	for (const key of sortedAllKeys) {
		allParamsList.set(key, allParams[key]);
	}
	const allQueryString = allParamsList.toString();

	const xSign = await generateXSign(allQueryString, merchantKey);

	const url = `${slotegratorApiUrl}/games/index?filter[is_mobile]=1&${queryString}`;

	const response = await fetch(url, {
		method: "GET",
		headers: {
			"X-Merchant-Id": merchantId,
			"X-Timestamp": timestamp,
			"X-Nonce": nonce,
			"X-Sign": xSign,
			"Content-Type": "application/x-www-form-urlencoded",
		},
	});

	if (!response.ok) {
		throw new Error(
			`API request failed: ${response.status} ${response.statusText}`,
		);
	}

	const data = (await response.json()) as GamesApiResponse;

	return data;
}

async function getExistingGameIds(): Promise<Set<string>> {
	console.log("Fetching existing game IDs from database...");

	const dbName = env === "production" ? "sportsdey_db" : "staging-db";

	const process = await import("node:child_process");

	return new Promise((resolve) => {
		process.exec(
			`npx wrangler d1 execute ${dbName} --command "SELECT id FROM game" --remote --env ${env}`,
			(error, stdout, stderr) => {
				if (error) {
					console.log(
						"Could not fetch existing games, proceeding without duplicate check",
					);
					console.log("Error:", error.message);
					resolve(new Set());
					return;
				}

				const lines = stdout
					.trim()
					.split("\n")
					.filter((line) => line.match(/^[a-f0-9]{32,}$/));
				const ids = new Set(lines);
				console.log(`Found ${ids.size} existing games in database`);
				resolve(ids);
			},
		);
	});
}

async function main() {
	console.log(`Syncing games from Slotegrator API (${env} environment)...`);
	console.log(`API URL: ${slotegratorApiUrl}`);
	console.log(`Merchant ID: ${merchantId}`);
	console.log("");

	const perPage = 50;
	const page = 1;

	console.log(`Fetching games from page ${page}...`);
	const response = await fetchGames(page, perPage);

	const totalGames = response._meta.totalCount;
	const pageCount = response._meta.pageCount;
	const games = response.items;

	console.log(`Total games available: ${totalGames}`);
	console.log(`Pages: ${pageCount}`);
	console.log(
		`Fetching ${limit > 0 ? Math.min(limit, pageCount) : pageCount} pages...`,
	);

	const allGames: GameItem[] = [...games];

	const pagesToFetch = limit === 0 ? pageCount : Math.min(limit, pageCount);
	console.log(`Fetching ${pagesToFetch} pages...`);

	if (pagesToFetch > 1) {
		for (let i = 2; i <= pagesToFetch; i++) {
			console.log(`Fetching page ${i}...`);
			const pageData = await fetchGames(i, perPage);
			allGames.push(...pageData.items);
		}
	}

	console.log(`\nTotal games fetched: ${allGames.length}`);

	const existingIds = await getExistingGameIds();

	const resolvedTxtPath = txtPath ?? defaultTxtPath;
	const categoryMap = fs.existsSync(resolvedTxtPath)
		? parseCasinoGamesFile(resolvedTxtPath)
		: new Map<string, string>();

	for (const game of allGames) {
		(game as GameItem & { category: string | null }).category = getCategory(
			game.name,
			categoryMap,
		);
	}

	const newGames = allGames.filter(
		(game) => !existingIds.has(game.uuid) || existingIds.size === 0,
	);

	console.log(`New games to insert: ${newGames.length}`);

	if (newGames.length === 0 && !categorize) {
		console.log("\nNo new games to insert.");
		return;
	}

	const now = Date.now();

	const values = newGames
		.map(
			(game) =>
				`(${escape(game.uuid)}, ${escape(game.name)}, ${escape(game.uuid)}, ${escape(game.image)}, ${escape((game as GameItem & { category: string | null }).category)}, 1, ${now}, ${now})`,
		)
		.join(",\n");

	const sql = `INSERT INTO game (id, name, code, image_url, category, enabled, created_at, updated_at) VALUES ${values};`;

	const batchSize = 100;
	const timestamp = Date.now();
	const usedDbName =
		dbName || (env === "production" ? "sportsdey_db" : "staging-db");

	const totalBatches = Math.ceil(newGames.length / batchSize);
	console.log(
		`\nTotal games: ${newGames.length}, ${totalBatches} batches of ${batchSize}`,
	);
	console.log(`Running on database: ${usedDbName}`);

	const { exec } = await import("node:child_process");
	let inserted = 0;
	let failed = 0;
	for (let i = 0; i < newGames.length; i += batchSize) {
		const batch = newGames.slice(i, i + batchSize);
		const batchValues = batch
			.map(
				(game) =>
					`(${escape(game.uuid)}, ${escape(game.name)}, ${escape(game.uuid)}, ${escape(game.image)}, ${escape((game as GameItem & { category: string | null }).category)}, 1, ${timestamp}, ${timestamp})`,
			)
			.join(",\n");
		const batchSql = `INSERT INTO game (id, name, code, image_url, category, enabled, created_at, updated_at) VALUES ${batchValues};`;
		const batchNum = Math.floor(i / batchSize) + 1;

		const tempFile = path.join(
			os.tmpdir(),
			`sync-games-${timestamp}-${batchNum}.sql`,
		);
		fs.writeFileSync(tempFile, batchSql);

		try {
			await new Promise((resolve, reject) => {
				const cmd = `npx wrangler d1 execute ${usedDbName} --file "${tempFile}" --remote --env staging`;
				exec(cmd, { timeout: 120000 }, (error, stdout, stderr) => {
					try {
						fs.unlinkSync(tempFile);
					} catch {}
					if (error) {
						reject(error);
					} else {
						resolve(stdout);
					}
				});
			});
			inserted += batch.length;
			console.log(
				`Batch ${batchNum}/${totalBatches}: ${inserted} games inserted`,
			);
		} catch (err) {
			failed++;
			console.error(`Batch ${batchNum} failed:`, err);
		}
	}

	if (inserted > 0) {
		console.log(`\nDone! Inserted ${inserted} games.`);
	}

	if (categorize && categoryMap.size > 0) {
		console.log("\nBackfilling categories for existing uncategorized games...");
		const allGamesForBackfill = allGames.filter((game) =>
			existingIds.has(game.uuid),
		);

		const { exec: execBackfill } = await import("node:child_process");

		for (let i = 0; i < allGamesForBackfill.length; i += batchSize) {
			const batch = allGamesForBackfill.slice(i, i + batchSize);
			const cases = batch
				.map((game) => {
					const cat = getCategory(game.name, categoryMap);
					if (!cat) return null;
					return `WHEN '${game.uuid.replace(/'/g, "''")}' THEN '${cat.replace(/'/g, "''")}'`;
				})
				.filter(Boolean);

			if (cases.length === 0) continue;

			const matchedIds = batch
				.filter((g) => getCategory(g.name, categoryMap))
				.map((g) => `'${g.uuid.replace(/'/g, "''")}'`)
				.join(",");
			const updateSql = `UPDATE game SET category = CASE id ${cases.join(" ")} END, updated_at = ${Date.now()} WHERE id IN (${matchedIds});`;

			const batchNum = Math.floor(i / batchSize) + 1;
			const tempFile = path.join(
				os.tmpdir(),
				`backfill-categories-${timestamp}-${batchNum}.sql`,
			);
			fs.writeFileSync(tempFile, updateSql);

			try {
				await new Promise((resolve, reject) => {
					const cmd = `npx wrangler d1 execute ${usedDbName} --file "${tempFile}" --remote --env ${env}`;
					execBackfill(cmd, { timeout: 120000 }, (error, stdout, stderr) => {
						try {
							fs.unlinkSync(tempFile);
						} catch {}
						if (error) reject(error);
						else resolve(stdout);
					});
				});
				console.log(
					`Backfill batch ${batchNum}: ${cases.length} games updated`,
				);
			} catch (err) {
				console.error(`Backfill batch ${batchNum} failed:`, err);
			}
		}
		console.log("\nBackfill complete!");
	}
}

main().catch((error) => {
	console.error("Error:", error);
	process.exit(1);
});
