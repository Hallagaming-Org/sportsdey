/**
 * Halla wallet callbacks — same shape as /pockets/*, but amounts are Naira.
 * Converts to/from kobo for the Sportsdey wallet (Lagos Rush /pockets stays kobo).
 *
 * Money calls require the provider transactionId and settle claim-first via
 * `settlePocketsTransaction`, so provider retries never move money twice.
 *
 * Mounted at: POST /halla/pockets/{balance|debit|credit|refund}
 */
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
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
	BONUS_ENGINE_NATIVE_PROVIDER_ID,
	optionalExecutionCtx,
	reportCasinoBetInBackground,
} from "@/services/bonus-engine";
import {
	settlePocketsTransaction,
	type PocketsSettleResult,
} from "@/services/pockets-settlement";
import { CasinoMoneyError, toKobo } from "@/utils/casino-money";
import { koboToNaira } from "@/utils/halla-money";
import type { CloudflareBindings } from "../types";

const hallaPocketsRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

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

/**
 * Validates the idempotency key + Naira amount for a money call.
 * `transactionId` is mandatory: without it a provider retry is
 * indistinguishable from a new transaction and duplicates money movement.
 */
function parseMoneyCall(input: {
	amount: number;
	transactionId?: string;
}):
	| { ok: true; providerTxId: string; amountKobo: number }
	| { ok: false; error: string } {
	if (!input.transactionId) {
		return {
			ok: false,
			error: "transactionId is required for idempotent processing",
		};
	}
	try {
		const amountKobo = toKobo(input.amount, "naira");
		if (amountKobo <= 0) {
			return { ok: false, error: "Amount must be a positive Naira amount" };
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
	tags: ["Halla Mini Games"],
	summary: "Get user wallet balance (Naira)",
	description:
		"Returns Sportsdey NGN wallet balance in Naira for Halla (internal ledger is kobo)",
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

hallaPocketsRoute.openapi(balanceRoute, async (c) => {
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

	const balanceInKobo = wallet?.balance ?? 0;

	return c.json(
		{
			success: true as const,
			data: {
				balance: koboToNaira(balanceInKobo),
				currency,
			},
		},
		200,
	);
});

const debitRoute = createRoute({
	method: "post",
	path: "/debit",
	tags: ["Halla Mini Games"],
	summary: "Debit user wallet (Naira amount)",
	description:
		"Debits Sportsdey wallet; request amount is Naira, stored as kobo. Requires the provider transactionId; retries with the same id are idempotent.",
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

hallaPocketsRoute.openapi(debitRoute, async (c) => {
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

	const { playerId, amount: amountNaira, currency } = result.data;
	const db = drizzle(c.env.DB, { schema });

	const settle = await settlePocketsTransaction({
		db,
		provider: "halla",
		paymentMethod: "halla",
		action: "debit",
		playerId,
		providerTxId: parsed.providerTxId,
		amountKobo: parsed.amountKobo,
		currency,
		metadata: { game: "halla", currency, action: "bet", amountNaira },
	});

	if (settle.status !== "settled" && settle.status !== "duplicate") {
		const { body: errBody, status } = settleErrorResponse(settle);
		return c.json(errBody, status);
	}

	if (settle.status === "settled") {
		// Halla callbacks carry no game code, so the bet reports at provider level.
		await reportCasinoBetInBackground({
			env: c.env,
			executionCtx: optionalExecutionCtx(c),
			userId: playerId,
			betId: parsed.providerTxId,
			amount: amountNaira,
			currency,
			fallbackProviderId: BONUS_ENGINE_NATIVE_PROVIDER_ID.HALLA,
		});
	}

	return c.json(
		{
			success: true as const,
			data: {
				oldBalance: koboToNaira(settle.oldBalanceKobo),
				newBalance: koboToNaira(settle.newBalanceKobo),
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
	tags: ["Halla Mini Games"],
	summary: "Credit user wallet (Naira amount)",
	description:
		"Credits Sportsdey wallet; request amount is Naira, stored as kobo. Requires the provider transactionId; retries with the same id are idempotent.",
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

hallaPocketsRoute.openapi(creditRoute, async (c) => {
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

	const { playerId, amount: amountNaira, currency } = result.data;
	const db = drizzle(c.env.DB, { schema });

	const settle = await settlePocketsTransaction({
		db,
		provider: "halla",
		paymentMethod: "halla",
		action: "credit",
		playerId,
		providerTxId: parsed.providerTxId,
		amountKobo: parsed.amountKobo,
		currency,
		metadata: { game: "halla", currency, action: "win", amountNaira },
	});

	if (settle.status !== "settled" && settle.status !== "duplicate") {
		const { body: errBody, status } = settleErrorResponse(settle);
		return c.json(errBody, status);
	}

	return c.json(
		{
			success: true as const,
			data: {
				oldBalance: koboToNaira(settle.oldBalanceKobo),
				newBalance: koboToNaira(settle.newBalanceKobo),
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
	tags: ["Halla Mini Games"],
	summary: "Refund user wallet (Naira amount)",
	description:
		"Refunds Sportsdey wallet; request amount is Naira, stored as kobo. Requires the provider transactionId; retries with the same id are idempotent.",
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

hallaPocketsRoute.openapi(refundRoute, async (c) => {
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

	const { playerId, amount: amountNaira, currency } = result.data;
	const db = drizzle(c.env.DB, { schema });

	const settle = await settlePocketsTransaction({
		db,
		provider: "halla",
		paymentMethod: "halla",
		action: "refund",
		playerId,
		providerTxId: parsed.providerTxId,
		amountKobo: parsed.amountKobo,
		currency,
		metadata: { game: "halla", currency, action: "refund", amountNaira },
	});

	if (settle.status !== "settled" && settle.status !== "duplicate") {
		const { body: errBody, status } = settleErrorResponse(settle);
		return c.json(errBody, status);
	}

	return c.json(
		{
			success: true as const,
			data: {
				oldBalance: koboToNaira(settle.oldBalanceKobo),
				newBalance: koboToNaira(settle.newBalanceKobo),
				currency,
				transactionId: settle.transactionId,
			},
		},
		200,
	);
});

export default hallaPocketsRoute;
