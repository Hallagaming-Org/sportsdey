import { z } from "@hono/zod-openapi";

export const GamePlayRequestSchema = z.object({
	gameCode: z.string().openapi({ description: "Game code to play" }),
}).openapi("GamePlayRequest");

export const GamePlayResponseSchema = z.object({
	success: z.literal(true).openapi({ description: "Success status" }),
	data: z.object({
		launchUrl: z.string().openapi({ description: "URL to launch the game" }),
		token: z.string().openapi({ description: "Token for game" }),
	}).openapi({ description: "Response data" }),
}).openapi("GamePlayResponse");

export const GamePlayErrorSchema = z.object({
	success: z.literal(false).openapi({ description: "Success status" }),
	error: z.string().openapi({ description: "Error message" }),
}).openapi("GamePlayError");

export const CasinoTransactionSchema = z.object({
	id: z.string().openapi({ description: "Transaction ID" }),
	providerTxId: z.string().openapi({ description: "Provider transaction ID" }),
	type: z.string().openapi({ description: "Transaction type" }),
	amount: z.number().openapi({ description: "Transaction amount" }),
	game: z.string().openapi({ description: "Game name" }),
	createdAt: z.string().openapi({ description: "Creation timestamp" }),
}).openapi("CasinoTransaction");

export const TransactionsResponseSchema = z.object({
	success: z.literal(true).openapi({ description: "Success status" }),
	data: z.array(CasinoTransactionSchema).openapi({ description: "Transactions" }),
}).openapi("TransactionsResponse");
