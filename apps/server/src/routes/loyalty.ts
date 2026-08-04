import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
	BonusEngineErrorSchema,
	LoyaltyHistorySuccessSchema,
	LoyaltyPointsSuccessSchema,
	LoyaltyRedeemRequestSchema,
	LoyaltyRedeemSuccessSchema,
} from "@/schemas/bonus-engine";
import {
	extractBonusEngineMessage,
	getBonusEngineLoyaltyHistory,
	getBonusEngineLoyaltyPoints,
	getBonusEngineWalletBalances,
	isBonusEngineConfigured,
	loginBonusEnginePlayer,
	redeemBonusEngineLoyaltyPoints,
} from "@/services/bonus-engine";
import type { CloudflareBindings } from "../types";

const loyaltyRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

/**
 * Ensures the player exists on Bonus Engine with current wallet balances before feature calls.
 */
async function syncBonusEnginePlayer(payload: {
	env: CloudflareBindings;
	userId: string;
	username: string;
}) {
	const balances = await getBonusEngineWalletBalances({
		env: payload.env,
		userId: payload.userId,
	});
	return loginBonusEnginePlayer({
		env: payload.env,
		player: {
			userId: payload.userId,
			username: payload.username,
			realWalletBalance: balances.realWalletBalance,
			bonusWalletBalance: balances.bonusWalletBalance,
		},
	});
}

function mapUpstreamStatus(status: number): 400 | 401 | 502 | 503 {
	if (status === 401) return 401;
	if (status === 503) return 503;
	if (status >= 400 && status < 500) return 400;
	return 502;
}

const pointsRoute = createRoute({
	method: "post",
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

	const sync = await syncBonusEnginePlayer({
		env: c.env,
		userId: user.id,
		username: user.name || user.email || user.id,
	});
	if (!sync.ok) {
		return c.json(
			{
				success: false as const,
				error: sync.error ?? "Failed to sync player with Bonus Engine",
			},
			mapUpstreamStatus(sync.status),
		);
	}

	const result = await getBonusEngineLoyaltyPoints({
		env: c.env,
		userId: user.id,
	});
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
	const sync = await syncBonusEnginePlayer({
		env: c.env,
		userId: user.id,
		username: user.name || user.email || user.id,
	});
	if (!sync.ok) {
		return c.json(
			{
				success: false as const,
				error: sync.error ?? "Failed to sync player with Bonus Engine",
			},
			mapUpstreamStatus(sync.status),
		);
	}

	const result = await redeemBonusEngineLoyaltyPoints({
		env: c.env,
		userId: user.id,
		pointsToRedeem: body.points_to_redeem,
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
	method: "post",
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

	const sync = await syncBonusEnginePlayer({
		env: c.env,
		userId: user.id,
		username: user.name || user.email || user.id,
	});
	if (!sync.ok) {
		return c.json(
			{
				success: false as const,
				error: sync.error ?? "Failed to sync player with Bonus Engine",
			},
			mapUpstreamStatus(sync.status),
		);
	}

	const result = await getBonusEngineLoyaltyHistory({
		env: c.env,
		userId: user.id,
	});
	if (!result.ok) {
		return c.json(
			{
				success: false as const,
				error: result.error ?? "Failed to fetch loyalty history",
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

export default loyaltyRoute;
