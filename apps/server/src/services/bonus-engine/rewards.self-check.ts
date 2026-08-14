/**
 * Runnable check for Real Cash reward parsing.
 * Run: `node --import tsx src/services/bonus-engine/rewards.self-check.ts`
 */
import assert from "node:assert/strict";
import { parseMissionRealCashReward } from "./rewards.service.ts";

assert.deepEqual(parseMissionRealCashReward({ type: "Real Cash", value: 200 }), {
	amountMajor: 200,
	rewardType: "Real Cash",
});
assert.deepEqual(
	parseMissionRealCashReward({ type: "real cash", amount: "50" }),
	{ amountMajor: 50, rewardType: "real cash" },
);
assert.equal(parseMissionRealCashReward({ type: "Points", amount: 50 }), null);
assert.deepEqual(
	parseMissionRealCashReward([{ type: "Points", amount: 10 }, { type: "Real Cash", amount: 25 }]),
	{ amountMajor: 25, rewardType: "Real Cash" },
);

console.log("bonus-engine rewards.self-check: ok");
