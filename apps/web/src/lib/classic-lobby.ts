import type { ComponentType } from "react";
import { apiRequest } from "@/lib/api";
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
	"crash-games",
	"original",
	"pvp",
	"slots",
	"tablecardgames",
	"arcade",
	"classic",
	"bingo",
	"dice",
	"jackpot",
	"lottery",
	"others",
	"roulette",
	"scratch",
] as const;

export const CLASSIC_CATEGORY_EMOJIS: Record<string, string> = {
	popular: "🔥",
	"crash-games": "🚀",
	original: "🎯",
	pvp: "⚔️",
	slots: "🎰",
	tablecardgames: "🃏",
	arcade: "🕹️",
	classic: "👑",
	bingo: "🎱",
	dice: "🎲",
	jackpot: "💰",
	lottery: "🎟️",
	others: "🧩",
	roulette: "🎡",
	scratch: "🎫",
};

const POPULAR_GAME_NAMES = [
	"Aviator",
	"Lagos Rush",
	"Penalty Shoot Out",
	"Sweet Bonanza",
	"Mines",
	"Plinko",
	"Gates of Olympus",
	"High Flyer",
	"Keno",
	"Big Bass Splash",
	"Baccarat",
	"JetX",
	"Helicopter X",
	"Balloon",
	"Xcape",
	"Hi Lo",
	"Blocks",
	"Eagle",
	"Avia Rush",
	"Avia Masters",
	"Roulette",
	"Space",
	"Wild Fortune",
	"Mystic Fortune",
	"Football X",
	"Greyhound",
	"Car Racing",
	"Crash X",
];

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
];

export const CLASSIC_THUNDR_CODES = [
	"solitaire",
	"blocks",
	"twentyone",
	"blackjack",
	"slots",
	"plinko",
];

export const CLASSIC_ORIGINALS_CODES = ["LAGOSRUSH", "sportsdey-crash"];

export const CLASSIC_SPECIAL_CATEGORIES = ["popular", "pvp", "original"];

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
		gradient: "linear-gradient(to bottom, #1e3a5f, #2d5a87, #4a90d9)",
	},
	blocks: {
		subtitle: "puzzle game",
		icon: BlocksLogo,
		gradient: "linear-gradient(to bottom, #ff6b35, #f7931e, #ffcc00)",
	},
	twentyone: {
		subtitle: "card game",
		icon: TwentyOneLogo,
		gradient: "linear-gradient(to bottom, #1a1a2e, #16213e, #0f3460)",
	},
	blackjack: {
		subtitle: "card game",
		icon: BlackjackLogo,
		gradient: "linear-gradient(to bottom, #2d2d2d, #4a4a4a, #6b6b6b)",
	},
	slots: {
		subtitle: "slot machine",
		icon: SlotsLogo,
		gradient: "linear-gradient(to bottom, #7b1fa2, #9c27b0, #ba68c8)",
	},
	plinko: {
		subtitle: "lucky drop",
		icon: PlinkoLogo,
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
		image: "/lagos-rush.png",
		gradient: "linear-gradient(to bottom, #ff6b35, #f7931e, #ffcc00)",
	},
	"sportsdey-crash": {
		subtitle: "sportsdey original",
		image: "/sportsdey-crash.jpeg",
		gradient: "linear-gradient(to bottom, #ff6b35, #f7931e, #ffcc00)",
	},
};

const SPORTSDEY_CRASH_URL =
	"https://binary.sportsdey.com/sportsdayApi/connectSportsDay?type=casino";

export function getUniquePopularGames(
	games: ClassicLobbyGame[],
	limit: number,
): ClassicLobbyGame[] {
	const result: ClassicLobbyGame[] = [];
	const addedIds = new Set<string>();
	for (const popName of POPULAR_GAME_NAMES) {
		if (result.length >= limit) break;
		const match = games.find(
			(g) =>
				!addedIds.has(g.id) &&
				g.name.toLowerCase().includes(popName.toLowerCase()),
		);
		if (match) {
			result.push(match);
			addedIds.add(match.id);
		}
	}
	return result;
}

export async function fetchClassicLobbyGames(): Promise<ClassicLobbyGame[]> {
	const games = await apiRequest<ClassicLobbyGame[]>("games");
	const enabled = games.filter((game) => game.enabled);
	return enabled;
}

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
						CLASSIC_THUNDR_CODES.includes(g.code),
					);
					break;
				case "crash-games":
					filtered = allGames.filter((g) =>
						g.name.toLowerCase().includes("aviator"),
					);
					break;
				case "original":
					filtered = allGames.filter((g) =>
						CLASSIC_ORIGINALS_CODES.includes(g.code),
					);
					break;
				default:
					break;
			}
		} else {
			filtered = allGames.filter((g) =>
				g.categories?.some((c) => c.slug === selectedCategory),
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
						CLASSIC_THUNDR_CODES.includes(g.code),
					).length;
					break;
				case "crash-games":
					acc[cat] = allGames.filter((g) =>
						g.name.toLowerCase().includes("aviator"),
					).length;
					break;
				case "original":
					acc[cat] = allGames.filter((g) =>
						CLASSIC_ORIGINALS_CODES.includes(g.code),
					).length;
					break;
				default:
					acc[cat] = 0;
			}
		} else {
			acc[cat] = allGames.filter((g) =>
				g.categories?.some((c) => c.slug === cat),
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

/**
 * Launch a Classic (Slotegrator / Thndr / Lagos Rush / LuckyWorld) game.
 * Returns null when the game opens in a new tab (sportsdey-crash).
 */
export async function launchClassicGame(
	game: ClassicLobbyGame,
): Promise<string | null> {
	if (game.code === "sportsdey-crash") {
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
		} else {
			path = `/thndr/play/${game.code}`;
			body = {};
		}
	} else {
		path = "/slotegrator/launch";
		body = { game_uuid: game.code };
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
