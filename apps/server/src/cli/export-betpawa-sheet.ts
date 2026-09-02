/**
 * Download BetPawa casino categorization Google Sheet → casino_games_betpawa.json
 *
 * Usage: pnpm games:export-betpawa-sheet
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	BETPAWA_SHEET_CSV_URL,
	parseBetpawaCsv,
	summarizeBetpawaJson,
	toDbCategoryJson,
} from "./betpawa-sheet-utils";

const dir = path.dirname(fileURLToPath(import.meta.url));
const jsonOut = path.join(dir, "casino_games_betpawa.json");
const typosOut = path.join(dir, "betpawa-sheet-typos.json");
const inventoryOut = path.join(dir, "betpawa-sheet-inventory.json");

async function main() {
	console.log(`Fetching ${BETPAWA_SHEET_CSV_URL}`);
	const res = await fetch(BETPAWA_SHEET_CSV_URL);
	if (!res.ok) {
		throw new Error(`Sheet download failed: ${res.status} ${res.statusText}`);
	}
	const csv = await res.text();

	const parsed = parseBetpawaCsv(csv);
	const dbJson = toDbCategoryJson(parsed.sections);
	const summary = summarizeBetpawaJson(dbJson);

	fs.writeFileSync(jsonOut, `${JSON.stringify(dbJson, null, "\t")}\n`);
	fs.writeFileSync(
		typosOut,
		`${JSON.stringify(
			{
				applied: parsed.typosApplied,
				duplicateAcrossSections: parsed.duplicateAcrossSections,
				note: "Review with Abiola before re-export if sheet source typos change.",
			},
			null,
			"\t",
		)}\n`,
	);
	fs.writeFileSync(
		inventoryOut,
		`${JSON.stringify(
			{
				source: BETPAWA_SHEET_CSV_URL,
				exportedAt: new Date().toISOString(),
				sheetSections: Object.fromEntries(
					Object.entries(parsed.sections).map(([k, v]) => [k, v.length]),
				),
				dbCategories: summary.categories,
				totalGameRows: summary.totalRows,
				uniqueTitles: summary.uniqueTitles,
				gamesByDbCategory: dbJson,
			},
			null,
			"\t",
		)}\n`,
	);

	console.log("\nSheet sections:");
	for (const [sec, games] of Object.entries(parsed.sections)) {
		console.log(`  ${sec}: ${games.length}`);
	}
	console.log("\nDB-mapped JSON:");
	for (const [cat, n] of summary.categories) {
		console.log(`  ${cat}: ${n}`);
	}
	console.log(`\nTotal rows: ${summary.totalRows}, unique titles: ${summary.uniqueTitles}`);
	console.log(`Typos fixed: ${parsed.typosApplied.length}`);
	console.log(`Cross-section duplicates: ${parsed.duplicateAcrossSections.length}`);
	console.log(`\nWrote:\n  ${jsonOut}\n  ${typosOut}\n  ${inventoryOut}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
