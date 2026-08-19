import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import { categorizeGamesFromJson } from "./categorize-utils";

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
let jsonPath: string | null = null;
let categorize = false;
let remote = false;

const defaultJsonPath = path.resolve(
	process.cwd(),
	"../../../casino_games.json",
);

for (const arg of args) {
	if (arg === "production" || arg === "staging") {
		env = arg;
	} else if (/^\d+$/.test(arg)) {
		limit = Number.parseInt(arg, 10);
	} else if (arg.startsWith("--db=")) {
		dbName = arg.replace("--db=", "");
	} else if (arg.startsWith("--json=")) {
		jsonPath = arg.replace("--json=", "");
	} else if (arg === "--categorize") {
		categorize = true;
	} else if (arg === "--remote") {
		remote = true;
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

const rawMerchantKey = process.env.SLOTITEGRATION_MERCHANT_KEY;
const rawMerchantId = process.env.SLOTITEGRATION_MERCHANT_ID;

if (!rawMerchantKey || !rawMerchantId) {
	console.error(
		"Error: Missing SLOTITEGRATION_MERCHANT_KEY or SLOTITEGRATION_MERCHANT_ID",
	);
	console.error(
		"Please set these environment variables or pass them as arguments",
	);
	process.exit(1);
}

const merchantKey: string = rawMerchantKey;
const merchantId: string = rawMerchantId;

const proxyUrl = process.env.PROXY_URL;
const proxySecret = process.env.PROXY_SECRET;

if (!proxyUrl || !proxySecret) {
	console.error("Error: Missing PROXY_URL or PROXY_SECRET");
	console.error("Please set these environment variables in your env file");
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
		const value = queryParams[key];
		if (value !== undefined) params.set(key, value);
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
		const value = allParams[key];
		if (value !== undefined) allParamsList.set(key, value);
	}
	const allQueryString = allParamsList.toString();

	const xSign = await generateXSign(allQueryString, merchantKey);

	const slotegratorProxyPath =
		env === "production" ? "slotegrator" : "slotegrator-staging";

	const url = `${proxyUrl}/${slotegratorProxyPath}/games/index?filter[is_mobile]=1&${queryString}`;
	const requestHeaders = {
		"X-Merchant-Id": merchantId,
		"X-Timestamp": timestamp,
		"X-Nonce": nonce,
		"X-Sign": xSign,
		"Content-Type": "application/x-www-form-urlencoded",
		"x-proxy-auth": proxySecret,
	};

	console.log("Slotegrator sync games request", {
		params: {
			page,
			perPage,
			queryParams,
			allParams,
			queryString,
			allQueryString,
		},
		proxy: {
			url,
			method: "GET",
			headers: {
				...requestHeaders,
				"X-Sign": "[REDACTED]",
				"x-proxy-auth": "[REDACTED]",
			},
		},
	});

	const response = await fetch(url, {
		method: "GET",
		headers: requestHeaders,
	});

	const responseText = await response.text();
	let responseBody: unknown = responseText;
	if (responseText) {
		try {
			responseBody = JSON.parse(responseText);
		} catch {
			// Keep non-JSON proxy responses as text for diagnostics.
		}
	}

	console.log("Slotegrator sync games proxy result", {
		url: response.url,
		upstreamUrl: response.headers.get("x-proxy-upstream-url"),
		status: response.status,
		statusText: response.statusText,
		ok: response.ok,
		headers: Object.fromEntries(response.headers.entries()),
		body: responseBody,
	});

	if (!response.ok) {
		throw new Error(
			`API request failed: ${response.status} ${response.statusText}`,
		);
	}

	const data = responseBody as GamesApiResponse;

	return data;
}

async function getExistingGameIds(): Promise<Set<string>> {
	console.log("Fetching existing game IDs from database...");

	const dbName = env === "production" ? "sportsdey_db" : "staging-db";

	const process = await import("node:child_process");

	return new Promise((resolve) => {
		process.exec(
			`npx wrangler d1 execute ${dbName} --json --command "SELECT id FROM game" --remote  --env ${env}`,
			{ maxBuffer: 64 * 1024 * 1024 },
			(error, stdout, _stderr) => {
				if (error) {
					console.log(
						"Could not fetch existing games, proceeding without duplicate check",
					);
					console.log("Error:", error.message);
					resolve(new Set());
					return;
				}

				const ids = new Set<string>();
				try {
					const parsed = JSON.parse(stdout) as Array<{
						results?: Array<{ id?: string }>;
					}>;
					for (const block of parsed) {
						for (const row of block.results ?? []) {
							if (typeof row.id === "string" && row.id.length > 0) {
								ids.add(row.id);
							}
						}
					}
				} catch {
					// Fallback: plain hex ids (older wrangler output)
					for (const line of stdout.trim().split("\n")) {
						if (/^[a-f0-9]{32,}$/i.test(line)) ids.add(line);
					}
				}
				console.log(`Found ${ids.size} existing games in database`);
				resolve(ids);
			},
		);
	});
}

async function main() {
	console.log(`Syncing games from Slotegrator API (${env} environment)...`);
	const logProxyPath =
		env === "production" ? "slotegrator" : "slotegrator-staging";
	console.log(`Proxy URL: ${proxyUrl}/${logProxyPath}`);
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

	const resolvedJsonPath = jsonPath ?? defaultJsonPath;

	const newGames = allGames.filter(
		(game) => !existingIds.has(game.uuid) || existingIds.size === 0,
	);

	console.log(`New games to insert: ${newGames.length}`);

	if (newGames.length === 0 && !categorize) {
		console.log("\nNo new games to insert.");
		return;
	}

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
					`(${escape(game.uuid)}, ${escape(game.name)}, ${escape(game.uuid)}, ${escape(game.image)}, 1, ${timestamp}, ${timestamp})`,
			)
			.join(",\n");
		const batchSql = `INSERT OR IGNORE INTO game (id, name, code, image_url, enabled, created_at, updated_at) VALUES ${batchValues};`;
		const batchNum = Math.floor(i / batchSize) + 1;

		const tempFile = path.join(
			os.tmpdir(),
			`sync-games-${timestamp}-${batchNum}.sql`,
		);
		fs.writeFileSync(tempFile, batchSql);

		const maxAttempts = 3;
		let batchOk = false;
		let lastErr: unknown;
		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				await new Promise((resolve, reject) => {
					const cmd = `npx wrangler d1 execute ${usedDbName} --file "${tempFile}"  "--remote" --env ${env}`;
					exec(cmd, { timeout: 180000 }, (error, stdout, _stderr) => {
						if (error) {
							reject(error);
						} else {
							resolve(stdout);
						}
					});
				});
				batchOk = true;
				break;
			} catch (err) {
				lastErr = err;
				console.error(
					`Batch ${batchNum} attempt ${attempt}/${maxAttempts} failed:`,
					err instanceof Error ? err.message : err,
				);
				if (attempt < maxAttempts) {
					await new Promise((r) => setTimeout(r, 2000 * attempt));
				}
			}
		}
		try {
			fs.unlinkSync(tempFile);
		} catch {}
		if (batchOk) {
			inserted += batch.length;
			console.log(
				`Batch ${batchNum}/${totalBatches}: ${inserted} games inserted`,
			);
		} else {
			failed++;
			console.error(`Batch ${batchNum} failed after retries:`, lastErr);
		}
	}

	if (inserted > 0) {
		console.log(`\nDone! Inserted ${inserted} games.`);
	}

	if (categorize) {
		console.log("\nRunning categorization from JSON...");
		await categorizeGamesFromJson(usedDbName, env, resolvedJsonPath);
	}
}

main().catch((error) => {
	console.error("Error:", error);
	process.exit(1);
});
