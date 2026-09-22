import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import {
	BONUS_ENGINE_NATIVE_PROVIDER_ID,
	casinoBetAmountFromKobo,
	optionalExecutionCtx,
	reportCasinoBetInBackground,
	reportCasinoBetResultInBackground,
} from "@/services/bonus-engine";
import {
	LagosRushBalanceRequestSchema,
	LagosRushBalanceResponseSchema,
	LagosRushCreditRequestSchema,
	LagosRushCreditResponseSchema,
	LagosRushDebitRequestSchema,
	LagosRushDebitResponseSchema,
	LagosRushRefundRequestSchema,
	LagosRushRefundResponseSchema,
	MinigodErrorSchema,
} from "@/schemas/minigod";
import {
	settlePocketsTransaction,
	type PocketsSettleResult,
} from "@/services/pockets-settlement";
import { CasinoMoneyError, toKobo } from "@/utils/casino-money";
import type { CloudflareBindings } from "../types";

const pocketsRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

/** D1 `game.code` for Lagos Rush; the provider callbacks carry no game id. */
const LAGOS_RUSH_GAME_CODE = "LAGOSRUSH";

function validatePocketsApiKey(c: {
	req: { header: (name: string) => string | undefined };
	env: CloudflareBindings;
}): boolean {
	const apiKey = c.req.header("x-api-key");
	const secretKey = c.env.POCKETS_SECRET_KEY;
	return Boolean(secretKey) && apiKey === secretKey;
}

const authError = {
	success: false as const,
	error: "Invalid API key",
};

type MoneyCallInput = {
	playerId: string;
	amount: number;
	currency: string;
	transactionId?: string;
};

/**
 * Validates the idempotency key + amount for a money call.
 * `transactionId` is mandatory: without it a provider retry is
 * indistinguishable from a new transaction and duplicates money movement.
 */
function parseMoneyCall(
	input: MoneyCallInput,
):
	| { ok: true; providerTxId: string; amountKobo: number }
	| { ok: false; error: string } {
	if (!input.transactionId) {
		return {
			ok: false,
			error: "transactionId is required for idempotent processing",
		};
	}
	try {
		const amountKobo = toKobo(input.amount, "kobo");
		if (amountKobo <= 0) {
			return { ok: false, error: "Amount must be a positive kobo integer" };
		}
		return { ok: true, providerTxId: input.transactionId, amountKobo };
	} catch (error) {
		return {
			ok: false,
			error:
				error instanceof CasinoMoneyError ? error.message : "Invalid amount",
		};
	}
}

function settleErrorResponse(result: PocketsSettleResult): {
	body: { success: false; error: string };
	status: 400 | 500;
} {
	switch (result.status) {
		case "invalid_amount":
			return {
				body: { success: false, error: "Invalid amount" },
				status: 400,
			};
		case "insufficient":
			return {
				body: { success: false, error: "Insufficient balance" },
				status: 400,
			};
		case "wallet_missing":
			return {
				body: { success: false, error: "Failed to update wallet" },
				status: 500,
			};
		default:
			return {
				body: { success: false, error: "Failed to update wallet" },
				status: 500,
			};
	}
}

const balanceRoute = createRoute({
	method: "post",
	path: "/balance",
	tags: ["Lagos Rush Casino"],
	summary: "Get user wallet balance",
	description: "Returns user's wallet balance in kobo for Lagos Rush",
	security: [{ ApiKeyAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: LagosRushBalanceRequestSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Balance retrieved successfully",
			content: {
				"application/json": {
					schema: LagosRushBalanceResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid request",
			content: {
				"application/json": {
					schema: MinigodErrorSchema,
				},
			},
		},
		401: {
			description: "Unauthorized - Invalid API key",
			content: {
				"application/json": {
					schema: MinigodErrorSchema,
				},
			},
		},
	},
});

pocketsRoute.openapi(balanceRoute, async (c) => {
	if (!validatePocketsApiKey(c)) {
		return c.json(authError, 401);
	}

	const body = await c.req.json();
	const result = LagosRushBalanceRequestSchema.safeParse(body);

	if (!result.success) {
		return c.json({ success: false as const, error: "Invalid request body" }, 400);
	}

	const { playerId, currency } = result.data;
	const db = drizzle(c.env.DB, { schema });

	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, playerId))
		.limit(1);

	return c.json(
		{
			success: true as const,
			data: {
				balance: wallet?.balance ?? 0,
				currency,
			},
		},
		200,
	);
});

const debitRoute = createRoute({
	method: "post",
	path: "/debit",
	tags: ["Lagos Rush Casino"],
	summary: "Debit user wallet",
	description:
		"Debits user's wallet balance for Lagos Rush. Requires the provider transactionId; retries with the same id are idempotent.",
	security: [{ ApiKeyAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: LagosRushDebitRequestSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Debit successful",
			content: {
				"application/json": {
					schema: LagosRushDebitResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid request or insufficient balance",
			content: {
				"application/json": {
					schema: MinigodErrorSchema,
				},
			},
		},
		401: {
			description: "Unauthorized - Invalid API key",
			content: {
				"application/json": {
					schema: MinigodErrorSchema,
				},
			},
		},
	},
});

pocketsRoute.openapi(debitRoute, async (c) => {
	if (!validatePocketsApiKey(c)) {
		return c.json(authError, 401);
	}

	const body = await c.req.json();
	const result = LagosRushDebitRequestSchema.safeParse(body);

	if (!result.success) {
		return c.json({ success: false as const, error: "Invalid request body" }, 400);
	}

	const parsed = parseMoneyCall(result.data);
	if (!parsed.ok) {
		return c.json({ success: false as const, error: parsed.error }, 400);
	}

	const { playerId, currency } = result.data;
	const db = drizzle(c.env.DB, { schema });

	const settle = await settlePocketsTransaction({
		db,
		provider: "pockets",
		paymentMethod: "lagos rush",
		action: "debit",
		playerId,
		providerTxId: parsed.providerTxId,
		amountKobo: parsed.amountKobo,
		currency,
		metadata: { game: "lagos rush", currency, action: "bet" },
	});

	if (settle.status !== "settled" && settle.status !== "duplicate") {
		const { body: errBody, status } = settleErrorResponse(settle);
		return c.json(errBody, status);
	}

	if (settle.status === "settled") {
		await reportCasinoBetInBackground({
			env: c.env,
			executionCtx: optionalExecutionCtx(c),
			userId: playerId,
			betId: parsed.providerTxId,
			amount: casinoBetAmountFromKobo(parsed.amountKobo),
			currency,
			gameRef: LAGOS_RUSH_GAME_CODE,
			fallbackProviderId: BONUS_ENGINE_NATIVE_PROVIDER_ID.LAGOS_RUSH,
		});
	}

	await reportCasinoBetInBackground({
		env: c.env,
		executionCtx: optionalExecutionCtx(c),
		userId: playerId,
		betId: transactionId,
		amount: casinoBetAmountFromKobo(amount),
		currency,
		gameRef: "LAGOSRUSH",
		fallbackProviderId: BONUS_ENGINE_NATIVE_PROVIDER_ID.LAGOS_RUSH,
	});

	return c.json(
		{
			success: true as const,
			data: {
				oldBalance: settle.oldBalanceKobo,
				newBalance: settle.newBalanceKobo,
				currency,
				transactionId: settle.transactionId,
			},
		},
		200,
	);
});

const creditRoute = createRoute({
	method: "post",
	path: "/credit",
	tags: ["Lagos Rush Casino"],
	summary: "Credit user wallet",
	description:
		"Credits user's wallet balance for Lagos Rush casino game. Requires the provider transactionId; retries with the same id are idempotent.",
	security: [{ ApiKeyAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: LagosRushCreditRequestSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Credit successful",
			content: {
				"application/json": {
					schema: LagosRushCreditResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid request",
			content: {
				"application/json": {
					schema: MinigodErrorSchema,
				},
			},
		},
		401: {
			description: "Unauthorized - Invalid API key",
			content: {
				"application/json": {
					schema: MinigodErrorSchema,
				},
			},
		},
	},
});

pocketsRoute.openapi(creditRoute, async (c) => {
	if (!validatePocketsApiKey(c)) {
		return c.json(authError, 401);
	}

	const body = await c.req.json();
	const result = LagosRushCreditRequestSchema.safeParse(body);

	if (!result.success) {
		return c.json({ success: false as const, error: "Invalid request body" }, 400);
	}

	const parsed = parseMoneyCall(result.data);
	if (!parsed.ok) {
		return c.json({ success: false as const, error: parsed.error }, 400);
	}

	const { playerId, currency } = result.data;
	const db = drizzle(c.env.DB, { schema });

	const settle = await settlePocketsTransaction({
		db,
		provider: "pockets",
		paymentMethod: "lagos rush",
		action: "credit",
		playerId,
		providerTxId: parsed.providerTxId,
		amountKobo: parsed.amountKobo,
		currency,
		metadata: { game: "lagos rush", currency, action: "win" },
	});

	if (settle.status !== "settled" && settle.status !== "duplicate") {
		const { body: errBody, status } = settleErrorResponse(settle);
		return c.json(errBody, status);
	}

	if (settle.status === "settled") {
		await reportCasinoBetResultInBackground({
			env: c.env,
			executionCtx: optionalExecutionCtx(c),
			userId: playerId,
			betId: parsed.providerTxId,
			totalWinAmount: casinoBetAmountFromKobo(parsed.amountKobo),
			isWin: 1,
		});
	}

	await reportCasinoBetResultInBackground({
		env: c.env,
		executionCtx: optionalExecutionCtx(c),
		userId: playerId,
		betId: transactionId,
		totalWinAmount: casinoBetAmountFromKobo(amount),
		isWin: 1,
	});

	return c.json(
		{
			success: true as const,
			data: {
				oldBalance: settle.oldBalanceKobo,
				newBalance: settle.newBalanceKobo,
				currency,
				transactionId: settle.transactionId,
			},
		},
		200,
	);
});

const refundRoute = createRoute({
	method: "post",
	path: "/refund",
	tags: ["Lagos Rush Casino"],
	summary: "Refund user wallet",
	description:
		"Refunds user's wallet balance for Lagos Rush casino game. Requires the provider transactionId; retries with the same id are idempotent.",
	security: [{ ApiKeyAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: LagosRushRefundRequestSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Refund successful",
			content: {
				"application/json": {
					schema: LagosRushRefundResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid request",
			content: {
				"application/json": {
					schema: MinigodErrorSchema,
				},
			},
		},
		401: {
			description: "Unauthorized - Invalid API key",
			content: {
				"application/json": {
					schema: MinigodErrorSchema,
				},
			},
		},
	},
});

pocketsRoute.openapi(refundRoute, async (c) => {
	if (!validatePocketsApiKey(c)) {
		return c.json(authError, 401);
	}

	const body = await c.req.json();
	const result = LagosRushRefundRequestSchema.safeParse(body);

	if (!result.success) {
		return c.json({ success: false as const, error: "Invalid request body" }, 400);
	}

	const parsed = parseMoneyCall(result.data);
	if (!parsed.ok) {
		return c.json({ success: false as const, error: parsed.error }, 400);
	}

	const { playerId, currency } = result.data;
	const db = drizzle(c.env.DB, { schema });

	const settle = await settlePocketsTransaction({
		db,
		provider: "pockets",
		paymentMethod: "lagos rush",
		action: "refund",
		playerId,
		providerTxId: parsed.providerTxId,
		amountKobo: parsed.amountKobo,
		currency,
		metadata: { game: "lagos rush", currency, action: "refund" },
	});

	if (settle.status !== "settled" && settle.status !== "duplicate") {
		const { body: errBody, status } = settleErrorResponse(settle);
		return c.json(errBody, status);
	}

	if (settle.status === "settled") {
		await reportCasinoBetResultInBackground({
			env: c.env,
			executionCtx: optionalExecutionCtx(c),
			userId: playerId,
			betId: parsed.providerTxId,
			totalWinAmount: casinoBetAmountFromKobo(parsed.amountKobo),
			isWin: 0,
			isRollback: 1,
		});
	}

	return c.json(
		{
			success: true as const,
			data: {
				oldBalance: settle.oldBalanceKobo,
				newBalance: settle.newBalanceKobo,
				currency,
				transactionId: settle.transactionId,
			},
		},
		200,
	);
});

export default pocketsRoute;
