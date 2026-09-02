/**
 * Diff BetPawa sheet categories against remote D1 (staging or production).
 *
 * Usage: pnpm games:diff-betpawa-categories staging
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	BETPAWA_CATEGORY_TO_DB,
	BETPAWA_DB_LABELS,
	canonicalLobbySlugForBetpawa,
} from "./betpawa-sheet-utils";
import {
	executeD1Json,
	flexibleName,
	loadCasinoJson,
	normalizeName,
} from "./categorize-utils";

const envArg = process.argv[2] === "production" ? "production" : "staging";
const dbName = envArg === "production" ? "sportsdey_db" : "staging-db";
const jsonPath = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"casino_games_betpawa.json",
);
const reportPath = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	`betpawa-category-diff-${envArg}.json`,
);

type ExpectedEntry = { title: string; dbCategory: string; lobbySlug: string };

function buildExpected(data: Record<string, string[]>): ExpectedEntry[] {
	const out: ExpectedEntry[] = [];
	for (const [dbCategory, games] of Object.entries(data)) {
		for (const title of games) {
			out.push({
				title,
				dbCategory,
				lobbySlug: canonicalLobbySlugForBetpawa(dbCategory),
			});
		}
	}
	return out;
}

async function fetchGameCategories(
	dbName: string,
	env: string,
): Promise<
	Map<string, { id: string; name: string; slugs: string[] }>
> {
	const rows = await executeD1Json<{
		id: string;
		name: string;
		slug: string | null;
	}>(
		dbName,
		env,
		`SELECT g.id, g.name, c.slug FROM game g LEFT JOIN game_category gc ON gc.game_id = g.id LEFT JOIN category c ON c.id = gc.category_id`,
		{ remote: true },
	);

	const byId = new Map<string, { id: string; name: string; slugs: string[] }>();
	for (const row of rows) {
		const existing = byId.get(row.id) ?? {
			id: row.id,
			name: row.name,
			slugs: [],
		};
		if (row.slug && !existing.slugs.includes(row.slug)) {
		 existing.slugs.push(row.slug);
		}
		byId.set(row.id, existing);
	}
	return byId;
}

async function main() {
	if (!fs.existsSync(jsonPath)) {
		console.error(`Missing ${jsonPath}. Run pnpm games:export-betpawa-sheet first.`);
		process.exit(1);
	}

	const data = loadCasinoJson(jsonPath);
	const expected = buildExpected(data);

	console.log(`Env=${envArg} db=${dbName}`);
	console.log(`Sheet JSON: ${jsonPath} (${expected.length} category assignments)`);

	console.log("Fetching game categories from D1 (single query)...");
	const gamesById = await fetchGameCategories(dbName, envArg);

	const nameToGame = new Map<string, { id: string; name: string; slugs: string[] }>();
	const flexToGame = new Map<string, { id: string; name: string; slugs: string[] }>();
	for (const game of gamesById.values()) {
		nameToGame.set(normalizeName(game.name), game);
		flexToGame.set(flexibleName(game.name), game);
	}

	const notOnSite: string[] = [];
	const correct: { title: string; dbCategory: string; current: string[] }[] = [];
	const wrongCategory: {
		title: string;
		expected: string;
		expectedLobby: string;
		current: string[];
		gameId: string;
	}[] = [];
	const missingCategory: {
		title: string;
		expected: string;
		current: string[];
		gameId: string;
	}[] = [];

	for (const entry of expected) {
		const key = normalizeName(entry.title);
		const game =
			nameToGame.get(key) ?? flexToGame.get(flexibleName(entry.title)) ?? null;
		if (!game) {
			notOnSite.push(entry.title);
			continue;
		}

		const currentSlugs = [...new Set(game.slugs)];
		const expectedSlug = entry.dbCategory;
		const hasExpected = currentSlugs.some(
			(s) =>
				s === expectedSlug ||
				canonicalLobbySlugForBetpawa(s) === entry.lobbySlug,
		);

		if (hasExpected && currentSlugs.length === 1 && currentSlugs[0] === expectedSlug) {
			correct.push({ title: entry.title, dbCategory: expectedSlug, current: currentSlugs });
		} else if (hasExpected) {
			correct.push({
				title: entry.title,
				dbCategory: expectedSlug,
				current: currentSlugs,
			});
		} else if (currentSlugs.length === 0) {
			missingCategory.push({
				title: entry.title,
				expected: expectedSlug,
				current: currentSlugs,
				gameId: game.id,
			});
		} else {
			wrongCategory.push({
				title: entry.title,
				expected: expectedSlug,
				expectedLobby: entry.lobbySlug,
				current: currentSlugs,
				gameId: game.id,
			});
		}
	}

	const uniqueNotOnSite = [...new Set(notOnSite.map((t) => t.toLowerCase()))];
	const report = {
		env: envArg,
		generatedAt: new Date().toISOString(),
		sheetMapping: BETPAWA_CATEGORY_TO_DB,
		summary: {
			totalAssignments: expected.length,
			onSiteMatched: expected.length - notOnSite.length,
			notOnSite: uniqueNotOnSite.length,
			alreadyCorrect: correct.length,
			wrongCategory: wrongCategory.length,
			missingCategory: missingCategory.length,
		},
		notOnSite: [...new Set(notOnSite)].sort(),
		wrongCategory,
		missingCategory,
		correctSample: correct.slice(0, 20),
	};

	fs.writeFileSync(reportPath, `${JSON.stringify(report, null, "\t")}\n`);

	console.log("\n--- Diff summary ---");
	console.log(`On site (matched by title): ${report.summary.onSiteMatched}`);
	console.log(`Not on site (skip per Abiola): ${report.summary.notOnSite}`);
	console.log(`Has expected category: ${report.summary.alreadyCorrect}`);
	console.log(`Wrong category: ${report.summary.wrongCategory}`);
	console.log(`No category links: ${report.summary.missingCategory}`);
	console.log(`\nReport: ${reportPath}`);

	if (wrongCategory.length > 0) {
		console.log("\nWrong category (first 15):");
		for (const row of wrongCategory.slice(0, 15)) {
			console.log(
				`  ${row.title}: expected ${row.expected} (${BETPAWA_DB_LABELS[row.expected] ?? row.expected}), has [${row.current.join(", ")}]`,
			);
		}
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
