import type { GameInfo } from "./types";

export type SwipeGamesLobbyCategory = {
	id: string;
	name: string;
	slug: string;
};

export type SwipeGamesLobbyGame = {
	id: string;
	name: string;
	code: string;
	imageUrl: string | null;
	categories: SwipeGamesLobbyCategory[];
	enabled: boolean;
	createdAt: number;
	updatedAt: number;
	provider: "swipegames";
	hasFreeSpins: boolean;
};

function joinImageUrl(baseURL: string, path: string): string | null {
	const base = baseURL.trim();
	const relative = path.trim();
	if (!base || !relative) return null;
	if (relative.startsWith("http://") || relative.startsWith("https://")) {
		return relative;
	}
	if (base.endsWith("/") && relative.startsWith("/")) {
		return `${base}${relative.slice(1)}`;
	}
	if (!base.endsWith("/") && !relative.startsWith("/")) {
		return `${base}/${relative}`;
	}
	return `${base}${relative}`;
}

export function mapSwipeGamesLobbyGame(
	game: GameInfo,
): SwipeGamesLobbyGame | null {
	const id = game.id?.trim();
	const title = game.title?.trim();
	if (!id || !title) return null;
	const images = game.images;
	const imageUrl =
		joinImageUrl(images.baseURL, images.square) ??
		joinImageUrl(images.baseURL, images.widescreen) ??
		joinImageUrl(images.baseURL, images.horizontal);
	return {
		id: `swipegames:${id}`,
		name: title,
		code: id,
		imageUrl,
		categories: [
			{ id: "swipegames", name: "Swipe Games", slug: "swipegames" },
			{ id: "slots", name: "Slots", slug: "slots" },
		],
		enabled: true,
		createdAt: 0,
		updatedAt: 0,
		provider: "swipegames",
		hasFreeSpins: Boolean(game.hasFreeSpins),
	};
}
