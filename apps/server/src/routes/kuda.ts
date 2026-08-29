import crypto from "node:crypto";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import {
	createDynamicCollectionAccount,
	queryDynamicCollectionStatus,
} from "@/lib/kuda/clients";
import { toWAT } from "@/utils";
import type { CloudflareBindings } from "../types";

const kudaRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();
const ErrorSchema = z.object({ success: z.literal(false), error: z.string() });
const InitiateDepositSchema = z.object({ amount: z.number().finite().positive().max(9_999_999) });
const InitiateDepositResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({ reference: z.string(), virtualAccountNumber: z.string(), accountName: z.string(), bankName: z.string(), amount: z.number() }),
});

const initiateDepositRoute = createRoute({
	method: "post",
	path: "/deposit/initiate",
	tags: ["Kuda"],
	summary: "Create a Kuda dynamic collection account",
	description: "Creates a one-time account for a wallet top-up. Account creation is not payment confirmation.",
	security: [{ BearerAuth: [] }],
	request: { body: { content: { "application/json": { schema: InitiateDepositSchema } } } },
	responses: {
		200: { description: "Deposit account created", content: { "application/json": { schema: InitiateDepositResponseSchema } } },
		400: { description: "Invalid request", content: { "application/json": { schema: ErrorSchema } } },
		401: { description: "Unauthorized", content: { "application/json": { schema: ErrorSchema } } },
		500: { description: "Server error", content: { "application/json": { schema: ErrorSchema } } },
	},
});

kudaRoute.openapi(initiateDepositRoute, async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ success: false as const, error: "Unauthorized" }, 401);
	const parsed = InitiateDepositSchema.safeParse(await c.req.json());
	if (!parsed.success) return c.json({ success: false as const, error: "Enter a valid deposit amount" }, 400);

	const amountKobo = Math.round(parsed.data.amount * 100);
	const reference = `KDA${crypto.randomUUID().replaceAll("-", "").toUpperCase()}`;
	const db = drizzle(c.env.DB, { schema });
	try {
	const [wallet] = await db.select({ id: schema.wallet.id }).from(schema.wallet).where(eq(schema.wallet.userId, user.id)).limit(1);
	if (!wallet) return c.json({ success: false as const, error: "Wallet is not available" }, 400);

	await db.insert(schema.kudaTransactions).values({
		id: `kdatxn_${crypto.randomUUID()}`,
		userId: user.id,
		reference,
		amount: amountKobo,
		status: "initiated",
		type: "deposit",
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	try {
		const account = await createDynamicCollectionAccount(c.env, {
			requestRef: reference,
			amount: amountKobo,
			accountName: "Sportsdey Wallet Top-up",
		});
		await db.update(schema.kudaTransactions).set({
			status: "pending",
			beneficiaryAccount: account.accountNumber,
			beneficiaryName: account.accountName,
			beneficiaryBank: "Kuda Bank",
			updatedAt: new Date(),
		}).where(eq(schema.kudaTransactions.reference, reference));

		return c.json({ success: true as const, data: {
			reference,
			virtualAccountNumber: account.accountNumber,
			accountName: account.accountName,
			bankName: "Kuda Bank",
			amount: parsed.data.amount,
		} }, 200);
	} catch (error) {
		console.error("[Kuda] dynamic account creation failed", { reference, error: error instanceof Error ? error.message : "Unknown error" });
		await db.update(schema.kudaTransactions).set({ status: "failed", updatedAt: new Date() }).where(eq(schema.kudaTransactions.reference, reference));
		return c.json({ success: false as const, error: "Unable to create a Kuda deposit account. Please try again." }, 500);
	}
	} catch (error) {
		console.error("[Kuda] database setup failed", { reference, error: error instanceof Error ? error.message : "Unknown error" });
		return c.json({ success: false as const, error: "Kuda deposits are not ready on this environment. Apply the staging database migration and try again." }, 503);
	}
});

const webhookRoute = createRoute({
	method: "post",
	path: "/webhook",
	tags: ["Kuda"],
	summary: "Kuda transaction notification",
	responses: { 200: { description: "Webhook accepted" }, 401: { description: "Unauthorized" }, 400: { description: "Invalid request" } },
});

const KudaWebhookSchema = z.object({
	eventType: z.string(), amount: z.union([z.number(), z.string()]), transactionReference: z.string(), accountNumber: z.string(), transactionType: z.string(), clientRequestRef: z.string().optional(), transactionScope: z.string().optional(),
}).passthrough();

function secureEqual(actual: string, expected: string) {
	const actualHash = crypto.createHash("sha256").update(actual).digest();
	const expectedHash = crypto.createHash("sha256").update(expected).digest();
	return crypto.timingSafeEqual(actualHash, expectedHash);
}

kudaRoute.openapi(webhookRoute, async (c) => {
	const username = c.req.header("username") ?? "";
	const encodedPassword = c.req.header("password") ?? "";
	const expectedUsername = c.env.KUDA_WEBHOOK_USERNAME;
	const expectedPassword = c.env.KUDA_WEBHOOK_PASSWORD;
	if (!expectedUsername || !expectedPassword) {
		console.error("[Kuda] webhook credentials are not configured");
		return c.json({ success: false, error: "Webhook is not configured" }, 401);
	}
	const password = Buffer.from(encodedPassword, "base64").toString("utf8");
	if (!secureEqual(username, expectedUsername) || !secureEqual(password, expectedPassword)) return c.json({ success: false, error: "Invalid credentials" }, 401);

	const parsed = KudaWebhookSchema.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) return c.json({ success: false, error: "Invalid webhook payload" }, 400);
	const payload = parsed.data;
	const isIncomingCredit = payload.eventType.toLowerCase() === "transaction.notification" && payload.transactionType.toLowerCase() === "credit" && (!payload.transactionScope || payload.transactionScope.toLowerCase() === "inward");
	if (!isIncomingCredit || !payload.clientRequestRef) return c.json({ success: true }, 200);

	const db = drizzle(c.env.DB, { schema });
	const [transaction] = await db.select().from(schema.kudaTransactions).where(eq(schema.kudaTransactions.reference, payload.clientRequestRef)).limit(1);
	if (!transaction || transaction.type !== "deposit") {
		console.warn("[Kuda] received unmatched transaction notification", { reference: payload.clientRequestRef });
		return c.json({ success: true }, 200);
	}
	await db.update(schema.kudaTransactions).set({
		kudaReference: payload.transactionReference,
		rawCallbackPayload: JSON.stringify(payload),
		updatedAt: new Date(),
	}).where(eq(schema.kudaTransactions.id, transaction.id));

	c.executionCtx.waitUntil(confirmAndCreditDeposit(c.env, transaction.id, payload));
	return c.json({ success: true }, 200);
});

async function confirmAndCreditDeposit(env: CloudflareBindings, transactionId: string, payload: z.infer<typeof KudaWebhookSchema>) {
	const db = drizzle(env.DB, { schema });
	const [transaction] = await db.select().from(schema.kudaTransactions).where(eq(schema.kudaTransactions.id, transactionId)).limit(1);
	if (!transaction || transaction.status === "success") return;
	const receivedAmount = Number(payload.amount);
	if (!Number.isSafeInteger(receivedAmount) || receivedAmount !== transaction.amount || payload.accountNumber !== transaction.beneficiaryAccount) {
		console.error("[Kuda] deposit notification did not match its expected collection", { reference: transaction.reference });
		return;
	}

	try {
		const status = await queryDynamicCollectionStatus(env, { accountCreationRequestRef: transaction.reference, accountNumber: transaction.beneficiaryAccount });
		if (!isConfirmedCollection(status)) {
			console.warn("[Kuda] deposit TSQ is not final yet", { reference: transaction.reference });
			return;
		}
		const walletTransactionId = `wt_${crypto.randomUUID()}`;

		await env.DB.batch([
			env.DB.prepare("INSERT OR IGNORE INTO wallet_transaction (id, user_id, amount, type, reference, status, payment_method, balance, metadata, created_at) VALUES (?, ?, ?, 'credit', ?, 'pending', 'kuda', NULL, ?, ?)").bind(walletTransactionId, transaction.userId, transaction.amount, transaction.reference, JSON.stringify({ kudaReference: payload.transactionReference, accountNumber: transaction.beneficiaryAccount }), Date.now()),
			env.DB.prepare("UPDATE wallet SET balance = balance + ? WHERE user_id = ? AND EXISTS (SELECT 1 FROM wallet_transaction WHERE reference = ? AND status = 'pending')").bind(transaction.amount, transaction.userId, transaction.reference),
			env.DB.prepare("UPDATE wallet_transaction SET status = 'success', balance = (SELECT balance FROM wallet WHERE user_id = ?) WHERE reference = ? AND status = 'pending'").bind(transaction.userId, transaction.reference),
			env.DB.prepare("UPDATE kuda_transactions SET status = 'success', updated_at = ? WHERE id = ?").bind(Date.now(), transaction.id),
		]);
	} catch (error) {
		console.error("[Kuda] deposit confirmation failed", { reference: transaction.reference, error: error instanceof Error ? error.message : "Unknown error" });
	}
}

function isConfirmedCollection(status: Record<string, unknown>) {
	const values = [status.status, status.transactionStatus, status.paymentStatus, status.responseCode, status.code]
		.filter((value): value is string | number => typeof value === "string" || typeof value === "number")
		.map((value) => String(value).toUpperCase());
	return values.some((value) => ["SUCCESS", "SUCCESSFUL", "COMPLETED", "PAID", "00"].includes(value));
}

const checkStatusRoute = createRoute({
	method: "get", path: "/deposit/status/{reference}", tags: ["Kuda"], summary: "Check Kuda deposit status", security: [{ BearerAuth: [] }],
	request: { params: z.object({ reference: z.string() }) },
	responses: { 200: { description: "Status retrieved" }, 401: { description: "Unauthorized" }, 404: { description: "Transaction not found" } },
});

kudaRoute.openapi(checkStatusRoute, async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ success: false as const, error: "Unauthorized" }, 401);
	const { reference } = c.req.valid("param");
	const db = drizzle(c.env.DB, { schema });
	const [transaction] = await db.select({ status: schema.kudaTransactions.status, amount: schema.kudaTransactions.amount, createdAt: schema.kudaTransactions.createdAt }).from(schema.kudaTransactions).where(and(eq(schema.kudaTransactions.reference, reference), eq(schema.kudaTransactions.userId, user.id))).limit(1);
	if (!transaction) return c.json({ success: false as const, error: "Transaction not found" }, 404);
	return c.json({ success: true as const, data: { status: transaction.status, amount: transaction.amount / 100, createdAt: toWAT(transaction.createdAt) } }, 200);
});

export default kudaRoute;
