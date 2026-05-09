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
import type { CloudflareBindings } from "../types";

const pocketsRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

function validatePocketsApiKey(c: any): boolean {
	const apiKey = c.req.header("x-api-key");
	const secretKey = c.env.POCKETS_SECRET_KEY;
	return apiKey === secretKey;
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
		return c.json(
			{
				success: false,
				error: "Invalid API key",
			},
			401,
		);
	}

	const body = await c.req.json();
	const result = LagosRushBalanceRequestSchema.safeParse(body);

	if (!result.success) {
		return c.json(
			{
				success: false,
				error: "Invalid request body",
			},
			400,
		);
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
			success: true,
			data: {
				balance: balanceInKobo,
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
	description: "Debits user's wallet balance for Lagos Rush casino game",
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
		return c.json(
			{
				success: false,
				error: "Invalid API key",
			},
			401,
		);
	}

	const body = await c.req.json();
	const result = LagosRushDebitRequestSchema.safeParse(body);

	if (!result.success) {
		return c.json(
			{
				success: false,
				error: "Invalid request body",
			},
			400,
		);
	}

	const { playerId, amount, currency } = result.data;
	const db = drizzle(c.env.DB, { schema });

	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, playerId))
		.limit(1);

	const oldBalanceKobo = wallet?.balance ?? 0;

	if (oldBalanceKobo < amount) {
		return c.json(
			{
				success: false,
				error: "Insufficient balance",
			},
			400,
		);
	}

	const newBalanceKobo = oldBalanceKobo - amount;

	const [updatedWallet] = await db
		.update(schema.wallet)
		.set({ balance: newBalanceKobo })
		.where(eq(schema.wallet.userId, playerId))
		.returning();

	if (!updatedWallet?.id) {
		return c.json({ success: false, error: "Failed to update wallet" }, 500);
	}

	const transactionId = crypto.randomUUID();

	const [walletTxn] = await db.insert(schema.walletTransaction).values({
		id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
		userId: playerId,
		amount: amount,
		type: "debit",
		reference: null,
		status: "success",
		paymentMethod: "lagos rush",
		balance: newBalanceKobo,
	}).returning();

	if (!walletTxn?.id) {
		return c.json({ success: false, error: "Failed to record wallet transaction" }, 500);
	}

	const [debitTxn] = await db
		.insert(schema.pocketsTransactions)
		.values({
			id: transactionId,
			userId: playerId,
			type: "DEBIT",
			amount: amount / 100,
			currency,
		})
		.returning();

	if (!debitTxn?.id) {
		return c.json({ success: false, error: "Failed to record debit transaction" }, 500);
	}

	return c.json(
		{
			success: true,
			data: {
				oldBalance: oldBalanceKobo,
				newBalance: newBalanceKobo,
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
	tags: ["Lagos Rush Casino"],
	summary: "Credit user wallet",
	description: "Credits user's wallet balance for Lagos Rush casino game",
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
		return c.json(
			{
				success: false,
				error: "Invalid API key",
			},
			401,
		);
	}

	const body = await c.req.json();
	const result = LagosRushCreditRequestSchema.safeParse(body);

	if (!result.success) {
		return c.json(
			{
				success: false,
				error: "Invalid request body",
			},
			400,
		);
	}

	const { playerId, amount, currency } = result.data;
	const db = drizzle(c.env.DB, { schema });

	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, playerId))
		.limit(1);

	const oldBalanceKobo = wallet?.balance ?? 0;

	const newBalanceKobo = oldBalanceKobo + amount;

	const [updatedWallet] = await db
		.update(schema.wallet)
		.set({ balance: newBalanceKobo })
		.where(eq(schema.wallet.userId, playerId))
		.returning();

	if (!updatedWallet?.id) {
		return c.json({ success: false, error: "Failed to update wallet" }, 500);
	}

	const transactionId = crypto.randomUUID();

	const [walletTxn] = await db.insert(schema.walletTransaction).values({
		id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
		userId: playerId,
		amount: amount,
		type: "credit",
		reference: null,
		status: "success",
		paymentMethod: "lagos rush",
		balance: newBalanceKobo,
	}).returning();

	if (!walletTxn?.id) {
		return c.json({ success: false, error: "Failed to record wallet transaction" }, 500);
	}

	const [creditTxn] = await db
		.insert(schema.pocketsTransactions)
		.values({
			id: transactionId,
			userId: playerId,
			type: "CREDIT",
			amount: amount / 100,
			currency,
		})
		.returning();

	if (!creditTxn?.id) {
		return c.json({ success: false, error: "Failed to record credit transaction" }, 500);
	}

	return c.json(
		{
			success: true,
			data: {
				oldBalance: oldBalanceKobo,
				newBalance: newBalanceKobo,
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
	tags: ["Lagos Rush Casino"],
	summary: "Refund user wallet",
	description: "Refunds user's wallet balance for Lagos Rush casino game",
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
		return c.json(
			{
				success: false,
				error: "Invalid API key",
			},
			401,
		);
	}

	const body = await c.req.json();
	const result = LagosRushRefundRequestSchema.safeParse(body);

	if (!result.success) {
		return c.json(
			{
				success: false,
				error: "Invalid request body",
			},
			400,
		);
	}

	const { playerId, amount, currency } = result.data;
	const db = drizzle(c.env.DB, { schema });

	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, playerId))
		.limit(1);

	const oldBalanceKobo = wallet?.balance ?? 0;

	const newBalanceKobo = oldBalanceKobo + amount;

	const [updatedWallet] = await db
		.update(schema.wallet)
		.set({ balance: newBalanceKobo })
		.where(eq(schema.wallet.userId, playerId))
		.returning();

	if (!updatedWallet?.id) {
		return c.json({ success: false, error: "Failed to update wallet" }, 500);
	}

	const transactionId = crypto.randomUUID();

	const [walletTxn] = await db.insert(schema.walletTransaction).values({
		id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
		userId: playerId,
		amount: amount,
		type: "refund",
		reference: null,
		status: "success",
		paymentMethod: "lagos rush",
		balance: newBalanceKobo,
	}).returning();

	if (!walletTxn?.id) {
		return c.json({ success: false, error: "Failed to record wallet transaction" }, 500);
	}

	const [refundTxn] = await db
		.insert(schema.pocketsTransactions)
		.values({
			id: transactionId,
			userId: playerId,
			type: "REFUND",
			amount: amount / 100,
			currency,
		})
		.returning();

	if (!refundTxn?.id) {
		return c.json({ success: false, error: "Failed to record refund transaction" }, 500);
	}

	return c.json(
		{
			success: true,
			data: {
				oldBalance: oldBalanceKobo,
				newBalance: newBalanceKobo,
				currency,
				transactionId,
			},
		},
		200,
	);
});

export default pocketsRoute;
