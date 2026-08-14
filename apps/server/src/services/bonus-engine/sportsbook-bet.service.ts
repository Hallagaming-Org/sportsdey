/**
 * Helpers for mapping Data.Bet sportsbook bet payloads into Bonus Engine
 * `POST /bet` fields (product_type=sportsbook).
 */

export type SportsbookBetReportIds = {
	sportId?: string;
	eventId?: string;
};

/**
 * Pulls sport / event identifiers from the first selection on a placed/accepted bet.
 * Used as Bonus Engine `provider_id` (sport) and `game_id` (event/match).
 */
export function extractSportsbookBetReportIds(
	betOdds: unknown,
): SportsbookBetReportIds {
	if (!Array.isArray(betOdds) || betOdds.length === 0) return {};
	const first = betOdds[0];
	if (typeof first !== "object" || first === null) return {};
	const row = first as Record<string, unknown>;
	const meta =
		typeof row.meta === "object" && row.meta !== null
			? (row.meta as Record<string, unknown>)
			: {};

	const sportRaw =
		meta.sport_event_info_sport_id ?? meta.sport_id ?? meta.sportId;
	const eventRaw =
		row.match_id ??
		meta.sport_event_info_event_id ??
		meta.event_id ??
		meta.eventId;

	const sportId =
		sportRaw === undefined || sportRaw === null ? "" : String(sportRaw).trim();
	const eventId =
		eventRaw === undefined || eventRaw === null ? "" : String(eventRaw).trim();

	return {
		...(sportId ? { sportId } : {}),
		...(eventId ? { eventId } : {}),
	};
}
