import { OpenAPIHono } from "@hono/zod-openapi";
import {
	BONUS_ENGINE_CALLBACK_EVENT_TYPE,
	BONUS_ENGINE_CALLBACK_MESSAGE,
	BONUS_ENGINE_CALLBACK_PATH,
	BONUS_ENGINE_HEADER,
	BONUS_ENGINE_INVALID_SIGNATURE_STATUS,
} from "@/services/bonus-engine/bonus-engine.service.constant";
import {
	applyBonusStatusWalletChanges,
	creditBonusActivation,
	creditMissionRealCashReward,
	getBonusEngineCallbackWalletView,
	getBonusEngineConfig,
	isBonusEngineCallbackVerifyConfigured,
	parseBonusActivationAmounts,
	parseBonusAllocationRecords,
	recordBonusEngineCallbackEvent,
	resolveBonusStatusWalletDeltas,
	shouldCreditAllocatedBonus,
	upsertBonusEngineLoyaltySnapshot,
	upsertBonusEngineMissionProgress,
	upsertBonusEngineUserBonus,
	verifyBonusEngineBody,
} from "@/services/bonus-engine";
import type { CloudflareBindings } from "../types";

const callbackRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

type CallbackContext = {
	req: {
		text: () => Promise<string>;
		header: (name: string) => string | undefined;
	};
	env: CloudflareBindings;
	json: (body: Record<string, unknown>, status?: 200 | 400 | 410 | 413 | 502) => Response;
};

async function readAndVerifyCallbackBody(
	c: CallbackContext,
): Promise<{ ok: true; bodyString: string } | { ok: false; response: Response }> {
	const bodyString = await c.req.text();
	if (!isBonusEngineCallbackVerifyConfigured(c.env)) {
		return {
			ok: false,
			response: c.json(
				{
					status: BONUS_ENGINE_INVALID_SIGNATURE_STATUS,
					message: "INVALID_SIGNATURE",
				},
				BONUS_ENGINE_INVALID_SIGNATURE_STATUS,
			),
		};
	}

	const signature = c.req.header(BONUS_ENGINE_HEADER.SIGNATURE) || "";
	const config = getBonusEngineConfig(c.env);
	const valid = await verifyBonusEngineBody({
		publicKeyPem: config.callbackPublicKeyPem,
		bodyString,
		signatureBase64: signature,
	});
	if (!valid) {
		return {
			ok: false,
			response: c.json(
				{
					status: BONUS_ENGINE_INVALID_SIGNATURE_STATUS,
					message: "INVALID_SIGNATURE",
				},
				BONUS_ENGINE_INVALID_SIGNATURE_STATUS,
			),
		};
	}

	return { ok: true, bodyString };
}

function parseJsonObject(bodyString: string): Record<string, unknown> | null {
	try {
		const parsed = JSON.parse(bodyString) as unknown;
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
			return null;
		}
		return parsed as Record<string, unknown>;
	} catch {
		return null;
	}
}

function asString(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim()) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
}

callbackRoute.post(
	BONUS_ENGINE_CALLBACK_PATH.LOYALTY_POINTS_UPDATE,
	async (c) => {
		const verified = await readAndVerifyCallbackBody(c);
		if (!verified.ok) return verified.response;

		const body = parseJsonObject(verified.bodyString);
		if (!body) {
			return c.json({ status: 400, message: "Invalid JSON body" }, 400);
		}

		const playerId = asString(body.player_id);
		const loyaltyPoints = asNumber(body.loyalty_points);
		const level = asString(body.level);
		const recorded = await recordBonusEngineCallbackEvent({
			env: c.env,
			eventType: BONUS_ENGINE_CALLBACK_EVENT_TYPE.LOYALTY_POINTS_UPDATE,
			idempotencySeed: `${playerId}:${loyaltyPoints}:${level}`,
			bodyJson: verified.bodyString,
		});

		if (recorded.isNew && playerId) {
			await upsertBonusEngineLoyaltySnapshot({
				env: c.env,
				userId: playerId,
				totalPoints: loyaltyPoints,
				loyaltyLevel: level,
			});
		}

		return c.json(
			{
				status: 200,
				message: "SUCCESS",
				data: { player_id: playerId, duplicate: !recorded.isNew },
			},
			200,
		);
	},
);

callbackRoute.post(BONUS_ENGINE_CALLBACK_PATH.LOYALTY_LEVEL_UP, async (c) => {
	const verified = await readAndVerifyCallbackBody(c);
	if (!verified.ok) return verified.response;

	const body = parseJsonObject(verified.bodyString);
	if (!body) {
		return c.json({ status: 400, message: "Invalid JSON body" }, 400);
	}

	const playerId = asString(body.player_id);
	const newLevel = asString(body.new_level);
	const recorded = await recordBonusEngineCallbackEvent({
		env: c.env,
		eventType: BONUS_ENGINE_CALLBACK_EVENT_TYPE.LOYALTY_LEVEL_UP,
		idempotencySeed: `${playerId}:${newLevel}`,
		bodyJson: verified.bodyString,
	});

	if (recorded.isNew && playerId) {
		await upsertBonusEngineLoyaltySnapshot({
			env: c.env,
			userId: playerId,
			loyaltyLevel: newLevel,
		});
	}

	return c.json(
		{
			status: 200,
			message: "SUCCESS",
			data: {
				player_id: playerId,
				new_level: newLevel,
				duplicate: !recorded.isNew,
			},
		},
		200,
	);
});

callbackRoute.post(BONUS_ENGINE_CALLBACK_PATH.MISSION_PROGRESS, async (c) => {
	const verified = await readAndVerifyCallbackBody(c);
	if (!verified.ok) return verified.response;

	const body = parseJsonObject(verified.bodyString);
	if (!body) {
		return c.json({ status: 400, message: "Invalid JSON body" }, 400);
	}

	const missionId = asString(body.mission_id);
	const playerId = asString(body.player_id);
	const progressPercentage = asNumber(body.progress_percentage);
	const recorded = await recordBonusEngineCallbackEvent({
		env: c.env,
		eventType: BONUS_ENGINE_CALLBACK_EVENT_TYPE.MISSION_PROGRESS,
		idempotencySeed: `${missionId}:${playerId}:${progressPercentage}`,
		bodyJson: verified.bodyString,
	});

	if (recorded.isNew && playerId && missionId) {
		await upsertBonusEngineMissionProgress({
			env: c.env,
			userId: playerId,
			missionId,
			progressPercentage,
		});
	}

	return c.json(
		{
			status: 200,
			message: "SUCCESS",
			data: {
				mission_id: missionId,
				player_id: playerId,
				duplicate: !recorded.isNew,
			},
		},
		200,
	);
});

callbackRoute.post(BONUS_ENGINE_CALLBACK_PATH.MISSION_COMPLETE, async (c) => {
	const verified = await readAndVerifyCallbackBody(c);
	if (!verified.ok) return verified.response;

	const body = parseJsonObject(verified.bodyString);
	if (!body) {
		return c.json({ status: 400, message: "Invalid JSON body" }, 400);
	}

	const missionId = asString(body.mission_id);
	const playerId = asString(body.player_id);
	const reward =
		typeof body.reward === "object" && body.reward !== null
			? body.reward
			: null;

	if (playerId && missionId) {
		try {
			const cashCredit = await creditMissionRealCashReward({
				env: c.env,
				userId: playerId,
				missionId,
				reward,
			});
			if (cashCredit.status === "wallet_missing") {
				console.error("Mission Real Cash credit blocked — wallet missing", {
					userId: playerId,
					missionId,
				});
				return c.json(
					{ status: 502, message: "WALLET_MISSING" },
					502,
				);
			}
			if (cashCredit.credited) {
				console.info("Mission Real Cash credited", {
					userId: playerId,
					missionId,
					amountKobo: cashCredit.amountKobo,
					reference: cashCredit.reference,
				});
			}
		} catch (error: unknown) {
			console.error("Mission Real Cash credit failed", {
				userId: playerId,
				missionId,
				error,
			});
			return c.json({ status: 502, message: "CREDIT_FAILED" }, 502);
		}

		await upsertBonusEngineMissionProgress({
			env: c.env,
			userId: playerId,
			missionId,
			progressPercentage: 100,
			completedAt: new Date(),
			rewardJson: reward ? JSON.stringify(reward) : null,
		});
	}

	const recorded = await recordBonusEngineCallbackEvent({
		env: c.env,
		eventType: BONUS_ENGINE_CALLBACK_EVENT_TYPE.MISSION_COMPLETE,
		idempotencySeed: `${missionId}:${playerId}`,
		bodyJson: verified.bodyString,
	});

	return c.json(
		{
			status: 200,
			message: "SUCCESS",
			data: {
				mission_id: missionId,
				player_id: playerId,
				duplicate: !recorded.isNew,
			},
		},
		200,
	);
});

callbackRoute.post(BONUS_ENGINE_CALLBACK_PATH.BALANCE, async (c) => {
	const verified = await readAndVerifyCallbackBody(c);
	if (!verified.ok) return verified.response;

	const body = parseJsonObject(verified.bodyString);
	if (!body) {
		return c.json(
			{ status: 400, message: BONUS_ENGINE_CALLBACK_MESSAGE.INVALID_JSON },
			400,
		);
	}

	const userId = asString(body.user_id);
	if (!userId) {
		return c.json(
			{
				status: 410,
				message: BONUS_ENGINE_CALLBACK_MESSAGE.MISSING_FIELDS,
			},
			410,
		);
	}

	const view = await getBonusEngineCallbackWalletView({
		env: c.env,
		userId,
	});

	return c.json(
		{
			status: 200,
			message: BONUS_ENGINE_CALLBACK_MESSAGE.BALANCE_RETRIEVED,
			data: {
				user_id: view.userId,
				username: view.username,
				real_wallet_balance: view.realWalletBalance,
				bonus_wallet_balance: view.bonusWalletBalance,
				timestamp: view.timestamp,
			},
		},
		200,
	);
});

callbackRoute.post(BONUS_ENGINE_CALLBACK_PATH.UPDATE_BONUS, async (c) => {
	const verified = await readAndVerifyCallbackBody(c);
	if (!verified.ok) return verified.response;

	const body = parseJsonObject(verified.bodyString);
	if (!body) {
		return c.json(
			{ status: 400, message: BONUS_ENGINE_CALLBACK_MESSAGE.INVALID_JSON },
			400,
		);
	}

	const userId = asString(body.user_id);
	const bonusId = asString(body.bonus_id);
	const bonusStatus = asString(body.bonus_status).toUpperCase();
	if (!userId || !bonusId || !bonusStatus) {
		return c.json(
			{
				status: 410,
				message: BONUS_ENGINE_CALLBACK_MESSAGE.MISSING_FIELDS,
			},
			410,
		);
	}

	const deltas = resolveBonusStatusWalletDeltas({
		realAmountChange: asNumber(body.real_amount_change),
		bonusAmountChange: asNumber(body.bonus_amount_change),
	});

	try {
		const walletApply = await applyBonusStatusWalletChanges({
			env: c.env,
			userId,
			bonusId,
			bonusStatus,
			realKobo: deltas.realKobo,
			bonusKobo: deltas.bonusKobo,
		});
		if (walletApply.status === "wallet_missing") {
			console.error("Bonus status wallet update blocked — wallet missing", {
				userId,
				bonusId,
				bonusStatus,
			});
			return c.json({ status: 502, message: "WALLET_MISSING" }, 502);
		}
	} catch (error: unknown) {
		console.error("Bonus status wallet update failed", {
			userId,
			bonusId,
			bonusStatus,
			error,
		});
		return c.json({ status: 502, message: "CREDIT_FAILED" }, 502);
	}

	await upsertBonusEngineUserBonus({
		env: c.env,
		userId,
		bonusId,
		status: bonusStatus,
		payloadJson: verified.bodyString,
	});

	await recordBonusEngineCallbackEvent({
		env: c.env,
		eventType: BONUS_ENGINE_CALLBACK_EVENT_TYPE.BONUS_STATUS_UPDATE,
		idempotencySeed: `${bonusId}:${userId}:${bonusStatus}`,
		bodyJson: verified.bodyString,
	});

	const view = await getBonusEngineCallbackWalletView({
		env: c.env,
		userId,
	});
	return c.json(
		{
			status: 200,
			message: BONUS_ENGINE_CALLBACK_MESSAGE.BONUS_STATUS_UPDATED,
			data: {
				user_id: view.userId,
				real_wallet_balance: view.realWalletBalance,
				bonus_wallet_balance: view.bonusWalletBalance,
				timestamp: view.timestamp,
			},
		},
		200,
	);
});

callbackRoute.post(BONUS_ENGINE_CALLBACK_PATH.BONUS_ALLOCATION, async (c) => {
	const verified = await readAndVerifyCallbackBody(c);
	if (!verified.ok) return verified.response;

	const body = parseJsonObject(verified.bodyString);
	if (!body) {
		return c.json(
			{ status: 400, message: BONUS_ENGINE_CALLBACK_MESSAGE.INVALID_JSON },
			400,
		);
	}

	const userId = asString(body.user_id);
	const records = parseBonusAllocationRecords(body);
	if (!userId || records.length === 0) {
		return c.json(
			{
				status: 410,
				message: BONUS_ENGINE_CALLBACK_MESSAGE.MISSING_FIELDS,
			},
			410,
		);
	}

	for (const record of records) {
		const bonusId = asString(record._id ?? record.userbonus_id ?? record.id);
		if (!bonusId) {
			return c.json(
				{
					status: 410,
					message: BONUS_ENGINE_CALLBACK_MESSAGE.MISSING_FIELDS,
				},
				410,
			);
		}

		const status = asString(record.status).toUpperCase();
		await upsertBonusEngineUserBonus({
			env: c.env,
			userId,
			bonusId,
			status,
			payloadJson: JSON.stringify(record),
		});

		if (!shouldCreditAllocatedBonus(record)) continue;

		try {
			const amounts = parseBonusActivationAmounts(record);
			const credit = await creditBonusActivation({
				env: c.env,
				userId,
				userbonusId: bonusId,
				bonusAmountMajor: amounts.bonusAmountMajor,
				cashAmountMajor: amounts.cashAmountMajor,
			});
			if (credit.status === "wallet_missing") {
				console.error("Bonus allocation credit blocked — wallet missing", {
					userId,
					bonusId,
				});
				return c.json({ status: 502, message: "WALLET_MISSING" }, 502);
			}
		} catch (error: unknown) {
			console.error("Bonus allocation credit failed", {
				userId,
				bonusId,
				error,
			});
			return c.json({ status: 502, message: "CREDIT_FAILED" }, 502);
		}
	}

	await recordBonusEngineCallbackEvent({
		env: c.env,
		eventType: BONUS_ENGINE_CALLBACK_EVENT_TYPE.BONUS_ALLOCATION,
		idempotencySeed: `${userId}:${records
			.map((row) => asString(row._id ?? row.userbonus_id ?? row.id))
			.join(",")}`,
		bodyJson: verified.bodyString,
	});

	const view = await getBonusEngineCallbackWalletView({
		env: c.env,
		userId,
	});
	return c.json(
		{
			status: 200,
			message: BONUS_ENGINE_CALLBACK_MESSAGE.BONUS_ALLOCATION_UPDATED,
			data: {
				user_id: view.userId,
				username: view.username,
				real_wallet_balance: view.realWalletBalance,
				bonus_wallet_balance: view.bonusWalletBalance,
				timestamp: view.timestamp,
			},
		},
		200,
	);
});

export default callbackRoute;
