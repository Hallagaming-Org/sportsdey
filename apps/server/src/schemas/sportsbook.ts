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