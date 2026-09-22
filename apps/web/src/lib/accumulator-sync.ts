import { apiRequest } from "@/lib/api";

export type AccumulatorSyncResponse =
	| { synced: true }
	| { skipped: true; reason: "already_done" | "sync_in_progress" };

export type AccumulatorSyncStatus = "already_synced" | "synced";

const SYNC_POLL_INTERVAL_MS = 2_000;
const SYNC_MAX_ATTEMPTS = 45;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		window.setTimeout(resolve, ms);
	});
}

function syncComplete(result: AccumulatorSyncResponse): boolean {
	if ("synced" in result && result.synced === true) {
		return true;
	}
	return "skipped" in result && result.reason === "already_done";
}

/**
 * Poll until KV marks the player synced or the background job finishes.
 * `synced` means grants/repairs ran this visit — caller should mint a new
 * DataBet token so the widget sees the boosts without a manual refresh.
 */
export async function ensureAccumulatorBoostsSynced(): Promise<AccumulatorSyncStatus> {
	let sawInProgress = false;
	for (let attempt = 0; attempt < SYNC_MAX_ATTEMPTS; attempt++) {
		const result = await apiRequest<AccumulatorSyncResponse>(
			"sportsbook/bet-boost/accumulator/sync",
			{
				method: "POST",
				credentials: "include",
			},
		);

		if (syncComplete(result)) {
			if ("synced" in result && result.synced === true) {
				return "synced";
			}
			return sawInProgress ? "synced" : "already_synced";
		}

		if (result.skipped && result.reason === "sync_in_progress") {
			sawInProgress = true;
			await sleep(SYNC_POLL_INTERVAL_MS);
			continue;
		}

		return "already_synced";
	}
	return sawInProgress ? "synced" : "already_synced";
}
