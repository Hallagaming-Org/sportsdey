export type CollapsibleGame = {
	id: string;
	name: string;
	code: string;
	imageUrl: string | null;
	enabled: boolean;
	createdAt: string;
	updatedAt: string;
	categories: { id: string; name: string; slug: string }[];
};

/** One row per code. Any disabled duplicate wins so admin kill-switches stick. */
export function collapseGamesByCode<T extends CollapsibleGame>(games: T[]): T[] {
	const byCode = new Map<string, T>();
	for (const game of games) {
		const existing = byCode.get(game.code);
		if (!existing) {
			byCode.set(game.code, {
				...game,
				categories: [...game.categories],
			});
			continue;
		}
		const categories = [
			...new Map(
				[...existing.categories, ...game.categories].map((category) => [
					category.slug,
					category,
				]),
			).values(),
		];
		const preferIncoming =
			(existing.enabled && !game.enabled) ||
			(existing.enabled === game.enabled &&
				game.updatedAt >= existing.updatedAt);
		const chosen = preferIncoming ? game : existing;
		byCode.set(game.code, {
			...chosen,
			enabled: existing.enabled && game.enabled,
			categories,
		});
	}
	return [...byCode.values()];
}
