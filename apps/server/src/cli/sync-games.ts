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

const envFileCandidates = [
	env === "production" ? ".env.production" : ".env.staging",
	".env",
	".dev.vars",
];
for (const envFile of envFileCandidates) {
	dotenv.config({ path: path.resolve(process.cwd(), envFile) });
}

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

function sqlEscape(value: string | number | null | undefined): string {
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

	const resolvedJsonPath = jsonPath ?? defaultJsonPath;
	const usedDbName =
		dbName || (env === "production" ? "sportsdey_db" : "staging-db");
	const wranglerEnv = env === "production" ? "production" : "staging";
	const now = Date.now();
	const batchSize = 80;
	const totalBatches = Math.ceil(allGames.length / batchSize);

	console.log(
		`\nUpserting ${allGames.length} games with provider metadata (${totalBatches} batches)`,
	);
	console.log(`Running on database: ${usedDbName}`);

	const { exec } = await import("node:child_process");
	let upserted = 0;
	let failed = 0;
	for (let i = 0; i < allGames.length; i += batchSize) {
		const batch = allGames.slice(i, i + batchSize);
		const batchNum = Math.floor(i / batchSize) + 1;
		const statements = batch.map((game) => {
			const isLiveGame =
				/\blive\b/i.test(game.type) || /\blive\b/i.test(game.label) ? 1 : 0;
			return `INSERT INTO game (id, name, code, image_url, provider_id, provider_name, is_live_game, free_spin, enabled, created_at, updated_at) VALUES (${sqlEscape(game.uuid)}, ${sqlEscape(game.name)}, ${sqlEscape(game.uuid)}, ${sqlEscape(game.image)}, ${sqlEscape(String(game.provider_id))}, ${sqlEscape(game.provider)}, ${isLiveGame}, ${game.has_freespins ? 1 : 0}, 1, ${now}, ${now}) ON CONFLICT(id) DO UPDATE SET name = excluded.name, code = excluded.code, image_url = COALESCE(excluded.image_url, game.image_url), provider_id = excluded.provider_id, provider_name = excluded.provider_name, is_live_game = excluded.is_live_game, free_spin = excluded.free_spin, updated_at = excluded.updated_at;`;
		});
		const tempFile = path.join(os.tmpdir(), `sync-games-${now}-${batchNum}.sql`);
		fs.writeFileSync(tempFile, `${statements.join("\n")}\n`);

		const maxAttempts = 3;
		let batchOk = false;
		let lastErr: unknown;
		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				await new Promise((resolve, reject) => {
					const remoteFlag = remote ? " --remote" : "";
					const cmd = `npx wrangler d1 execute ${usedDbName} --file "${tempFile}"${remoteFlag} --env ${wranglerEnv}`;
					exec(cmd, { timeout: 180000 }, (error, stdout) => {
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
			upserted += batch.length;
			console.log(
				`Batch ${batchNum}/${totalBatches}: ${upserted}/${allGames.length} upserted`,
			);
		} else {
			failed += 1;
			console.error(`Batch ${batchNum} failed after retries:`, lastErr);
		}
	}

	console.log(`\nDone. upserted=${upserted} batches_failed=${failed}`);

	if (categorize) {
		console.log("\nRunning categorization from JSON...");
		await categorizeGamesFromJson(usedDbName, env, resolvedJsonPath);
	}
}

main().catch((error) => {
	console.error("Error:", error);
	process.exit(1);
});

