import { z } from "@hono/zod-openapi";

export const FreebetCreateRequestSchema = z.object({
	player_id: z.string(),
	amount: z.number(),
	currency: z.string(),
	expired_at: z.string(),
	conditions: z.array(z.any()).optional(),
});

export const FreebetCreateResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		id: z.string(),
		dataBetFreebetId: z.string(),
		amount: z.number(),
		currency: z.string(),
		expiredAt: z.string(),
	}),
});

export const FreebetItemSchema = z.object({
	id: z.string(),
	version: z.string(),
	dataBetFreebetId: z.string(),
	playerId: z.string(),
	idempotenceId: z.string(),
	conditions: z.string().nullable(),
	amount: z.number(),
	currency: z.string(),
	expiresAt: z.string(),
	foreignParams: z.string().nullable(),
	usedOnBetId: z.string().nullable(),
	usedAt: z.string().nullable(),
	status: z.number(),
	createdAt: z.string(),
});

export const FreebetListResponseSchema = z.object({
	success: z.literal(true),
	data: z.array(FreebetItemSchema),
});

export const FreebetGetResponseSchema = z.object({
	success: z.literal(true),
	data: FreebetItemSchema,
});

export const FreebetBulkCreateRequestSchema = z.object({
	freebets: z.array(
		z.object({
			player_id: z.string(),
			idempotence_id: z.string(),
			amount: z.number(),
			currency: z.string(),
			expired_at: z.string(),
			conditions: z.array(z.any()).optional(),
		}),
	),
});

export const FreebetBulkCreateResponseSchema = z.object({
	success: z.literal(true),
	data: z.array(
		z.object({
			id: z.string(),
			dataBetFreebetId: z.string(),
			amount: z.number(),
			currency: z.string(),
			expiredAt: z.string(),
		}),
	),
});

export const FreebetUpdateRequestSchema = z.object({
	player_id: z.string(),
	freebet_id: z.string(),
	expired_at: z.string().optional(),
	conditions: z.array(z.any()).optional(),
});

export const FreebetUpdateResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		dataBetFreebetId: z.string(),
	}),
});

export const FreebetCancelRequestSchema = z.object({
	freebet_id: z.string(),
});

export const FreebetCancelResponseSchema = z.object({
	success: z.literal(true),
	data: FreebetItemSchema,
});

export const FreebetUnusedListQuerySchema = z.object({
	player_id: z.string(),
});
