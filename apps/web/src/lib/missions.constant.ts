export const MISSION_ROUTE = {
	SPORTS: "/sportsbetting",
	SPORTS_SPLAT: "/sportsbetting/$",
	CASINO: "/games",
	WALLET: "/wallet",
	ACCOUNT: "/account",
	INVITE: "/account#account-referral-id",
} as const;

/** Data.Bet prematch football lobby (SportsDey basename `/sportsbetting`). */
export const MISSION_SPORTSBOOK_FOOTBALL_PREMATCH =
	"sports/prematch/football";

export const MISSION_SPORTSBOOK_PATH_FIELD = "sportsbook_path";

export function isDatabetTournamentGin(id: string): boolean {
	const value = id.trim();
	return /:gin:/i.test(value) || /^betting:\d+:/i.test(value);
}

export function sportsbookHrefFromSplat(splat: string): string {
	return `${MISSION_ROUTE.SPORTS}/${splat.replace(/^\/+/, "")}`;
}

export function sportsbookSplatFromHref(href: string): string | undefined {
	const prefix = `${MISSION_ROUTE.SPORTS}/`;
	if (!href.startsWith(prefix)) return undefined;
	const splat = href.slice(prefix.length).split("#")[0]?.replace(/\/+$/, "");
	if (!splat) return undefined;
	try {
		return decodeURIComponent(splat);
	} catch {
		return splat;
	}
}

export function sportsbookTournamentSplat(tournamentId: string): string {
	return `${MISSION_SPORTSBOOK_FOOTBALL_PREMATCH}/tournament/${tournamentId.trim()}`;
}

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

export const MISSION_PLAY_SEARCH_KEY = "play" as const;

export const MISSION_PLACEHOLDER_UNIQUE_IDS = new Set([
	"provider_id",
	"game_id",
	"provider_name",
]);

export const MISSION_TRIGGER_KEYWORD = {
	DEPOSIT: /\bdeposit\b/i,
	INVITE: /\b(refer|invite|friend)\b/i,
	VIRTUAL: /\bvirtual\b/i,
	SPORTS:
		/\b(sportsbook|sporting|sports bet|place bet on sport|bet on specific provider\/game\/sport|\/sport\/odd\/market\/event)\b/i,
	WAGER_OR_BET: /\b(wager|bet|login)\b/i,
} as const;

export const MISSION_REWARD_TYPE = {
	POINTS: "Points",
	REAL_CASH: "Real Cash",
} as const;
