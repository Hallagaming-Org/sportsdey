import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
	MinigodErrorSchema,
	MinigodLauncherResponseSchema,
} from "@/schemas/minigod";
import type { CloudflareBindings } from "../types";
import hallaPocketsRoute from "./halla-pockets";

type HallaGame = "bomb" | "dice" | "metronite";

const HALLA_DEFAULTS: Record<
	HallaGame,
	{ baseUrl: string; apiKeyEnv: keyof CloudflareBindings; baseUrlEnv: keyof CloudflareBindings; label: string }
> = {
	bomb: {
		baseUrl: "https://halla-bomb.minigod.xyz",
		apiKeyEnv: "HALLA_BOMB_API_KEY",
		baseUrlEnv: "HALLA_BOMB_BASE_URL",
		label: "Halla Bomb",
	},
	dice: {
		baseUrl: "https://halla-dice.minigod.xyz",
		apiKeyEnv: "HALLA_DICE_API_KEY",
		baseUrlEnv: "HALLA_DICE_BASE_URL",
		label: "Halla Dice",
	},
	metronite: {
		baseUrl: "https://metronite.minigod.xyz",
		apiKeyEnv: "HALLA_METRONITE_API_KEY",
		baseUrlEnv: "HALLA_METRONITE_BASE_URL",
		label: "Halla Metronite",
	},
};

const hallaRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

function createLauncherRoute(game: HallaGame) {
	const config = HALLA_DEFAULTS[game];

	const launcherRoute = createRoute({
		method: "post",
		path: `/${game}/launcher`,
		tags: ["Halla Mini Games"],
		summary: `Launch ${config.label}`,
		description: `Generate a real-money NGN launch URL for ${config.label}`,
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

	hallaRoute.openapi(launcherRoute, async (c) => {
		const user = c.get("user");
		if (!user) {
			return c.json(
				{
					success: false as const,
					error: "Unauthorized",
				},
				401,
			);
		}

		const apiKey = c.env[config.apiKeyEnv] as string | undefined;
		const baseUrl =
			((c.env[config.baseUrlEnv] as string | undefined) || config.baseUrl).replace(
				/\/$/,
				"",
			);

		if (!apiKey) {
			return c.json(
				{
					success: false as const,
					error: `${config.label} API not configured`,
				},
				500,
			);
		}

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
			success?: boolean;
			data?: { gameUrl: string };
			error?: string;
			message?: string | string[];
		};

		if (!response.ok || data.success === false) {
			const upstream =
				(Array.isArray(data.message)
					? data.message.join("; ")
					: data.message) ||
				data.error ||
				`upstream ${response.status}`;
			console.error(`${config.label} launch failed`, {
				status: response.status,
				upstream,
			});
			return c.json(
				{
					success: false as const,
					error:
						upstream === "Can't get wallet balance"
							? "Halla can't reach Sportsdey wallet callbacks. Confirm they point at /halla/pockets/* with POCKETS_SECRET_KEY."
							: `Failed to launch game (${upstream})`,
				},
				400,
			);
		}

		return c.json(
			{
				success: true as const,
				data: {
					url: data.data?.gameUrl || "",
				},
			},
			200,
		);
	});
}

createLauncherRoute("bomb");
createLauncherRoute("dice");
createLauncherRoute("metronite");

/** Naira in/out wallet callbacks (Lagos Rush keeps kobo on /pockets/*). */
hallaRoute.route("/pockets", hallaPocketsRoute);

export default hallaRoute;
