import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
	BonusActionRequestSchema,
	BonusActionSuccessSchema,
	BonusCampaignsRequestSchema,
	BonusCampaignsSuccessSchema,
	BonusEngineErrorSchema,
	BonusListSuccessSchema,
} from "@/schemas/bonus-engine";
import {
	activateBonusEngineUserBonus,
	cancelBonusEngineUserBonus,
	extractBonusEngineMessage,
	isBonusEngineConfigured,
	isBonusEngineJsonNotFound,
	isBonusEngineUnhandledException,
	listBonusEngineCampaigns,
	listBonusEngineUserBonuses,
	BONUS_ENGINE_UPSTREAM_ROUTE_MISSING,
} from "@/services/bonus-engine";
import type { CloudflareBindings } from "../types";

const bonusRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

function mapUpstreamStatus(status: number, error?: string): 400 | 401 | 502 | 503 {
	if (isHtmlUpstreamError(error)) return 502;
	if (status === 401) return 401;
	if (status === 503) return 503;
	if (status >= 400 && status < 500) return 400;
	return 502;
}

function isHtmlUpstreamError(error?: string): boolean {
	const message = error?.trim() ?? "";
	return message.startsWith("<") || /cannot post/i.test(message);
}


function publicBonusEngineError(error: string | undefined, fallback: string): string {
	if (isHtmlUpstreamError(error)) return BONUS_ENGINE_UPSTREAM_ROUTE_MISSING;
	if (isBonusEngineUnhandledException(error)) return fallback;
	const message = error?.trim() ?? "";
	return message || fallback;
}

function publicBonusEngineListMessage(
	message: string | undefined,
	fallback: string,
): string {
	if (isBonusEngineUnhandledException(message)) return fallback;
	const text = message?.trim() ?? "";
	return text || fallback;
}

const campaignsRoute = createRoute({
	method: "post",
	path: "/campaigns",
	tags: ["Bonuses"],
	summary: "Fetch active bonus campaigns for the authenticated player",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": { schema: BonusCampaignsRequestSchema },
			},
		},
	},
	responses: {
		200: {
			description: "Active bonus campaigns fetched",
			content: {
				"application/json": { schema: BonusCampaignsSuccessSchema },
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

bonusRoute.openapi(campaignsRoute, async (c) => {
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
	const result = await listBonusEngineCampaigns({
		env: c.env,
		userId: user.id,
		bonusType: body.bonus_type,
	});
	if (!result.ok && isBonusEngineJsonNotFound(result)) {
		return c.json(
			{
				success: true as const,
				data: [],
				message: "No active bonus campaigns found",
			},
			200,
		);
	}
	if (!result.ok) {
		return c.json(
			{
				success: false as const,
				error: publicBonusEngineError(
					result.error,
					"Failed to fetch bonus campaigns",
				),
			},
			mapUpstreamStatus(result.status, result.error),
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

const listRoute = createRoute({
	method: "post",
	path: "/list",
	tags: ["Bonuses"],
	summary: "Fetch player bonus assignments for the authenticated player",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Player bonuses fetched",
			content: {
				"application/json": { schema: BonusListSuccessSchema },
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

bonusRoute.openapi(listRoute, async (c) => {
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

	const result = await listBonusEngineUserBonuses({
		env: c.env,
		userId: user.id,
		username: user.name || user.email || user.id,
	});
	if (!result.ok && isBonusEngineJsonNotFound(result)) {
		return c.json(
			{
				success: true as const,
				data: [],
				message: "No player bonuses found",
			},
			200,
		);
	}
	if (!result.ok) {
		return c.json(
			{
				success: false as const,
				error: publicBonusEngineError(
					result.error,
					"Failed to fetch player bonuses",
				),
			},
			mapUpstreamStatus(result.status, result.error),
		);
	}

	const bonuses = Array.isArray(result.data?.data) ? result.data.data : [];
	return c.json(
		{
			success: true as const,
			data: bonuses,
			message: publicBonusEngineListMessage(
				result.data?.message ||
					result.message ||
					extractBonusEngineMessage(result.data, ""),
				bonuses.length > 0 ? "OK" : "No player bonuses found",
			),
		},
		200,
	);
});

const activateRoute = createRoute({
	method: "post",
	path: "/activate",
	tags: ["Bonuses"],
	summary: "Activate a player bonus assignment",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": { schema: BonusActionRequestSchema },
			},
		},
	},
	responses: {
		200: {
			description: "Bonus activated",
			content: {
				"application/json": { schema: BonusActionSuccessSchema },
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
			description: "Bonus Engine upstream error or wallet credit failed",
			content: { "application/json": { schema: BonusEngineErrorSchema } },
		},
		503: {
			description: "Bonus Engine not configured",
			content: { "application/json": { schema: BonusEngineErrorSchema } },
		},
	},
});

bonusRoute.openapi(activateRoute, async (c) => {
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
	const result = await activateBonusEngineUserBonus({
		env: c.env,
		userId: user.id,
		username: user.name || user.email || user.id,
		userbonusId: body.userbonus_id,
	});
	if (!result.ok) {
		return c.json(
			{
				success: false as const,
				error: publicBonusEngineError(
					result.error,
					"Failed to activate bonus",
				),
			},
			mapUpstreamStatus(result.status, result.error),
		);
	}

	return c.json(
		{
			success: true as const,
			data: result.data?.data ?? {},
			message:
				result.data?.message ||
				result.message ||
				extractBonusEngineMessage(result.data, "BONUS ACTIVATED"),
		},
		200,
	);
});

const cancelRoute = createRoute({
	method: "post",
	path: "/cancel",
	tags: ["Bonuses"],
	summary: "Cancel a player bonus assignment",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": { schema: BonusActionRequestSchema },
			},
		},
	},
	responses: {
		200: {
			description: "Bonus cancelled",
			content: {
				"application/json": { schema: BonusActionSuccessSchema },
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

bonusRoute.openapi(cancelRoute, async (c) => {
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
	const result = await cancelBonusEngineUserBonus({
		env: c.env,
		userId: user.id,
		userbonusId: body.userbonus_id,
	});
	if (!result.ok) {
		return c.json(
			{
				success: false as const,
				error: publicBonusEngineError(
					result.error,
					"Failed to cancel bonus",
				),
			},
			mapUpstreamStatus(result.status, result.error),
		);
	}

	return c.json(
		{
			success: true as const,
			data: result.data?.data ?? {},
			message:
				result.data?.message ||
				result.message ||
				extractBonusEngineMessage(result.data, "BONUS CANCELLED"),
		},
		200,
	);
});

export default bonusRoute;
