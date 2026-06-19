import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import * as schema from "@/db/schema";
import { requirePermission } from "@/middleware/admin-permissions";
import { ErrorResponseSchema, successResponseSchema } from "@/schemas";
import type { CloudflareBindings } from "../types";

const adminTransactionsRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

function formatDateTime(date: Date): string {
	const months = [
		"Jan", "Feb", "Mar", "Apr", "May", "Jun",
		"Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
	];
	const month = months[date.getMonth()];
	const day = date.getDate();
	const year = date.getFullYear();
	const hours = date.getHours();
	const minutes = date.getMinutes().toString().padStart(2, "0");
	const ampm = hours >= 12 ? "pm" : "am";
	const displayHours = hours % 12 || 12;
	return `${month} ${day}, ${year}, ${displayHours}:${minutes} ${ampm}`;
}

function capitalizeStatus(status: string): string {
	return status
		.replace(/_/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

function maskAccountNumber(acc: string): string {
	if (acc.length <= 4) return acc;
	return "*".repeat(acc.length - 4) + acc.slice(-4);
}

const TransactionSummaryParamsSchema = z.object({
	id: z.string().openapi({ description: "Transaction ID" }),
});

const TransactionSummaryResponseSchema = z.object({
	transactionId: z.string(),
	type: z.enum(["Deposit", "Withdrawal"]),
	status: z.string(),
	amount: z.number(),
	paymentMethod: z.string(),
	referenceId: z.string(),
	ipAddress: z.string(),
	device: z.string(),
	location: z.string(),
	transactionChannel: z.string(),
	fees: z.number().optional(),
	date: z.string().optional(),
	amountCredited: z.number().optional(),
	provider: z.string().optional(),
	cardType: z.string().nullable().optional(),
	cardLast4: z.string().nullable().optional(),
	description: z.string().optional(),
	feesAmount: z.number().optional(),
	requestedOn: z.string().optional(),
	processedOn: z.string().nullable().optional(),
	bankName: z.string().nullable().optional(),
	accountNumber: z.string().optional(),
	accountName: z.string().optional(),
	balanceBefore: z.number().nullable().optional(),
});

const getTransactionSummaryRoute = createRoute({
	method: "get",
	path: "/wallet-transactions/{id}/summary",
	tags: ["Admin - Wallet"],
	summary: "Get transaction summary",
	description:
		"Retrieve a detailed transaction summary for a deposit or withdrawal. Admin or super_admin with transactions permission required.",
	security: [{ BearerAuth: [] }],
	request: {
		params: TransactionSummaryParamsSchema,
	},
	responses: {
		200: {
			description: "Transaction summary retrieved",
			content: {
				"application/json": {
					schema: successResponseSchema(TransactionSummaryResponseSchema),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		403: {
			description: "Forbidden",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		404: {
			description: "Transaction not found",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

adminTransactionsRoute.openapi(getTransactionSummaryRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized", details: null }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (
		!session ||
		(session.role !== "admin" && session.role !== "super_admin")
	) {
		return c.json({ success: false, error: "Forbidden - admin only", details: null }, 403);
	}

	if (
		session.role !== "super_admin" &&
		!requirePermission(session, "transaction_read")
	) {
		return c.json(
			{ success: false, error: "Forbidden - transactions permission required", details: null },
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
		return c.json({ success: false, error: "Transaction not found", details: null }, 404);
	}

	let meta: Record<string, unknown> = {};
	try {
		meta = JSON.parse(txn.metadata || "{}");
	} catch { /* empty */ }

	const amount = (txn.amount ?? 0) / 100;

	if (txn.type === "credit") {
		return c.json({
			success: true,
			data: {
				transactionId: txn.id,
				type: "Deposit" as const,
				status: capitalizeStatus(txn.status),
				amount,
				fees: (meta.fees as number) ?? 0,
				date: formatDateTime(new Date(txn.createdAt)),
				amountCredited: (meta.amountCredited as number) ?? amount,
				paymentMethod: txn.paymentMethod,
				provider: (meta.provider as string) ?? "",
				referenceId: txn.reference ?? "",
				cardType: (meta.cardType as string) ?? null,
				cardLast4: (meta.cardLast4 as string) ?? null,
				description: (meta.description as string) ?? "",
				ipAddress: (meta.ipAddress as string) ?? "",
				device: (meta.device as string) ?? "",
				location: (meta.location as string) ?? "",
				transactionChannel: (meta.transactionChannel as string) ?? "",
			},
		});
	}

	const processedOn = txn.status === "success" || txn.status === "completed" || txn.status === "rejected"
		? formatDateTime(new Date(txn.createdAt))
		: null;

	return c.json({
		success: true,
		data: {
			transactionId: txn.id,
			type: "Withdrawal" as const,
			status: capitalizeStatus(txn.status),
			amount,
			feesAmount: (meta.feesAmount as number) ?? 0,
			requestedOn: formatDateTime(new Date(txn.createdAt)),
			processedOn,
			paymentMethod: txn.paymentMethod,
			bankName: (meta.bankName as string) ?? (meta.destinationBank as string) ?? null,
			accountNumber: maskAccountNumber((meta.accountNumber as string) ?? ""),
			accountName: (meta.accountName as string) ?? "",
			referenceId: txn.reference ?? "",
			balanceBefore: (meta.balanceBefore as number) ?? null,
			ipAddress: (meta.ipAddress as string) ?? "",
			device: (meta.device as string) ?? "",
			location: (meta.location as string) ?? "",
			transactionChannel: (meta.transactionChannel as string) ?? "",
		},
	});
});

export default adminTransactionsRoute;
