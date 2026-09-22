/** Shared Casino lobby category helpers (Classic D1 links + Scorpio overlay). */

import { httpsLobbyImageUrl } from "./scorpio-image";

export type LobbyCategory = {
	id: string;
	name: string;
	slug: string;
};

const OTHERS_CATEGORY: LobbyCategory = {
	id: "others",
	name: "Others",
	slug: "others",
};

export function normalizeGameName(name: string): string {
	return name.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Compact slug (lowercase, no _/-) → Casino tab slug.
 * Add aliases here when the same lobby type is stored under several labels.
 */
const LOBBY_SLUG_ALIASES: Record<string, string> = {
	crash: "crash",
	crashgame: "crash",
	crashgames: "crash",
	wheel: "jackpot",
	jackpot: "jackpot",
	lotto: "lottery",
	virtual: "virtuals",
	virtuals: "virtuals",
	virtualsports: "virtuals",
	tablecardgames: "tablecardgames",
	tableandcardgames: "tablecardgames",
	tablegames: "tablecardgames",
	instant: "arcade",
	instantgames: "arcade",
	instantgame: "arcade",
};

/** Map DB / JSON / aggregator slugs onto Casino tab slugs. */
export function canonicalLobbySlug(slug: string): string {
	const compact = slug.toLowerCase().replace(/[_-]/g, "");
	return LOBBY_SLUG_ALIASES[compact] ?? slug.toLowerCase();
}

function mergeCategories(
	into: LobbyCategory[],
	cats: LobbyCategory[],
): LobbyCategory[] {
	const seen = new Set(into.map((c) => c.slug));
	for (const cat of cats) {
		const slug = canonicalLobbySlug(cat.slug);
		if (!slug || seen.has(slug)) continue;
		seen.add(slug);
		into.push({ ...cat, slug });
	}
	return into;
}

function isR2LobbyImage(url: string): boolean {
	return url.includes("bucket.sportsdey.com");
}

function rememberCatalogImage(
	into: Map<string, string>,
	key: string,
	imageUrl: string | null | undefined,
): void {
	if (!key) return;
	const url = httpsLobbyImageUrl(imageUrl);
	if (!url) return;
	const existing = into.get(key);
	if (!existing || (isR2LobbyImage(url) && !isR2LobbyImage(existing))) {
		into.set(key, url);
	}
}

export function overlayScorpioLobbyCategories<
	T extends {
		id: string;
		name: string;
		code: string;
		categories: LobbyCategory[];
		providerId?: number;
		imageUrl?: string | null;
	},
>(
	scorpio: T[],
	catalog: {
		name: string;
		code: string;
		categories?: LobbyCategory[];
		imageUrl?: string | null;
	}[],
): Array<T & { fallbackImageUrl: string | null }> {
	const byName = new Map<string, LobbyCategory[]>();
	const byCode = new Map<string, LobbyCategory[]>();
	const imageByName = new Map<string, string>();
	const imageByCode = new Map<string, string>();
	/** Thundr originals like Plinko must not leak their tabs onto same-named aggregator titles. */
	const skipNameOverlayCodes = new Set(["plinko"]);

	for (const game of catalog) {
		const cats = (game.categories ?? []).map((c) => ({
			...c,
			slug: canonicalLobbySlug(c.slug),
		}));
		const nameKey = normalizeGameName(game.name);
		if (cats.length > 0 && !skipNameOverlayCodes.has(game.code)) {
			byName.set(nameKey, mergeCategories(byName.get(nameKey) ?? [], cats));
			if (game.code) {
				byCode.set(game.code, mergeCategories(byCode.get(game.code) ?? [], cats));
			}
		} else if (cats.length > 0 && game.code) {
			byCode.set(game.code, mergeCategories(byCode.get(game.code) ?? [], cats));
		}
		rememberCatalogImage(imageByName, nameKey, game.imageUrl);
		if (game.code) {
			rememberCatalogImage(imageByCode, game.code, game.imageUrl);
		}
	}

	return scorpio.map((game) => {
		const fromCode =
			byCode.get(game.id) ??
			(game.providerId != null
				? byCode.get(`scorpio:${game.providerId}:${game.code}`)
				: undefined) ??
			byCode.get(game.code);
		const fromName = byName.get(normalizeGameName(game.name));
		const lobby = mergeCategories(
			[...(fromName ?? [])],
			fromCode ?? [],
		);
		const resolved = lobby.length > 0 ? lobby : [OTHERS_CATEGORY];

		const providerCats = game.categories.filter((c) => {
			const slug = canonicalLobbySlug(c.slug);
			return slug.startsWith("type-") || /^\d+$/.test(c.id);
		});

		const liveImage = httpsLobbyImageUrl(game.imageUrl);
		const d1Image =
			imageByCode.get(game.id) ??
			(game.providerId != null
				? imageByCode.get(`scorpio:${game.providerId}:${game.code}`)
				: undefined) ??
			imageByCode.get(game.code) ??
			imageByName.get(normalizeGameName(game.name)) ??
			null;
		const imageUrl = liveImage ?? d1Image;
		const fallbackImageUrl =
			d1Image && d1Image !== imageUrl ? d1Image : null;

		return {
			...game,
			imageUrl,
			fallbackImageUrl,
			categories: mergeCategories([...resolved], providerCats),
		};
	});
}

export function gameMatchesLobbyCategory(
	game: { categories?: LobbyCategory[] },
	category: string,
): boolean {
	const wanted = canonicalLobbySlug(category);
	return (game.categories ?? []).some(
		(c) => canonicalLobbySlug(c.slug) === wanted,
	);
}
