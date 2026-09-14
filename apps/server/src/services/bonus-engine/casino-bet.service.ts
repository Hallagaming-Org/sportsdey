import { eq, or } from "drizzle-orm";
import type { ExecutionContext } from "hono";
import { createDb } from "../../db";
import * as schema from "../../db/schema";
import type { CloudflareBindings } from "../../types";
import {
	BONUS_ENGINE_FALLBACK_CASINO_PROVIDER,
	BONUS_ENGINE_PRODUCT_TYPE,
} from "./bonus-engine.service.constant";
import { nativeCasinoProviderByGameCode } from "./casino-catalog.constant";
import {
	reportBonusEngineBet,
	runBonusEngineBackground,
} from "./events.service";

export type CasinoCatalogGame = {
	id: string;
	code: string | null;
	providerId: string | null;
};

export type CasinoBetIdentity = {
	providerId: string;
	gameId?: string;
};

/**
 * Picks the `provider_id`/`game_id` pair for `POST /bet`.
 *
 * Admin builds mission rules from the same ids that `reference-data.service`
 * serves, so this must agree with it: Slotegrator's own provider id when the
 * catalog row has one, otherwise the native provider that owns the game code,
 * otherwise the calling route's provider.
 */
export function resolveCasinoBetIdentity(payload: {
	gameRef?: string | null;
	catalogGame?: CasinoCatalogGame | null;
	fallbackProviderId?: string;
}): CasinoBetIdentity {
	const gameRef = payload.gameRef?.trim() || undefined;
	const catalogProviderId = payload.catalogGame?.providerId?.trim();
	const catalogCode = payload.catalogGame?.code?.trim() || undefined;
	const catalogGameId = catalogCode ?? payload.catalogGame?.id.trim();

	if (catalogProviderId) {
		return { providerId: catalogProviderId, gameId: catalogGameId ?? gameRef };
	}

	const native =
		nativeCasinoProviderByGameCode(catalogCode) ??
		nativeCasinoProviderByGameCode(gameRef);
	if (native) {
		return { providerId: native.uniqueId, gameId: catalogGameId ?? gameRef };
	}

	const fallbackProviderId = payload.fallbackProviderId?.trim();
	return {
		providerId:
			fallbackProviderId || BONUS_ENGINE_FALLBACK_CASINO_PROVIDER.uniqueId,
		gameId: catalogGameId ?? gameRef,
	};
}

/** Bonus Engine amounts are major units; provider ledgers are kobo. */
export function casinoBetAmountFromKobo(amountKobo: number): number {
	return Math.round(amountKobo) / 100;
}

async function findCasinoCatalogGame(
	env: CloudflareBindings,
	gameRef?: string | null,
): Promise<CasinoCatalogGame | null> {
	const ref = gameRef?.trim();
	if (!ref) return null;

	const db = createDb(env.DB);
	const [row] = await db
		.select({
			id: schema.game.id,
			code: schema.game.code,
			providerId: schema.game.providerId,
		})
		.from(schema.game)
		.where(or(eq(schema.game.code, ref), eq(schema.game.id, ref)))
		.limit(1);

	return row ?? null;
}

export type CasinoBetReport = {
	env: CloudflareBindings;
	userId: string;
	betId: string;
	/** Major units (naira), not kobo. */
	amount: number;
	currency?: string;
	/** Provider game code or uuid, when the callback carries one. */
	gameRef?: string | null;
	/** Provider id to report when the game is not in the D1 catalog. */
	fallbackProviderId?: string;
};

/**
 * Reports one casino bet so Bonus Engine can advance mission progress.
 * Never throws — a provider callback must not fail because Bonus Engine is down.
 */
export async function reportCasinoBet(report: CasinoBetReport): Promise<void> {
	try {
		const catalogGame = await findCasinoCatalogGame(report.env, report.gameRef);
		const identity = resolveCasinoBetIdentity({
			gameRef: report.gameRef,
			catalogGame,
			fallbackProviderId: report.fallbackProviderId,
		});

		const result = await reportBonusEngineBet({
			env: report.env,
			bet: {
				userId: report.userId,
				betId: report.betId,
				amount: report.amount,
				productType: BONUS_ENGINE_PRODUCT_TYPE.CASINO,
				currency: report.currency,
				providerId: identity.providerId,
				gameId: identity.gameId,
			},
		});

		if (!result.ok) {
			console.error("Bonus Engine casino bet report failed", {
				betId: report.betId,
				userId: report.userId,
				providerId: identity.providerId,
				gameId: identity.gameId,
				status: result.status,
				error: result.error,
			});
		}
	} catch (error) {
		console.error("Bonus Engine casino bet report error", {
			betId: report.betId,
			userId: report.userId,
			error,
		});
	}
}

/**
 * Reads `executionCtx` off a Hono context without throwing.
 *
 * Hono's getter throws when the request arrived without an ExecutionContext
 * (direct `app.request()` calls, some runtimes). Reporting a bet must never be
 * the reason a provider's wallet callback 500s, so fall back to awaiting.
 */
export function optionalExecutionCtx(
	context: unknown,
): ExecutionContext | undefined {
	try {
		const executionCtx = (context as { executionCtx?: ExecutionContext })
			?.executionCtx;
		return typeof executionCtx?.waitUntil === "function"
			? executionCtx
			: undefined;
	} catch {
		return undefined;
	}
}

/**
 * Fire-and-forget wrapper for provider callbacks. Uses `waitUntil` when the
 * Worker runtime provides it so the provider gets its wallet response promptly.
 */
export async function reportCasinoBetInBackground(
	report: CasinoBetReport & { executionCtx: ExecutionContext | undefined },
): Promise<void> {
	const { executionCtx, ...rest } = report;
	await runBonusEngineBackground(executionCtx, reportCasinoBet(rest));
}
