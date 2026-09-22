import { isClassicKnownGameCode } from "./classic-lobby-codes";
import type { ScorpioLobbyGame } from "./scorpio-catalog";

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
 * Lower is better. Hot Casino / Popular should not pick a GIS uuid over a
 * working Scorpio or in-house original with the same display name.
 */
export function lobbyLaunchPreference(game: {
	code: string;
	provider?: string;
}): number {
	if (isClassicKnownGameCode(game.code)) return 0;
	if (game.provider === "scorpio" || isScorpioStoredCode(game.code)) return 1;
	return 2;
}

/** Keep one tile per display name, preferring originals then Scorpio then GIS. */
export function dedupeLobbyGamesByName<
	T extends { id: string; name: string; code: string; provider?: string },
>(games: T[]): T[] {
	const bestByName = new Map<string, T>();
	for (const game of games) {
		const key = game.name.toLowerCase().trim();
		if (!key) continue;
		const existing = bestByName.get(key);
		if (
			!existing ||
			lobbyLaunchPreference(game) < lobbyLaunchPreference(existing)
		) {
			bestByName.set(key, game);
		}
	}

	const seen = new Set<string>();
	const out: T[] = [];
	for (const game of games) {
		const key = game.name.toLowerCase().trim();
		if (!key || seen.has(key)) continue;
		const winner = bestByName.get(key);
		if (!winner) continue;
		seen.add(key);
		out.push(winner);
	}
	return out;
}

/**
 * Merge catalogs for Casino:
 * - Drop D1 `scorpio:*` rows from the Classic/Slotegrator list (wrong launch + often no art)
 * - Keep live Scorpio tiles (nested thumbnails + `/scorpio/launch`)
 * - Drop unprefixed D1 copies whose code matches a live Scorpio game (those used to
 *   hide Scorpio and GIS-launch, which always fails)
 * - Keep in-house originals even when Scorpio reuses a short code (`slots`, `blackjack`)
 * - Add D1 Scorpio rows only when the live catalog does not already have that game
 */
export function mergeLobbyGames<C extends ClassicCatalogGame>(
	classic: C[],
	scorpio: ScorpioLobbyGame[],
): Array<C | ScorpioLobbyGame> {
	const liveScorpioCodes = new Set(
		scorpio.map((game) => game.code.trim().toLowerCase()).filter(Boolean),
	);
	const classicOnly = excludeScorpioStoredGames(classic).filter((game) => {
		const code = game.code.trim().toLowerCase();
		if (!code || isClassicKnownGameCode(game.code)) return true;
		return !liveScorpioCodes.has(code);
	});
	const fallback = d1ScorpioFallbackGames(classic, scorpio);
	return [...classicOnly, ...scorpio, ...fallback];
}
