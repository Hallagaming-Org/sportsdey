import assert from "node:assert/strict";
import {
	buildBonusEngineLoyaltyProjectBody,
	buildBonusEngineLoyaltyRedeemBody,
	buildBonusEngineLoyaltyScopedBody,
	shouldTreatLoyaltyHistoryAsEmpty,
} from "./loyalty.service";
import { BONUS_ENGINE_LOYALTY_MESSAGE } from "./bonus-engine.service.constant";

const scoped = buildBonusEngineLoyaltyScopedBody({
	clientId: "shiv",
	projectId: "main",
	userId: "hari114",
});
assert.deepEqual(scoped, {
	client_id: "shiv",
	project_id: "main",
	user_id: "hari114",
});

const project = buildBonusEngineLoyaltyProjectBody({
	clientId: "shiv",
	projectId: "main",
});
assert.deepEqual(project, {
	client_id: "shiv",
	project_id: "main",
});

const redeem = buildBonusEngineLoyaltyRedeemBody({
	clientId: "shiv",
	projectId: "main",
	userId: "hari114",
	pointsToRedeem: 500,
	loyaltyId: "camp-1",
});
assert.deepEqual(redeem, {
	client_id: "shiv",
	project_id: "main",
	user_id: "hari114",
	points_to_redeem: 500,
	loyalty_id: "camp-1",
});

assert.equal(
	shouldTreatLoyaltyHistoryAsEmpty({
		ok: false,
		status: 200,
		error: BONUS_ENGINE_LOYALTY_MESSAGE.HISTORY_ENGINE_FETCH_FAILED,
	}),
	true,
);
assert.equal(
	shouldTreatLoyaltyHistoryAsEmpty({
		ok: false,
		status: 404,
		error: "No loyalty history found",
	}),
	true,
);
assert.equal(
	shouldTreatLoyaltyHistoryAsEmpty({
		ok: false,
		status: 500,
		error: "Cannot read properties of null (reading '_id')",
	}),
	true,
);
assert.equal(
	shouldTreatLoyaltyHistoryAsEmpty({
		ok: false,
		status: 503,
		error: "Failed to obtain Bonus Engine access token",
	}),
	false,
);
assert.equal(
	shouldTreatLoyaltyHistoryAsEmpty({
		ok: false,
		status: 404,
		error: "<!DOCTYPE html>\nCannot POST /api/loyalty/history",
	}),
	false,
);

console.log("bonus-engine loyalty.self-check: ok");
