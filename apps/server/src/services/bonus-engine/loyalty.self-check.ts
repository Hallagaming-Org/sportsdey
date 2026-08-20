import assert from "node:assert/strict";
import {
	buildBonusEngineLoyaltyProjectBody,
	buildBonusEngineLoyaltyRedeemBody,
	buildBonusEngineLoyaltyScopedBody,
} from "./loyalty.service";

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
});
assert.deepEqual(redeem, {
	client_id: "shiv",
	project_id: "main",
	user_id: "hari114",
	points_to_redeem: 500,
});

console.log("bonus-engine loyalty.self-check: ok");
