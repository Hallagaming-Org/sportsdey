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
