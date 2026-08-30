import { fetchWithTimeout } from "@/utils/fetch-with-timeout";
import { sportsbookApiBase } from "@/utils/ticket-selection-labels";
import type { CloudflareBindings } from "../types";

type FixtureCompetitor = {
	id?: string;
	name?: string;
	type?: string | number;
	homeAway?: string;
	templatePosition?: number;
};

type FixtureEvent = {
	id?: string;
	fixture?: {
		title?: string;
		startTime?: string;
		competitors?: FixtureCompetitor[] | Record<string, FixtureCompetitor>;
	};
};

type DataBetFixtureResponse = {
	data?: {
		sportEventsByIds?: FixtureEvent[];
	};
};

const FIXTURE_TIMEOUT_MS = 12_000;
const FIXTURE_RETRY_DELAY_MS = 250;

export function looksLikeSportEventId(
	value: string | null | undefined,
): boolean {
	if (!value) return false;
	const trimmed = value.trim();
	if (/^\d+:[0-9a-f-]{8,}$/i.test(trimmed)) return true;
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
		trimmed,
	);
}

export function titleFromCompetitors(
	competitors:
		| FixtureCompetitor[]
		| Record<string, FixtureCompetitor>
		| undefined,
): string | undefined {
	const list = Array.isArray(competitors)
		? competitors
		: competitors
			? Object.values(competitors)
			: [];
	const named = list
		.filter((item) => item?.name?.trim())
		.sort((a, b) => (a.templatePosition ?? 99) - (b.templatePosition ?? 99));
	if (named.length < 2) return undefined;
	return `${named[0]?.name?.trim()} vs ${named[1]?.name?.trim()}`;
}

export function fixtureTitle(
	event: FixtureEvent | undefined,
): string | undefined {
	const raw = event?.fixture?.title?.trim();
	if (raw && !looksLikeSportEventId(raw)) return raw;
	return titleFromCompetitors(event?.fixture?.competitors);
}

export function matchDisplayName(
	title: string | null | undefined,
	matchId?: string | null,
): string {
	const trimmed = title?.trim();
	if (trimmed && !looksLikeSportEventId(trimmed)) return trimmed;
	if (matchId?.trim() && !looksLikeSportEventId(matchId)) return matchId.trim();
	return "Unknown match";
}

function mergeTitles(
	target: Map<string, string>,
	events: FixtureEvent[] | undefined,
) {
	if (!events) return;
	for (const event of events) {
		const id = event.id;
		const title = fixtureTitle(event);
		if (id && title) target.set(id, title);
	}
}

async function sleep(ms: number) {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchFixtureEvents(
	base: string,
	secret: string,
	sportEventIds: string[],
): Promise<FixtureEvent[]> {
	if (sportEventIds.length === 0) return [];
	let lastError: unknown;
	for (let attempt = 1; attempt <= 2; attempt++) {
		try {
			const res = await fetchWithTimeout(
				`${base}/sport-events-fixtures`,
				{
					method: "POST",
					headers: {
						"X-Proxy-Auth": secret,
						"Content-Type": "application/json",
						Accept: "application/json",
					},
					body: JSON.stringify({
						locale: "en",
						sportEventIds,
					}),
				},
				FIXTURE_TIMEOUT_MS,
			);
			if (!res.ok) {
				lastError = `status ${res.status}`;
				if (res.status >= 500 && attempt < 2) {
					await sleep(FIXTURE_RETRY_DELAY_MS);
					continue;
				}
				console.error("[getFixtureTitlesByIds] API returned", res.status);
				return [];
			}
			const data = (await res.json()) as DataBetFixtureResponse;
			const events = data?.data?.sportEventsByIds;
			if (!Array.isArray(events)) {
				console.error("[getFixtureTitlesByIds] Unexpected response format");
				return [];
			}
			return events;
		} catch (error) {
			lastError = error;
			if (attempt < 2) {
				await sleep(FIXTURE_RETRY_DELAY_MS);
			}
		}
	}
	console.error("[getFixtureTitlesByIds] Error:", lastError);
	return [];
}

export async function getFixtureTitlesByIds(
	env: CloudflareBindings,
	sportEventIds: string[],
): Promise<Map<string, string>> {
	const titleById = new Map<string, string>();
	const uniqueIds = [...new Set(sportEventIds.filter(Boolean))];
	const base = sportsbookApiBase(env);
	const secret = env.PROXY_SECRET?.trim();
	if (uniqueIds.length === 0 || !base || !secret) return titleById;

	mergeTitles(titleById, await fetchFixtureEvents(base, secret, uniqueIds));

	const missing = uniqueIds.filter((id) => !titleById.has(id));
	if (missing.length > 0 && missing.length < uniqueIds.length) {
		for (const id of missing) {
			mergeTitles(titleById, await fetchFixtureEvents(base, secret, [id]));
		}
	}

	console.log(
		`[getFixtureTitlesByIds] Found ${titleById.size} titles for ${uniqueIds.length} requested IDs`,
	);
	return titleById;
}
