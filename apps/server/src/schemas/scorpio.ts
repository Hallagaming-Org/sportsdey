import { z } from "@hono/zod-openapi";

export const ScorpioLaunchRequestSchema = z
	.object({
		providerId: z.number().int().positive().openapi({
			description: "Scorpio provider ID",
			example: 1,
		}),
		gameCode: z.string().min(1).openapi({
			description: "Scorpio game code",
			example: "vswaysdogs",
		}),
		language: z
			.string()
			.optional()
			.default("en")
			.openapi({ description: "UI language code" }),
		currency: z
			.string()
			.optional()
			.default("NGN")
			.openapi({ description: "ISO-4217 currency" }),
		returnUrl: z
			.string()
			.url()
			.optional()
			.openapi({ description: "URL after player exits the game" }),
		rtp: z
			.number()
			.optional()
			.default(0)
			.openapi({ description: "RTP override; 0 uses operator default" }),
	})
	.openapi("ScorpioLaunchRequest");

export const ScorpioLaunchResponseSchema = z
	.object({
		success: z.literal(true),
		data: z.object({
			url: z.string().openapi({ description: "Game launch URL" }),
			playerCode: z.number().openapi({ description: "Scorpio player code" }),
		}),
	})
	.openapi("ScorpioLaunchResponse");

export const ScorpioKickRequestSchema = z
	.object({
		playerExternalId: z
			.string()
			.optional()
			.openapi({ description: "Defaults to authenticated user id" }),
	})
	.openapi("ScorpioKickRequest");

export const ScorpioProviderIdParamSchema = z
	.object({
		providerId: z.coerce.number().int().positive(),
	})
	.openapi("ScorpioProviderIdParam");

export const ScorpioProviderSettingsParamSchema = z
	.object({
		providerId: z.coerce.number().int().positive(),
		currency: z.string().min(1),
	})
	.openapi("ScorpioProviderSettingsParam");

export const ScorpioTransactionListQuerySchema = z
	.object({
		startTime: z.string().openapi({
			description: "YYYY-MM-DD HH:mm:ss",
		}),
		endTime: z.string().openapi({
			description: "YYYY-MM-DD HH:mm:ss",
		}),
		offset: z.coerce.number().int().min(0).default(0),
		limit: z.coerce.number().int().min(1).max(500).default(100),
	})
	.openapi("ScorpioTransactionListQuery");

export const ScorpioRoundQuerySchema = z
	.object({
		roundId: z.string().optional(),
		playerExternalId: z.string().optional(),
		transId: z.string().optional(),
	})
	.openapi("ScorpioRoundQuery");

export const ScorpioBonusRegisterSchema = z
	.object({
		issueId: z.string().optional(),
		providerId: z.number().int().positive(),
		gameCode: z.union([z.string(), z.array(z.string())]),
		playerExternalId: z.string().optional(),
		currency: z.string().default("NGN"),
		bonusType: z.number().int(),
		callAmount: z.number(),
		expireAt: z.string(),
		metaData: z
			.object({
				spinAmount: z.number().optional(),
				baseBetAmount: z.number().optional(),
			})
			.optional(),
	})
	.openapi("ScorpioBonusRegister");

export const ScorpioBonusCancelSchema = z
	.object({
		issueId: z.string().min(1),
	})
	.openapi("ScorpioBonusCancel");

export const ScorpioIssueIdParamSchema = z
	.object({
		issueId: z.string().min(1),
	})
	.openapi("ScorpioIssueIdParam");

export const ScorpioErrorResponseSchema = z
	.object({
		success: z.literal(false),
		error: z.string(),
		code: z.string().optional(),
		details: z.any().nullable().optional(),
	})
	.openapi("ScorpioErrorResponse");

export const ScorpioSuccessDataSchema = z
	.object({
		success: z.literal(true),
		data: z.any(),
	})
	.openapi("ScorpioSuccessData");
