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

/** Scorpio NGN payloads send some numeric fields as strings (e.g. providerId: "2"). */
const scorpioNumber = z.coerce.number();

const scorpioPlayerId = z.preprocess(
	(value) => (value == null ? value : String(value).trim()),
	z.string().min(1),
);

/** 0/1 and "true"/"false" appear on real Scorpio callbacks. z.coerce.boolean() treats "false" as true. */
const scorpioBoolean = z.preprocess((value) => {
	if (value === true || value === 1 || value === "1" || value === "true") {
		return true;
	}
	if (value === false || value === 0 || value === "0" || value === "false") {
		return false;
	}
	return value;
}, z.boolean());

/**
 * Scorpio logs omit `command` from JSON (it's a separate column) and often omit
 * `timestamp` on bet/cancel. Infer those before schema parse.
 */
export function normalizeScorpioCallbackBody(raw: unknown): unknown {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
	const body = { ...(raw as Record<string, unknown>) };

	if (typeof body.command === "string") {
		body.command = body.command.trim().toLowerCase();
	}

	if (typeof body.command !== "string" || body.command.length === 0) {
		if (body.referenceId != null) {
			body.command = "cancel";
		} else if (
			body.transactionId != null &&
			(body.isCall !== undefined || body.isRoundFinished !== undefined)
		) {
			body.command = "bet";
		} else if (body.transactionId != null && body.amount !== undefined) {
			body.command = "win";
		} else if (body.playerId != null && body.currency != null) {
			body.command = "balance";
		}
	}

	// Cancel docs require both ids; live payloads sometimes send only one.
	if (body.command === "cancel") {
		if (body.referenceId == null && body.transactionId != null) {
			body.referenceId = body.transactionId;
			body.transactionId = `${String(body.transactionId)}:cancel`;
		} else if (body.transactionId == null && body.referenceId != null) {
			body.transactionId = `${String(body.referenceId)}:cancel`;
		}
	}

	if (body.command === "bet" || body.command === "win") {
		if (body.isCall === undefined) body.isCall = false;
		if (body.isRoundFinished === undefined) body.isRoundFinished = true;
	}

	if (body.roundId == null || body.roundId === "") body.roundId = "0";
	if (body.gameCode == null) body.gameCode = "";
	if (body.gameName == null) body.gameName = "";
	if (body.providerName == null) body.providerName = "";
	if (body.providerId == null) body.providerId = 0;

	if (body.timestamp == null) {
		body.timestamp = Date.now();
	}
	return body;
}

export const ScorpioCallbackBalanceSchema = z
	.object({
		command: z.literal("balance"),
		playerId: scorpioPlayerId,
		currency: z.string().min(1),
		timestamp: scorpioNumber.optional(),
	})
	.openapi("ScorpioCallbackBalance");

export const ScorpioCallbackBetSchema = z
	.object({
		command: z.literal("bet"),
		transactionId: z.string().min(1),
		playerId: scorpioPlayerId,
		roundId: z.string().min(1),
		providerId: scorpioNumber,
		providerName: z.string(),
		gameCode: z.string(),
		gameName: z.string(),
		currency: z.string().min(1),
		amount: scorpioNumber,
		isRoundFinished: scorpioBoolean.optional().default(true),
		isCall: scorpioBoolean.optional().default(false),
		timestamp: scorpioNumber.optional(),
	})
	.openapi("ScorpioCallbackBet");

export const ScorpioCallbackWinSchema = z
	.object({
		command: z.literal("win"),
		transactionId: z.string().min(1),
		playerId: scorpioPlayerId,
		roundId: z.string().min(1),
		providerId: scorpioNumber,
		providerName: z.string(),
		gameCode: z.string(),
		gameName: z.string(),
		currency: z.string().min(1),
		amount: scorpioNumber,
		isRoundFinished: scorpioBoolean.optional().default(true),
		isCall: scorpioBoolean.optional().default(false),
		timestamp: scorpioNumber.optional(),
	})
	.openapi("ScorpioCallbackWin");

export const ScorpioCallbackCancelSchema = z
	.object({
		command: z.literal("cancel"),
		transactionId: z.string().min(1),
		referenceId: z.string().min(1),
		playerId: scorpioPlayerId,
		roundId: z.string().min(1),
		providerId: scorpioNumber,
		providerName: z.string(),
		gameCode: z.string(),
		gameName: z.string(),
		currency: z.string().min(1),
		amount: scorpioNumber,
		timestamp: scorpioNumber.optional(),
	})
	.openapi("ScorpioCallbackCancel");

const ScorpioCallbackUnionSchema = z.discriminatedUnion("command", [
	ScorpioCallbackBalanceSchema,
	ScorpioCallbackBetSchema,
	ScorpioCallbackWinSchema,
	ScorpioCallbackCancelSchema,
]);

export const ScorpioCallbackRequestSchema = z.preprocess(
	normalizeScorpioCallbackBody,
	ScorpioCallbackUnionSchema,
);

/** Loose body so OpenAPI middleware cannot 400 Scorpio (wallet requires HTTP 200). */
export const ScorpioCallbackRawBodySchema = z
	.record(z.string(), z.any())
	.openapi("ScorpioCallbackRawBody");

export const ScorpioCallbackResponseSchema = z
	.object({
		balance: z.number(),
		statusCode: z.string(),
	})
	.openapi("ScorpioCallbackResponse");
