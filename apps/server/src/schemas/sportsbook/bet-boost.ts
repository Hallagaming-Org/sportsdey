import { z } from "@hono/zod-openapi";
import { BetConditionSchema } from "./bet";

export const SportSchema = z.enum(["Football", "Basketball", "Tennis"]);
export type Sport = z.infer<typeof SportSchema>;

export const BetBoostCreateSchema = z.object({
	boostName: z.string(),
	description: z.string(),
	boostPercentage: z.number(),
	eligibleUsers: z.string(),
	eligibleSports: z.array(SportSchema),
	minimumSelections: z.number(),
	maximumSelections: z.number(),
	competitionIDs: z.array(z.string()).default([]),
	eligibleEventsID: z.array(z.string()).default([]),
	minimumOddsPerSelection: z.number(),
	endDateTime: z.string(),
	maximumWin: z.number().optional(),
});

export const AccumulatorPresetSchema = z.object({
	sport: z.enum(["football", "basketball", "tennis"]),
	selections: z.number().int().min(2).max(50),
});

export const BetBoostCreateResponseSchema = z.object({
	success: z.literal(true),
	data: z.array(
		z.object({
			id: z.string(),
			dataBetBoostId: z.string(),
			playerId: z.string().nullable(),
		}),
	),
});

export const AccumulatorBonusTableResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		sports: z.array(z.enum(["football", "basketball", "tennis"])),
		minSelections: z.object({
			football: z.number(),
			basketball: z.number(),
			tennis: z.number(),
		}),
		maxSelections: z.number(),
		program: z.object({
			strategy: z.literal("steps"),
			selectionsPerStep: z.number(),
			multiplierPerStep: z.string(),
			maxMultiplier: z.string(),
		}),
		rows: z.array(
			z.object({
				selections: z.number(),
				label: z.string(),
				football: z.number().nullable(),
				basketball: z.number().nullable(),
				tennis: z.number().nullable(),
			}),
		),
	}),
});

export const AccumulatorProgramGrantSchema = z.object({
	player_id: z.string(),
	currency: z.string().default("NGN"),
	initial_quantity: z.number().int().min(1).max(9999).optional(),
	expires_at: z.string().optional(),
});

export const AccumulatorProgramGrantResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		playerId: z.string(),
		created: z.array(
			z.object({
				sport: z.enum(["football", "basketball", "tennis"]),
				dataBetBoostId: z.string(),
			}),
		),
		skipped: z.array(z.enum(["football", "basketball", "tennis"])),
		failed: z.array(
			z.object({
				sport: z.enum(["football", "basketball", "tennis"]),
				error: z.string(),
			}),
		),
	}),
});

export const BetBoostListQuerySchema = z.object({
	player_id: z.string().optional().openapi({
		description: "Optional Databet player id filter (Sportsdey user id)",
	}),
});

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
	calculation_strategy: BetBoostCalculationStrategySchema.optional(),
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
