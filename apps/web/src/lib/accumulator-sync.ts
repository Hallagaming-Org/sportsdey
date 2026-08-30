import { apiRequest } from "@/lib/api";

export type AccumulatorSyncResponse =
	| { synced: true }
	| { skipped: true; reason: "already_done" | "sync_in_progress" };

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

/** Poll until KV marks the player synced or the background job finishes. */
export async function ensureAccumulatorBoostsSynced(): Promise<void> {
	for (let attempt = 0; attempt < SYNC_MAX_ATTEMPTS; attempt++) {
		const result = await apiRequest<AccumulatorSyncResponse>(
			"sportsbook/bet-boost/accumulator/sync",
			{
				method: "POST",
				credentials: "include",
			},
		);

		if (syncComplete(result)) {
			return;
		}

		if (result.skipped && result.reason === "sync_in_progress") {
			await sleep(SYNC_POLL_INTERVAL_MS);
			continue;
		}

		return;
	}
}
