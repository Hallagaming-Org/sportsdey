import crypto from "node:crypto";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { kudaRequest, generateRequestRef } from "@/lib/kuda/client";
import { creditWallet } from "@/db/atomic-wallet";
import { toWAT } from "@/utils";
import type { CloudflareBindings } from "../types";

const kudaRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const ErrorSchema = z.object({
	success: z.literal(false),
	error: z.string(),
});

// ===== 1. INITIATE DEPOSIT =====

const InitiateDepositSchema = z.object({
	amount: z.number().positive(),
});

const InitiateDepositResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		reference: z.string(),
		virtualAccountNumber: z.string(),
		bankName: z.string(),
		amount: z.number(),
		expiresAt: z.string(),
	}),
});

const initiateDepositRoute = createRoute({
	method: "post",
	path: "/deposit/initiate",
	tags: ["Kuda"],
	summary: "Initiate a Kuda deposit",
	description: "Generate a virtual account for user to deposit funds",
	security: [{ BearerAuth: [] }],
	request: {
		body: { content: { "application/json": { schema: InitiateDepositSchema } } },
	},
	responses: {
		200: {
			description: "Deposit initiated",
			content: { "application/json": { schema: InitiateDepositResponseSchema } },
		},
		401: { description: "Unauthorized", content: { "application/json": { schema: ErrorSchema } } },
		500: { description: "Server error", content: { "application/json": { schema: ErrorSchema } } },
	},
});

kudaRoute.openapi(initiateDepositRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ success: false as const, error: "Unauthorized" }, 401);
	}

	const body = await c.req.json();
	const parsed = InitiateDepositSchema.safeParse(body);

	if (!parsed.success) {
		return c.json({ success: false as const, error: "Invalid amount" }, 400);
	}

	const db = drizzle(c.env.DB, { schema });
	const reference = `KDA_DEP_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
	const amountKobo = Math.round(parsed.data.amount * 100);

	try {
		//  Generate a virtual account
		const virtualAccount = await generateVirtualAccount(c.env, {
			userId: user.id,
			reference: reference,
			amount: amountKobo,
		});

		await db.insert(schema.kudaTransactions).values({
			id: `kdatxn_${crypto.randomUUID()}`,
			userId: user.id,
			reference: reference,
			amount: amountKobo,
			status: "pending",
			type: "deposit",
			virtualAccount: virtualAccount.accountNumber,
			bankName: virtualAccount.bankName,
			expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours expiry
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		return c.json({
			success: true as const,
			data: {
				reference: reference,
				virtualAccountNumber: virtualAccount.accountNumber,
				bankName: virtualAccount.bankName,
				amount: parsed.data.amount,
				expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
			},
		}, 200);
	} catch (error) {
		console.error("Failed to initiate Kuda deposit:", error);
		return c.json({
			success: false as const,
			error: "Failed to initiate deposit",
		}, 500);
	}
});

// ===== WEBHOOK - =====

const webhookRoute = createRoute({
	method: "post",
	path: "/webhook",
	tags: ["Kuda"],
	summary: "Kuda webhook for deposit confirmation",
	responses: {
		200: { description: "Webhook processed" },
		401: { description: "Unauthorized" },
		500: { description: "Server error" },
	},
});

kudaRoute.openapi(webhookRoute, async (c) => {
	const username = c.req.header("username");
	const encodedPassword = c.req.header("password");

	if (!username || !encodedPassword) {
		return c.json({ success: false, error: "Missing credentials" }, 401);
	}

	const password = Buffer.from(encodedPassword, "base64").toString("utf8");

	if (username !== c.env.KUDA_WEBHOOK_USERNAME || password !== c.env.KUDA_WEBHOOK_PASSWORD) {
		return c.json({ success: false, error: "Invalid credentials" }, 401);
	}

	const rawBody = await c.req.text();
	let payload;

	try {
		payload = JSON.parse(rawBody);
	} catch {
		return c.json({ success: false, error: "Invalid JSON" }, 400);
	}

	console.log("[Kuda Webhook] Transaction received:", {
		reference: payload.transactionReference,
		status: payload.status,
		amount: payload.amount,
	});

	const db = drizzle(c.env.DB, { schema });
	const reference = payload.transactionReference;

	const [transaction] = await db
		.select()
		.from(schema.kudaTransactions)
		.where(eq(schema.kudaTransactions.reference, reference))
		.limit(1);

	if (!transaction) {
		console.error("[Kuda Webhook] Unknown reference:", reference);
		return c.json({ success: false, error: "Transaction not found" }, 404);
	}

	if (transaction.status === "success") {
		return c.json({ success: true, message: "Already processed" }, 200);
	}

	await db
		.update(schema.kudaTransactions)
		.set({
			status: payload.status === "SUCCESS" ? "success" : "failed",
			rawCallbackPayload: JSON.stringify(payload),
			updatedAt: new Date(),
		})
		.where(eq(schema.kudaTransactions.id, transaction.id));

	if (payload.status === "SUCCESS") {
		await creditWallet(db, transaction.userId, transaction.amount);

		await db.insert(schema.walletTransaction).values({
			id: `wt_${crypto.randomUUID()}`,
			userId: transaction.userId,
			amount: transaction.amount,
			type: "credit",
			reference: transaction.reference,
			status: "success",
			paymentMethod: "kuda",
			balance: 0, 
			metadata: JSON.stringify({
				virtualAccount: transaction.virtualAccount,
				bankName: transaction.bankName,
			}),
			createdAt: new Date(),
		});
	}

	return c.json({ success: true }, 200);
});

// ===== 3. CHECK DEPOSIT STATUS =====

const checkStatusRoute = createRoute({
	method: "get",
	path: "/deposit/status/{reference}",
	tags: ["Kuda"],
	summary: "Check deposit status",
	security: [{ BearerAuth: [] }],
	request: {
		params: z.object({ reference: z.string() }),
	},
	responses: {
		200: { description: "Status retrieved" },
		401: { description: "Unauthorized" },
		404: { description: "Transaction not found" },
	},
});

kudaRoute.openapi(checkStatusRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ success: false as const, error: "Unauthorized" }, 401);
	}

	const { reference } = c.req.valid("param");

	const db = drizzle(c.env.DB, { schema });

	const [transaction] = await db
		.select({
			status: schema.kudaTransactions.status,
			amount: schema.kudaTransactions.amount,
			createdAt: schema.kudaTransactions.createdAt,
		})
		.from(schema.kudaTransactions)
		.where(
			and(
				eq(schema.kudaTransactions.reference, reference),
				eq(schema.kudaTransactions.userId, user.id),
			),
		)
		.limit(1);

	if (!transaction) {
		return c.json({ success: false as const, error: "Transaction not found" }, 404);
	}

	return c.json({
		success: true as const,
		data: {
			status: transaction.status,
			amount: transaction.amount / 100,
			createdAt: toWAT(transaction.createdAt),
		},
	}, 200);
});

// ===== Generate Virtual Account =====

async function generateVirtualAccount(
	env: CloudflareBindings,
	params: { userId: string; reference: string; amount: number }
): Promise<{ accountNumber: string; bankName: string }> {
	const response = await kudaRequest<{
		status: boolean;
		message: string;
		data: { accountNumber: string; bankName: string };
	}>(env, "FUND_VIRTUAL_ACCOUNT", {
		userId: params.userId,
		reference: params.reference,
		amount: params.amount,
	});

	return response.data;
}

export default kudaRoute;