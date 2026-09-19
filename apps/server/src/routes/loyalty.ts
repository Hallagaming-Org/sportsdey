import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
	BonusEngineErrorSchema,
	LoyaltyHistorySuccessSchema,
	LoyaltyListsSuccessSchema,
	LoyaltyPointsSuccessSchema,
	LoyaltyRedeemRequestSchema,
	LoyaltyRedeemSuccessSchema,
} from "@/schemas/bonus-engine";
import {
	extractBonusEngineMessage,
	getBonusEngineLoyaltyHistory,
	getBonusEngineLoyaltyLists,
	getBonusEngineLoyaltyPoints,
	isBonusEngineConfigured,
	redeemBonusEngineLoyaltyPoints,
	shouldTreatLoyaltyHistoryAsEmpty,
	BONUS_ENGINE_LOYALTY_MESSAGE,
} from "@/services/bonus-engine";
import type { CloudflareBindings } from "../types";

const loyaltyRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

function mapUpstreamStatus(status: number): 400 | 401 | 502 | 503 {
	if (status === 401) return 401;
	if (status === 503) return 503;
	if (status >= 400 && status < 500) return 400;
	return 502;
}

const pointsRoute = createRoute({
	method: "get",
	path: "/points",
	tags: ["Loyalty"],
	summary: "Fetch current loyalty points for the authenticated player",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Loyalty points fetched",
			content: {
				"application/json": { schema: LoyaltyPointsSuccessSchema },
			},
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: BonusEngineErrorSchema } },
		},
		400: {
			description: "Upstream client error",
			content: { "application/json": { schema: BonusEngineErrorSchema } },
		},
		502: {
			description: "Bonus Engine upstream error",
			content: { "application/json": { schema: BonusEngineErrorSchema } },
		},
		503: {
			description: "Bonus Engine not configured",
			content: { "application/json": { schema: BonusEngineErrorSchema } },
		},
	},
});

loyaltyRoute.openapi(pointsRoute, async (c) => {
	const user = c.get("user");
	if (!user?.id) {
		return c.json({ success: false as const, error: "Unauthorized" }, 401);
	}
	if (!isBonusEngineConfigured(c.env)) {
		return c.json(
			{
				success: false as const,
				error: "Bonus Engine is not configured",
			},
			503,
		);
	}

	const result = await getBonusEngineLoyaltyPoints({
		env: c.env,
		userId: user.id,
	});
	if (!result.ok && result.status === 404) {
		return c.json(
			{
				success: true as const,
				data: {
					player_id: user.id,
					total_points: 0,
					loyalty_level: "Iron",
				},
				message: result.error ?? "Player loyalty data not found",
			},
			200,
		);
	}
	if (!result.ok) {
		return c.json(
			{
				success: false as const,
				error: result.error ?? "Failed to fetch loyalty points",
			},
			mapUpstreamStatus(result.status),
		);
	}

	return c.json(
		{
			success: true as const,
			data: result.data?.data ?? {},
			message:
				result.data?.message ||
				result.message ||
				extractBonusEngineMessage(result.data, "OK"),
		},
		200,
	);
});

const redeemRoute = createRoute({
	method: "post",
	path: "/redeem",
	tags: ["Loyalty"],
	summary: "Redeem loyalty points for the authenticated player",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": { schema: LoyaltyRedeemRequestSchema },
			},
		},
	},
	responses: {
		200: {
			description: "Loyalty points redeemed",
			content: {
				"application/json": { schema: LoyaltyRedeemSuccessSchema },
			},
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: BonusEngineErrorSchema } },
		},
		400: {
			description: "Insufficient points or invalid request",
			content: { "application/json": { schema: BonusEngineErrorSchema } },
		},
		502: {
			description: "Bonus Engine upstream error",
			content: { "application/json": { schema: BonusEngineErrorSchema } },
		},
		503: {
			description: "Bonus Engine not configured",
			content: { "application/json": { schema: BonusEngineErrorSchema } },
		},
	},
});

loyaltyRoute.openapi(redeemRoute, async (c) => {
	const user = c.get("user");
	if (!user?.id) {
		return c.json({ success: false as const, error: "Unauthorized" }, 401);
	}
	if (!isBonusEngineConfigured(c.env)) {
		return c.json(
			{
				success: false as const,
				error: "Bonus Engine is not configured",
			},
			503,
		);
	}

	const body = c.req.valid("json");
	const result = await redeemBonusEngineLoyaltyPoints({
		env: c.env,
		userId: user.id,
		pointsToRedeem: body.points_to_redeem,
		loyaltyId: body.loyalty_id,
	});
	if (!result.ok) {
		return c.json(
			{
				success: false as const,
				error: result.error ?? "Failed to redeem loyalty points",
			},
			mapUpstreamStatus(result.status),
		);
	}

	return c.json(
		{
			success: true as const,
			data: result.data?.data ?? {},
			message:
				result.data?.message ||
				result.message ||
				extractBonusEngineMessage(result.data, "OK"),
		},
		200,
	);
});

const historyRoute = createRoute({
	method: "get",
	path: "/history",
	tags: ["Loyalty"],
	summary: "Fetch loyalty points history for the authenticated player",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Loyalty history fetched",
			content: {
				"application/json": { schema: LoyaltyHistorySuccessSchema },
			},
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: BonusEngineErrorSchema } },
		},
		400: {
			description: "Upstream client error",
			content: { "application/json": { schema: BonusEngineErrorSchema } },
		},
		502: {
			description: "Bonus Engine upstream error",
			content: { "application/json": { schema: BonusEngineErrorSchema } },
		},
		503: {
			description: "Bonus Engine not configured",
			content: { "application/json": { schema: BonusEngineErrorSchema } },
		},
	},
});

loyaltyRoute.openapi(historyRoute, async (c) => {
	const user = c.get("user");
	if (!user?.id) {
		return c.json({ success: false as const, error: "Unauthorized" }, 401);
	}
	if (!isBonusEngineConfigured(c.env)) {
		return c.json(
			{
				success: false as const,
				error: "Bonus Engine is not configured",
			},
			503,
		);
	}

	const result = await getBonusEngineLoyaltyHistory({
		env: c.env,
		userId: user.id,
	});
	if (shouldTreatLoyaltyHistoryAsEmpty(result)) {
		console.warn("Bonus Engine loyalty history unavailable; returning empty", {
			userId: user.id,
			status: result.status,
			error: result.error,
		});
		return c.json(
			{
				success: true as const,
				data: [],
				message: BONUS_ENGINE_LOYALTY_MESSAGE.HISTORY_EMPTY,
			},
			200,
		);
	}
	if (!result.ok) {
		console.error("Bonus Engine loyalty history failed", {
			userId: user.id,
			status: result.status,
			error: result.error,
		});
		return c.json(
			{
				success: false as const,
				error: BONUS_ENGINE_LOYALTY_MESSAGE.HISTORY_UNAVAILABLE,
			},
			mapUpstreamStatus(result.status),
		);
	}

	const history = Array.isArray(result.data?.data) ? result.data.data : [];
	return c.json(
		{
			success: true as const,
			data: history,
			message:
				result.data?.message ||
				result.message ||
				extractBonusEngineMessage(result.data, "OK"),
		},
		200,
	);
});

const listsRoute = createRoute({
	method: "get",
	path: "/lists",
	tags: ["Loyalty"],
	summary: "Fetch all active loyalty campaigns for the project",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Active loyalty campaigns fetched",
			content: {
				"application/json": { schema: LoyaltyListsSuccessSchema },
			},
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: BonusEngineErrorSchema } },
		},
		400: {
			description: "Upstream client error",
			content: { "application/json": { schema: BonusEngineErrorSchema } },
		},
		502: {
			description: "Bonus Engine upstream error",
			content: { "application/json": { schema: BonusEngineErrorSchema } },
		},
		503: {
			description: "Bonus Engine not configured",
			content: { "application/json": { schema: BonusEngineErrorSchema } },
		},
	},
});

loyaltyRoute.openapi(listsRoute, async (c) => {
	const user = c.get("user");
	if (!user?.id) {
		return c.json({ success: false as const, error: "Unauthorized" }, 401);
	}
	if (!isBonusEngineConfigured(c.env)) {
		return c.json(
			{
				success: false as const,
				error: "Bonus Engine is not configured",
			},
			503,
		);
	}

	const result = await getBonusEngineLoyaltyLists({ env: c.env });
	if (!result.ok && result.status === 404) {
		return c.json(
			{
				success: true as const,
				data: [],
				message: result.error ?? "No active loyalty campaigns found",
			},
			200,
		);
	}
	if (!result.ok) {
		return c.json(
			{
				success: false as const,
				error: result.error ?? "Failed to fetch loyalty campaigns",
			},
			mapUpstreamStatus(result.status),
		);
	}

	const campaigns = Array.isArray(result.data?.data) ? result.data.data : [];
	return c.json(
		{
			success: true as const,
			data: campaigns,
			message:
				result.data?.message ||
				result.message ||
				extractBonusEngineMessage(result.data, "OK"),
		},
		200,
	);
});

export default loyaltyRoute;
