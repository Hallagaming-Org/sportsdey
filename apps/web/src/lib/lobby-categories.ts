/** Shared Casino lobby category helpers (Classic D1 links + Scorpio overlay). */

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

/** Map DB / JSON slugs onto Casino tab slugs. */
export function canonicalLobbySlug(slug: string): string {
	const compact = slug.toLowerCase().replace(/[_-]/g, "");
	if (compact === "crashgames") return "crash-games";
	if (
		compact === "tablecardgames" ||
		compact === "tableandcardgames" ||
		compact === "tablegames"
	) {
		return "tablecardgames";
	}
	return slug.toLowerCase();
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

export function overlayScorpioLobbyCategories<
	T extends {
		id: string;
		name: string;
		code: string;
		categories: LobbyCategory[];
		providerId?: number;
	},
>(
	scorpio: T[],
	catalog: { name: string; code: string; categories?: LobbyCategory[] }[],
): T[] {
	const byName = new Map<string, LobbyCategory[]>();
	const byCode = new Map<string, LobbyCategory[]>();

	for (const game of catalog) {
		const cats = (game.categories ?? []).map((c) => ({
			...c,
			slug: canonicalLobbySlug(c.slug),
		}));
		if (cats.length === 0) continue;
		const nameKey = normalizeGameName(game.name);
		byName.set(nameKey, mergeCategories(byName.get(nameKey) ?? [], cats));
		if (game.code) {
			byCode.set(game.code, mergeCategories(byCode.get(game.code) ?? [], cats));
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

		return {
			...game,
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
