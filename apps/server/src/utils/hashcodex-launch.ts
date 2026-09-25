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
 * Build the Hashcodex game URL.
 * Hashcodex connect uses playerId + depositUrl (session deposit). No HMAC env.
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
	return url.toString();
}
