import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import {
	GamePlayErrorSchema,
	GamePlayRequestSchema,
	GamePlayResponseSchema,
	TransactionsResponseSchema,
} from "@/schemas/casino";
import type { CloudflareBindings } from "../types";

const casinoRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const playGameRoute = createRoute({
	method: "post",
	path: "/play/{gameCode}",
	tags: ["Casino"],
	summary: "Play a casino game",
	description: "Generate launch token and redirect to game provider",
	security: [{ BearerAuth: [] }],
	request: {
		params: GamePlayRequestSchema,
	},
	responses: {
		200: {
			description: "Game launch URL generated",
			content: {
				"application/json": {
					schema: GamePlayResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid request or game not found",
			content: {
				"application/json": {
					schema: GamePlayErrorSchema,
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: GamePlayErrorSchema,
				},
			},
		},
	},
});

const getTransactionsRoute = createRoute({
	method: "get",
	path: "/transactions",
	tags: ["Casino"],
	summary: "Get casino transactions",
	description: "Retrieve user's casino game transaction history",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Transactions retrieved successfully",
			content: {
				"application/json": {
					schema: TransactionsResponseSchema,
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: GamePlayErrorSchema,
				},
			},
		},
	},
});

casinoRoute.openapi(playGameRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(
			{
				success: false,
				error: "Unauthorized",
			},
			401,
		);
	}

	const { gameCode } = c.req.valid("param");
	const db = drizzle(c.env.DB, { schema });

	const token = `launch_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;

	await db.insert(schema.gameLaunchTokens).values({
		token,
		userId: user.id,
		game: gameCode,
		used: false,
	});

	const baseUrl =
		c.env.LUCKYWORLDGAMES_LAUNCH_URL ||
		"https://play.luckyworldgames.com/launch";
	const launchUrl = `${baseUrl}/${gameCode}?user=${user.id}&token=${token}&currency=NGN&operator=HALLABET`;

	return c.json(
		{
			success: true,
			data: {
				launchUrl,
				token,
			},
		},
		200,
	);
});

casinoRoute.openapi(getTransactionsRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(
			{
				success: false,
				error: "Unauthorized",
			},
			401,
		);
	}

	const db = drizzle(c.env.DB, { schema });

	const transactions = await db
		.select()
		.from(schema.gameTransactions)
		.where(eq(schema.gameTransactions.userId, user.id))
		.orderBy(desc(schema.gameTransactions.createdAt))
		.limit(50);

	const formattedTransactions = transactions.map((tx) => ({
		id: tx.id,
		providerTxId: tx.providerTxId,
		type: tx.type,
		amount: tx.amount,
		game: tx.game,
		createdAt: tx.createdAt.toISOString(),
	}));

	return c.json(
		{
			success: true,
			data: formattedTransactions,
		},
		200,
	);
});

export default casinoRoute;
