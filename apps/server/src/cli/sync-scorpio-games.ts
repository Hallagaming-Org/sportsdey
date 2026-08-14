/**
 * Fetch Scorpio provider game lists, upsert into the `game` table, optionally
 * merge names into casino_games.json, and optionally run categorize-games.
 *
 * Usage (from apps/server):
 *   pnpm exec tsx src/cli/sync-scorpio-games.ts staging
 *   pnpm exec tsx src/cli/sync-scorpio-games.ts staging --categorize
 *   pnpm exec tsx src/cli/sync-scorpio-games.ts staging --json-only
 *   pnpm exec tsx src/cli/sync-scorpio-games.ts staging --dry-run
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	categorizeGamesFromJson,
	escape,
	executeSqlFile,
	normalizeName,
} from "./categorize-utils";

type ScorpioProvider = {
	providerId: number;
	providerName: string;
	status?: number;
};

type ScorpioGame = {
	gameID?: string;
	gameCode?: string;
	gameName?: string;
	gameImage?: string | Record<string, unknown>;
	gameType?: number;
	inMaintenance?: boolean | number;
	status?: number;
};

type CasinoGamesJson = Record<string, string[]>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultJsonPath = path.resolve(__dirname, "casino_games.json");

const args = process.argv.slice(2);
let env: "production" | "staging" = "staging";
let categorize = false;
let jsonOnly = false;
let dryRun = false;
let mergeJson = true;
let remote = true;
let jsonPath = defaultJsonPath;

for (const arg of args) {
	if (arg === "production" || arg === "staging") env = arg;
	else if (arg === "--categorize") categorize = true;
	else if (arg === "--json-only") jsonOnly = true;
	else if (arg === "--dry-run") dryRun = true;
	else if (arg === "--no-json") mergeJson = false;
	else if (arg === "--local") remote = false;
	else if (arg.startsWith("--json=")) jsonPath = arg.replace("--json=", "");
}

const dbName = env === "production" ? "sportsdey_db" : "staging-db";

function loadDevVars(): Record<string, string> {
	const candidates = [
		path.resolve(process.cwd(), ".dev.vars"),
		path.resolve(__dirname, "../../.dev.vars"),
	];
	const out: Record<string, string> = {};
	for (const file of candidates) {
		if (!fs.existsSync(file)) continue;
		for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			const eq = trimmed.indexOf("=");
			if (eq <= 0) continue;
			out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
		}
		break;
	}
	return out;
}

function resolveGameCode(game: ScorpioGame): string | null {
	const raw = game.gameID || game.gameCode;
	if (raw == null) return null;
	const code = String(raw).trim();
	return code || null;
}

function resolveGameImage(
	gameImage: ScorpioGame["gameImage"],
): string | null {
	if (typeof gameImage === "string") {
		const trimmed = gameImage.trim();
		return trimmed || null;
	}
	return null;
}

function categoriesFor(name: string, gameType: number | undefined): string[] {
	const hay = name.toLowerCase();
	const cats: string[] = [];

	if (
		gameType === 2 ||
		/\b(aviator|crash|jetx|jet x|balloon|high.?flyer|helicopter|mines|plinko|chicken road|rabbit road|cricket road|chicken vs zombies)\b/.test(
			hay,
		)
	) {
		cats.push("crash_games");
	}
	if (/\bbingo\b/.test(hay)) cats.push("bingo");
	if (/\broulette\b/.test(hay)) cats.push("roulette");
	if (
		/\b(blackjack|baccarat|poker|solitaire|twenty one|andar bahar|teen patti)\b/.test(
			hay,
		)
	) {
		cats.push("table_card_games");
	}
	if (/\bscratch\b/.test(hay)) cats.push("scratch");
	if (/\b(lottery|lotto)\b/.test(hay)) cats.push("lottery");
	if (/\bjackpot\b/.test(hay)) cats.push("jackpot");
	if (/\b(arcade|blocks)\b/.test(hay)) cats.push("arcade");

	if (cats.length === 1 && cats[0] === "crash_games") return cats;
	if (cats.includes("crash_games") && gameType === 2) {
		return cats.filter((c) => c !== "slots");
	}
	if (!cats.includes("slots")) cats.push("slots");
	return cats;
}

async function scorpioGet<T>(
	apiUrl: string,
	token: string,
	pathname: string,
): Promise<T> {
	const url = `${apiUrl.replace(/\/+$/, "")}${pathname}`;
	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/json",
			"User-Agent": "sportsdey-sync-scorpio-games/1.0",
		},
	});
	const payload = (await response.json()) as {
		success?: boolean;
		message?: string;
		data?: T;
	};
	if (!response.ok || payload.success === false) {
		throw new Error(
			`Scorpio ${pathname} failed (${response.status}): ${payload.message || "unknown"}`,
		);
	}
	return payload.data as T;
}

function mergeIntoCasinoJson(
	filePath: string,
	entries: { name: string; categories: string[] }[],
): void {
	const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as CasinoGamesJson;
	const added: Record<string, number> = {};

	for (const entry of entries) {
		for (const cat of entry.categories) {
			if (!data[cat]) data[cat] = [];
			const existing = new Set(data[cat].map((n) => normalizeName(n)));
			if (existing.has(normalizeName(entry.name))) continue;
			data[cat].push(entry.name);
			added[cat] = (added[cat] || 0) + 1;
		}
	}

	for (const name of [
		"Aviator",
		"Chicken Road 2",
		"Chicken Road Gold",
		"Rabbit Road",
		"Navigator",
	]) {
		const existing = new Set((data.popular || []).map((n) => normalizeName(n)));
		if (!existing.has(normalizeName(name))) {
			data.popular = [...(data.popular || []), name];
			added.popular = (added.popular || 0) + 1;
		}
	}

	fs.writeFileSync(filePath, `${JSON.stringify(data, null, "\t")}\n`);
	console.log("casino_games.json additions:", added);
}

async function main() {
	const vars = loadDevVars();
	const apiUrl = vars.SCORPIO_API_URL || vars.SCORPIO_BASE_URL || "";
	const token = vars.SCORPIO_API_TOKEN || "";
	if (!apiUrl || !token) {
		throw new Error("SCORPIO_API_URL and SCORPIO_API_TOKEN required in .dev.vars");
	}

	console.log(`Fetching Scorpio providers (${env})...`);
	const providers = await scorpioGet<ScorpioProvider[]>(
		apiUrl,
		token,
		"/v1/provider/list",
	);
	const active = (providers || []).filter((p) => p.status !== 0);
	console.log(`Active providers: ${active.length}`);

	const catalog: {
		id: string;
		name: string;
		code: string;
		imageUrl: string | null;
		enabled: boolean;
		categories: string[];
	}[] = [];

	for (const provider of active) {
		const games = await scorpioGet<ScorpioGame[]>(
			apiUrl,
			token,
			`/v1/game/list/${provider.providerId}`,
		);
		console.log(
			`  ${provider.providerName} (${provider.providerId}): ${(games || []).length} games`,
		);
		for (const game of games || []) {
			const rawCode = resolveGameCode(game);
			const name = typeof game.gameName === "string" ? game.gameName.trim() : "";
			if (!rawCode || !name) continue;
			const code = `scorpio:${provider.providerId}:${rawCode}`;
			const disabled =
				game.inMaintenance === true ||
				game.inMaintenance === 1 ||
				game.status === 0;
			catalog.push({
				id: crypto.randomUUID(),
				name,
				code,
				imageUrl: resolveGameImage(game.gameImage),
				enabled: !disabled,
				categories: categoriesFor(name, game.gameType),
			});
		}
	}

	// Deduplicate by code
	const byCode = new Map<string, (typeof catalog)[number]>();
	for (const row of catalog) {
		if (!byCode.has(row.code)) byCode.set(row.code, row);
	}
	const rows = [...byCode.values()];
	console.log(`Unique Scorpio games: ${rows.length}`);

	if (mergeJson) {
		console.log(`\nMerging names into ${jsonPath}...`);
		if (!dryRun) {
			mergeIntoCasinoJson(
				jsonPath,
				rows.map((r) => ({ name: r.name, categories: r.categories })),
			);
		}
	}

	if (jsonOnly) {
		console.log("--json-only set; skipping DB insert.");
		return;
	}

	const now = Date.now();
	const gameValues = rows.map(
		(g) =>
			`(${escape(g.id)}, ${escape(g.name)}, ${escape(g.code)}, ${escape(g.imageUrl)}, ${g.enabled ? 1 : 0}, ${now}, ${now})`,
	);

	// Batch inserts — D1 has statement size limits
	const BATCH = 80;
	console.log(
		`\nInserting ${rows.length} games into ${dbName} (${env}, ${remote ? "remote" : "local"})${dryRun ? " [dry-run]" : ""}...`,
	);

	if (dryRun) {
		console.log(`Would insert ${rows.length} rows in ${Math.ceil(rows.length / BATCH)} batches`);
	} else {
		const statements: string[] = [];
		for (let i = 0; i < gameValues.length; i += BATCH) {
			const chunk = gameValues.slice(i, i + BATCH);
			statements.push(
				`INSERT OR IGNORE INTO game (id, name, code, image_url, enabled, created_at, updated_at) VALUES\n${chunk.join(",\n")};`,
			);
		}
		if (statements.length > 0) {
			await executeSqlFile(
				dbName,
				env,
				statements.join("\n"),
				`${statements.length} game insert batches`,
				"sync-scorpio",
				0,
				{ remote, throwOnError: true },
			);
		}
	}

	if (categorize) {
		console.log("\nRunning categorize-games...");
		if (!dryRun) {
			await categorizeGamesFromJson(dbName, env, jsonPath, { remote });
		}
	}

	console.log("\nDone.");
}

main().catch((error) => {
	console.error("Error:", error);
	process.exit(1);
});
