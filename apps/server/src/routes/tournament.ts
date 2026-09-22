import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
	BonusEngineErrorSchema,
	TournamentJoinRequestSchema,
	TournamentJoinSuccessSchema,
	TournamentLeaderboardRequestSchema,
	TournamentLeaderboardSuccessSchema,
	TournamentListSuccessSchema,
} from "@/schemas/bonus-engine";
import {
	extractBonusEngineMessage,
	getBonusEngineTournamentLeaderboard,
	isBonusEngineConfigured,
	joinBonusEngineTournament,
	listBonusEngineTournaments,
} from "@/services/bonus-engine";
import type { CloudflareBindings } from "../types";

const tournamentRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

function mapUpstreamStatus(status: number): 400 | 401 | 502 | 503 {
	if (status === 401) return 401;
	if (status === 503) return 503;
	if (status >= 400 && status < 500) return 400;
	return 502;
}

const listRoute = createRoute({
	method: "get",
	path: "/list",
	tags: ["Tournaments"],
	summary: "Fetch Bonus Engine tournaments for the project",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Tournament list fetched",
			content: {
				"application/json": { schema: TournamentListSuccessSchema },
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

tournamentRoute.openapi(listRoute, async (c) => {
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

	const result = await listBonusEngineTournaments({ env: c.env });
	if (!result.ok && result.status === 404) {
		return c.json(
			{
				success: true as const,
				data: [],
				message: result.error ?? "No tournaments found",
			},
			200,
		);
	}
	if (!result.ok) {
		return c.json(
			{
				success: false as const,
				error: result.error ?? "Failed to fetch tournaments",
			},
			mapUpstreamStatus(result.status),
		);
	}

	const tournaments = Array.isArray(result.data?.data) ? result.data.data : [];
	return c.json(
		{
			success: true as const,
			data: tournaments,
			message:
				result.data?.message ||
				result.message ||
				extractBonusEngineMessage(result.data, "OK"),
		},
		200,
	);
});

const joinRoute = createRoute({
	method: "post",
	path: "/join",
	tags: ["Tournaments"],
	summary: "Opt the authenticated player into a tournament",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": { schema: TournamentJoinRequestSchema },
			},
		},
	},
	responses: {
		200: {
			description: "Joined tournament",
			content: {
				"application/json": { schema: TournamentJoinSuccessSchema },
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

tournamentRoute.openapi(joinRoute, async (c) => {
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
	const result = await joinBonusEngineTournament({
		env: c.env,
		tournamentId: body.tournament_id,
		userId: user.id,
	});
	if (!result.ok) {
		return c.json(
			{
				success: false as const,
				error: result.error ?? "Failed to join tournament",
			},
			mapUpstreamStatus(result.status),
		);
	}

	const payload = result.data?.data;
	const data =
		payload !== undefined &&
		typeof payload === "object" &&
		!Array.isArray(payload)
			? payload
			: {};
	return c.json(
		{
			success: true as const,
			data,
			message:
				result.data?.message ||
				result.message ||
				extractBonusEngineMessage(result.data, "OK"),
		},
		200,
	);
});

const leaderboardRoute = createRoute({
	method: "get",
	path: "/leaderboard",
	tags: ["Tournaments"],
	summary: "Fetch a Bonus Engine tournament leaderboard",
	security: [{ BearerAuth: [] }],
	request: {
		query: TournamentLeaderboardRequestSchema,
	},
	responses: {
		200: {
			description: "Leaderboard fetched",
			content: {
				"application/json": { schema: TournamentLeaderboardSuccessSchema },
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

tournamentRoute.openapi(leaderboardRoute, async (c) => {
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

	const query = c.req.valid("query");
	const result = await getBonusEngineTournamentLeaderboard({
		env: c.env,
		tournamentId: query.tournament_id,
	});
	if (!result.ok && result.status === 404) {
		return c.json(
			{
				success: true as const,
				data: [],
				message: result.error ?? "No leaderboard found",
			},
			200,
		);
	}
	if (!result.ok) {
		return c.json(
			{
				success: false as const,
				error: result.error ?? "Failed to fetch leaderboard",
			},
			mapUpstreamStatus(result.status),
		);
	}

	const rows = Array.isArray(result.data?.data) ? result.data.data : [];
	return c.json(
		{
			success: true as const,
			data: rows,
			message:
				result.data?.message ||
				result.message ||
				extractBonusEngineMessage(result.data, "OK"),
		},
		200,
	);
});

export default tournamentRoute;
