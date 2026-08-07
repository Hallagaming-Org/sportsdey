/**
 * Stable routes and trigger keywords for mission CTA resolution.
 * Destinations come from Bonus Engine `mission_triggers` + `provider_games`,
 * never from guessing on casino game display names.
 */

export const MISSION_ROUTE = {
	SPORTS: "/sportsbetting",
	CASINO: "/games",
	WALLET: "/wallet",
	ACCOUNT: "/account",
} as const;

export const MISSION_ACTION_LABEL = {
	SPORTS: "Go to Sports",
	CASINO: "Go to Casino",
	VIRTUALS: "Go to Virtuals",
	DEPOSIT: "Deposit Now",
	INVITE: "Invite Now",
	PLAY: "Play Now",
	COMPLETED: "Completed",
	LOCKED: "Locked",
} as const;

/** Query key for deep-linking a mission-configured game on the casino lobby. */
export const MISSION_PLAY_SEARCH_KEY = "play" as const;

/**
 * Trigger-type substrings from Bonus Engine Admin (matched against
 * `mission_triggers[].type` only — not mission titles or game names).
 */
export const MISSION_TRIGGER_KEYWORD = {
	DEPOSIT: /\bdeposit\b/i,
	INVITE: /\b(refer|invite|friend)\b/i,
	VIRTUAL: /\bvirtual\b/i,
	SPORTS: /\b(sportsbook|sporting|sports bet|place bet on sport)\b/i,
	WAGER_OR_BET: /\b(wager|bet|login)\b/i,
} as const;

export const MISSION_REWARD_TYPE = {
	POINTS: "Points",
	REAL_CASH: "Real Cash",
} as const;
