import { z } from "@hono/zod-openapi";

export const CreateSportsbookTokenSchema = z.object({
	locale: z.string().openapi({ description: "Language code (e.g., 'en')" }),
	currency: z.string().openapi({ description: "Currency code (e.g., 'EUR', 'NGN')" }),
});

export const CreateSportsbookTokenResponseSchema = z.object({
	token: z.string().openapi({ description: "Betting session token" }),
});

export const SportsbookTokenErrorSchema = z.object({
	success: z.literal(false),
	error: z.string(),
	details: z.null().optional(),
});