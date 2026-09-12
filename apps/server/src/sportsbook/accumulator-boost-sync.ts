import type { CloudflareBindings } from "@/types";
import {
	ACCUMULATOR_PROGRAM_QUANTITY,
	ACCUMULATOR_SPORTS,
	type AccumulatorSport,
	betBoostListIncludesApplicable,
	boostCoversAccumulatorSport,
	defaultAccumulatorProgramExpiry,
	planAccumulatorFoldGrants,
	planAccumulatorFoldRepairs,
} from "./accumulator-bonus";
import {
	addRepairedBoostIds,
	accumulatorSyncLockKey,
	getAccumulatorKv,
	getRepairedBoostIds,
	isAccumulatorProgramSynced,
	markAccumulatorProgramSynced,
	releaseAccumulatorSyncLock,
	tryAcquireAccumulatorSyncLock,
} from "./accumulator-boost-kv";

export const ACCUMULATOR_SYNC_CONCURRENCY = 8;

export type DatabetBoostRecord = {
	id: string;
	calculation_strategy?: {
		type?: string;
		strategy?: { params?: { multiplier?: string } };
	};
	required_conditions?: Array<{
		bet_details?: Array<{
			data?: {
				sport?: { sport_ids?: string[] };
				odds_count?: { min?: number; max?: number };
			};
		}>;
	}>;
	applicable_conditions?: Array<{
		bet_details?: Array<{
			data?: {
				sport?: { sport_ids?: string[] };
				odds_count?: { min?: number; max?: number };
			};
		}>;
	}>;
};

export type ListPlayerBetBoostsResult =
	| {
			ok: true;
			boosts: DatabetBoostRecord[];
			listIncludesApplicable: boolean;
	  }
	| { ok: false; status: number; error: string };

export type AccumulatorSyncResult = {
	created: Array<{
		sport: AccumulatorSport;
		selections: number;
		dataBetBoostId: string;
	}>;
	repaired: Array<{
		sport: AccumulatorSport;
		selections: number;
		dataBetBoostId: string;
	}>;
	skipped: AccumulatorSport[];
	removedLegacy: string[];
	failed: Array<{
		sport: AccumulatorSport;
		selections: number;
		error: string;
	}>;
	skippedSync: boolean;
	skipReason?: "lock" | "nothing_to_do" | "list_failed" | "program_synced";
};

type DatabetFetch = (
	env: CloudflareBindings,
	path: string,
	options?: {
		method?: string;
		body?: unknown;
		query?: Record<string, string | string[] | undefined>;
		headers?: Record<string, string>;
	},
) => Promise<Response>;

export async function listPlayerBetBoosts(
	databetFetch: DatabetFetch,
	env: CloudflareBindings,
	playerId: string,
): Promise<ListPlayerBetBoostsResult> {
	let response: Response;
	try {
		response = await databetFetch(
			env,
			`/bet-boosts?player_id=${encodeURIComponent(playerId)}`,
		);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "bet-boost list request failed";
		return { ok: false, status: 0, error: message };
	}

	if (!response.ok) {
		const error = await response.text();
		return {
			ok: false,
			status: response.status,
			error: error.slice(0, 500),
		};
	}

	const data = (await response.json()) as DatabetBoostRecord[] | unknown;
	if (!Array.isArray(data)) {
		return { ok: false, status: response.status, error: "invalid list payload" };
	}

	const boosts = data.filter(
		(boost): boost is DatabetBoostRecord => typeof boost?.id === "string",
	);
	const listIncludesApplicable = betBoostListIncludesApplicable(boosts);
	const sample = boosts.find(
		(boost) => boost.calculation_strategy?.type === "static",
	);

	console.info("DataBet bet-boost list shape", {
		playerId,
		count: boosts.length,
		listIncludesApplicable,
		sampleKeys: sample ? Object.keys(sample) : [],
		sampleHasApplicable: sample?.applicable_conditions !== undefined,
	});

	return { ok: true, boosts, listIncludesApplicable };
}

export function planAccumulatorSyncWork(
	existing: DatabetBoostRecord[],
	repairedBoostIds: ReadonlySet<string>,
) {
	const grantPlan = planAccumulatorFoldGrants(existing);
	const remaining = existing;
	const toRepair = planAccumulatorFoldRepairs(remaining, {
		skipBoostIds: repairedBoostIds,
	});
	const { toCreate, blockedLegacySports } = planAccumulatorFoldGrants(remaining);
	return {
		legacyStepsBoostIds: grantPlan.legacyStepsBoostIds,
		toRepair,
		toCreate,
		blockedLegacySports,
	};
}

export async function ensureAccumulatorProgramBoosts(
	databetFetch: DatabetFetch,
	env: CloudflareBindings,
	input: {
		playerId: string;
		currency?: string;
		initialQuantity?: number;
		expiresAt?: string;
		force?: boolean;
		/** Caller already holds acc-sync-lock (e.g. waitUntil worker). */
		skipLock?: boolean;
	},
): Promise<AccumulatorSyncResult> {
	const empty: AccumulatorSyncResult = {
		created: [],
		repaired: [],
		skipped: [],
		removedLegacy: [],
		failed: [],
		skippedSync: false,
	};

	const kv = getAccumulatorKv(env);
	let lockHeld = false;
	if (!input.force && !input.skipLock && kv) {
		lockHeld = await tryAcquireAccumulatorSyncLock(kv, input.playerId);
		if (!lockHeld) {
			return { ...empty, skippedSync: true, skipReason: "lock" };
		}
	}

	try {
		const list = await listPlayerBetBoosts(databetFetch, env, input.playerId);
		if (!list.ok) {
			console.error("Accumulator program list failed on sync", {
				playerId: input.playerId,
				status: list.status,
				error: list.error,
			});
			return { ...empty, skippedSync: true, skipReason: "list_failed" };
		}

		const repairedBoostIds = kv
			? await getRepairedBoostIds(kv, input.playerId)
			: new Set<string>();
		const work = planAccumulatorSyncWork(list.boosts, repairedBoostIds);

		if (
			work.legacyStepsBoostIds.length === 0 &&
			work.toRepair.length === 0 &&
			work.toCreate.length === 0
		) {
			if (kv) await markAccumulatorProgramSynced(kv, input.playerId);
			return { ...empty, skippedSync: true, skipReason: "nothing_to_do" };
		}

		const created: AccumulatorSyncResult["created"] = [];
	const repaired: AccumulatorSyncResult["repaired"] = [];
	const failed: AccumulatorSyncResult["failed"] = [];
	const removedLegacy: string[] = [];

	for (const boostId of work.legacyStepsBoostIds) {
		const response = await databetFetch(env, `/bet-boosts/${boostId}`, {
			method: "DELETE",
		});
		if (response.ok || response.status === 404) {
			removedLegacy.push(boostId);
			continue;
		}
		const boost = list.boosts.find((item) => item.id === boostId);
		const sport =
			ACCUMULATOR_SPORTS.find(
				(candidate) =>
					boost != null && boostCoversAccumulatorSport(boost, candidate),
			) ?? "football";
		failed.push({
			sport,
			selections: 0,
			error: `delete legacy steps ${boostId}: ${response.status} ${await response.text()}`,
		});
	}

	const remaining = list.boosts.filter(
		(boost) => !removedLegacy.includes(boost.id),
	);
	const toRepair = planAccumulatorFoldRepairs(remaining, {
		skipBoostIds: repairedBoostIds,
	});

	let repairIndex = 0;
	async function repairNext(): Promise<void> {
		while (repairIndex < toRepair.length) {
			const repair = toRepair[repairIndex++];
			if (!repair) return;
			const response = await databetFetch(env, `/bet-boosts/${repair.boostId}`, {
				method: "PUT",
				body: {
					player_id: input.playerId,
					applicable_conditions: repair.applicable_conditions,
					calculation_strategy: repair.calculation_strategy,
				},
			});
			if (!response.ok) {
				failed.push({
					sport: repair.sport,
					selections: repair.selections,
					error: `repair applicable ${repair.boostId}: ${response.status} ${await response.text()}`,
				});
				continue;
			}
			repaired.push({
				sport: repair.sport,
				selections: repair.selections,
				dataBetBoostId: repair.boostId,
			});
			if (kv) {
				await addRepairedBoostIds(kv, input.playerId, [repair.boostId]);
			}
		}
	}

	await Promise.all(
		Array.from(
			{
				length: Math.min(
					ACCUMULATOR_SYNC_CONCURRENCY,
					Math.max(toRepair.length, 0),
				),
			},
			() => repairNext(),
		),
	);

	const { toCreate, blockedLegacySports } = planAccumulatorFoldGrants(remaining);
	const expiresAt = input.expiresAt ?? defaultAccumulatorProgramExpiry();
	const initialQuantity = input.initialQuantity ?? ACCUMULATOR_PROGRAM_QUANTITY;

	let createIndex = 0;
	async function grantNext(): Promise<void> {
		while (createIndex < toCreate.length) {
			const preset = toCreate[createIndex++];
			if (!preset) return;
			const response = await databetFetch(env, "/bet-boosts", {
				method: "POST",
				body: {
					idempotence_id: crypto.randomUUID(),
					player_id: input.playerId,
					currency_code: input.currency ?? "NGN",
					initial_quantity: initialQuantity,
					applicable_conditions: preset.applicable_conditions,
					required_conditions: preset.required_conditions,
					calculation_strategy: preset.calculation_strategy,
					expires_at: expiresAt,
				},
			});

			if (!response.ok) {
				failed.push({
					sport: preset.sport,
					selections: preset.selections,
					error: `${response.status} ${await response.text()}`,
				});
				continue;
			}

			const raw = (await response.json()) as
				| { id: string }
				| Array<{ id: string }>;
			const createdBoost = Array.isArray(raw) ? raw[0] : raw;
			if (!createdBoost?.id) {
				failed.push({
					sport: preset.sport,
					selections: preset.selections,
					error: "No boost created",
				});
				continue;
			}
			created.push({
				sport: preset.sport,
				selections: preset.selections,
				dataBetBoostId: createdBoost.id,
			});
		}
	}

	await Promise.all(
		Array.from(
			{
				length: Math.min(
					ACCUMULATOR_SYNC_CONCURRENCY,
					Math.max(toCreate.length, 0),
				),
			},
			() => grantNext(),
		),
	);

		if (
			failed.length === 0 &&
			kv &&
			work.legacyStepsBoostIds.length === removedLegacy.length
		) {
			const after = planAccumulatorSyncWork(
				remaining,
				await getRepairedBoostIds(kv, input.playerId),
			);
			if (after.toCreate.length === 0 && after.toRepair.length === 0) {
				await markAccumulatorProgramSynced(kv, input.playerId);
			}
		}

		return {
			created,
			repaired,
			skipped: blockedLegacySports,
			removedLegacy,
			failed,
			skippedSync: false,
		};
	} finally {
		if (lockHeld && kv) {
			await releaseAccumulatorSyncLock(kv, input.playerId);
		}
	}
}

export type AccumulatorProgramSyncResult =
	| { synced: true }
	| {
			skipped: true;
			reason: "already_done" | "sync_in_progress";
	  };

export async function runAccumulatorProgramSync(
	databetFetch: DatabetFetch,
	env: CloudflareBindings,
	playerId: string,
	executionCtx?: ExecutionContext,
): Promise<AccumulatorProgramSyncResult> {
	const kv = getAccumulatorKv(env);
	if (kv && (await isAccumulatorProgramSynced(kv, playerId))) {
		return { skipped: true, reason: "already_done" };
	}

	if (kv && (await kv.get(accumulatorSyncLockKey(playerId)))) {
		if (await isAccumulatorProgramSynced(kv, playerId)) {
			return { skipped: true, reason: "already_done" };
		}
		return { skipped: true, reason: "sync_in_progress" };
	}

	if (!kv || !(await tryAcquireAccumulatorSyncLock(kv, playerId))) {
		if (kv && (await isAccumulatorProgramSynced(kv, playerId))) {
			return { skipped: true, reason: "already_done" };
		}
		return { skipped: true, reason: "sync_in_progress" };
	}

	const runSyncJob = async () => {
		try {
			const grant = await ensureAccumulatorProgramBoosts(databetFetch, env, {
				playerId,
				skipLock: true,
			});
			if (grant.failed.length > 0) {
				console.error("Accumulator program sync partial failure", {
					playerId,
					failed: grant.failed,
				});
			}
		} finally {
			await releaseAccumulatorSyncLock(kv, playerId);
		}
	};

	if (executionCtx && typeof executionCtx.waitUntil === "function") {
		executionCtx.waitUntil(runSyncJob());
		return { skipped: true, reason: "sync_in_progress" };
	}

	await runSyncJob();
	if (kv && (await isAccumulatorProgramSynced(kv, playerId))) {
		return { skipped: true, reason: "already_done" };
	}
	return { synced: true };
}

export function scheduleAccumulatorProgramBoosts(
	databetFetch: DatabetFetch,
	env: CloudflareBindings,
	playerId: string,
	executionCtx?: ExecutionContext,
): void {
	const task = (async () => {
		const kv = getAccumulatorKv(env);
		if (kv && (await isAccumulatorProgramSynced(kv, playerId))) {
			return null;
		}
		return ensureAccumulatorProgramBoosts(databetFetch, env, { playerId });
	})()
		.then((grant) => {
			if (grant && grant.failed.length > 0) {
				console.error("Accumulator program grant failed on token create", {
					playerId,
					failed: grant.failed,
				});
			}
		})
		.catch((error) => {
			console.error("Accumulator program grant threw on token create", {
				playerId,
				error:
					error instanceof Error
						? { name: error.name, message: error.message }
						: String(error),
			});
		});

	if (executionCtx && typeof executionCtx.waitUntil === "function") {
		executionCtx.waitUntil(task);
		return;
	}
	void task;
}
