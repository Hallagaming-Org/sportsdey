import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	ensureAccumulatorProgramBoosts,
	listPlayerBetBoosts,
	planAccumulatorSyncWork,
} from "./accumulator-boost-sync";
import { listAccumulatorFoldBoostPayloads } from "./accumulator-bonus";

type MemoryKv = {
	store: Map<string, string>;
	get: (key: string, type?: "json" | "text") => Promise<unknown>;
	put: (
		key: string,
		value: string,
		options?: { expirationTtl?: number },
	) => Promise<void>;
	delete: (key: string) => Promise<void>;
};

function memoryKv(): MemoryKv {
	const store = new Map<string, string>();
	return {
		store,
		async get(key, type) {
			const value = store.get(key);
			if (value == null) return null;
			if (type === "json") return JSON.parse(value);
			return value;
		},
		async put(key, value) {
			store.set(key, value);
		},
		async delete(key) {
			store.delete(key);
		},
	};
}

describe("accumulator boost sync", () => {
	it("listPlayerBetBoosts fails safe instead of returning an empty array", async () => {
		const result = await listPlayerBetBoosts(
			async () => new Response("upstream down", { status: 502 }),
			{} as never,
			"player-1",
		);
		assert.equal(result.ok, false);
		if (result.ok) return;
		assert.equal(result.status, 502);
	});

	it("planAccumulatorSyncWork reports nothing to do for a complete table", () => {
		const payloads = listAccumulatorFoldBoostPayloads().map((payload, index) => ({
			id: `boost-${index}`,
			calculation_strategy: payload.calculation_strategy,
			required_conditions: payload.required_conditions as never,
			applicable_conditions: payload.applicable_conditions as never,
		}));
		const work = planAccumulatorSyncWork(payloads, new Set());
		assert.equal(work.legacyStepsBoostIds.length, 0);
		assert.equal(work.staleFoldBoostIds.length, 0);
		assert.equal(work.toRepair.length, 0);
		assert.equal(work.toCreate.length, 0);
	});

	it("planAccumulatorSyncWork reports leftover fold cards for deletion", () => {
		const leftover = {
			id: "fold-3",
			calculation_strategy: {
				type: "static",
				strategy: { params: { multiplier: "1.20" } },
			},
			required_conditions: [
				{
					bet_details: [
						{
							data: {
								sport: { sport_ids: ["football"] },
								odds_count: { min: 3, max: 3 },
							},
						},
					],
				},
			],
			applicable_conditions: [
				{
					bet_details: [
						{
							data: {
								sport: { sport_ids: ["football"] },
								odds_count: { min: 3, max: 3 },
							},
						},
					],
				},
			],
		};
		const work = planAccumulatorSyncWork([leftover], new Set());
		assert.deepEqual(work.staleFoldBoostIds, ["fold-3"]);
		assert.equal(work.toRepair.length, 0);
		assert.equal(work.toCreate.length, 3);
	});

	it("ensureAccumulatorProgramBoosts skips sync when list fails", async () => {
		const grant = await ensureAccumulatorProgramBoosts(
			async () => new Response("nope", { status: 503 }),
			{ sportsdey_ns: memoryKv() } as never,
			{ playerId: "player-1", force: true },
		);
		assert.equal(grant.skippedSync, true);
		assert.equal(grant.skipReason, "list_failed");
		assert.equal(grant.created.length, 0);
	});

	it("ensureAccumulatorProgramBoosts skips when another sync holds the lock", async () => {
		const kv = memoryKv();
		await kv.put("acc-sync-lock:player-1", "1");
		const grant = await ensureAccumulatorProgramBoosts(
			async () => new Response("[]", { status: 200 }),
			{ sportsdey_ns: kv } as never,
			{ playerId: "player-1" },
		);
		assert.equal(grant.skippedSync, true);
		assert.equal(grant.skipReason, "lock");
	});

	it("ensureAccumulatorProgramBoosts releases lock after list fails", async () => {
		const kv = memoryKv();
		const grant = await ensureAccumulatorProgramBoosts(
			async () => new Response("nope", { status: 503 }),
			{ sportsdey_ns: kv } as never,
			{ playerId: "player-1" },
		);
		assert.equal(grant.skipReason, "list_failed");
		assert.equal(await kv.get("acc-sync-lock:player-1"), null);
	});
});
