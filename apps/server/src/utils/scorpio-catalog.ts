/** Slim Scorpio catalog used by admin game management and lobby prefetch. */

export type ScorpioCatalogProvider = {
	providerId: number;
	providerName: string;
	status?: number;
};

export type ScorpioCatalogRemoteGame = {
	gameID?: string;
	gameCode?: string;
	gameName?: string;
	gameImage?: string | Record<string, unknown>;
	gameType?: number;
	inMaintenance?: boolean;
	status?: number;
	enabled?: boolean;
};

export type ScorpioCatalogGame = {
	providerId: number;
	providerName: string;
	gameId: string;
	name: string;
	imageUrl: string | null;
	inMaintenance: boolean;
	enabled: boolean;
};

export function httpsCatalogImageUrl(
	value: string | null | undefined,
): string | null {
	if (!value) return null;
	const trimmed = value.trim();
	if (/^https:\/\//i.test(trimmed)) return trimmed;
	if (/^http:\/\//i.test(trimmed)) {
		return `https://${trimmed.slice("http://".length)}`;
	}
	return null;
}

function firstHttpUrl(value: unknown): string | null {
	if (typeof value === "string") {
		return httpsCatalogImageUrl(value);
	}
	if (!value || typeof value !== "object") return null;
	if (Array.isArray(value)) {
		for (const item of value) {
			const found = firstHttpUrl(item);
			if (found) return found;
		}
		return null;
	}
	for (const nested of Object.values(value as Record<string, unknown>)) {
		const found = firstHttpUrl(nested);
		if (found) return found;
	}
	return null;
}

export function resolveScorpioCatalogImage(
	gameImage: ScorpioCatalogRemoteGame["gameImage"],
): string | null {
	if (typeof gameImage === "string") {
		return httpsCatalogImageUrl(gameImage);
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
		const url = httpsCatalogImageUrl(
			typeof candidate === "string" ? candidate : null,
		);
		if (url) return url;
	}
	return firstHttpUrl(gameImage);
}

export function resolveScorpioCatalogGameId(
	game: ScorpioCatalogRemoteGame,
): string | null {
	const raw = game.gameID || game.gameCode;
	if (raw == null) return null;
	const code = String(raw).trim();
	return code || null;
}

export function mapScorpioCatalogGames(
	provider: ScorpioCatalogProvider,
	games: ScorpioCatalogRemoteGame[],
): ScorpioCatalogGame[] {
	const mapped: ScorpioCatalogGame[] = [];
	for (const game of games) {
		const gameId = resolveScorpioCatalogGameId(game);
		const name = typeof game.gameName === "string" ? game.gameName.trim() : "";
		if (!gameId || !name) continue;
		mapped.push({
			providerId: provider.providerId,
			providerName: provider.providerName,
			gameId,
			name,
			imageUrl: resolveScorpioCatalogImage(game.gameImage),
			inMaintenance: game.inMaintenance === true,
			enabled:
				game.enabled !== false &&
				game.inMaintenance !== true &&
				game.status !== 0,
		});
	}
	return mapped;
}

export async function mapInBatches<T, R>(
	items: T[],
	batchSize: number,
	mapper: (item: T) => Promise<R>,
): Promise<R[]> {
	const out: R[] = [];
	const size = Math.max(1, batchSize);
	for (let i = 0; i < items.length; i += size) {
		const batch = items.slice(i, i + size);
		out.push(...(await Promise.all(batch.map(mapper))));
	}
	return out;
}
