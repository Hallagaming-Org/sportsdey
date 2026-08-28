import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
	runAccumulatorProgramSync,
} from "../sportsbook/accumulator-boost-sync";
import { accumulatorProgramSyncedKey } from "../sportsbook/accumulator-boost-kv";

type MemoryKv = {
	store: Map<string, string>;
	get: (key: string, type?: "json" | "text") => Promise<unknown>;
	put: (
		key: string,
		value: string,
		options?: { expirationTtl?: number },
	) => Promise<void>;
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
	};
}

describe("sportsbook accumulator sync decouple", () => {
	it("token/create route no longer schedules accumulator boost sync", () => {
		const sportsbookPath = path.resolve(
			import.meta.dirname,
			"sportsbook.ts",
		);
		const source = fs.readFileSync(sportsbookPath, "utf8");
		const tokenHandlerStart = source.indexOf('path: "/token/create"');
		assert.ok(tokenHandlerStart >= 0);
		const nextRoute = source.indexOf("const heartbeatRoute", tokenHandlerStart);
		assert.ok(nextRoute > tokenHandlerStart);
		const tokenHandler = source.slice(tokenHandlerStart, nextRoute);
		assert.equal(
			tokenHandler.includes("scheduleAccumulatorProgramBoosts"),
			false,
			"token/create must not call scheduleAccumulatorProgramBoosts",
		);
		assert.ok(
			source.includes('path: "/bet-boost/accumulator/sync"'),
			"missing dedicated accumulator sync route",
		);
	});

	it("runAccumulatorProgramSync returns already_done when program is synced", async () => {
		const kv = memoryKv();
		await kv.put(accumulatorProgramSyncedKey("player-1"), "1");
		let ensureCalls = 0;
		const result = await runAccumulatorProgramSync(
			async () => {
				ensureCalls += 1;
				return new Response("[]", { status: 200 });
			},
			{ sportsdey_ns: kv } as never,
			"player-1",
		);
		assert.deepEqual(result, { skipped: true, reason: "already_done" });
		assert.equal(ensureCalls, 0);
	});

	it("runAccumulatorProgramSync invokes ensure path once when not yet synced", async () => {
		const kv = memoryKv();
		let listCalls = 0;
		const result = await runAccumulatorProgramSync(
			async (_env, requestPath) => {
				if (requestPath.startsWith("/bet-boosts?")) {
					listCalls += 1;
					return new Response("[]", { status: 200 });
				}
				return new Response(JSON.stringify({ id: "boost-new" }), {
					status: 200,
				});
			},
			{ sportsdey_ns: kv } as never,
			"player-2",
		);
		assert.equal(result.synced, true);
		assert.equal(listCalls, 1);
	});
});
