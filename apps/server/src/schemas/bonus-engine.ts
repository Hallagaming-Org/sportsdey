import { z } from "@hono/zod-openapi";

export const BonusEngineErrorSchema = z
	.object({
		success: z.literal(false),
		error: z.string(),
	})
	.openapi("BonusEngineError");

export const LoyaltyPointsSuccessSchema = z
	.object({
		success: z.literal(true),
		data: z
			.object({
				player_id: z.string().optional(),
				total_points: z.number().optional(),
				loyalty_level: z.string().optional(),
			})
			.passthrough(),
		message: z.string().optional(),
	})
	.openapi("LoyaltyPointsSuccess");

export const LoyaltyRedeemRequestSchema = z
	.object({
		points_to_redeem: z.number().positive().openapi({
			description:
				"Loyalty points to redeem (forwarded as Bonus Engine `points_to_redeem`)",
			example: 500,
		}),
	})
	.openapi("LoyaltyRedeemRequest");

export const LoyaltyRedeemSuccessSchema = z
	.object({
		success: z.literal(true),
		data: z
			.object({
				player_id: z.string().optional(),
				total_points: z.number().optional(),
				redeemed_points: z.number().optional(),
				loyalty_level: z.string().optional(),
			})
			.passthrough(),
		message: z.string().optional(),
	})
	.openapi("LoyaltyRedeemSuccess");

export const LoyaltyHistoryItemSchema = z
	.object({
		player_id: z.string().optional(),
		points_earned: z.number().optional(),
		points_redeemed: z.number().optional(),
		points_balance: z.number().optional(),
		transaction_type: z.string().optional(),
		reason: z.string().optional(),
		transaction_date: z.string().optional(),
	})
	.passthrough()
	.openapi("LoyaltyHistoryItem");

export const LoyaltyHistorySuccessSchema = z
	.object({
		success: z.literal(true),
		data: z.array(LoyaltyHistoryItemSchema),
		message: z.string().optional(),
	})
	.openapi("LoyaltyHistorySuccess");

export const LoyaltyListsSuccessSchema = z
	.object({
		success: z.literal(true),
		data: z.array(z.record(z.string(), z.unknown())),
		message: z.string().optional(),
	})
	.openapi("LoyaltyListsSuccess");

export const MissionListSuccessSchema = z
	.object({
		success: z.literal(true),
		data: z.array(z.record(z.string(), z.unknown())),
		message: z.string().optional(),
	})
	.openapi("MissionListSuccess");

export const BonusEngineCallbackAckSchema = z
	.object({
		status: z.number(),
		message: z.string(),
		data: z.record(z.string(), z.unknown()).optional(),
	})
	.openapi("BonusEngineCallbackAck");

export const BonusEngineBalanceCallbackSuccessSchema = z
	.object({
		status: z.number(),
		message: z.string(),
		data: z.object({
			user_id: z.string(),
			real_wallet_balance: z.number(),
			bonus_wallet_balance: z.number(),
		}),
	})
	.openapi("BonusEngineBalanceCallbackSuccess");
