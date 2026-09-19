import type { ComponentType } from "react";
import { apiRequest } from "@/lib/api";
import { canonicalLobbySlug } from "@/lib/lobby-categories";
import { CLASSIC_THUNDR_CODES } from "@/lib/classic-lobby-codes";
import {
	dedupeLobbyGamesByName,
	isScorpioStoredCode,
	mergeLobbyGames,
} from "@/lib/lobby-games";
import type { ScorpioLobbyGame } from "@/lib/scorpio-catalog";
import { resolveServerUrl } from "@/lib/server-url";
import BlackjackLogo from "@/logos/blackjack.svg?react";
import BlocksLogo from "@/logos/blocks.svg?react";
import PlinkoLogo from "@/logos/plinko.svg?react";
import SlotsLogo from "@/logos/slots.svg?react";
import SolitaireLogo from "@/logos/solitaire.svg?react";
import TwentyOneLogo from "@/logos/twentyone.svg?react";

export type ClassicCategory = {
	id: string;
	name: string;
	slug: string;
};

/** Lobby game from Sportsdey DB / Slotegrator sync (`GET /games`). */
export type ClassicLobbyGame = {
	id: string;
	name: string;
	code: string;
	imageUrl: string | null;
	categories: ClassicCategory[];
	enabled: boolean;
	createdAt: number;
	updatedAt: number;
};

export const CLASSIC_CATEGORIES = [
	"popular",
	"crash",
	"original",
	"pvp",
	"arcade",
	"slots",
	"tablecardgames",
	"classic",
	"bingo",
	"dice",
	"jackpot",
	"lottery",
	"virtuals",
	"others",
	"roulette",
	"scratch",
] as const;

export const CLASSIC_CATEGORY_LABELS: Record<string, string> = {
	popular: "Popular",
	crash: "Crash",
	original: "Original",
	pvp: "PvP",
	arcade: "Arcade",
	slots: "Slots",
	tablecardgames: "Table/Card Games",
	classic: "Classic",
	bingo: "Bingo",
	dice: "Dice",
	jackpot: "Jackpot",
	lottery: "Lottery",
	virtuals: "Virtuals",
	others: "Others",
	roulette: "Roulette",
	scratch: "Scratch",
};

export const CLASSIC_CATEGORY_EMOJIS: Record<string, string> = {
	popular: "🔥",
	crash: "🚀",
	original: "🎯",
	pvp: "⚔️",
	arcade: "🕹️",
	slots: "🎰",
	tablecardgames: "🃏",
	classic: "👑",
	bingo: "🎱",
	dice: "🎲",
	jackpot: "💰",
	lottery: "🎟️",
	virtuals: "⚽",
	others: "🧩",
	roulette: "🎡",
	scratch: "🎫",
};

/** Homepage Hot Casino + /games Popular — order from Abiola Hot Casino List. */
export const HOT_CASINO_GAME_NAMES = [
	"Aviator",
	"Aviatrix",
	"Lagos Rush",
	"Metronite",
	"Aero",
	"Doggo Balloon",
	"Sportsdey Crash",
	"Lucky Rise",
	"Navigator",
	"Chicken Road Race",
	"Big Bass Crash",
	"Crash X",
	"Vortex",
	"Penalty Roulette",
	"Penalty Shootout: Cup Mania",
	"Football Manager",
	"Avia Rush",
	"Football Crash",
	"Mines",
	"Keno",
];

/** @deprecated Use HOT_CASINO_GAME_NAMES */
const POPULAR_GAME_NAMES = HOT_CASINO_GAME_NAMES;

export const CLASSIC_PRIORITY_GAMES = [
	"solitaire",
	"blocks",
	"twentyone",
	"blackjack",
	"slots",
	"plinko",
	"XCAPEHB",
	"EAGLEHB",
	"LUCKYRISEHB",
	"LAGOSRUSH",
	"HALLABOMB",
	"HALLADICE",
	"HALLAMETRONITE",
	"sportsdey-crash",
	"spin_and_win",
];

export {
	CLASSIC_HIDDEN_FROM_ALL_CODES,
	CLASSIC_THUNDR_CODES,
} from "@/lib/classic-lobby-codes";

export const CLASSIC_ORIGINALS_CODES = [
	"LAGOSRUSH",
	"HALLABOMB",
	"HALLADICE",
	"HALLAMETRONITE",
	"sportsdey-crash",
	"spin_and_win",
];

const HALLA_LAUNCH_PATHS: Record<string, string> = {
	HALLABOMB: "/halla/bomb/launcher",
	HALLADICE: "/halla/dice/launcher",
	HALLAMETRONITE: "/halla/metronite/launcher",
};

/** Virtual sports titles (Slotegrator) — shown on the Virtuals tab even if D1 still tags them as Others. */
export const VIRTUALS_GAME_NAMES = [
	"Virtual football pro",
	"Virtual soccer",
	"Virtual champions",
	"Spin greyhounds",
	"Spin horses",
	"Spin cricket",
	"Instant soccer",
] as const;

export const CLASSIC_SPECIAL_CATEGORIES = [
	"popular",
	"pvp",
	"original",
	"virtuals",
];

export const CLASSIC_KNOWN_GAMES: Record<
	string,
	{
		subtitle: string;
		icon?: ComponentType<{ className?: string }>;
		image?: string;
		gradient: string;
	}
> = {
	solitaire: {
		subtitle: "classic card game",
		icon: SolitaireLogo,
		image: "/solitaire.png",
		gradient: "linear-gradient(to bottom, #1e3a5f, #2d5a87, #4a90d9)",
	},
	blocks: {
		subtitle: "puzzle game",
		icon: BlocksLogo,
		image: "/blocks.png",
		gradient: "linear-gradient(to bottom, #ff6b35, #f7931e, #ffcc00)",
	},
	twentyone: {
		subtitle: "card game",
		icon: TwentyOneLogo,
		image: "/twentyone.png",
		gradient: "linear-gradient(to bottom, #1a1a2e, #16213e, #0f3460)",
	},
	blackjack: {
		subtitle: "card game",
		icon: BlackjackLogo,
		image: "/blackjack.png",
		gradient: "linear-gradient(to bottom, #2d2d2d, #4a4a4a, #6b6b6b)",
	},
	slots: {
		subtitle: "slot machine",
		icon: SlotsLogo,
		image: "/slots.png",
		gradient: "linear-gradient(to bottom, #7b1fa2, #9c27b0, #ba68c8)",
	},
	plinko: {
		subtitle: "lucky drop",
		icon: PlinkoLogo,
		image: "/plinko.png",
		gradient: "linear-gradient(to bottom, #00897b, #26a69a, #4db6ac)",
	},
	XCAPEHB: {
		subtitle: "fulfilling games",
		image: "/xcape-thumbnail-16x9.jpg",
		gradient: "linear-gradient(to bottom, #1fe0c8, #7a5cff, #c43cff)",
	},
	EAGLEHB: {
		subtitle: "fulfilling games",
		image: "/eagle-thumbnail-16x9.jpg",
		gradient: "linear-gradient(to bottom, #d9f27c, #8bbf4f, #5f9e7a)",
	},
	LUCKYRISEHB: {
		subtitle: "fulfilling games",
		image: "/luckyrise-thumbnail-16x9.png",
		gradient: "linear-gradient(to bottom, #0E0E2B, #1f3a5f, #d4a017)",
	},
	LAGOSRUSH: {
		subtitle: "fulfilling games",
		image: "/lagos-rush-v2.png",
		gradient: "linear-gradient(to bottom, #ff6b35, #f7931e, #ffcc00)",
	},
	HALLABOMB: {
		subtitle: "halla mini game",
		image: "/halla-bomb.webp",
		gradient: "linear-gradient(to bottom, #1a1a2e, #c0392b, #e74c3c)",
	},
	HALLADICE: {
		subtitle: "halla mini game",
		image: "/halla-dice.webp",
		gradient: "linear-gradient(to bottom, #0f2027, #203a43, #2c5364)",
	},
	HALLAMETRONITE: {
		subtitle: "halla mini game",
		image: "/halla-metronite.webp",
		gradient: "linear-gradient(to bottom, #141e30, #243b55, #4a90d9)",
	},
	"sportsdey-crash": {
		subtitle: "sportsdey original",
		image: "/sportsdey-crash.webp",
		gradient: "linear-gradient(to bottom, #ff6b35, #f7931e, #ffcc00)",
	},
	spin_and_win: {
		subtitle: "sportsdey original",
		image: "/spin-and-win-v3.jpg",
		gradient: "linear-gradient(to bottom, #e91e63, #9c27b0, #673ab7)",
	},
};

const KNOWN_GAME_BY_NAME: Record<string, string> = {
	"lagos rush": "LAGOSRUSH",
};

/** Prefer our R2 art, then static originals, then provider thumbnails. */
export function resolveKnownLobbyImage(game: {
	code: string;
	name: string;
	imageUrl?: string | null;
}): string | null {
	if (game.imageUrl?.includes("bucket.sportsdey.com")) {
		return game.imageUrl;
	}
	const byCode = CLASSIC_KNOWN_GAMES[game.code]?.image;
	if (byCode) return byCode;
	const alias = KNOWN_GAME_BY_NAME[game.name.toLowerCase().trim()];
	const byName = alias ? CLASSIC_KNOWN_GAMES[alias]?.image : undefined;
	if (byName) return byName;
	return game.imageUrl ?? null;
}

const SPORTSDEY_CRASH_URL =
	"https://binary.sportsdey.com/sportsdayApi/connectSportsDay?type=casino";

function scoreLobbyNameMatch(gameName: string, target: string): number {
	const g = gameName.toLowerCase().trim();
	const t = target.toLowerCase().trim();
	if (g === t) return 0;
	if (g === `${t} mobile`) return 1;
	if (g.startsWith(`${t} `) || g.startsWith(`${t}:`)) return 2;
	if (g.includes(t)) return 3;
	return 999;
}

/**
 * Pick enabled lobby games in the given name order.
 * Prefers exact title, then "… Mobile", then prefix, then substring.
 */
export function pickGamesByOrderedNames<T extends { id: string; name: string }>(
	games: T[],
	names: readonly string[],
	limit: number = Number.POSITIVE_INFINITY,
): T[] {
	const result: T[] = [];
	const addedIds = new Set<string>();

	for (const target of names) {
		if (result.length >= limit) break;

		let best: T | undefined;
		let bestScore = 999;
		for (const game of games) {
			if (addedIds.has(game.id)) continue;
			const score = scoreLobbyNameMatch(game.name, target);
			if (score < bestScore) {
				bestScore = score;
				best = game;
			}
		}

		if (best && bestScore < 999) {
			result.push(best);
			addedIds.add(best.id);
		}
	}

	return result;
}

export function getUniquePopularGames(
	games: ClassicLobbyGame[],
	limit: number,
): ClassicLobbyGame[] {
	return pickGamesByOrderedNames(games, POPULAR_GAME_NAMES, limit);
}

/**
 * Popular / Hot Casino tiles: merge catalogs, then pick HOT names while
 * preferring in-house originals and Scorpio over GIS uuid duplicates.
 */
export function popularLobbyGames(
	classic: ClassicLobbyGame[],
	scorpio: ScorpioLobbyGame[],
	limit: number = Number.POSITIVE_INFINITY,
) {
	return pickGamesByOrderedNames(
		dedupeLobbyGamesByName(mergeLobbyGames(classic, scorpio)),
		HOT_CASINO_GAME_NAMES,
		limit,
	);
}

/** Query params already supported by `GET /games`. */
export type ClassicLobbyGamesQuery = {
	category?: string;
	search?: string;
	sort?: "asc" | "desc";
	offset?: number;
	limit?: number;
};

export async function fetchClassicLobbyGames(
	query?: ClassicLobbyGamesQuery,
): Promise<ClassicLobbyGame[]> {
	const params = new URLSearchParams();
	if (query?.category) params.set("category", query.category);
	if (query?.search) params.set("search", query.search);
	if (query?.sort) params.set("sort", query.sort);
	if (query?.offset != null) params.set("offset", String(query.offset));
	if (query?.limit != null) params.set("limit", String(query.limit));
	const qs = params.toString();
	const games = await apiRequest<ClassicLobbyGame[]>(
		qs ? `games?${qs}` : "games",
	);
	const enabled = games.filter(
		(game) => game.enabled && !CLASSIC_OFFLINE_CODES.has(game.code),
	);
	return enabled;
}

/**
 * Games whose wallet integration is disabled server-side (Hashcodex /
 * Sportsdey Crash self-credit vulnerability rework). Hidden from the lobby
 * until the signed server-to-server wallet callback ships.
 */
const CLASSIC_OFFLINE_CODES = new Set(["sportsdey-crash", "spin_and_win"]);

export function filterClassicGames(
	allGames: ClassicLobbyGame[],
	selectedCategory: string | null,
	search: string,
): ClassicLobbyGame[] {
	let filtered = allGames;

	if (selectedCategory) {
		if (CLASSIC_SPECIAL_CATEGORIES.includes(selectedCategory)) {
			switch (selectedCategory) {
				case "popular":
					filtered = getUniquePopularGames(allGames, Number.POSITIVE_INFINITY);
					break;
				case "pvp":
					filtered = allGames.filter((g) =>
						(CLASSIC_THUNDR_CODES as readonly string[]).includes(g.code),
					);
					break;
				case "original":
					filtered = allGames.filter((g) =>
						CLASSIC_ORIGINALS_CODES.includes(g.code),
					);
					break;
				case "virtuals":
					filtered = pickGamesByOrderedNames(
						allGames,
						VIRTUALS_GAME_NAMES,
					);
					break;
				default:
					break;
			}
		} else {
			filtered = allGames.filter((g) =>
				g.categories?.some(
					(c) =>
						canonicalLobbySlug(c.slug) === canonicalLobbySlug(selectedCategory),
				),
			);
		}
	}

	if (search) {
		const q = search.toLowerCase();
		filtered = filtered.filter((g) => g.name.toLowerCase().includes(q));
	}

	return filtered;
}

export function classicCategoryCounts(
	allGames: ClassicLobbyGame[],
): Record<string, number> {
	if (allGames.length === 0) return {};

	return CLASSIC_CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
		if (CLASSIC_SPECIAL_CATEGORIES.includes(cat)) {
			switch (cat) {
				case "popular":
					acc[cat] = getUniquePopularGames(
						allGames,
						Number.POSITIVE_INFINITY,
					).length;
					break;
				case "pvp":
					acc[cat] = allGames.filter((g) =>
						(CLASSIC_THUNDR_CODES as readonly string[]).includes(g.code),
					).length;
					break;
				case "original":
					acc[cat] = allGames.filter((g) =>
						CLASSIC_ORIGINALS_CODES.includes(g.code),
					).length;
					break;
				case "virtuals":
					acc[cat] = pickGamesByOrderedNames(
						allGames,
						VIRTUALS_GAME_NAMES,
					).length;
					break;
				default:
					acc[cat] = 0;
			}
		} else {
			acc[cat] = allGames.filter((g) =>
				g.categories?.some(
					(c) => canonicalLobbySlug(c.slug) === canonicalLobbySlug(cat),
				),
			).length;
		}
		return acc;
	}, {});
}

type LaunchResponse = {
	success: boolean;
	data?: { url?: string };
	error?: string;
};

/** Slotegrator catalog games (uuid codes) — support Try Demo + Play Now. */
export function isSlotegratorLobbyGame(game: Pick<ClassicLobbyGame, "code">) {
	if (isScorpioStoredCode(game.code)) return false;
	return game.code !== "sportsdey-crash" && !CLASSIC_KNOWN_GAMES[game.code];
}

export type ClassicLaunchMode = "demo" | "real";

/**
 * Launch a Classic (Slotegrator / Thndr / Lagos Rush / LuckyWorld) game.
 * Returns null when the game opens in a new tab (sportsdey-crash).
 *
 * For Slotegrator: pass `mode: "demo"` → `/slotegrator/launch-demo`,
 * or `mode: "real"` → `/slotegrator/launch` (wallet session).
 */
export async function launchClassicGame(
	game: ClassicLobbyGame,
	options?: { mode?: ClassicLaunchMode },
): Promise<string | null> {
	if (isScorpioStoredCode(game.code)) {
		throw new Error("Game not found");
	}

	if (game.code === "sportsdey-crash" || game.code === "spin_and_win") {
		window.open(SPORTSDEY_CRASH_URL, "_blank");
		return null;
	}

	const base = resolveServerUrl();
	const knownGame = CLASSIC_KNOWN_GAMES[game.code];
	const isKnownGame = !!knownGame;

	let path: string;
	let body: Record<string, unknown>;

	if (isKnownGame) {
		if (["XCAPEHB", "EAGLEHB", "LUCKYRISEHB"].includes(game.code)) {
			path = `/casino/play/${game.code}`;
			body = {};
		} else if (game.code === "LAGOSRUSH") {
			path = "/lagos-rush/launcher";
			body = { game: game.code };
		} else if (HALLA_LAUNCH_PATHS[game.code]) {
			path = HALLA_LAUNCH_PATHS[game.code];
			body = { game: game.code };
		} else {
			path = `/thndr/play/${game.code}`;
			body = {};
		}
	} else {
		const mode = options?.mode ?? "demo";
		path = mode === "real" ? "/slotegrator/launch" : "/slotegrator/launch-demo";
		body = {
			game_uuid: game.code,
			// Bare exit page — avoids nesting the full casino lobby in the game iframe
			// when GIS closes the session immediately.
			return_url: `${window.location.origin}/game-exit`,
			device: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
		};
	}

	const response = await fetch(`${base}${path}`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});

	const data = (await response.json()) as LaunchResponse;

	if (!response.ok || data.success === false) {
		const err = new Error(data.error || "Failed to launch game") as Error & {
			status?: number;
		};
		err.status = response.status;
		throw err;
	}

	const gameUrl = data.data?.url;
	if (!gameUrl) {
		throw new Error("Missing launch URL in response");
	}

	return gameUrl;
}
