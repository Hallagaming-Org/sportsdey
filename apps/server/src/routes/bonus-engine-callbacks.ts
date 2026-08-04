import { OpenAPIHono } from "@hono/zod-openapi";
import {
	BONUS_ENGINE_CALLBACK_EVENT_TYPE,
	BONUS_ENGINE_CALLBACK_PATH,
	BONUS_ENGINE_HEADER,
	BONUS_ENGINE_INVALID_SIGNATURE_STATUS,
} from "@/services/bonus-engine/bonus-engine.service.constant";
import {
	getBonusEngineConfig,
	getBonusEngineWalletBalances,
	isBonusEngineCallbackVerifyConfigured,
	recordBonusEngineCallbackEvent,
	upsertBonusEngineLoyaltySnapshot,
	upsertBonusEngineMissionProgress,
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
	json: (body: Record<string, unknown>, status?: 200 | 400 | 413) => Response;
};

/**
 * Verifies the inbound RSA signature over the raw body before any mutation.
 * Docs require HTTP 413 on invalid signatures.
 */
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
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
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
	const recorded = await recordBonusEngineCallbackEvent({
		env: c.env,
		eventType: BONUS_ENGINE_CALLBACK_EVENT_TYPE.MISSION_COMPLETE,
		idempotencySeed: `${missionId}:${playerId}`,
		bodyJson: verified.bodyString,
	});

	if (recorded.isNew && playerId && missionId) {
		await upsertBonusEngineMissionProgress({
			env: c.env,
			userId: playerId,
			missionId,
			progressPercentage: 100,
			completedAt: new Date(),
			rewardJson: reward ? JSON.stringify(reward) : null,
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

callbackRoute.post(BONUS_ENGINE_CALLBACK_PATH.BALANCE, async (c) => {
	const verified = await readAndVerifyCallbackBody(c);
	if (!verified.ok) return verified.response;

	const body = parseJsonObject(verified.bodyString);
	if (!body) {
		return c.json({ status: 400, message: "Invalid JSON body" }, 400);
	}

	const userId = asString(body.user_id);
	if (!userId) {
		return c.json({ status: 400, message: "MISSING_USER_ID" }, 400);
	}

	const balances = await getBonusEngineWalletBalances({
		env: c.env,
		userId,
	});

	return c.json(
		{
			status: 200,
			message: "SUCCESS",
			data: {
				user_id: userId,
				real_wallet_balance: balances.realWalletBalance,
				bonus_wallet_balance: balances.bonusWalletBalance,
			},
		},
		200,
	);
});

export default callbackRoute;
