import { and, eq, isNotNull, ne } from "drizzle-orm";
import { createDb } from "../../db";
import * as schema from "../../db/schema";
import type { CloudflareBindings } from "../../types";
import { databetFetch } from "../../utils/databet-fetch";
import {
	BONUS_ENGINE_DATABET_FOOTBALL_SPORT,
	BONUS_ENGINE_DATABET_TOURNAMENTS_PATH,
	BONUS_ENGINE_SPORTSBOOK_CATALOG,
	BONUS_ENGINE_TOP_EUROPEAN_CHAMPIONSHIPS,
	matchTopEuropeanChampionship,
} from "./reference-data.service.constant";
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
 * Lists distinct casino providers for Bonus Engine Admin dropdowns.
 * Only returns rows with real Slotegrator `provider_id` + `provider_name`.
 * Returns [] when the catalog has not been synced yet (never invents placeholders).
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

	return [...providers.values()].sort((left, right) =>
		left.name.localeCompare(right.name),
	);
}

/**
 * Lists casino games that have real provider metadata, optionally filtered
 * by Slotegrator provider id (`gameProvider` query = provider `unique_id`).
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
				: and(
						eq(schema.game.enabled, true),
						isNotNull(schema.game.providerId),
						ne(schema.game.providerId, ""),
					),
		);

	return rows.flatMap((row) => {
		const providerId = row.providerId?.trim();
		if (!providerId) return [];
		return [
			{
				provider_unique_id: providerId,
				name: row.name,
				unique_id: row.id,
				free_spin: row.freeSpin ? 1 : 0,
			},
		];
	});
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

/**
 * Returns top-6 European championships for Admin dropdowns.
 * Uses Data.Bet tournament ids when the sportsbook proxy is configured so
 * Championship ID equals `POST /bet` `league_id`.
 */
export async function listBonusEngineChampionships(payload: {
	env?: CloudflareBindings;
	sportId?: string;
	categoryId?: string;
	championshipId?: string;
}): Promise<BonusEngineChampionshipItem[]> {
	const live = payload.env
		? await loadLiveTopEuropeanChampionships(payload.env)
		: null;
	const rows = live ?? fallbackChampionships();
	return filterChampionships(rows, payload);
}

/** Events are not catalogued — league-level missions do not pin fixtures. */
export function listBonusEngineSportEvents(_payload: {
	sportId?: string;
	categoryId?: string;
	championshipId?: string;
}): BonusEngineSportEventItem[] {
	return [];
}

/** Markets require a live event; Admin catalog does not list fixtures. */
export function listBonusEngineEventMarkets(_payload: {
	eventId?: string;
}): BonusEngineEventMarketItem[] {
	return [];
}

function fallbackChampionships(): Array<{
	sportId: number;
	categoryId: number;
	championshipId: number | string;
	name: string;
}> {
	return BONUS_ENGINE_SPORTSBOOK_CATALOG.championships.map((championship) => ({
		sportId: championship.sportId,
		categoryId: championship.categoryId,
		championshipId: championship.championshipId,
		name: championship.name,
	}));
}

function filterChampionships(
	rows: Array<{
		sportId: number;
		categoryId: number;
		championshipId: number | string;
		name: string;
	}>,
	payload: {
		sportId?: string;
		categoryId?: string;
		championshipId?: string;
	},
): BonusEngineChampionshipItem[] {
	const sportId = parseOptionalInt(payload.sportId);
	const categoryId = parseOptionalInt(payload.categoryId);
	const championshipId = payload.championshipId?.trim() || "";

	return rows
		.filter((championship) => {
			if (sportId !== null && championship.sportId !== sportId) return false;
			if (categoryId !== null && championship.categoryId !== categoryId) {
				return false;
			}
			if (
				championshipId &&
				String(championship.championshipId) !== championshipId
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

/**
 * Load Data.Bet tournament ids for the top-6 European championships.
 * Returns null when the proxy is missing or every lookup fails.
 */
async function loadLiveTopEuropeanChampionships(
	env: CloudflareBindings,
): Promise<Array<{
	sportId: number;
	categoryId: number;
	championshipId: number | string;
	name: string;
}> | null> {
	if (!env.PROXY_URL?.trim() || !env.PROXY_SECRET?.trim()) return null;

	try {
		const pages = await Promise.all(
			BONUS_ENGINE_TOP_EUROPEAN_CHAMPIONSHIPS.map((championship) =>
				fetchDatabetTournamentsByName(env, championship.searchName),
			),
		);

		const byCanonicalName = new Map<
			string,
			{
				sportId: number;
				categoryId: number;
				championshipId: number | string;
				name: string;
			}
		>();

		for (const page of pages) {
			for (const tournament of page) {
				const matched = matchTopEuropeanChampionship(tournament.name);
				if (!matched || byCanonicalName.has(matched.name)) continue;
				byCanonicalName.set(matched.name, {
					sportId: matched.sportId,
					categoryId: matched.categoryId,
					championshipId: toChampionshipId(tournament.id),
					name: matched.name,
				});
			}
		}

		if (byCanonicalName.size === 0) return null;

		return BONUS_ENGINE_TOP_EUROPEAN_CHAMPIONSHIPS.map((championship) => {
			return (
				byCanonicalName.get(championship.name) ?? {
					sportId: championship.sportId,
					categoryId: championship.categoryId,
					championshipId: championship.fallbackChampionshipId,
					name: championship.name,
				}
			);
		});
	} catch (error) {
		console.warn("Bonus Engine championship catalog fell back to stubs", {
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

async function fetchDatabetTournamentsByName(
	env: CloudflareBindings,
	name: string,
): Promise<Array<{ id: string; name: string }>> {
	const response = await databetFetch(env, BONUS_ENGINE_DATABET_TOURNAMENTS_PATH, {
		method: "POST",
		headers: { "Api-Locale": "en" },
		body: {
			sport: BONUS_ENGINE_DATABET_FOOTBALL_SPORT,
			name,
			limit: 20,
			offset: 0,
		},
	});
	if (!response.ok) return [];

	const data = (await response.json()) as {
		data?: {
			tournaments_by_filters?: Array<{ id?: string; name?: string }>;
		};
	};
	const rawPage = data.data?.tournaments_by_filters ?? [];
	return rawPage.flatMap((tournament) => {
		const id = tournament.id?.trim();
		const tournamentName = tournament.name?.trim();
		if (!id || !tournamentName) return [];
		return [{ id, name: tournamentName }];
	});
}

function toChampionshipId(rawId: string): number | string {
	const trimmed = rawId.trim();
	const numeric = Number(trimmed);
	if (Number.isInteger(numeric) && String(numeric) === trimmed) {
		return numeric;
	}
	return trimmed;
}

function parseOptionalInt(value: string | undefined): number | null {
	if (!value?.trim()) return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}
