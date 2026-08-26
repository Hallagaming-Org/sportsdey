import assert from "node:assert/strict";
import {
	buildBonusEngineListCampaignsBody,
	buildBonusEnginePlayerScopedBody,
	buildBonusEngineUserBonusActionBody,
	findUserBonusById,
	isBonusEngineActivateAccepted,
	mergeUserBonusesWithLocalSnapshots,
	parseBonusActivationAmounts,
	parseBonusAllocationRecords,
	resolveBonusStatusWalletDeltas,
	shouldCreditAllocatedBonus,
} from "./bonus.service.ts";
import { isBonusEngineJsonNotFound } from "./client.ts";

assert.deepEqual(
	buildBonusEnginePlayerScopedBody({
		clientId: "shiv",
		projectId: "main",
		userId: "hari114",
	}),
	{
		client_id: "shiv",
		project_id: "main",
		user_id: "hari114",
	},
);

assert.deepEqual(
	buildBonusEngineListCampaignsBody({
		clientId: "shiv",
		projectId: "main",
		userId: "hari114",
		bonusType: "welcome",
	}),
	{
		client_id: "shiv",
		project_id: "main",
		user_id: "hari114",
		bonus_type: "welcome",
	},
);

assert.deepEqual(
	buildBonusEngineUserBonusActionBody({
		clientId: "shiv",
		projectId: "main",
		userId: "hari114",
		userbonusId: "66d7fbf439d19fb08c09a37c",
	}),
	{
		client_id: "shiv",
		project_id: "main",
		user_id: "hari114",
		userbonus_id: "66d7fbf439d19fb08c09a37c",
	},
);

const assignment = {
	_id: "68358c5d14dfca8ca571b41e",
	bonus_amount: 100,
	cash_amount: "0",
};
assert.equal(
	findUserBonusById({
		bonuses: [assignment],
		userbonusId: "68358c5d14dfca8ca571b41e",
	})?._id,
	"68358c5d14dfca8ca571b41e",
);
assert.equal(
	findUserBonusById({
		bonuses: [assignment],
		userbonusId: "missing",
	}),
	null,
);
assert.deepEqual(parseBonusActivationAmounts(assignment), {
	bonusAmountMajor: 100,
	cashAmountMajor: 0,
});
assert.deepEqual(parseBonusActivationAmounts(null), {
	bonusAmountMajor: 0,
	cashAmountMajor: 0,
});

assert.equal(
	isBonusEngineActivateAccepted({ ok: true, status: 200 }),
	true,
);
assert.equal(
	isBonusEngineActivateAccepted({
		ok: false,
		status: 400,
		error: "Bonus already activated",
	}),
	true,
);
assert.equal(
	isBonusEngineActivateAccepted({
		ok: false,
		status: 400,
		error: "Internal server error",
	}),
	false,
);

assert.deepEqual(
	resolveBonusStatusWalletDeltas({
		realAmountChange: 10.84,
		bonusAmountChange: 50.89,
	}),
	{ realKobo: 1084, bonusKobo: -5089 },
);
assert.deepEqual(
	resolveBonusStatusWalletDeltas({
		realAmountChange: -5,
		bonusAmountChange: -20,
	}),
	{ realKobo: -500, bonusKobo: 2000 },
);

const allocated = {
	_id: "68358c5d14dfca8ca571b41e",
	user_action: "ACTIVATED",
	bonus_amount: 100,
};
assert.equal(shouldCreditAllocatedBonus(allocated), true);
assert.equal(
	shouldCreditAllocatedBonus({ _id: "x", status: "PENDING" }),
	false,
);
assert.equal(shouldCreditAllocatedBonus({ status: "ACTIVE" }), true);

assert.equal(
	parseBonusAllocationRecords({
		user_id: "user123",
		bonus_data: allocated,
	}).length,
	1,
);
assert.equal(
	parseBonusAllocationRecords({
		user_id: "user123",
		bonus_data: [allocated, { _id: "second" }],
	}).length,
	2,
);
assert.equal(parseBonusAllocationRecords({ user_id: "user123" }).length, 0);

const merged = mergeUserBonusesWithLocalSnapshots({
	bonuses: [{ _id: "a", status: "PENDING", bonus_amount: 100 }],
	snapshots: [
		{
			bonusId: "a",
			status: "EXPIRED",
			payloadJson: JSON.stringify({ bonus_amount: 100 }),
		},
		{
			bonusId: "b",
			status: "ACTIVE",
			payloadJson: JSON.stringify({ campaign_code: "BONUSLOGIN" }),
		},
	],
});
assert.equal(merged.find((row) => row._id === "a")?.status, "EXPIRED");
assert.equal(
	merged.find((row) => row._id === "b")?.campaign_code,
	"BONUSLOGIN",
);

assert.equal(
	isBonusEngineJsonNotFound({
		ok: false,
		status: 404,
		error: "No campaigns found",
	}),
	true,
);
assert.equal(
	isBonusEngineJsonNotFound({
		ok: false,
		status: 404,
		error: "<!DOCTYPE html>\nCannot POST /api/list_active_campaign",
	}),
	false,
);

console.log("bonus-engine bonus.self-check: ok");
