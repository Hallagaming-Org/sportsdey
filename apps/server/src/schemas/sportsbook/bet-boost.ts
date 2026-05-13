import { z } from "@hono/zod-openapi";
import { BetConditionSchema } from "./bet";

export const BetBoostCreateSchema = z.object({
	idempotence_id: z.string(),
	player_id: z.string(),
	currency_code: z.string(),
	initial_quantity: z.number(),
	calculation_strategy: z
		.object({
			type: z.string(),
			strategy: z
				.object({
					conditions: z.array(z.any()).optional(),
					params: z
						.object({
							max_multiplier: z.string().optional(),
							min_marge_ratio: z.string().optional(),
							max_marge_ratio: z.string().optional(),
						})
						.optional(),
				})
				.optional(),
		})
		.optional(),
	applicable_conditions: z.array(BetConditionSchema),
	required_conditions: z.array(BetConditionSchema),
	expires_at: z.string(),
});

export const BetBoostCreateResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		id: z.string(),
		dataBetBoostId: z.string(),
	}),
});

export const BetBoostListQuerySchema = z.object({});

export const BetBoostItemSchema = z.object({
	id: z.string(),
	version: z.string(),
	currencyCode: z.string(),
	playerId: z.string(),
	initialQuantity: z.number(),
	remainingQuantity: z.number(),
	expiresAt: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
	calculationStrategy: z.string().nullable(),
	applicableConditions: z.string().nullable(),
	requiredConditions: z.string().nullable(),
});

export const BetBoostListResponseSchema = z.object({
	success: z.literal(true),
	data: z.array(BetBoostItemSchema),
});

export const BetBoostGetSchema = z.object({
	id: z.string().openapi({ description: "Bet Boost ID" }),
});

export const BetBoostGetResponseSchema = z.object({
	success: z.literal(true),
	data: BetBoostItemSchema,
});

export const BetBoostUpdateSchema = z.object({
	player_id: z.string(),
	boost_id: z.string(),
	calculation_strategy: z
		.object({
			type: z.string(),
			strategy: z
				.object({
					conditions: z.array(z.any()).optional(),
					params: z
						.object({
							max_multiplier: z.string().optional(),
							min_marge_ratio: z.string().optional(),
							max_marge_ratio: z.string().optional(),
						})
						.optional(),
				})
				.optional(),
		})
		.optional(),
	applicable_conditions: z.array(BetConditionSchema).optional(),
	required_conditions: z.array(BetConditionSchema).optional(),
	expires_at: z.string().optional(),
});

export const BetBoostUpdateResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		boost_id: z.string(),
	}),
});