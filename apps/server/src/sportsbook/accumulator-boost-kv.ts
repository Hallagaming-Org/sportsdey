import type { CloudflareBindings } from "@/types";

/** Same KV fallback chain as SMS / tennis cache routes. */
export type AccumulatorKvNamespace = NonNullable<
	ReturnType<typeof getAccumulatorKv>
>;

/** Covers first-time 147-boost grant; released in finally when sync completes. */
export const ACCUMULATOR_SYNC_LOCK_TTL_SECONDS = 600;
export const ACCUMULATOR_REPAIRED_TTL_SECONDS = 365 * 24 * 60 * 60;
export const ACCUMULATOR_APPLICABLE_REPAIR_VERSION = "v4";

export function getAccumulatorKv(
	env: CloudflareBindings,
): AccumulatorKvNamespace | null {
	return (
		env.sportsdey_ns ||
		env.staging_kv ||
		(env as unknown as Record<string, AccumulatorKvNamespace | undefined>)[
			"staging-kv"
		] ||
		null
	);
}

export function accumulatorSyncLockKey(playerId: string): string {
	return `acc-sync-lock:${playerId}`;
}

export function accumulatorRepairedBoostsKey(playerId: string): string {
	return `acc-repaired-boosts-${ACCUMULATOR_APPLICABLE_REPAIR_VERSION}:${playerId}`;
}

export function accumulatorProgramSyncedKey(playerId: string): string {
	return `acc-program-sync-${ACCUMULATOR_APPLICABLE_REPAIR_VERSION}:${playerId}`;
}

export async function getRepairedBoostIds(
	kv: AccumulatorKvNamespace,
	playerId: string,
): Promise<Set<string>> {
	const raw = await kv.get(accumulatorRepairedBoostsKey(playerId), "json");
	if (!Array.isArray(raw)) return new Set();
	return new Set(raw.filter((id): id is string => typeof id === "string"));
}

export async function addRepairedBoostIds(
	kv: AccumulatorKvNamespace,
	playerId: string,
	boostIds: string[],
): Promise<void> {
	if (boostIds.length === 0) return;
	const existing = await getRepairedBoostIds(kv, playerId);
	for (const id of boostIds) existing.add(id);
	await kv.put(
		accumulatorRepairedBoostsKey(playerId),
		JSON.stringify([...existing]),
		{ expirationTtl: ACCUMULATOR_REPAIRED_TTL_SECONDS },
	);
}

export async function isAccumulatorProgramSynced(
	kv: AccumulatorKvNamespace,
	playerId: string,
): Promise<boolean> {
	return (await kv.get(accumulatorProgramSyncedKey(playerId))) === "1";
}

export async function markAccumulatorProgramSynced(
	kv: AccumulatorKvNamespace,
	playerId: string,
): Promise<void> {
	await kv.put(accumulatorProgramSyncedKey(playerId), "1", {
		expirationTtl: ACCUMULATOR_REPAIRED_TTL_SECONDS,
	});
}

export async function tryAcquireAccumulatorSyncLock(
	kv: AccumulatorKvNamespace,
	playerId: string,
): Promise<boolean> {
	const key = accumulatorSyncLockKey(playerId);
	if (await kv.get(key)) return false;
	await kv.put(key, "1", { expirationTtl: ACCUMULATOR_SYNC_LOCK_TTL_SECONDS });
	return true;
}

export async function releaseAccumulatorSyncLock(
	kv: AccumulatorKvNamespace,
	playerId: string,
): Promise<void> {
	await kv.delete(accumulatorSyncLockKey(playerId));
}
