import { z } from "@hono/zod-openapi";

export const ThundrGameIdSchema = z
	.enum(["solitaire", "blocks", "twentyone", "blackjack", "slots", "plinko"])
	.openapi({ description: "Thundr game identifier" });

export const ThundrPlayRequestSchema = z.object({
	gameId: ThundrGameIdSchema.openapi({ param: { name: "gameId", in: "path" } }),
}).openapi("ThundrPlayRequest");

export const ThundrPlayResponseSchema = z.object({
	success: z.literal(true).openapi({ description: "Success status" }),
	data: z.object({
		launchUrl: z
			.string()
			.openapi({ description: "URL to launch the Thundr game" }),
	}).openapi({ description: "Response data" }),
}).openapi("ThundrPlayResponse");

export const ThundrErrorSchema = z.object({
	success: z.literal(false).openapi({ description: "Success status" }),
	error: z.string().openapi({ description: "Error message" }),
}).openapi("ThundrError");

export const ThundrSessionRequestSchema = z.object({
	sessionToken: z.string().openapi({ param: { name: "sessionToken" } }),
}).openapi("ThundrSessionRequest");

export const ThundrSessionResponseSchema = z.object({
	userId: z.string().openapi({ description: "User ID" }),
	displayName: z.string().openapi({ description: "Display name" }),
	sessionId: z.string().openapi({ description: "Session ID" }),
	currency: z.string().openapi({ description: "Currency" }),
}).openapi("ThundrSessionResponse");

export const ThundrSessionErrorResponseSchema = z.object({
	errors: z.array(
		z.object({
			code: z.literal("SESSION_EXPIRED").openapi({ description: "Error code" }),
			isClientSafe: z.literal(true).openapi({ description: "Is client safe" }),
		}),
	).openapi({ description: "Errors" }),
}).openapi("ThundrSessionErrorResponse");

export const ThundrInsufficientBalanceErrorSchema = z.object({
	errors: z.array(
		z.object({
			code: z.literal("INSUFFICIENT_BALANCE").openapi({ description: "Error code" }),
			isClientSafe: z.literal(true).openapi({ description: "Is client safe" }),
		}),
	).openapi({ description: "Errors" }),
}).openapi("ThundrInsufficientBalanceError");

export const ThundrTransactionErrorSchema = z.discriminatedUnion("code", [
	z.object({
		code: z.literal("INSUFFICIENT_BALANCE").openapi({ description: "Error code" }),
		isClientSafe: z.literal(true).openapi({ description: "Is client safe" }),
	}),
	z.object({
		code: z.literal("SESSION_EXPIRED").openapi({ description: "Error code" }),
		isClientSafe: z.literal(true).openapi({ description: "Is client safe" }),
	}),
	z.object({
		code: z.literal("INVALID_SIGNATURE").openapi({ description: "Error code" }),
		isClientSafe: z.literal(true).openapi({ description: "Is client safe" }),
	}),
]);

export const ThundrTransactionErrorResponseSchema = z.object({
	errors: z.array(ThundrTransactionErrorSchema).openapi({ description: "Errors" }),
}).openapi("ThundrTransactionErrorResponse");

const ThundrTransactionBaseSchema = z.object({
	type: z.enum(["BET", "WIN", "LOSE", "DRAW", "ROLLBACK"]).openapi({ description: "Transaction type" }),
	transactionId: z.string().openapi({ description: "Transaction ID" }),
	requestedAt: z.string().datetime().openapi({ description: "Requested at" }),
	userId: z.string().openapi({ description: "User ID" }),
	sessionId: z.string().openapi({ description: "Session ID" }),
	roundId: z.string().openapi({ description: "Round ID" }),
	currency: z.string().openapi({ description: "Currency" }),
	gameId: ThundrGameIdSchema.openapi({ description: "Game ID" }),
}).openapi("ThundrTransactionBase");

export const ThundrBetTransactionSchema = z.object({
	type: z.literal("BET").openapi({ description: "Transaction type" }),
	transactionId: z.string().openapi({ description: "Transaction ID" }),
	requestedAt: z.string().datetime().openapi({ description: "Requested at" }),
	userId: z.string().openapi({ description: "User ID" }),
	sessionId: z.string().openapi({ description: "Session ID" }),
	roundId: z.string().openapi({ description: "Round ID" }),
	currency: z.string().openapi({ description: "Currency" }),
	gameId: ThundrGameIdSchema.openapi({ description: "Game ID" }),
	amount: z.number().openapi({ description: "Amount" }),
	reward: z.number().optional().openapi({ description: "Reward" }),
	serviceFee: z.number().optional().openapi({ description: "Service fee" }),
}).openapi("ThundrBetTransaction");

export const ThundrWinTransactionSchema = z.object({
	type: z.literal("WIN").openapi({ description: "Transaction type" }),
	transactionId: z.string().openapi({ description: "Transaction ID" }),
	requestedAt: z.string().datetime().openapi({ description: "Requested at" }),
	userId: z.string().openapi({ description: "User ID" }),
	sessionId: z.string().openapi({ description: "Session ID" }),
	roundId: z.string().openapi({ description: "Round ID" }),
	currency: z.string().openapi({ description: "Currency" }),
	gameId: ThundrGameIdSchema.openapi({ description: "Game ID" }),
	amount: z.number().openapi({ description: "Amount" }),
	roomId: z.string().optional().openapi({ description: "Room ID" }),
}).openapi("ThundrWinTransaction");

export const ThundrLoseTransactionSchema = z.object({
	type: z.literal("LOSE").openapi({ description: "Transaction type" }),
	transactionId: z.string().openapi({ description: "Transaction ID" }),
	requestedAt: z.string().datetime().openapi({ description: "Requested at" }),
	userId: z.string().openapi({ description: "User ID" }),
	sessionId: z.string().openapi({ description: "Session ID" }),
	roundId: z.string().openapi({ description: "Round ID" }),
	currency: z.string().openapi({ description: "Currency" }),
	gameId: ThundrGameIdSchema.openapi({ description: "Game ID" }),
	roomId: z.string().optional().openapi({ description: "Room ID" }),
}).openapi("ThundrLoseTransaction");

export const ThundrDrawTransactionSchema = z.object({
	type: z.literal("DRAW").openapi({ description: "Transaction type" }),
	transactionId: z.string().openapi({ description: "Transaction ID" }),
	requestedAt: z.string().datetime().openapi({ description: "Requested at" }),
	userId: z.string().openapi({ description: "User ID" }),
	sessionId: z.string().openapi({ description: "Session ID" }),
	roundId: z.string().openapi({ description: "Round ID" }),
	currency: z.string().openapi({ description: "Currency" }),
	gameId: ThundrGameIdSchema.openapi({ description: "Game ID" }),
	amount: z.number().openapi({ description: "Amount" }),
	roomId: z.string().optional().openapi({ description: "Room ID" }),
}).openapi("ThundrDrawTransaction");

export const ThundrRollbackTransactionSchema = z.object({
	type: z.literal("ROLLBACK").openapi({ description: "Transaction type" }),
	transactionId: z.string().openapi({ description: "Transaction ID" }),
	requestedAt: z.string().datetime().openapi({ description: "Requested at" }),
	userId: z.string().openapi({ description: "User ID" }),
	sessionId: z.string().openapi({ description: "Session ID" }),
	roundId: z.string().openapi({ description: "Round ID" }),
	currency: z.string().openapi({ description: "Currency" }),
	gameId: ThundrGameIdSchema.openapi({ description: "Game ID" }),
	originalTransactionId: z.string().openapi({ description: "Original transaction ID" }),
}).openapi("ThundrRollbackTransaction");

export const ThundrTransactionRequestSchema = z.discriminatedUnion("type", [
	ThundrBetTransactionSchema,
	ThundrWinTransactionSchema,
	ThundrLoseTransactionSchema,
	ThundrDrawTransactionSchema,
	ThundrRollbackTransactionSchema,
]).openapi("ThundrTransactionRequest");

export const ThundrTransactionResponseSchema = z.object({
	transactionId: z.string().openapi({ description: "Transaction ID" }),
	userId: z.string().openapi({ description: "User ID" }),
	currency: z.string().openapi({ description: "Currency" }),
	amount: z.number().openapi({ description: "Amount" }),
	type: z.enum(["BET", "WIN", "LOSE", "DRAW", "ROLLBACK"]).openapi({ description: "Transaction type" }),
}).openapi("ThundrTransactionResponse");

export const ThundrBalanceRequestSchema = z.object({
	userId: z.string().openapi({ param: { name: "userId", in: "path" } }),
}).openapi("ThundrBalanceRequest");

export const ThundrBalanceQuerySchema = z.object({
	sessionId: z.string().openapi({ description: "Session ID" }),
	currency: z.string().openapi({ description: "Currency" }),
	gameId: z.string().openapi({ description: "Game ID" }),
}).openapi("ThundrBalanceQuery");

export const ThundrBalanceResponseSchema = z.object({
	balance: z.number().openapi({ description: "Balance" }),
}).openapi("ThundrBalanceResponse");
