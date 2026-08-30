/**
 * Halla wallet callbacks — same shape as /pockets/*, but amounts are Naira.
 * Converts to/from kobo for the Sportsdey wallet (Lagos Rush /pockets stays kobo).
 *
 * Mounted at: POST /halla/pockets/{balance|debit|credit|refund}
 */
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { creditWallet, debitWallet } from "@/db/atomic-wallet";
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
import { koboToNaira, nairaToKobo } from "@/utils/halla-money";
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
	description: "Debits Sportsdey wallet; request amount is Naira, stored as kobo",
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

	const { playerId, amount: amountNaira, currency } = result.data;
	const amountKobo = nairaToKobo(amountNaira);
	const db = drizzle(c.env.DB, { schema });

	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, playerId))
		.limit(1);

	const oldBalanceKobo = wallet?.balance ?? 0;

	if (oldBalanceKobo < amountKobo) {
		return c.json(
			{ success: false as const, error: "Insufficient balance" },
			400,
		);
	}

	const updatedWallet = await debitWallet(db, playerId, amountKobo);
	if (!updatedWallet) {
		return c.json({ success: false as const, error: "Failed to update wallet" }, 500);
	}
	const newBalanceKobo = updatedWallet.balance;
	const transactionId = crypto.randomUUID();

	const [walletTxn] = await db
		.insert(schema.walletTransaction)
		.values({
			id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
			userId: playerId,
			amount: amountKobo,
			type: "debit",
			reference: null,
			status: "success",
			paymentMethod: "halla",
			balance: newBalanceKobo,
			metadata: JSON.stringify({
				game: "halla",
				currency,
				action: "bet",
				amountNaira,
			}),
		})
		.returning();

	if (!walletTxn?.id) {
		return c.json(
			{ success: false as const, error: "Failed to record wallet transaction" },
			500,
		);
	}

	const [debitTxn] = await db
		.insert(schema.pocketsTransactions)
		.values({
			id: transactionId,
			userId: playerId,
			type: "DEBIT",
			amount: amountKobo,
			balanceBefore: oldBalanceKobo,
			balanceAfter: newBalanceKobo,
			currency,
		})
		.returning();

	if (!debitTxn?.id) {
		return c.json(
			{ success: false as const, error: "Failed to record debit transaction" },
			500,
		);
	}

	return c.json(
		{
			success: true as const,
			data: {
				oldBalance: koboToNaira(oldBalanceKobo),
				newBalance: koboToNaira(newBalanceKobo),
				currency,
				transactionId,
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
	description: "Credits Sportsdey wallet; request amount is Naira, stored as kobo",
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

	const { playerId, amount: amountNaira, currency } = result.data;
	const amountKobo = nairaToKobo(amountNaira);
	const db = drizzle(c.env.DB, { schema });

	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, playerId))
		.limit(1);

	const oldBalanceKobo = wallet?.balance ?? 0;
	const updatedWallet = await creditWallet(db, playerId, amountKobo);
	if (!updatedWallet) {
		return c.json({ success: false as const, error: "Failed to update wallet" }, 500);
	}
	const newBalanceKobo = updatedWallet.balance;
	const transactionId = crypto.randomUUID();

	const [walletTxn] = await db
		.insert(schema.walletTransaction)
		.values({
			id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
			userId: playerId,
			amount: amountKobo,
			type: "credit",
			reference: null,
			status: "success",
			paymentMethod: "halla",
			balance: newBalanceKobo,
			metadata: JSON.stringify({
				game: "halla",
				currency,
				action: "win",
				amountNaira,
			}),
		})
		.returning();

	if (!walletTxn?.id) {
		return c.json(
			{ success: false as const, error: "Failed to record wallet transaction" },
			500,
		);
	}

	const [creditTxn] = await db
		.insert(schema.pocketsTransactions)
		.values({
			id: transactionId,
			userId: playerId,
			type: "CREDIT",
			amount: amountKobo,
			balanceBefore: oldBalanceKobo,
			balanceAfter: newBalanceKobo,
			currency,
		})
		.returning();

	if (!creditTxn?.id) {
		return c.json(
			{ success: false as const, error: "Failed to record credit transaction" },
			500,
		);
	}

	return c.json(
		{
			success: true as const,
			data: {
				oldBalance: koboToNaira(oldBalanceKobo),
				newBalance: koboToNaira(newBalanceKobo),
				currency,
				transactionId,
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
	description: "Refunds Sportsdey wallet; request amount is Naira, stored as kobo",
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

	const { playerId, amount: amountNaira, currency } = result.data;
	const amountKobo = nairaToKobo(amountNaira);
	const db = drizzle(c.env.DB, { schema });

	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, playerId))
		.limit(1);

	const oldBalanceKobo = wallet?.balance ?? 0;
	const updatedWallet = await creditWallet(db, playerId, amountKobo);
	if (!updatedWallet) {
		return c.json({ success: false as const, error: "Failed to update wallet" }, 500);
	}
	const newBalanceKobo = updatedWallet.balance;
	const transactionId = crypto.randomUUID();

	const [walletTxn] = await db
		.insert(schema.walletTransaction)
		.values({
			id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
			userId: playerId,
			amount: amountKobo,
			type: "refund",
			reference: null,
			status: "success",
			paymentMethod: "halla",
			balance: newBalanceKobo,
			metadata: JSON.stringify({
				game: "halla",
				currency,
				action: "refund",
				amountNaira,
			}),
		})
		.returning();

	if (!walletTxn?.id) {
		return c.json(
			{ success: false as const, error: "Failed to record wallet transaction" },
			500,
		);
	}

	const [refundTxn] = await db
		.insert(schema.pocketsTransactions)
		.values({
			id: transactionId,
			userId: playerId,
			type: "REFUND",
			amount: amountKobo,
			balanceBefore: oldBalanceKobo,
			balanceAfter: newBalanceKobo,
			currency,
		})
		.returning();

	if (!refundTxn?.id) {
		return c.json(
			{ success: false as const, error: "Failed to record refund transaction" },
			500,
		);
	}

	return c.json(
		{
			success: true as const,
			data: {
				oldBalance: koboToNaira(oldBalanceKobo),
				newBalance: koboToNaira(newBalanceKobo),
				currency,
				transactionId,
			},
		},
		200,
	);
});

export default hallaPocketsRoute;
