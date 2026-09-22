import assert from "node:assert/strict";
import {
	mergeMissionListWithLocalProgress,
	parseBonusEngineMissionProgress,
} from "./mission.service";

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

const fromPercent = parseBonusEngineMissionProgress({
	missionId: "m1",
	body: { data: { progress_percentage: 40 } },
});
assert.equal(fromPercent.progressPercentage, 40);
assert.equal(fromPercent.completed, false);

const fromCurrentTarget = parseBonusEngineMissionProgress({
	missionId: "m1",
	body: { data: { current: 2, target: 5 } },
});
assert.equal(fromCurrentTarget.progressCurrent, 2);
assert.equal(fromCurrentTarget.progressTarget, 5);
assert.equal(fromCurrentTarget.progressPercentage, 40);

const fromTriggers = parseBonusEngineMissionProgress({
	missionId: "m1",
	body: {
		data: {
			triggers: [
				{ current: 100, target: 200 },
				{ current: 50, target: 100 },
			],
		},
	},
});
assert.equal(fromTriggers.progressCurrent, 150);
assert.equal(fromTriggers.progressTarget, 300);
assert.equal(fromTriggers.progressPercentage, 50);

console.log("bonus-engine mission.self-check: ok");
