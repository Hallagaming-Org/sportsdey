import { z } from "@hono/zod-openapi";

export const MinigodLauncherResponseSchema = z.object({
	success: z.literal(true).openapi({ description: "Success status" }),
	data: z.object({
		url: z
			.string()
			.openapi({ description: "URL to launch the Minigod game" }),
	}).openapi({ description: "Response data" }),
}).openapi("MinigodLauncherResponse");

export const LagosRushBalanceRequestSchema = z.object({
	playerId: z.string().openapi({ description: "User ID" }),
	currency: z.string().openapi({ description: "Currency code" }),
}).openapi("LagosRushBalanceRequest");

export const LagosRushBalanceResponseSchema = z.object({
	success: z.literal(true).openapi({ description: "Success status" }),
	data: z.object({
		balance: z.number().openapi({ description: "Balance in kobo" }),
		currency: z.string().openapi({ description: "Currency code" }),
	}).openapi({ description: "Response data" }),
}).openapi("LagosRushBalanceResponse");

export const LagosRushDebitRequestSchema = z.object({
	playerId: z.string().openapi({ description: "User ID" }),
	amount: z.number().openapi({ description: "Amount in kobo" }),
	currency: z.string().openapi({ description: "Currency code" }),
});

export const LagosRushDebitResponseSchema = z.object({
	success: z.literal(true).openapi({ description: "Success status" }),
	data: z.object({
		oldBalance: z.number().openapi({ description: "Previous balance in kobo" }),
		newBalance: z.number().openapi({ description: "New balance in kobo" }),
		currency: z.string().openapi({ description: "Currency code" }),
		transactionId: z.string().openapi({ description: "Transaction ID" }),
	}).openapi({ description: "Response data" }),
}).openapi("LagosRushDebitResponse");

export const LagosRushCreditRequestSchema = z.object({
	playerId: z.string().openapi({ description: "Player ID" }),
	amount: z.number().openapi({ description: "Amount in kobo" }),
	currency: z.string().openapi({ description: "Currency code" }),
}).openapi("LagosRushCreditRequest");

export const LagosRushCreditResponseSchema = z.object({
	success: z.literal(true).openapi({ description: "Success status" }),
	data: z.object({
		oldBalance: z.number().openapi({ description: "Previous balance in kobo" }),
		newBalance: z.number().openapi({ description: "New balance in kobo" }),
		currency: z.string().openapi({ description: "Currency code" }),
		transactionId: z.string().openapi({ description: "Transaction ID" }),
	}).openapi({ description: "Response data" }),
}).openapi("LagosRushCreditResponse");

export const LagosRushRefundRequestSchema = z.object({
	playerId: z.string().openapi({ description: "Player ID" }),
	amount: z.number().openapi({ description: "Amount in kobo" }),
	currency: z.string().openapi({ description: "Currency code" }),
}).openapi("LagosRushRefundRequest");

export const LagosRushRefundResponseSchema = z.object({
	success: z.literal(true).openapi({ description: "Success status" }),
	data: z.object({
		oldBalance: z.number().openapi({ description: "Previous balance in kobo" }),
		newBalance: z.number().openapi({ description: "New balance in kobo" }),
		currency: z.string().openapi({ description: "Currency code" }),
		transactionId: z.string().openapi({ description: "Transaction ID" }),
	}).openapi({ description: "Response data" }),
}).openapi("LagosRushRefundResponse");

export const MinigodErrorSchema = z.object({
	success: z.literal(false).openapi({ description: "Success status" }),
	error: z.string().openapi({ description: "Error message" }),
}).openapi("MinigodError");
