import { eq, inArray, like } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { scorpioGameCode } from "@/utils/scorpio-game-flags";

type Db = ReturnType<typeof drizzle>;

export function catalogCodesForGame(
	gameCode: string,
	provider?: string | null,
	providerId?: number | null,
): string[] {
	const raw = gameCode.trim();
	if (!raw) return [];
	if (raw.startsWith("scorpio:")) return [raw];
	if (provider === "Scorpio") {
		const codes = [raw];
		if (providerId != null && Number.isFinite(Number(providerId))) {
			codes.push(scorpioGameCode(Number(providerId), raw));
		}
		return codes;
	}
	return [raw];
}

export function pickCatalogGameName(
	gameNameByCode: Map<string, string | null | undefined>,
	gameCode: string | null | undefined,
	provider?: string | null,
	providerId?: number | null,
): string | null {
	if (!gameCode?.trim()) return null;
	const raw = gameCode.trim();
	for (const code of [...catalogCodesForGame(raw, provider, providerId)].reverse()) {
		const name = gameNameByCode.get(code);
		if (name) return name;
	}
	const suffix = `:${raw}`;
	for (const [code, name] of gameNameByCode) {
		if (name && code.startsWith("scorpio:") && code.endsWith(suffix)) {
			return name;
		}
	}
	return null;
}

export async function lookupGameName(
	db: Db,
	gameCode: string | null | undefined,
	provider?: string | null,
	providerId?: number | null,
): Promise<string | null> {
	if (!gameCode?.trim()) return null;
	const raw = gameCode.trim();
	const codes = catalogCodesForGame(raw, provider, providerId);
	if (codes.length > 0) {
		const rows = await db
			.select({ code: schema.game.code, name: schema.game.name })
			.from(schema.game)
			.where(codes.length === 1 ? eq(schema.game.code, codes[0]!) : inArray(schema.game.code, codes));
		const byCode = new Map(rows.map((row) => [row.code, row.name]));
		const exact = pickCatalogGameName(byCode, raw, provider, providerId);
		if (exact) return exact;
	}

	if (provider === "Scorpio" && !raw.startsWith("scorpio:")) {
		const [row] = await db
			.select({ name: schema.game.name })
			.from(schema.game)
			.where(like(schema.game.code, `scorpio:%:${raw}`))
			.limit(1);
		if (row?.name) return row.name;
	}

	return null;
}

export async function loadGameNames(
	db: Db,
	tickets: Array<{
		gameCode: string | null;
		provider?: string | null;
		providerId?: number | null;
	}>,
): Promise<Map<string, string | null>> {
	const gameNameByCode = new Map<string, string | null>();
	const lookupCodes = [
		...new Set(
			tickets.flatMap((ticket) =>
				ticket.gameCode
					? catalogCodesForGame(
							ticket.gameCode,
							ticket.provider,
							ticket.providerId,
						)
					: [],
			),
		),
	];
	const chunkSize = 100;
	for (let i = 0; i < lookupCodes.length; i += chunkSize) {
		const chunk = lookupCodes.slice(i, i + chunkSize);
		const rows = await db
			.select({ code: schema.game.code, name: schema.game.name })
			.from(schema.game)
			.where(inArray(schema.game.code, chunk));
		for (const row of rows) {
			gameNameByCode.set(row.code, row.name ?? null);
		}
	}

	const missingScorpio = [
		...new Set(
			tickets
				.filter(
					(ticket) =>
						ticket.provider === "Scorpio" &&
						ticket.gameCode &&
						!pickCatalogGameName(
							gameNameByCode,
							ticket.gameCode,
							ticket.provider,
							ticket.providerId,
						),
				)
				.map((ticket) => ticket.gameCode!.trim()),
		),
	];
	for (const raw of missingScorpio) {
		const [row] = await db
			.select({ code: schema.game.code, name: schema.game.name })
			.from(schema.game)
			.where(like(schema.game.code, `scorpio:%:${raw}`))
			.limit(1);
		if (row?.name) {
			gameNameByCode.set(raw, row.name);
			gameNameByCode.set(row.code, row.name);
		}
	}

	return gameNameByCode;
}
