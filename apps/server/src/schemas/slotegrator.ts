import { z } from "@hono/zod-openapi";

export const SlotitegrationBalanceRequestSchema = z
	.object({
		action: z.literal("balance"),
		player_id: z.string(),
		currency: z.string(),
		session_id: z.string().optional(),
	})
	.openapi({ description: "Slotitegration balance request" });

export const SlotitegrationBalanceResponseSchema = z
	.object({
		action: z.literal("balance"),
		player_id: z.string(),
		balance: z.number(),
		currency: z.string(),
	})
	.openapi({ description: "Slotitegration balance response" });

export const SlotitegrationErrorSchema = z
	.object({
		error: z.string(),
		code: z.string(),
	})
	.openapi({ description: "Slotitegration error response" });