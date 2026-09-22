/** PvP tab: Thundr head-to-head titles. Plinko is Arcade-only. */
export const CLASSIC_THUNDR_CODES = [
	"solitaire",
	"blocks",
	"twentyone",
	"blackjack",
	"slots",
] as const;

/** Thundr originals hidden from the unfiltered All tab. */
export const CLASSIC_HIDDEN_FROM_ALL_CODES = [
	...CLASSIC_THUNDR_CODES,
	"plinko",
] as const;

/**
 * Native / in-house lobby codes (Thndr, LuckyWorld, Lagos Rush, Halla, Crash).
 * Keep in sync with `CLASSIC_KNOWN_GAMES` in classic-lobby.ts.
 */
export const CLASSIC_KNOWN_GAME_CODES = [
	...CLASSIC_HIDDEN_FROM_ALL_CODES,
	"XCAPEHB",
	"EAGLEHB",
	"LUCKYRISEHB",
	"LAGOSRUSH",
	"HALLABOMB",
	"HALLADICE",
	"HALLAMETRONITE",
	"sportsdey-crash",
	"spin_and_win",
] as const;

export function isClassicKnownGameCode(code: string): boolean {
	return (CLASSIC_KNOWN_GAME_CODES as readonly string[]).includes(code);
}
