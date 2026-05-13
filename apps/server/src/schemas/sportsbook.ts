import { z } from "zod";

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

export const BetPlaceRequestSchema = z.object({
	request_id: z.string(),
	bet_id: z.string(),
	bet_player_id: z.string(),
	bet_type: z.number().optional(),
	bet_stake: z.string(),
	bet_freebet_id: z.string().optional(),
	bet_insurance_id: z.string().optional(),
	bet_boost_id: z.string().optional(),
	total_odds_value: z.string().optional(),
	bet_odds: z.array(z.any()).optional(),
	bet_builder_odds: z.array(z.any()).optional(),
	bet_system_sizes: z.array(z.number()).optional(),
	bet_created_at: z.string().optional(),
	competitors: z.array(z.any()).optional(),
});

export const BetRestrictionSchema = z.object({
	type: z.string(),
	context: z.record(z.string(), z.any()).optional(),
});

export const BetErrorResponseSchema = z.object({
	restrictions: z.array(BetRestrictionSchema),
});

export const BetSettleRequestSchema = z.object({
	request_id: z.string(),
	bet_id: z.string(),
	bet_player_id: z.string().optional(),
	bet_boost_id: z.string().optional(),
	total_odds_value: z.string().optional(),
	base_odds_value: z.string().optional(),
	bet_odds: z.array(z.any()).optional(),
	settle_amount: z.string(),
	settle_type: z.number(),
	restrictions: z.array(z.any()).optional(),
});

export const BetUnsettleRequestSchema = z.object({
	request_id: z.string(),
	bet_id: z.string(),
	bet_player_id: z.string().optional(),
	unsettle_amount: z.string().optional(),
});

export const CashOutAcceptedRequestSchema = z.object({
	request_id: z.string(),
	bet_id: z.string(),
	cash_out_order_id: z.string(),
	amount: z.string().optional(),
	refund_amount: z.string(),
});

export const CashOutDeclinedRequestSchema = z.object({
	request_id: z.string(),
	bet_id: z.string(),
	cash_out_order_ids: z.array(z.string()),
});

const BetConditionDataSchema = z.record(z.any());

const BetConditionBetDetailSchema = z.object({
	bet_type: z.number(),
	data: BetConditionDataSchema,
});

const BetConditionSchema = z.object({
	type: z.string(),
	bet_details: z.array(BetConditionBetDetailSchema),
});

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

export const BetBoostListResponseSchema = z.object({
	success: z.literal(true),
	data: z.array(
		z.object({
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
		}),
	),
});

export const BetBoostGetSchema = z.object({
	id: z.string().openapi({ description: "Bet Boost ID" }),
});

export const BetBoostGetResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
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
	}),
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