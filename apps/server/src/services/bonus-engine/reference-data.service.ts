import { and, eq } from "drizzle-orm";
import { createDb } from "../../db";
import * as schema from "../../db/schema";
import type { CloudflareBindings } from "../../types";
import { BONUS_ENGINE_FALLBACK_CASINO_PROVIDER } from "./bonus-engine.service.constant";
import { BONUS_ENGINE_SPORTSBOOK_CATALOG } from "./reference-data.service.constant";
import type {
	BonusEngineChampionshipItem,
	BonusEngineEventMarketItem,
	BonusEngineGameItem,
	BonusEngineGameProviderItem,
	BonusEngineSportCategoryItem,
	BonusEngineSportEventItem,
	BonusEngineSportItem,
} from "./reference-data.service.type";

/**
 * Lists distinct casino game providers for Bonus Engine Admin dropdowns.
 * Falls back to a single Casino provider when games lack provider metadata.
 */
export async function listBonusEngineGameProviders(
	env: CloudflareBindings,
): Promise<BonusEngineGameProviderItem[]> {
	const db = createDb(env.DB);
	const rows = await db
		.select({
			providerId: schema.game.providerId,
			providerName: schema.game.providerName,
			isLiveGame: schema.game.isLiveGame,
		})
		.from(schema.game)
		.where(eq(schema.game.enabled, true));

	const providers = new Map<string, BonusEngineGameProviderItem>();
	for (const row of rows) {
		const uniqueId = row.providerId?.trim();
		const name = row.providerName?.trim();
		if (!uniqueId || !name) continue;
		const existing = providers.get(uniqueId);
		providers.set(uniqueId, {
			name,
			unique_id: uniqueId,
			is_live_game:
				row.isLiveGame || existing?.is_live_game === 1
					? 1
					: (existing?.is_live_game ?? 0),
		});
	}

	if (providers.size === 0) {
		return [
			{
				name: BONUS_ENGINE_FALLBACK_CASINO_PROVIDER.name,
				unique_id: BONUS_ENGINE_FALLBACK_CASINO_PROVIDER.uniqueId,
				is_live_game: BONUS_ENGINE_FALLBACK_CASINO_PROVIDER.isLiveGame,
			},
		];
	}

	return [...providers.values()].sort((left, right) =>
		left.name.localeCompare(right.name),
	);
}

/**
 * Lists casino games, optionally filtered by provider unique id.
 */
export async function listBonusEngineGames(payload: {
	env: CloudflareBindings;
	gameProvider?: string;
}): Promise<BonusEngineGameItem[]> {
	const db = createDb(payload.env.DB);
	const providerFilter = payload.gameProvider?.trim();
	const rows = await db
		.select({
			id: schema.game.id,
			name: schema.game.name,
			providerId: schema.game.providerId,
			freeSpin: schema.game.freeSpin,
		})
		.from(schema.game)
		.where(
			providerFilter
				? and(
						eq(schema.game.enabled, true),
						eq(schema.game.providerId, providerFilter),
					)
				: eq(schema.game.enabled, true),
		);

	const fallbackId = BONUS_ENGINE_FALLBACK_CASINO_PROVIDER.uniqueId;

	if (providerFilter === fallbackId) {
		return rows
			.filter((row) => !row.providerId?.trim())
			.map((row) => ({
				provider_unique_id: fallbackId,
				name: row.name,
				unique_id: row.id,
				free_spin: row.freeSpin ? 1 : 0,
			}));
	}

	return rows.map((row) => ({
		provider_unique_id: row.providerId?.trim() || fallbackId,
		name: row.name,
		unique_id: row.id,
		free_spin: row.freeSpin ? 1 : 0,
	}));
}

/** Returns sportsbook sports for Admin dropdowns. */
export function listBonusEngineSports(): BonusEngineSportItem[] {
	return BONUS_ENGINE_SPORTSBOOK_CATALOG.sports.map((sport) => ({
		SportId: sport.SportId,
		Name: sport.Name,
	}));
}

/** Returns sport categories, optionally filtered by sport/category id. */
export function listBonusEngineSportCategories(payload: {
	sportId?: string;
	categoryId?: string;
}): BonusEngineSportCategoryItem[] {
	const sportId = parseOptionalInt(payload.sportId);
	const categoryId = parseOptionalInt(payload.categoryId);

	return BONUS_ENGINE_SPORTSBOOK_CATALOG.categories
		.filter((category) => {
			if (sportId !== null && category.sportId !== sportId) return false;
			if (categoryId !== null && category.categoryId !== categoryId) {
				return false;
			}
			return true;
		})
		.map((category) => ({
			categoryId: category.categoryId,
			name: category.name,
		}));
}

/** Returns championships/leagues for Admin dropdowns. */
export function listBonusEngineChampionships(payload: {
	sportId?: string;
	categoryId?: string;
	championshipId?: string;
}): BonusEngineChampionshipItem[] {
	const sportId = parseOptionalInt(payload.sportId);
	const categoryId = parseOptionalInt(payload.categoryId);
	const championshipId = parseOptionalInt(payload.championshipId);

	return BONUS_ENGINE_SPORTSBOOK_CATALOG.championships
		.filter((championship) => {
			if (sportId !== null && championship.sportId !== sportId) return false;
			if (categoryId !== null && championship.categoryId !== categoryId) {
				return false;
			}
			if (
				championshipId !== null &&
				championship.championshipId !== championshipId
			) {
				return false;
			}
			return true;
		})
		.map((championship) => ({
			championshipId: championship.championshipId,
			name: championship.name,
		}));
}

/** Returns sport events for Admin dropdowns. */
export function listBonusEngineSportEvents(payload: {
	sportId?: string;
	categoryId?: string;
	championshipId?: string;
}): BonusEngineSportEventItem[] {
	const sportId = parseOptionalInt(payload.sportId);
	const categoryId = parseOptionalInt(payload.categoryId);
	const championshipId = parseOptionalInt(payload.championshipId);

	return BONUS_ENGINE_SPORTSBOOK_CATALOG.events
		.filter((event) => {
			if (sportId !== null && event.sportId !== sportId) return false;
			if (categoryId !== null && event.categoryId !== categoryId) return false;
			if (
				championshipId !== null &&
				event.championshipId !== championshipId
			) {
				return false;
			}
			return true;
		})
		.map((event) => ({
			EventId: event.EventId,
			EventName: event.EventName,
		}));
}

/** Returns markets for a sport event (or all stub markets). */
export function listBonusEngineEventMarkets(payload: {
	eventId?: string;
}): BonusEngineEventMarketItem[] {
	const eventId = parseOptionalInt(payload.eventId);
	return BONUS_ENGINE_SPORTSBOOK_CATALOG.markets
		.filter((market) => eventId === null || market.EventId === eventId)
		.map((market) => ({
			EventId: market.EventId,
			EventName: market.EventName,
			MarketId: market.MarketId,
			MarketName: market.MarketName,
		}));
}

function parseOptionalInt(value: string | undefined): number | null {
	if (!value?.trim()) return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}
