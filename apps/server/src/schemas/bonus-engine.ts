import { z } from "@hono/zod-openapi";
import {
	BONUS_ENGINE_BODY_FIELD,
	BONUS_ENGINE_CAMPAIGN_TYPE_VALUES,
	BONUS_ENGINE_DEFAULT_CAMPAIGN_TYPE,
} from "@/services/bonus-engine/bonus-engine.service.constant";

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
		loyalty_id: z.string().min(1).optional().openapi({
			description:
				"Active campaign `_id` from `GET /loyalty/lists` (forwarded as Bonus Engine `loyalty_id` when present)",
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

export const TournamentListSuccessSchema = z
	.object({
		success: z.literal(true),
		data: z.array(z.record(z.string(), z.unknown())),
		message: z.string().optional(),
	})
	.openapi("TournamentListSuccess");

export const TournamentJoinRequestSchema = z
	.object({
		[BONUS_ENGINE_BODY_FIELD.TOURNAMENT_ID]: z.string().min(1).openapi({
			description: "Bonus Engine tournament `_id`",
			example: "6a6b4dfbb1acec12b58ecaf4",
		}),
	})
	.openapi("TournamentJoinRequest");

export const TournamentJoinSuccessSchema = z
	.object({
		success: z.literal(true),
		data: z.record(z.string(), z.unknown()),
		message: z.string().optional(),
	})
	.openapi("TournamentJoinSuccess");

export const TournamentLeaderboardRequestSchema = z
	.object({
		[BONUS_ENGINE_BODY_FIELD.TOURNAMENT_ID]: z.string().min(1).openapi({
			param: { in: "query" },
			description: "Bonus Engine tournament `_id`",
			example: "6a6b4dfbb1acec12b58ecaf4",
		}),
	})
	.openapi("TournamentLeaderboardRequest");

export const TournamentLeaderboardSuccessSchema = z
	.object({
		success: z.literal(true),
		data: z.array(z.record(z.string(), z.unknown())),
		message: z.string().optional(),
	})
	.openapi("TournamentLeaderboardSuccess");

export const BonusCampaignsRequestSchema = z
	.object({
		bonus_type: z.enum(BONUS_ENGINE_CAMPAIGN_TYPE_VALUES).default(
			BONUS_ENGINE_DEFAULT_CAMPAIGN_TYPE,
		).openapi({
			param: { name: BONUS_ENGINE_BODY_FIELD.BONUS_TYPE, in: "query" },
			description:
				"Bonus Engine `bonus_type` filter. Always sent; defaults to welcome.",
			example: BONUS_ENGINE_DEFAULT_CAMPAIGN_TYPE,
		}),
	})
	.openapi("BonusCampaignsRequest");

export const BonusCampaignsSuccessSchema = z
	.object({
		success: z.literal(true),
		data: z.array(z.record(z.string(), z.unknown())),
		message: z.string().optional(),
	})
	.openapi("BonusCampaignsSuccess");

export const BonusListSuccessSchema = z
	.object({
		success: z.literal(true),
		data: z.array(z.record(z.string(), z.unknown())),
		message: z.string().optional(),
	})
	.openapi("BonusListSuccess");

export const BonusActionRequestSchema = z
	.object({
		userbonus_id: z.string().min(1).openapi({
			description:
				"Player bonus assignment `_id` from `GET /bonus/getall_User_bonus` (forwarded as Bonus Engine `userbonus_id`)",
			example: "66d7fbf439d19fb08c09a37c",
		}),
	})
	.openapi("BonusActionRequest");

export const BonusActionSuccessSchema = z
	.object({
		success: z.literal(true),
		data: z
			.object({
				user_id: z.string().optional(),
				real_wallet_balance: z.number().optional(),
				bonus_wallet_balance: z.number().optional(),
			})
			.passthrough(),
		message: z.string().optional(),
	})
	.openapi("BonusActionSuccess");

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
			username: z.string().optional(),
			real_wallet_balance: z.number(),
			bonus_wallet_balance: z.number(),
			timestamp: z.string().optional(),
		}),
	})
	.openapi("BonusEngineBalanceCallbackSuccess");
