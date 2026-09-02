/**
 * Parse Abiola's BetPawa-style casino categorization spreadsheet (column A sections).
 * Sheet: https://docs.google.com/spreadsheets/d/1IKEpRiIh7HfehxlP3M_x7iR23pmpdQfMLMKjPEdRRFk
 */
import type { CasinoGamesJson } from "./categorize-utils";

export const BETPAWA_SHEET_ID = "1IKEpRiIh7HfehxlP3M_x7iR23pmpdQfMLMKjPEdRRFk";
export const BETPAWA_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${BETPAWA_SHEET_ID}/export?format=csv&gid=0`;

/** Section headers in column A (exact match, case-insensitive). */
export const BETPAWA_SECTION_HEADERS = new Set([
	"POPULAR",
	"CRASH",
	"WHEEL",
	"CLASSICS",
	"INSTANT",
	"TABLE AND CARD",
]);

/**
 * Sheet section label → Sportsdey D1 category key (slug/id).
 * WHEEL has no lobby tab; wheel-style titles map to jackpot (see lobby-categories wheel alias).
 */
export const BETPAWA_CATEGORY_TO_DB: Record<string, string> = {
	POPULAR: "popular",
	CRASH: "crash",
	WHEEL: "jackpot",
	CLASSICS: "classic",
	INSTANT: "arcade",
	"TABLE AND CARD": "tablecardgames",
};

/** DB key → human label for reports. */
export const BETPAWA_DB_LABELS: Record<string, string> = {
	popular: "Popular",
	crash: "Crash",
	jackpot: "Jackpot (from WHEEL)",
	classic: "Classic",
	arcade: "Arcade (from INSTANT)",
	tablecardgames: "Table/Card Games",
};

/** DB key → canonical Casino lobby tab slug (matches lobby-categories.ts aliases). */
export const BETPAWA_DB_TO_LOBBY: Record<string, string> = {
	popular: "popular",
	crash: "crash",
	jackpot: "jackpot",
	classic: "classic",
	arcade: "arcade",
	tablecardgames: "tablecardgames",
};

export function canonicalLobbySlugForBetpawa(dbSlug: string): string {
	const compact = dbSlug.toLowerCase().replace(/[_-]/g, "");
	const aliases: Record<string, string> = {
		instant: "arcade",
		instantgames: "arcade",
		wheel: "jackpot",
		tableandcard: "tablecardgames",
		tablecardgames: "tablecardgames",
		crashgames: "crash",
		crashgame: "crash",
		crash: "crash",
	};
	return aliases[compact] ?? dbSlug.toLowerCase();
}

/** Known typos in the sheet — applied on export; listed in betpawa-sheet-typos.json for Abiola. */
export const BETPAWA_TYPO_FIXES: Record<string, string> = {
	"CRASH GOA;": "CRASH GOAL",
	jJACKPOT: "Jackpot",
	"PWER OF OLYMPUS": "POWER OF OLYMPUS",
	"LUCKY  OASIS": "LUCKY OASIS",
	"CASH  BALLON": "CASH BALLOON",
	/** Sheet omits colon/hyphens; DB title is "Chicken Route: Ro-co-co". */
	"CHICKEN ROUTE RO CO CO": "Chicken Route: Ro-co-co",
};

export type BetpawaParseResult = {
	sections: Record<string, string[]>;
	typosApplied: { original: string; fixed: string }[];
	duplicateAcrossSections: { title: string; sections: string[] }[];
};

export function fixBetpawaTitle(title: string): {
	fixed: string;
	wasTypo: boolean;
	original: string;
} {
	const trimmed = title.trim();
	const fixed = BETPAWA_TYPO_FIXES[trimmed] ?? trimmed.replace(/\s+/g, " ");
	return {
		fixed,
		wasTypo: fixed !== trimmed,
		original: trimmed,
	};
}

export function parseBetpawaCsv(csv: string): BetpawaParseResult {
	const lines = csv.split(/\r?\n/);
	const sections: Record<string, string[]> = {};
	let current: string | null = null;
	const typosApplied: { original: string; fixed: string }[] = [];
	const titleToSections = new Map<string, Set<string>>();

	for (const line of lines) {
		const cell = line.split(",")[0]?.trim() ?? "";
		if (!cell || cell.toUpperCase() === "GAMES CATEGORY") continue;

		const upper = cell.toUpperCase();
		if (BETPAWA_SECTION_HEADERS.has(upper) && upper !== current) {
			current = upper;
			sections[current] = sections[current] ?? [];
			continue;
		}

		if (!current) continue;

		const { fixed, wasTypo, original } = fixBetpawaTitle(cell);
		if (wasTypo) typosApplied.push({ original, fixed });

		sections[current].push(fixed);

		const key = fixed.toLowerCase();
		const set = titleToSections.get(key) ?? new Set<string>();
		set.add(current);
		titleToSections.set(key, set);
	}

	const duplicateAcrossSections = [...titleToSections.entries()]
		.filter(([, secs]) => secs.size > 1)
		.map(([title, secs]) => ({
			title,
			sections: [...secs],
		}));

	return { sections, typosApplied, duplicateAcrossSections };
}

/** Merge sheet sections into DB-keyed JSON for categorize/apply scripts. */
export function toDbCategoryJson(sections: Record<string, string[]>): CasinoGamesJson {
	const out: CasinoGamesJson = {};
	for (const [section, games] of Object.entries(sections)) {
		const dbKey = BETPAWA_CATEGORY_TO_DB[section];
		if (!dbKey) continue;
		const list = out[dbKey] ?? [];
		for (const game of games) {
			if (!list.includes(game)) list.push(game);
		}
		out[dbKey] = list;
	}
	return out;
}

export function summarizeBetpawaJson(data: CasinoGamesJson): {
	categories: [string, number][];
	totalRows: number;
	uniqueTitles: number;
} {
	let totalRows = 0;
	const allTitles = new Set<string>();
	const categories: [string, number][] = [];
	for (const [cat, games] of Object.entries(data)) {
		totalRows += games.length;
		for (const g of games) allTitles.add(g.toLowerCase().trim());
		categories.push([cat, games.length]);
	}
	return { categories, totalRows, uniqueTitles: allTitles.size };
}
