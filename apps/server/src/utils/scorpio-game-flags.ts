import { eq, like } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";

type Db = ReturnType<typeof drizzle>;

export function scorpioGameCode(providerId: number, gameId: string): string {
	return `scorpio:${providerId}:${String(gameId).trim()}`;
}

function resolveRemoteGameId(game: Record<string, unknown>): string | null {
	const raw = game.gameID ?? game.gameCode;
	if (raw == null) return null;
	const id = String(raw).trim();
	return id || null;
}

export async function loadDisabledScorpioCodes(
	db: Db,
	providerId: number,
): Promise<Set<string>> {
	const prefix = `scorpio:${providerId}:`;
	const rows = await db
		.select({
			code: schema.game.code,
			enabled: schema.game.enabled,
		})
		.from(schema.game)
		.where(like(schema.game.code, `${prefix}%`));

	const disabled = new Set<string>();
	for (const row of rows) {
		if (row.enabled === false && row.code.startsWith(prefix)) {
			disabled.add(row.code);
		}
	}
	return disabled;
}

export async function isScorpioGameDisabled(
	db: Db,
	providerId: number,
	gameId: string,
): Promise<boolean> {
	const code = scorpioGameCode(providerId, gameId);
	const rows = await db
		.select({ enabled: schema.game.enabled })
		.from(schema.game)
		.where(eq(schema.game.code, code));
	return rows.some((row) => row.enabled === false);
}

export function overlayScorpioEnabled<T extends Record<string, unknown>>(
	games: T[],
	providerId: number,
	disabledCodes: Set<string>,
): Array<T & { enabled: boolean }> {
	return games.map((game) => {
		const id = resolveRemoteGameId(game);
		const code = id ? scorpioGameCode(providerId, id) : "";
		return {
			...game,
			enabled: code ? !disabledCodes.has(code) : true,
		};
	});
}
