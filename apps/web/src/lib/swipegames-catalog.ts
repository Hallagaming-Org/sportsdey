import { apiRequest } from "@/lib/api";
import { resolveServerUrl } from "@/lib/server-url";

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
	hasFreeSpins?: boolean;
};

export function isSwipeGamesGame(
	game: { provider?: string },
): game is SwipeGamesLobbyGame {
	return game.provider === "swipegames";
}

export async function fetchSwipeGamesLobbyGames(): Promise<
	SwipeGamesLobbyGame[]
> {
	try {
		const games = await apiRequest<SwipeGamesLobbyGame[]>("swipegames/games");
		return (games || []).filter((game) => game.enabled !== false);
	} catch {
		return [];
	}
}

export async function launchSwipeGamesGame(input: {
	gameId: string;
	mode?: "demo" | "real";
}): Promise<string> {
	const base = resolveServerUrl();
	const path =
		input.mode === "real" ? "/swipegames/launch" : "/swipegames/launch-demo";
	const device = /Mobi|Android/i.test(navigator.userAgent)
		? "mobile"
		: "desktop";
	const response = await fetch(`${base}${path}`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			gameId: input.gameId,
			device,
			returnUrl: `${window.location.origin}/game-exit`,
			demo: input.mode !== "real",
		}),
	});
	const data = (await response.json()) as {
		success?: boolean;
		data?: { url?: string };
		error?: string;
	};
	if (!response.ok || data.success === false || !data.data?.url) {
		const err = new Error(data.error || "Failed to launch game") as Error & {
			status?: number;
		};
		err.status = response.status;
		throw err;
	}
	return data.data.url;
}
