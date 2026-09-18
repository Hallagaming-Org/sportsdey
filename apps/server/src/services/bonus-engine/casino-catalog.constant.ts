/**
 * Sportsdey-hosted casino providers.
 *
 * Slotegrator rows in D1 `game` carry their own `provider_id`/`provider_name`,
 * so Admin can target them directly. Our in-house and direct-integration games
 * are seeded without provider metadata, which left them invisible to the Admin
 * dropdowns and unreportable as anything but the generic `casino` provider.
 *
 * This catalog is the single source of truth for both sides: the reference-data
 * dropdowns Admin picks from, and the `provider_id`/`game_id` we send on
 * `POST /bet`. Keep game codes in sync with `cli/seed-games.ts`.
 */
export type BonusEngineNativeCasinoProvider = {
	name: string;
	uniqueId: string;
	isLiveGame: 0 | 1;
	/** D1 `game.code` values this provider owns. */
	gameCodes: readonly string[];
};

/** Stable `provider_id` values reported by each provider callback route. */
export const BONUS_ENGINE_NATIVE_PROVIDER_ID = {
	LAGOS_RUSH: "lagos-rush",
	HALLA: "halla",
	LUCKYWORLD: "luckyworld",
	THNDR: "thndr",
	SPORTSDEY_ORIGINALS: "sportsdey-originals",
	SWIPEGAMES: "swipegames",
} as const;

export const BONUS_ENGINE_NATIVE_CASINO_PROVIDERS: readonly BonusEngineNativeCasinoProvider[] =
	[
		{
			name: "Lagos Rush",
			uniqueId: BONUS_ENGINE_NATIVE_PROVIDER_ID.LAGOS_RUSH,
			isLiveGame: 0,
			gameCodes: ["LAGOSRUSH"],
		},
		{
			name: "Halla Mini Games",
			uniqueId: BONUS_ENGINE_NATIVE_PROVIDER_ID.HALLA,
			isLiveGame: 0,
			gameCodes: ["HALLABOMB", "HALLADICE", "HALLAMETRONITE"],
		},
		{
			name: "LuckyWorld Games",
			uniqueId: BONUS_ENGINE_NATIVE_PROVIDER_ID.LUCKYWORLD,
			isLiveGame: 0,
			gameCodes: ["XCAPEHB", "EAGLEHB", "LUCKYRISEHB"],
		},
		{
			name: "Thndr Games",
			uniqueId: BONUS_ENGINE_NATIVE_PROVIDER_ID.THNDR,
			isLiveGame: 0,
			gameCodes: [
				"solitaire",
				"blocks",
				"twentyone",
				"blackjack",
				"slots",
				"plinko",
			],
		},
		{
			name: "Sportsdey Originals",
			uniqueId: BONUS_ENGINE_NATIVE_PROVIDER_ID.SPORTSDEY_ORIGINALS,
			isLiveGame: 0,
			gameCodes: ["sportsdey-crash", "spin_and_win"],
		},
	] as const;

const nativeProviderByGameCode = new Map<
	string,
	BonusEngineNativeCasinoProvider
>(
	BONUS_ENGINE_NATIVE_CASINO_PROVIDERS.flatMap((provider) =>
		provider.gameCodes.map((code) => [code.toLowerCase(), provider] as const),
	),
);

const nativeProviderById = new Map<string, BonusEngineNativeCasinoProvider>(
	BONUS_ENGINE_NATIVE_CASINO_PROVIDERS.map(
		(provider) => [provider.uniqueId, provider] as const,
	),
);

/** Resolves the owning provider for a D1 `game.code`, case-insensitively. */
export function nativeCasinoProviderByGameCode(
	gameCode?: string | null,
): BonusEngineNativeCasinoProvider | undefined {
	const code = gameCode?.trim().toLowerCase();
	if (!code) return undefined;
	return nativeProviderByGameCode.get(code);
}

export function nativeCasinoProviderById(
	uniqueId?: string | null,
): BonusEngineNativeCasinoProvider | undefined {
	const id = uniqueId?.trim();
	if (!id) return undefined;
	return nativeProviderById.get(id);
}
