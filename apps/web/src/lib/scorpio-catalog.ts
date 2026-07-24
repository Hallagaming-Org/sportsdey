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
	gameImage?: string;
	gameType?: number;
	inMaintenance?: boolean;
	status?: number;
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
	const code = game.gameID || game.gameCode;
	return code?.trim() ? code : null;
}

export function mapScorpioGame(
	game: ScorpioRemoteGame,
	provider: ScorpioProvider,
): ScorpioLobbyGame | null {
	const code = resolveGameCode(game);
	const name = game.gameName?.trim();
	if (!code || !name) return null;

	const providerCat: ScorpioCategory = {
		id: String(provider.providerId),
		name: provider.providerName,
		slug: providerSlug(provider.providerId, provider.providerName),
	};
	const typeCat = gameTypeCategory(game.gameType);
	const categories = typeCat ? [providerCat, typeCat] : [providerCat];

	const disabled =
		game.inMaintenance === true ||
		game.status === 0 ||
		provider.status === 0;

	return {
		id: `scorpio:${provider.providerId}:${code}`,
		name,
		code,
		imageUrl: game.gameImage?.trim() || null,
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
	const providers = await apiRequest<ScorpioProvider[]>(
		"scorpio/providers",
		scorpioAuthOpts,
	);
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
				if (error instanceof ApiError && error.status === 401) throw error;
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
		throw new ApiError("Failed to launch game");
	}

	return { url: data.url };
}
