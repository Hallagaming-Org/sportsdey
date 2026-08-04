import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
	BonusEngineErrorSchema,
	MissionListSuccessSchema,
} from "@/schemas/bonus-engine";
import {
	extractBonusEngineMessage,
	getBonusEngineWalletBalances,
	isBonusEngineConfigured,
	listBonusEngineMissions,
	loginBonusEnginePlayer,
} from "@/services/bonus-engine";
import type { CloudflareBindings } from "../types";

const missionRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

function mapUpstreamStatus(status: number): 400 | 401 | 502 | 503 {
	if (status === 401) return 401;
	if (status === 503) return 503;
	if (status >= 400 && status < 500) return 400;
	return 502;
}

const listRoute = createRoute({
	method: "post",
	path: "/list",
	tags: ["Missions"],
	summary: "Fetch mission list for the authenticated player",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Mission list fetched",
			content: {
				"application/json": { schema: MissionListSuccessSchema },
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

missionRoute.openapi(listRoute, async (c) => {
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

	const balances = await getBonusEngineWalletBalances({
		env: c.env,
		userId: user.id,
	});
	const sync = await loginBonusEnginePlayer({
		env: c.env,
		player: {
			userId: user.id,
			username: user.name || user.email || user.id,
			realWalletBalance: balances.realWalletBalance,
			bonusWalletBalance: balances.bonusWalletBalance,
		},
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

	const result = await listBonusEngineMissions({
		env: c.env,
		userId: user.id,
	});
	if (!result.ok) {
		return c.json(
			{
				success: false as const,
				error: result.error ?? "Failed to fetch missions",
			},
			mapUpstreamStatus(result.status),
		);
	}

	const missions = Array.isArray(result.data?.data) ? result.data.data : [];
	return c.json(
		{
			success: true as const,
			data: missions,
			message:
				result.data?.message ||
				result.message ||
				extractBonusEngineMessage(result.data, "OK"),
		},
		200,
	);
});

export default missionRoute;
