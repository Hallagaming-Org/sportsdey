import crypto from "node:crypto";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import * as schema from "@/db/schema";
import {
	trackWebengageEvent,
} from "@/lib/webengage";
import { requirePermission } from "@/middleware/admin-permissions";
import { ErrorResponseSchema, successResponseSchema } from "@/schemas";
import { toWAT } from "@/utils";
import { createTransferRecipient, initiateTransfer } from "@/utils/paystack";
import type { CloudflareBindings } from "../types";

const adminWithdrawalsRoute = new OpenAPIHono<{
	Bindings: CloudflareBindings;
}>();

const PendingWithdrawalSchema = z.object({
	id: z.string(),
	userId: z.string(),
	userName: z.string().nullable(),
	userEmail: z.string(),
	amount: z.number(),
	status: z.string(),
	bankCode: z.string().optional(),
	accountNumber: z.string().optional(),
	accountName: z.string().optional(),
	createdAt: z.string(),
});

const PaginationSchema = z.object({
	page: z.number(),
	limit: z.number(),
	total: z.number(),
	totalPages: z.number(),
});

const getPendingRoute = createRoute({
	method: "get",
	path: "/withdrawals/pending",
	tags: ["Admin - Withdrawals"],
	summary: "Get pending withdrawals",
	description:
		"List all withdrawal requests pending admin approval (requires transaction_read)",
	security: [{ BearerAuth: [] }],
	request: {
		query: z.object({
			page: z.coerce.number().int().min(1).default(1),
			limit: z.coerce.number().int().min(1).max(100).default(20),
		}),
	},
	responses: {
		200: {
			description: "Pending withdrawals retrieved",
			content: {
				"application/json": {
					schema: successResponseSchema(
						z.object({
							transactions: z.array(PendingWithdrawalSchema),
							pagination: PaginationSchema,
						}),
					),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		403: {
			description: "Forbidden - insufficient permissions",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

const approveRoute = createRoute({
	method: "post",
	path: "/withdrawals/{id}/approve",
	tags: ["Admin - Withdrawals"],
	summary: "Approve withdrawal",
	description:
		"Approve a pending withdrawal and process payout via Paystack (super_admin only)",
	security: [{ BearerAuth: [] }],
	request: {
		params: z.object({
			id: z.string().openapi({ description: "Transaction ID" }),
		}),
	},
	responses: {
		200: {
			description: "Withdrawal approved and processing",
			content: {
				"application/json": {
					schema: successResponseSchema(
						z.object({
							message: z.string(),
							transferReference: z.string().optional(),
						}),
					),
				},
			},
		},
		400: {
			description: "Invalid request",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		403: {
			description: "Forbidden - super_admin only",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		404: {
			description: "Transaction not found",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

const rejectRoute = createRoute({
	method: "post",
	path: "/withdrawals/{id}/reject",
	tags: ["Admin - Withdrawals"],
	summary: "Reject withdrawal",
	description:
		"Reject a pending withdrawal request with a reason and refund balance (super_admin only)",
	security: [{ BearerAuth: [] }],
	request: {
		params: z.object({
			id: z.string().openapi({ description: "Transaction ID" }),
		}),
		body: {
			content: {
				"application/json": {
					schema: z.object({
						reason: z
							.string()
							.min(1)
							.openapi({ description: "Reason for rejection" }),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: "Withdrawal rejected",
			content: {
				"application/json": {
					schema: successResponseSchema(z.object({ message: z.string() })),
				},
			},
		},
		400: {
			description: "Invalid request",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		403: {
			description: "Forbidden - super_admin only",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		404: {
			description: "Transaction not found",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

adminWithdrawalsRoute.openapi(getPendingRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (
		!session ||
		(session.role !== "super_admin" &&
			!requirePermission(session, "transaction_read"))
	) {
		return c.json(
			{ success: false, error: "Forbidden - insufficient permissions" },
			403,
		);
	}

	const query = c.req.valid("query");
	const page = query.page;
	const limit = query.limit;
	const offset = (page - 1) * limit;
	const db = drizzle(c.env.DB, { schema });

	const countResult = await db
		.select({ count: schema.walletTransaction.id })
		.from(schema.walletTransaction)
		.where(eq(schema.walletTransaction.status, "pending_approval"));

	const total = countResult.length;
	const totalPages = Math.ceil(total / limit);

	const transactions = await db
		.select({
			id: schema.walletTransaction.id,
			userId: schema.walletTransaction.userId,
			userName: schema.user.name,
			userEmail: schema.user.email,
			amount: schema.walletTransaction.amount,
			status: schema.walletTransaction.status,
			metadata: schema.walletTransaction.metadata,
			createdAt: schema.walletTransaction.createdAt,
		})
		.from(schema.walletTransaction)
		.innerJoin(schema.user, eq(schema.walletTransaction.userId, schema.user.id))
		.where(eq(schema.walletTransaction.status, "pending_approval"))
		.orderBy(desc(schema.walletTransaction.createdAt))
		.limit(limit)
		.offset(offset);

	const formatted = transactions.map((tx) => {
		let meta: Record<string, unknown> = {};
		try {
			meta = JSON.parse(tx.metadata || "{}");
		} catch {
			/* empty */
		}
		return {
			id: tx.id,
			userId: tx.userId,
			userName: tx.userName,
			userEmail: tx.userEmail,
			amount: (tx.amount ?? 0) / 100,
			status: tx.status,
			bankCode: (meta.bankCode as string) || undefined,
			accountNumber: (meta.accountNumber as string) || undefined,
			accountName: (meta.accountName as string) || undefined,
			createdAt: toWAT(tx.createdAt),
		};
	});

	return c.json({
		success: true,
		data: {
			transactions: formatted,
			pagination: { page, limit, total, totalPages },
		},
	});
});

adminWithdrawalsRoute.openapi(approveRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session || session.role !== "super_admin") {
		return c.json(
			{ success: false, error: "Forbidden - super_admin only" },
			403,
		);
	}

	const { id } = c.req.valid("param");
	const db = drizzle(c.env.DB, { schema });

	const [txn] = await db
		.select()
		.from(schema.walletTransaction)
		.where(eq(schema.walletTransaction.id, id))
		.limit(1);

	if (!txn) {
		return c.json({ success: false, error: "Transaction not found" }, 404);
	}

	if (txn.status !== "pending_approval") {
		return c.json(
			{
				success: false,
				error: "Transaction is not pending approval",
			},
			400,
		);
	}

	let meta: Record<string, unknown> = {};
	try {
		meta = JSON.parse(txn.metadata || "{}");
	} catch {
		/* empty */
	}

	const bankCode = meta.bankCode as string | undefined;
	const accountNumber = meta.accountNumber as string | undefined;
	const accountName = meta.accountName as string | undefined;

	if (!bankCode || !accountNumber || !accountName) {
		return c.json(
			{ success: false, error: "Missing bank details in transaction" },
			400,
		);
	}

	try {
		const recipient = await createTransferRecipient(
			c.env.PAYSTACK_SECRET_KEY,
			bankCode,
			accountNumber,
			accountName,
			"NGN",
			c.env.PROXY_URL,
			c.env.PROXY_SECRET,
		);

		const transfer = await initiateTransfer(
			c.env.PAYSTACK_SECRET_KEY,
			txn.amount / 100,
			recipient.recipient_code,
			"balance",
			"Withdrawal from wallet",
			c.env.PROXY_URL,
			c.env.PROXY_SECRET,
		);

		await db
			.update(schema.walletTransaction)
			.set({
				status: transfer.status === "success" ? "success" : "processing",
				paymentMethod: "paystack",
				reference: transfer.reference,
			})
			.where(eq(schema.walletTransaction.id, id));

		await db.insert(schema.userNotification).values({
			id: `notif_${crypto.randomUUID()}`,
			userId: txn.userId,
			title: "Withdrawal Approved",
			message: `Your withdrawal of ₦${(txn.amount / 100).toLocaleString()} has been approved and is being processed.`,
		});

		trackWebengageEvent(
			c.env,
			{
				userId: txn.userId,
				eventName: "withdrawal_completed",
				eventData: {
					amount: txn.amount / 100,
					transaction_id: transfer.reference,
					bank: bankCode,
					wallet_balance_after: (txn.balance ?? 0) / 100,
					"account number": accountNumber,
					"account name": accountName ?? "",
				},
			},
			c.executionCtx,
		);


		return c.json({
			success: true,
			data: {
				message: "Withdrawal approved and processing",
				transferReference: transfer.reference,
			},
		});
	} catch (error) {
		return c.json(
			{
				success: false,
				error:
					error instanceof Error
						? error.message
						: "Failed to process withdrawal",
			},
			400,
		);
	}
});

adminWithdrawalsRoute.openapi(rejectRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session || session.role !== "super_admin") {
		return c.json(
			{ success: false, error: "Forbidden - super_admin only" },
			403,
		);
	}

	const { id } = c.req.valid("param");
	const body = await c.req.json();
	const reasonResult = z.object({ reason: z.string().min(1) }).safeParse(body);

	if (!reasonResult.success) {
		return c.json({ success: false, error: "Reason is required" }, 400);
	}

	const { reason } = reasonResult.data;
	const db = drizzle(c.env.DB, { schema });

	const [txn] = await db
		.select()
		.from(schema.walletTransaction)
		.where(eq(schema.walletTransaction.id, id))
		.limit(1);

	if (!txn) {
		return c.json({ success: false, error: "Transaction not found" }, 404);
	}

	if (txn.status !== "pending_approval") {
		return c.json(
			{
				success: false,
				error: "Transaction is not pending approval",
			},
			400,
		);
	}

	let existingMeta: Record<string, unknown> = {};
	try {
		existingMeta = JSON.parse(txn.metadata || "{}");
	} catch {
		/* empty */
	}

	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, txn.userId))
		.limit(1);

	const refundedBalance = wallet ? wallet.balance + txn.amount : txn.amount;

	if (wallet) {
		await db
			.update(schema.wallet)
			.set({ balance: refundedBalance })
			.where(eq(schema.wallet.userId, txn.userId));
	}

	await db
		.update(schema.walletTransaction)
		.set({
			status: "rejected",
			balance: refundedBalance,
			metadata: JSON.stringify({
				...existingMeta,
				rejectionReason: reason,
				refundedAmount: txn.amount,
				balanceAfterRefund: refundedBalance,
			}),
		})
		.where(eq(schema.walletTransaction.id, id));

	await db.insert(schema.userNotification).values({
		id: `notif_${crypto.randomUUID()}`,
		userId: txn.userId,
		title: "Withdrawal Rejected",
		message: `Your withdrawal of ₦${(txn.amount / 100).toLocaleString()} has been rejected. Reason: ${reason}`,
	});

	return c.json({
		success: true,
		data: { message: "Withdrawal rejected" },
	});
});

export default adminWithdrawalsRoute;
