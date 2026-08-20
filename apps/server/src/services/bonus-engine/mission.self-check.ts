import assert from "node:assert/strict";
import { mergeMissionListWithLocalProgress } from "./mission.service";

const merged = mergeMissionListWithLocalProgress({
	missions: [
		{
			_id: "m1",
			title: "Wager",
			progress_percentage: 10,
			mission_status: "ACTIVE",
		},
		{
			mission_id: "m2",
			title: "Deposit",
			progress_percentage: "0",
		},
	],
	progress: [
		{
			missionId: "m1",
			progressPercentage: 45,
			completedAt: null,
			rewardJson: null,
		},
		{
			missionId: "m2",
			progressPercentage: 100,
			completedAt: new Date("2026-08-18T10:00:00.000Z"),
			rewardJson: JSON.stringify({ type: "Real Cash", amount: 50 }),
		},
	],
});

assert.equal(merged[0]?.progress_percentage, 45);
assert.equal(merged[0]?.mission_status, "ACTIVE");
assert.equal(merged[1]?.progress_percentage, 100);
assert.equal(merged[1]?.mission_status, "COMPLETED");
assert.equal(merged[1]?.completed_at, "2026-08-18T10:00:00.000Z");

console.log("bonus-engine mission.self-check: ok");
