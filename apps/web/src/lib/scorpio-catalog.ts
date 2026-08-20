import { ApiError, apiRequest } from "@/lib/api";

export type ScorpioProvider = {
	providerId: number;
	providerName: string;
	logo?: string;
	status?: number;
};

export type ScorpioRemoteGame = {
	gameID?: string;
	gameCode?: string;
	gameName?: string;
	/** Some providers (e.g. EGT) return a nested image object instead of a URL string. */
	gameImage?: string | Record<string, unknown>;
	gameType?: number;
	inMaintenance?: boolean;
	status?: number;
	enabled?: boolean;
};

export type ScorpioCategory = {
	id: string;
	name: string;
	slug: string;
};

/** Lobby game shape used by Casino UI, mapped from Scorpio catalog. */
export type ScorpioLobbyGame = {
	id: string;
	name: string;
	code: string;
	imageUrl: string | null;
	categories: ScorpioCategory[];
	enabled: boolean;
	createdAt: number;
	updatedAt: number;
	provider: "scorpio";
	providerId: number;
	providerName: string;
};

function providerSlug(providerId: number, providerName: string): string {
	const base = providerName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return base || `provider-${providerId}`;
}

function gameTypeCategory(gameType: number | undefined): ScorpioCategory | null {
	if (gameType === undefined || gameType === null || Number.isNaN(gameType)) {
		return null;
	}
	return {
		id: `type-${gameType}`,
		name: `Type ${gameType}`,
		slug: `type-${gameType}`,
	};
}

function resolveGameCode(game: ScorpioRemoteGame): string | null {
	const raw = game.gameID || game.gameCode;
	if (raw == null) return null;
	const code = String(raw).trim();
	return code || null;
}

/** Normalize Scorpio thumbnail: plain URL string or nested provider image map. */
function resolveGameImage(gameImage: ScorpioRemoteGame["gameImage"]): string | null {
	if (typeof gameImage === "string") {
		const trimmed = gameImage.trim();
		return trimmed || null;
	}
	if (!gameImage || typeof gameImage !== "object") return null;

	const img = gameImage as {
		mobile?: {
			squareTile?: string;
			icon?: { small?: string; medium?: string };
			verticalTile?: { small?: string; large?: string };
		};
		desktop?: {
			landscapeTile?: string;
			gameCover?: string;
			banner?: { small?: string; medium?: string };
		};
	};
	const candidates = [
		img.mobile?.squareTile,
		img.mobile?.icon?.medium,
		img.mobile?.icon?.small,
		img.desktop?.landscapeTile,
		img.desktop?.gameCover,
		img.desktop?.banner?.medium,
		img.desktop?.banner?.small,
		img.mobile?.verticalTile?.small,
	];
	for (const candidate of candidates) {
		if (typeof candidate === "string" && candidate.trim()) {
			return candidate.trim();
		}
	}
	return null;
}

export function mapScorpioGame(
	game: ScorpioRemoteGame,
	provider: ScorpioProvider,
): ScorpioLobbyGame | null {
	const code = resolveGameCode(game);
	const name =
		typeof game.gameName === "string" ? game.gameName.trim() : null;
	if (!code || !name) return null;

	const providerCat: ScorpioCategory = {
		id: String(provider.providerId),
		name: provider.providerName,
		slug: providerSlug(provider.providerId, provider.providerName),
	};
	const typeCat = gameTypeCategory(game.gameType);
	const categories = typeCat ? [providerCat, typeCat] : [providerCat];

	const disabled =
		game.enabled === false ||
		game.inMaintenance === true ||
		game.status === 0 ||
		provider.status === 0;

	return {
		id: `scorpio:${provider.providerId}:${code}`,
		name,
		code,
		imageUrl: resolveGameImage(game.gameImage),
		categories,
		enabled: !disabled,
		createdAt: 0,
		updatedAt: 0,
		provider: "scorpio",
		providerId: provider.providerId,
		providerName: provider.providerName,
	};
}

const scorpioAuthOpts: RequestInit = { credentials: "include" };

/** Live Scorpio catalog: providers → games per provider → lobby Game[]. */
export async function fetchScorpioLobbyGames(): Promise<ScorpioLobbyGame[]> {
	let providers: ScorpioProvider[];
	try {
		providers = await apiRequest<ScorpioProvider[]>(
			"scorpio/providers",
			scorpioAuthOpts,
		);
	} catch (error) {
		throw error;
	}

	const activeProviders = (providers || []).filter((p) => p.status !== 0);

	const lists = await Promise.all(
		activeProviders.map(async (provider) => {
			try {
				const games = await apiRequest<ScorpioRemoteGame[]>(
					`scorpio/games/${provider.providerId}`,
					scorpioAuthOpts,
				);
				return (games || [])
					.map((game) => mapScorpioGame(game, provider))
					.filter((g): g is ScorpioLobbyGame => g !== null && g.enabled);
			} catch (error) {
				// One provider failing should not empty the whole casino
				console.log("scorpio provider games failed", {
					providerId: provider.providerId,
					error: error instanceof Error ? error.message : "unknown",
				});
				return [] as ScorpioLobbyGame[];
			}
		}),
	);

	return lists.flat();
}

export function buildScorpioCategoryTabs(
	games: ScorpioLobbyGame[],
): ScorpioCategory[] {
	const bySlug = new Map<string, ScorpioCategory>();
	for (const game of games) {
		for (const cat of game.categories) {
			if (!bySlug.has(cat.slug)) bySlug.set(cat.slug, cat);
		}
	}
	return Array.from(bySlug.values()).sort((a, b) =>
		a.name.localeCompare(b.name),
	);
}

export type ScorpioLaunchBody = {
	providerId: number;
	gameCode: string;
	language?: string;
	currency?: string;
	returnUrl?: string;
};

export async function launchScorpioGame(
	body: ScorpioLaunchBody,
): Promise<{ url: string }> {
	const data = await apiRequest<{ url: string; playerCode?: string }>(
		"scorpio/launch",
		{
			method: "POST",
			credentials: "include",
			body: JSON.stringify({
				language: "en",
				currency: "NGN",
				...body,
			}),
		},
	);

	if (!data?.url) {
		throw new ApiError({ message: "Failed to launch game" });
	}

	return { url: data.url };
}
