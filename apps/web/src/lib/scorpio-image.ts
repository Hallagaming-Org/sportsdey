/** Nested Scorpio / EGT thumbnail maps or a plain URL. */
export type ScorpioGameImage =
	| string
	| Record<string, unknown>
	| undefined
	| null;

/** Absolute https thumbnail only — relative / http srcs 404 or mixed-content block. */
export function httpsLobbyImageUrl(value: string | null | undefined): string | null {
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
		return httpsLobbyImageUrl(value);
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

/** Normalize Scorpio thumbnail: plain URL string or nested provider image map. */
export function resolveScorpioGameImage(
	gameImage: ScorpioGameImage,
): string | null {
	if (typeof gameImage === "string") {
		return httpsLobbyImageUrl(gameImage);
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
		const url = httpsLobbyImageUrl(
			typeof candidate === "string" ? candidate : null,
		);
		if (url) return url;
	}
	return firstHttpUrl(gameImage);
}
