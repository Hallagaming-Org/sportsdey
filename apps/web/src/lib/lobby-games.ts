import type { ScorpioLobbyGame } from "@/lib/scorpio-catalog";

type ClassicCatalogGame = {
	id: string;
	name: string;
	code: string;
	imageUrl: string | null;
	categories: ScorpioLobbyGame["categories"];
	enabled: boolean;
};

/** D1 stores Scorpio games as `scorpio:{providerId}:{gameCode}`. */
const SCORPIO_STORED_CODE = /^scorpio:(\d+):(.+)$/i;

export function parseScorpioStoredCode(code: string): {
	providerId: number;
	gameCode: string;
} | null {
	const match = SCORPIO_STORED_CODE.exec(code.trim());
	if (!match) return null;
	const providerId = Number(match[1]);
	const gameCode = match[2]?.trim() ?? "";
	if (!Number.isFinite(providerId) || providerId <= 0 || !gameCode) {
		return null;
	}
	return { providerId, gameCode };
}

export function isScorpioStoredCode(code: string): boolean {
	return parseScorpioStoredCode(code) != null;
}

/** Slotegrator / originals only — D1 Scorpio copies must not use GIS launch. */
export function excludeScorpioStoredGames<T extends { code: string }>(
	games: T[],
): T[] {
	return games.filter((game) => !isScorpioStoredCode(game.code));
}

export function scorpioStoredKey(providerId: number, gameCode: string): string {
	return `scorpio:${providerId}:${gameCode}`.toLowerCase();
}

/**
 * Classic D1 rows that are Scorpio, but missing from the live catalog.
 * Shown as Scorpio tiles so they still launch through `/scorpio/launch`.
 */
export function d1ScorpioFallbackGames(
	classic: ClassicCatalogGame[],
	liveScorpio: ScorpioLobbyGame[],
): ScorpioLobbyGame[] {
	const liveKeys = new Set(
		liveScorpio.map((game) => scorpioStoredKey(game.providerId, game.code)),
	);

	const out: ScorpioLobbyGame[] = [];
	for (const game of classic) {
		if (!game.enabled) continue;
		const parsed = parseScorpioStoredCode(game.code);
		if (!parsed) continue;
		if (liveKeys.has(game.code.trim().toLowerCase())) continue;
		out.push({
			id: game.code,
			name: game.name,
			code: parsed.gameCode,
			imageUrl: game.imageUrl,
			categories: game.categories,
			enabled: true,
			createdAt: 0,
			updatedAt: 0,
			provider: "scorpio",
			providerId: parsed.providerId,
			providerName: "Scorpio",
		});
	}
	return out;
}

export type LobbyGame = ScorpioLobbyGame | ClassicCatalogGame;

/**
 * Merge catalogs for Casino:
 * - Drop D1 `scorpio:*` rows from the Classic/Slotegrator list (wrong launch + often no art)
 * - Keep live Scorpio tiles (nested thumbnails + `/scorpio/launch`)
 * - Add D1 Scorpio rows only when the live catalog does not already have that game
 */
export function mergeLobbyGames<C extends ClassicCatalogGame>(
	classic: C[],
	scorpio: ScorpioLobbyGame[],
): Array<C | ScorpioLobbyGame> {
	const classicOnly = excludeScorpioStoredGames(classic);
	const classicCodes = new Set(
		classicOnly.map((game) => game.code.trim().toLowerCase()).filter(Boolean),
	);
	const scorpioOnly = scorpio.filter((game) => {
		const code = game.code.trim().toLowerCase();
		return Boolean(code) && !classicCodes.has(code);
	});
	const fallback = d1ScorpioFallbackGames(classic, scorpioOnly);
	return [...classicOnly, ...scorpioOnly, ...fallback];
}
