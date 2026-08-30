import { fetchWithTimeout } from "@/utils/fetch-with-timeout";
import type { CloudflareBindings } from "../types";

type DatabetOdd = {
	odd_id?: string;
	odd_ratio?: string;
	odd_status?: number;
	match_id?: string;
	market_id?: string;

	title?: string;
	match_title?: string;
	market_title?: string;
};

type DatabetBet = {
	_id: string;
	odds?: DatabetOdd[];
	bet_builder_odds?: Array<{
		match_id?: string;
		ratio?: string;
		status?: number;
		odds?: DatabetOdd[];
	}>;
};

export type EnrichedOdd = {
	oddId: string | null;
	matchId: string | null;
	marketId: string | null;
	oddRatio: string | null;
	oddStatus: number | null;
	pickTitle: string | null; 
	matchTitle: string | null; 
	marketTitle: string | null; 
};

export async function fetchBetDetailsById(
	env: CloudflareBindings,
	betId: string,
): Promise<DatabetBet | null> {
	if (!env.PROXY_URL || !env.PROXY_SECRET) return null;

	try {
		const url = new URL(`${env.PROXY_URL}/sportsbook/bet/getListByIds`);
		url.searchParams.set("request_id", crypto.randomUUID());
		url.searchParams.append("bet_ids[]", betId);

		const res = await fetchWithTimeout(
			url.toString(),
			{
				method: "GET",
				headers: {
					"x-proxy-auth": env.PROXY_SECRET,
					Accept: "application/json",
				},
			},
			8000,
		);

		if (!res.ok) return null;

		const data = (await res.json()) as { bets?: DatabetBet[] };
		return data.bets?.[0] ?? null;
	} catch {
		return null;
	}
}

export function enrichOdd(odd: DatabetOdd): EnrichedOdd {
	return {
		oddId: odd.odd_id ?? null,
		matchId: odd.match_id ?? null,
		marketId: odd.market_id ?? null,
		oddRatio: odd.odd_ratio ?? null,
		oddStatus: odd.odd_status ?? null,
		pickTitle: odd.title ?? null,
		matchTitle: odd.match_title ?? null,
		marketTitle: odd.market_title ?? null,
	};
}