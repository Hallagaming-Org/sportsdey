export const HASHCODEX_GAME_CODES = [
	"sportsdey-crash",
	"spin_and_win",
] as const;

export type HashcodexGameCode = (typeof HASHCODEX_GAME_CODES)[number];

export const DEFAULT_HASHCODEX_LAUNCH_URL =
	"https://binary.sportsdey.com/sportsdayApi/connectSportsDay";

export function isHashcodexGameCode(
	value: string | undefined,
): value is HashcodexGameCode {
	return value === "sportsdey-crash" || value === "spin_and_win";
}

/**
 * Build the Hashcodex game URL with the player id and SportsDey wallet
 * callback so their client can POST /hashcodex/deposit (session) and optionally
 * /hashcodex/wallet and /hashcodex/balance.
 */
export function buildHashcodexLaunchUrl(opts: {
	launchBase?: string;
	playerId: string;
	gameCode: HashcodexGameCode;
	apiUrl: string;
}): string {
	const apiUrl = opts.apiUrl.replace(/\/$/, "");
	const base = opts.launchBase?.trim() || DEFAULT_HASHCODEX_LAUNCH_URL;
	const url = new URL(base);
	url.searchParams.set("type", "casino");
	url.searchParams.set("playerId", opts.playerId);
	url.searchParams.set("gameCode", opts.gameCode);
	url.searchParams.set("apiUrl", apiUrl);
	url.searchParams.set("depositUrl", `${apiUrl}/hashcodex/deposit`);
	url.searchParams.set("walletUrl", `${apiUrl}/hashcodex/wallet`);
	url.searchParams.set("balanceUrl", `${apiUrl}/hashcodex/balance`);
	return url.toString();
}
