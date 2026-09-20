/** Names used by SportsDey's own binary games, which do not have a third-party catalog provider. */
const NATIVE_GAME_NAMES: Record<string, string> = {
	"sportsdey-crash": "SportsDey Crash",
	"spin_and_win": "Spin and Win",
};

function normaliseGameCode(gameCode: string | null | undefined): string {
	return gameCode?.trim().toLowerCase() ?? "";
}

export function nativeCasinoGameName(
	gameCode: string | null | undefined,
): string | null {
	return NATIVE_GAME_NAMES[normaliseGameCode(gameCode)] ?? null;
}

export function nativeCasinoProvider(
	gameCode: string | null | undefined,
): string | null {
	return nativeCasinoGameName(gameCode) ? "SportsDey" : null;
}
