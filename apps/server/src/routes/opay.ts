import crypto from "node:crypto";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { createCashierOrder, queryCashierOrderStatus } from "@/lib/opay/client";
import { verifyCallbackSignature } from "@/lib/opay/signature";
import { trackWebengageEvent } from "@/lib/webengage";
import { syncWebengageUserProfile } from "@/utils/webengage-user-profile";
import type { CloudflareBindings } from "../types";

const opayRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const InitiateSchema = z.object({
	amount: z.number().positive().openapi({ example: 5000 }),
});

const InitiateResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		cashierUrl: z.string(),
		reference: z.string(),
	}),
});

const ErrorSchema = z.object({
	success: z.literal(false),
	error: z.string(),
});

function opayConfig(env: CloudflareBindings) {
	return {
		env: env.NODE_ENV === "production" ? ("production" as const) : ("sandbox" as const),
		merchantId: env.OPAY_MERCHANT_ID,
		publicKey: env.OPAY_PUBLIC_KEY,
		privateKey: env.OPAY_PRIVATE_KEY,
	};
}

function normalizeStatus(status: string): "success" | "pending" | "failed" {
	const normalized = status.toUpperCase();
	if (["SUCCESS", "SUCCESSFUL", "COMPLETED", "PAID"].includes(normalized)) return "success";
	if (["PENDING", "PROCESSING", "INITIATED"].includes(normalized)) return "pending";
	return "failed";
}

function safeCallbackRecord(payload: Record<string, unknown>) {
	return JSON.stringify({
		reference: typeof payload.reference === "string" ? payload.reference : undefined,
		orderNo: typeof payload.orderNo === "string" ? payload.orderNo : undefined,
		status: typeof payload.status === "string" ? payload.status : undefined,
	});
}

async function settleOpayTransaction(
	env: CloudflareBindings,
	transaction: { id: string; userId: string; amount: number; reference: string; status: string },
	providerStatus: string,
	payload?: Record<string, unknown>,
) {
	const status = normalizeStatus(providerStatus);
	const callbackRecord = payload ? safeCallbackRecord(payload) : null;
	const now = Date.now();

	if (status === "success") {
		await env.DB.batch([
			env.DB.prepare("UPDATE wallet SET balance = balance + ? WHERE user_id = ? AND EXISTS (SELECT 1 FROM wallet_transaction WHERE reference = ? AND status = 'pending')").bind(transaction.amount, transaction.userId, transaction.reference),
			env.DB.prepare("UPDATE wallet_transaction SET status = 'success', balance = (SELECT balance FROM wallet WHERE user_id = ?) WHERE reference = ? AND status = 'pending'").bind(transaction.userId, transaction.reference),
			env.DB.prepare("UPDATE opay_transaction SET status = 'success', raw_callback_payload = COALESCE(?, raw_callback_payload), updated_at = ? WHERE id = ? AND status != 'success'").bind(callbackRecord, now, transaction.id),
		]);
		return status;
	}

	const db = drizzle(env.DB, { schema });
	await db.update(schema.opayTransaction).set({
		status,
		...(callbackRecord ? { rawCallbackPayload: callbackRecord } : {}),
	}).where(and(eq(schema.opayTransaction.id, transaction.id), eq(schema.opayTransaction.status, "initiated")));
	if (status === "failed") {
		await db.update(schema.walletTransaction).set({ status: "failed" }).where(and(eq(schema.walletTransaction.reference, transaction.reference), eq(schema.walletTransaction.status, "pending")));
	}
	return status;
}

function getWalletRedirectOrigin(env: CloudflareBindings): string | null {
	for (const configuredOrigin of [
		env.FRONTEND_URL,
		env.CORS_ORIGIN,
		env.BETTER_AUTH_URL,
	]) {
		if (!configuredOrigin?.trim()) continue;
		try {
			return new URL(configuredOrigin).origin;
		} catch {
		}
	}
	return null;
}

const initiateRoute = createRoute({
	method: "post",
	path: "/initiate",
	tags: ["OPay"],
	summary: "Initiate an OPay deposit",
	security: [{ BearerAuth: [] }],
	request: {
		body: { content: { "application/json": { schema: InitiateSchema } } },
	},
	responses: {
		200: {
			description: "Cashier order created",
			content: { "application/json": { schema: InitiateResponseSchema } },
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorSchema } },
		},
		500: {
			description: "Provider error",
			content: { "application/json": { schema: ErrorSchema } },
		},
	},
});

opayRoute.openapi(initiateRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ success: false as const, error: "Unauthorized" }, 401);
	}

	const parsed = InitiateSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json(
			{ success: false as const, error: "Invalid request body" },
			400,
		);
	}

	if (
		!c.env.OPAY_MERCHANT_ID ||
		!c.env.OPAY_PUBLIC_KEY ||
		!c.env.OPAY_PRIVATE_KEY
	) {
		return c.json(
			{ success: false as const, error: "OPay is not configured" },
			500,
		);
	}

	const walletRedirectOrigin = getWalletRedirectOrigin(c.env);
	if (!walletRedirectOrigin) {
		return c.json(
			{ success: false as const, error: "Wallet redirect URL is not configured" },
			500,
		);
	}

	const db = drizzle(c.env.DB, { schema });
	const reference = `opay_${crypto.randomUUID()}`;
	const amountKobo = Math.round(parsed.data.amount * 100);

	try {
		const [opayTxn] = await db
			.insert(schema.opayTransaction)
			.values({
				id: `opaytxn_${crypto.randomUUID()}`,
				userId: user.id,
				reference,
				amount: amountKobo,
				status: "initiated",
			})
			.returning({ id: schema.opayTransaction.id });

		if (!opayTxn?.id) {
			return c.json(
				{
					success: false as const,
					error: "Failed to record deposit transaction",
				},
				500,
			);
		}

		const [wallet] = await db
			.select({ balance: schema.wallet.balance })
			.from(schema.wallet)
			.where(eq(schema.wallet.userId, user.id))
			.limit(1);

		await db.insert(schema.walletTransaction).values({
			id: `wtxn_${crypto.randomUUID()}`,
			userId: user.id,
			amount: amountKobo,
			type: "credit",
			reference,
			status: "pending",
			paymentMethod: "opay",
			balance: wallet?.balance ?? null,
			metadata: JSON.stringify({ provider: "opay" }),
			createdAt: new Date(),
		});

		trackWebengageEvent(
			c.env,
			{
				userId: user.id,
				eventName: "deposit_initiated",
				eventData: {
					amount: parsed.data.amount,
					currency: "NGN",
					payment_method: "opay",
					transaction_id: reference,
				},
			},
			c.executionCtx,
		);

		const result = await createCashierOrder(
			opayConfig(c.env),
			{
				reference,
				amountKobo,
				returnUrl: `${walletRedirectOrigin}/wallet?deposit=processing&reference=${encodeURIComponent(reference)}`,
				callbackUrl: `${c.env.SERVER_URL}/opay/callback`,
				cancelUrl: `${walletRedirectOrigin}/wallet?deposit=cancelled&reference=${encodeURIComponent(reference)}`,
				userEmail: user.email,
				userMobile: user.mobileNumber ?? "",
				userName: user.name,
			},
		);

		const [updatedTxn] = await db
			.update(schema.opayTransaction)
			.set({ orderNo: result.orderNo, cashierUrl: result.cashierUrl })
			.where(eq(schema.opayTransaction.id, opayTxn.id))
			.returning({ id: schema.opayTransaction.id });

		if (!updatedTxn?.id) {
			return c.json(
				{
					success: false as const,
					error: "Failed to update deposit transaction",
				},
				500,
			);
		}

		return c.json(
			{
				success: true as const,
				data: { cashierUrl: result.cashierUrl, reference },
			},
			200,
		);
	} catch (err) {
		const [updatedTxn] = await db
			.update(schema.opayTransaction)
			.set({ status: "failed" })
			.where(eq(schema.opayTransaction.reference, reference))
			.returning({ id: schema.opayTransaction.id });
		if (!updatedTxn?.id) {
			return c.json(
				{
					success: false as const,
					error: "Failed to update deposit transaction",
				},
				500,
			);
		}
		await db
			.update(schema.walletTransaction)
			.set({ status: "failed" })
			.where(eq(schema.walletTransaction.reference, reference));
		const [failedWallet] = await db
			.select({ balance: schema.wallet.balance })
			.from(schema.wallet)
			.where(eq(schema.wallet.userId, user.id))
			.limit(1);
		trackWebengageEvent(
			c.env,
			{
				userId: user.id,
				eventName: "deposit_failed",
				eventData: {
					amount: parsed.data.amount,
					payment_method: "opay",
					failure_reason:
						err instanceof Error ? err.message : "Failed to initiate deposit",
					wallet_balance_after: (failedWallet?.balance ?? 0) / 100,
				},
			},
			c.executionCtx,
		);
		console.error("OPay deposit initiation failed", {
			operation: "create_cashier_order",
			reason: err instanceof Error ? err.name : "UnknownError",
		});
		return c.json(
			{ success: false as const, error: "Failed to initiate deposit" },
			500,
		);
	}
});

const statusRoute = createRoute({
	method: "get",
	path: "/status/{reference}",
	tags: ["OPay"],
	summary: "Confirm an OPay deposit status",
	security: [{ BearerAuth: [] }],
	request: { params: z.object({ reference: z.string().min(1) }) },
	responses: { 200: { description: "Current deposit status" }, 401: { description: "Unauthorized" }, 404: { description: "Deposit not found" } },
});

opayRoute.openapi(statusRoute, async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ success: false as const, error: "Unauthorized" }, 401);
	const { reference } = c.req.valid("param");
	const db = drizzle(c.env.DB, { schema });
	const [transaction] = await db.select({
		id: schema.opayTransaction.id,
		userId: schema.opayTransaction.userId,
		amount: schema.opayTransaction.amount,
		reference: schema.opayTransaction.reference,
		orderNo: schema.opayTransaction.orderNo,
		status: schema.opayTransaction.status,
	}).from(schema.opayTransaction).where(and(eq(schema.opayTransaction.reference, reference), eq(schema.opayTransaction.userId, user.id))).limit(1);
	if (!transaction) return c.json({ success: false as const, error: "Deposit not found" }, 404);

	if (transaction.status !== "success" && transaction.orderNo && c.env.OPAY_MERCHANT_ID && c.env.OPAY_PUBLIC_KEY && c.env.OPAY_PRIVATE_KEY) {
		try {
			const remote = await queryCashierOrderStatus(opayConfig(c.env), { reference, orderNo: transaction.orderNo });
			await settleOpayTransaction(c.env, transaction, remote.status, { reference, orderNo: transaction.orderNo, status: remote.status });
		} catch (error) {
			console.error("OPay deposit reconciliation failed", { operation: "query_order_status", reason: error instanceof Error ? error.name : "UnknownError" });
		}
	}

	const [updated] = await db.select({ status: schema.opayTransaction.status }).from(schema.opayTransaction).where(eq(schema.opayTransaction.id, transaction.id)).limit(1);
	return c.json({ success: true as const, data: { status: updated?.status ?? transaction.status } }, 200);
});

const callbackRoute = createRoute({
	method: "post",
	path: "/callback",
	tags: ["OPay"],
	summary: "OPay webhook callback (unauthenticated, signature-verified)",
	responses: {
		200: { description: "Acknowledged" },
		400: { description: "Invalid signature or payload" },
	},
});

opayRoute.openapi(callbackRoute, async (c) => {
	if (!c.env.OPAY_PRIVATE_KEY) {
		return c.json({ success: false as const, error: "Not configured" }, 500);
	}

	const rawBody = await c.req.text();
	let parsedBody: unknown;

	try {
		parsedBody = JSON.parse(rawBody);
	} catch {
		return c.json({ success: false, error: "Invalid JSON" }, 400);
	}

	let payload: Record<string, unknown> | undefined;
	let reference: string | undefined;
	let status: string | undefined;
	let isValid = false;

	if (
		typeof parsedBody === "object" &&
		parsedBody !== null &&
		"payload" in parsedBody &&
		"sha512" in parsedBody
	) {
		const body = parsedBody as {
			payload?: Record<string, unknown>;
			sha512?: string;
		};

		if (body.payload && typeof body.sha512 === "string") {
			const { valid, payload: signedPayload } = await verifyCallbackSignature(
				rawBody,
				c.env.OPAY_PRIVATE_KEY,
			);

			if (valid && signedPayload) {
				isValid = true;
				payload = signedPayload;
				reference = signedPayload.reference as string;
				status = signedPayload.status as string;
			}
		}
	}

	if (!isValid || !payload || !reference || !status) {
		console.error("Callback verification failed");
		return c.json({ success: false, error: "Invalid" }, 400);
	}

	const db = drizzle(c.env.DB, { schema });

	const [existingTxn] = await db
		.select({
			id: schema.opayTransaction.id,
			userId: schema.opayTransaction.userId,
			amount: schema.opayTransaction.amount,
			reference: schema.opayTransaction.reference,
			status: schema.opayTransaction.status,
		})
		.from(schema.opayTransaction)
		.where(eq(schema.opayTransaction.reference, reference))
		.limit(1);

	if (!existingTxn) {
		console.error("OPay callback did not match a recorded transaction");
		return c.json({ success: false, error: "Unknown reference" }, 400);
	}

	if (existingTxn.status === "success") {
		return c.json({ success: true }, 200);
	}

	const dbStatus = await settleOpayTransaction(c.env, existingTxn, status, payload);

	if (dbStatus === "success") {
		const [walletRow] = await db
			.select({
				id: schema.wallet.id,
				balance: schema.wallet.balance,
			})
			.from(schema.wallet)
			.where(eq(schema.wallet.userId, existingTxn.userId))
			.limit(1);

		if (walletRow) {
			const newBalance = walletRow.balance;
			trackWebengageEvent(
				c.env,
				{
					userId: existingTxn.userId,
					eventName: "deposit_completed",
					eventData: {
						amount: existingTxn.amount / 100,
						currency: "NGN",
						payment_method: "opay",
						transaction_id: existingTxn.reference,
						type: "credit",
						wallet_balance_after: newBalance / 100,
					},
				},
				c.executionCtx,
			);

			await syncWebengageUserProfile(c.env, existingTxn.userId, c.executionCtx);
		}
	} else if (dbStatus === "failed") {
		const [failedWallet] = await db
			.select({ balance: schema.wallet.balance })
			.from(schema.wallet)
			.where(eq(schema.wallet.userId, existingTxn.userId))
			.limit(1);
		trackWebengageEvent(
			c.env,
			{
				userId: existingTxn.userId,
				eventName: "deposit_failed",
				eventData: {
					amount: existingTxn.amount / 100,
					payment_method: "opay",
					failure_reason: status || "Payment failed",
					wallet_balance_after: (failedWallet?.balance ?? 0) / 100,
				},
			},
			c.executionCtx,
		);
	}

	return c.json({ success: true }, 200);
});

export default opayRoute;
