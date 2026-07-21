import { z } from "@hono/zod-openapi";

export const AffnookSyncEventSchema = z
	.enum(["registration", "login"])
	.openapi("AffnookSyncEvent");

export const AffnookSyncRequestSchema = z
	.object({
		event: AffnookSyncEventSchema,
		trackingToken: z.string().min(1).optional().openapi({
			description: "Affiliate tracking token from referral link",
			example: "649951f273a208",
		}),
		promocode: z.string().min(1).optional().openapi({
			description: "Promo code entered at signup",
			example: "SPORTSKING",
		}),
		country: z.string().min(2).max(2).optional().openapi({
			description: "ISO country code",
			example: "NG",
		}),
		city: z.string().optional().openapi({
			description: "City inferred from client/geo",
			example: "Lagos",
		}),
	})
	.openapi("AffnookSyncRequest");

export const AffnookSyncSuccessSchema = z
	.object({
		success: z.literal(true),
		data: z.object({
			event: AffnookSyncEventSchema,
			synced: z.boolean(),
			message: z.string(),
		}),
	})
	.openapi("AffnookSyncSuccess");

export const AffnookSyncErrorSchema = z
	.object({
		success: z.literal(false),
		error: z.string(),
		details: z.unknown().optional(),
	})
	.openapi("AffnookSyncError");
