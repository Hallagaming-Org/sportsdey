import { fetchWithTimeout } from "@/utils/fetch-with-timeout";
import { sportsbookApiBase } from "@/utils/ticket-selection-labels";
import type { CloudflareBindings } from "../types";

interface DataBetFixtureResponse {
	data?: {
		sportEventsByIds?: Array<{
			id: string;
			fixture?: {
				title?: string;
				type?: string;
				startTime?: string;
				status?: string;
				sport?: {
					id?: string;
					name?: string;
				};
				tournament?: {
					id?: string;
					name?: string;
					countryCode?: string;
				};
				competitors?: Array<{
					id?: string;
					name?: string;
					type?: string;
					homeAway?: string;
					templatePosition?: number;
				}>;
			};
		}>;
	};
}

export async function getFixtureTitlesByIds(
	env: CloudflareBindings,
	sportEventIds: string[],
): Promise<Map<string, string>> {
	const titleById = new Map<string, string>();
	
	const base = sportsbookApiBase(env);
	if (sportEventIds.length === 0 || !base || !env.PROXY_SECRET) {
		return titleById;
	}

	try {
		const res = await fetchWithTimeout(
			`${base}/sport-events-fixtures`,
			{
				method: "POST",
				headers: {
					"x-proxy-auth": env.PROXY_SECRET,
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: JSON.stringify({
					locale: "en",
					sportEventIds,
				}),
			},
			8000,
		);

		if (!res.ok) {
			console.error(`[getFixtureTitlesByIds] API returned ${res.status}`);
			return titleById;
		}

		const data = await res.json() as DataBetFixtureResponse;
		
		const events = data?.data?.sportEventsByIds;
		
		if (!events || !Array.isArray(events)) {
			console.error('[getFixtureTitlesByIds] Unexpected response format');
			return titleById;
		}

		for (const event of events) {
			const id = event.id;
			const title = event.fixture?.title;
			if (id && title) {
				titleById.set(id, title);
			}
		}
		
		console.log(`[getFixtureTitlesByIds] Found ${titleById.size} titles for ${sportEventIds.length} requested IDs`);
		
	} catch (error) {
		console.error('[getFixtureTitlesByIds] Error:', error);
	}

	return titleById;
}