import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
	MinigodErrorSchema,
	MinigodLauncherResponseSchema,
} from "@/schemas/minigod";
import type { CloudflareBindings } from "../types";

const lagosRushRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const launcherRoute = createRoute({
	method: "post",
	path: "/launcher",
	tags: ["Lagos rush casino"],
	summary: "Launch a lagos rush casino game",
	description: "Generate a game launch URL for Minigod casino",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Game launch URL generated",
			content: {
				"application/json": {
					schema: MinigodLauncherResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid request",
			content: {
				"application/json": {
					schema: MinigodErrorSchema,
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: MinigodErrorSchema,
				},
			},
		},
		500: {
			description: "Server error",
			content: {
				"application/json": {
					schema: MinigodErrorSchema,
				},
			},
		},
	},
});

lagosRushRoute.openapi(launcherRoute, async (c) => {
	const user = c.get("user");
	console.log("launcher endpoint - user from c.get:", user);
	console.log("launcher endpoint - session from c.get:", c.get("session"));
	if (!user) {
		return c.json(
			{
				success: false,
				error: "Unauthorized",
			},
			401,
		);
	}

	const apiKey = c.env.LAGOS_RUSH_API_KEY;
	const baseUrl = c.env.LAGOS_RUSH_BASE_URL || "https://lagos-rush.minigod.xyz";

	if (!apiKey) {
		return c.json(
			{
				success: false,
				error: "Lagos rush API not configured",
			},
			500,
		);
	}

	// const nameParts = (user.name || "").split(" ");
	// const firstName = nameParts[0] || "User";
	// const lastName = nameParts.slice(1).join(" ") || "User";

	const payload = {
		playerId: user.id,
		username: user.name,
		email: user.email || "",
		currency: "NGN",
		operatorAlias: "SPORTDEY",
	};

	const response = await fetch(`${baseUrl}/api/v1/launcher`, {
		method: "POST",
		headers: {
			"x-api-key": apiKey,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	const data = (await response.json()) as {
		success: boolean;
		data?: { gameUrl: string };
		error?: string;
	};

	if (!response.ok || !data.success) {
		return c.json(
			{
				success: false,
				error: "Failed to launch game",
			},
			400,
		);
	}

	return c.json(
		{
			success: true,
			data: {
				url: data.data?.gameUrl || "",
			},
		},
		200,
	);
});

export default lagosRushRoute;
