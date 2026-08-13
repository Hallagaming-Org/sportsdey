import { z } from "@hono/zod-openapi";
import { BetConditionSchema } from "./bet";

/** Params shared across Databet calculation strategies (static / steps / margin). */
const BetBoostStrategyParamsSchema = z
	.object({
		// static
		multiplier: z.string().optional(),
		min_selections: z.number().optional(),
		// steps
		selections_per_step: z.number().optional(),
		multiplier_per_step: z.string().optional(),
		// steps + margin
		max_multiplier: z.string().optional(),
		// margin (Databet spelling)
		min_marge_ratio: z.string().optional(),
		max_marge_ratio: z.string().optional(),
	})
	.passthrough();

const BetBoostCalculationStrategySchema = z.object({
	type: z.enum(["static", "steps", "margin"]),
	strategy: z.object({
		conditions: z.array(z.any()).optional(),
		params: BetBoostStrategyParamsSchema.optional(),
	}),
});

export const AccumulatorPresetSchema = z.object({
	sport: z.enum(["football", "basketball", "tennis"]),
	selections: z.number().int().min(2).max(50),
});

export const BetBoostCreateSchema = z
	.object({
		player_id: z.string(),
		currency: z.string(),
		initial_quantity: z.number(),
		calculation_strategy: BetBoostCalculationStrategySchema.optional(),
		applicable_conditions: z.array(BetConditionSchema).optional(),
		required_conditions: z.array(BetConditionSchema).optional(),
		expires_at: z.string(),
		/** Fill DataBet strategy + conditions from the Sportsdey accumulator bonus table. */
		accumulator: AccumulatorPresetSchema.optional(),
	})
	.superRefine((value, ctx) => {
		if (value.accumulator) return;
		if (!value.required_conditions?.length) {
			ctx.addIssue({
				code: "custom",
				message:
					"required_conditions is required unless accumulator preset is set",
				path: ["required_conditions"],
			});
		}
		if (!value.applicable_conditions?.length) {
			ctx.addIssue({
				code: "custom",
				message:
					"applicable_conditions is required unless accumulator preset is set",
				path: ["applicable_conditions"],
			});
		}
	});

export const BetBoostCreateResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		id: z.string(),
		dataBetBoostId: z.string(),
		bonusPercent: z.number().optional(),
		multiplier: z.string().optional(),
	}),
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
