import crypto from "node:crypto";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { createCashierOrder } from "@/lib/opay/client";
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

		const result = await createCashierOrder(
			{
				env: c.env.NODE_ENV === "production" ? "production" : "sandbox",
				merchantId: c.env.OPAY_MERCHANT_ID,
				publicKey: c.env.OPAY_PUBLIC_KEY,
				privateKey: c.env.OPAY_PRIVATE_KEY,
			},
			{
				reference,
				amountKobo,
				returnUrl: `${c.env.BETTER_AUTH_URL}/wallet?deposit=success`,
    			callbackUrl: `${c.env.SERVER_URL}/opay/callback`,
    			cancelUrl: `${c.env.BETTER_AUTH_URL}/wallet?deposit=cancelled`,
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
		console.error(
			"OPay initiate failed:",
			err instanceof Error ? err.message : err,
		);
		return c.json(
			{ success: false as const, error: "Failed to initiate deposit" },
			500,
		);
	}
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
		!("sha512" in parsedBody)
	) {
		const body = parsedBody as Record<string, unknown>;
		if (body.reference && body.status) {
			isValid = true;
			payload = body;
			reference = String(body.reference);
			status = String(body.status);
		}
	} else if (
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
		console.error("OPay callback for unknown reference:", reference);
		return c.json({ success: false, error: "Unknown reference" }, 400);
	}

	if (existingTxn.status === "success") {
		return c.json({ success: true }, 200);
	}

	const dbStatus = status === "SUCCESS" ? "success" : "failed";

	await db
		.update(schema.opayTransaction)
		.set({
			status: dbStatus,
			rawCallbackPayload: JSON.stringify(payload),
		})
		.where(eq(schema.opayTransaction.id, existingTxn.id));

	if (status === "SUCCESS") {
		const [walletRow] = await db
			.select({
				id: schema.wallet.id,
				balance: schema.wallet.balance,
			})
			.from(schema.wallet)
			.where(eq(schema.wallet.userId, existingTxn.userId))
			.limit(1);

		if (walletRow) {
			const newBalance = walletRow.balance + existingTxn.amount;

			await db.insert(schema.walletTransaction).values({
				id: `wtxn_${crypto.randomUUID()}`,
				userId: existingTxn.userId,
				amount: existingTxn.amount,
				type: "credit",
				reference: existingTxn.reference,
				status: "success",
				paymentMethod: "opay",
				balance: newBalance,
				createdAt: new Date(),
			});

			await db
				.update(schema.wallet)
				.set({ balance: newBalance })
				.where(eq(schema.wallet.id, walletRow.id));

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
	} else {
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
