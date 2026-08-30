import { z } from "@hono/zod-openapi";

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
	base_odds_value: z.string().optional(),
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
	bet_player_id: z.string(),
	bet_boost_id: z.string().optional(),
	total_odds_value: z.string().optional(),
	base_odds_value: z.string().optional(),
	bet_odds: z.array(z.any()).optional(),
	settle_amount: z.string(),
	settle_type: z.union([z.literal(1), z.literal(2), z.literal(3)]),
	restrictions: z.array(z.any()).optional(),
});

export const BetUnsettleRequestSchema = z.object({
	request_id: z.string(),
	bet_id: z.string(),
	bet_player_id: z.string(),
	unsettle_amount: z.string(),
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

export const BetConditionDataSchema = z.record(z.string(), z.any());

/**
 * Databet Bet Boost / freebet condition detail.
 * Docs use `type: "single" | "express" | "system"` (string), not a numeric bet_type.
 * @see https://docs.data.bet/betting/bet-boost/
 */
export const BetConditionBetDetailSchema = z.object({
	type: z.string(),
	data: BetConditionDataSchema.optional(),
});

export const BetConditionSchema = z.object({
	type: z.string(),
	bet_details: z.array(BetConditionBetDetailSchema),
});
