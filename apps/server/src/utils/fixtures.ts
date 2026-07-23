import { fetchWithTimeout } from "@/utils/fetch-with-timeout";
import type { CloudflareBindings } from "../types";

export async function getFixtureTitlesByIds(
	env: CloudflareBindings,
	sportEventIds: string[],
): Promise<Map<string, string>> {
	const titleById = new Map<string, string>();
	if (sportEventIds.length === 0 || !env.PROXY_URL || !env.PROXY_SECRET) {
		return titleById;
	}

	try {
		const res = await fetchWithTimeout(
			`${env.PROXY_URL}/sportsbook/sport-events-fixtures`,
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

		if (!res.ok) return titleById;

		const data = (await res.json()) as any;
		const events: any[] = data.data?.sportEventsByIds ?? [];

		for (const event of events) {
			const id = event.id;
			const title = event.fixture?.title;
			if (id && title) {
				titleById.set(id, title);
			}
		}
	} catch {
		// swallowed 
	}

	return titleById;
}