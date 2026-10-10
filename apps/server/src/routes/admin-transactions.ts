import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import * as schema from "@/db/schema";
import { requirePermission } from "@/middleware/admin-permissions";
import { ErrorResponseSchema, successResponseSchema } from "@/schemas";
import {
	adminActivityActions,
	getAdminActivityActor,
	recordActivityForSession,
} from "@/utils/admin-activity-log";
import {
	parseWalletTransactionMetadata,
	readWalletFraudFlag,
	withWalletFraudFlag,
	type WalletFraudFlag,
} from "@/utils/wallet-transaction-fraud-flag";
import type { CloudflareBindings } from "../types";

const adminTransactionsRoute = new OpenAPIHono<{
	Bindings: CloudflareBindings;
}>();

function formatDateTime(date: Date): string {
	const watDate = new Date(date.getTime() + 60 * 60 * 1000);
	const months = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];
	const month = months[watDate.getMonth()];
	const day = watDate.getDate();
	const year = watDate.getFullYear();
	const hours = watDate.getHours();
	const minutes = watDate.getMinutes().toString().padStart(2, "0");
	const ampm = hours >= 12 ? "pm" : "am";
	const displayHours = hours % 12 || 12;
	return `${month} ${day}, ${year}, ${displayHours}:${minutes} ${ampm}`;
}

function capitalizeStatus(status: string): string {
	return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fraudFlagFields(flag: WalletFraudFlag | null) {
	return {
		flagged: flag !== null,
		flaggedAt: flag?.flaggedAt ?? null,
		flaggedByAdminName: flag?.flaggedByAdminName ?? null,
		flagReason: flag?.reason ?? null,
	};
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
	type: z.enum(["deposit", "withdrawal"]),
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
	userId: z.string().optional(),
	flagged: z.boolean(),
	flaggedAt: z.number().nullable(),
	flaggedByAdminName: z.string().nullable(),
	flagReason: z.string().nullable(),
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
		return c.json(
			{ success: false, error: "Unauthorized", details: null },
			401,
		);
	}

	const session = await validateAdminSession(c.env, token);
	if (
		!session ||
		(session.role !== "admin" && session.role !== "super_admin")
	) {
		return c.json(
			{ success: false, error: "Forbidden - admin only", details: null },
			403,
		);
	}

	if (
		session.role !== "super_admin" &&
		!requirePermission(session, "transaction_read")
	) {
		return c.json(
			{
				success: false,
				error: "Forbidden - transactions permission required",
				details: null,
			},
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
		return c.json(
			{ success: false, error: "Transaction not found", details: null },
			404,
		);
	}

	const meta: Record<string, unknown> = parseWalletTransactionMetadata(
		txn.metadata,
	);
	const fraud = readWalletFraudFlag(meta);

	const amount = (txn.amount ?? 0) / 100;

	if (txn.type === "credit") {
		return c.json({
			success: true,
			data: {
				transactionId: txn.id,
				userId: txn.userId,
				type: "deposit" as const,
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
				...fraudFlagFields(fraud),
			},
		});
	}

	const processedOn =
		txn.status === "success" ||
		txn.status === "completed" ||
		txn.status === "rejected"
			? formatDateTime(new Date(txn.createdAt))
			: null;

	return c.json({
		success: true,
		data: {
			transactionId: txn.id,
			userId: txn.userId,
			type: "withdrawal" as const,
			status: capitalizeStatus(txn.status),
			amount,
			feesAmount: (meta.feesAmount as number) ?? 0,
			requestedOn: formatDateTime(new Date(txn.createdAt)),
			processedOn,
			paymentMethod: txn.paymentMethod,
			bankName:
				(meta.bankName as string) ?? (meta.destinationBank as string) ?? null,
			accountNumber: maskAccountNumber((meta.accountNumber as string) ?? ""),
			accountName: (meta.accountName as string) ?? "",
			referenceId: txn.reference ?? "",
			balanceBefore: (meta.balanceBefore as number) ?? null,
			ipAddress: (meta.ipAddress as string) ?? "",
			device: (meta.device as string) ?? "",
			location: (meta.location as string) ?? "",
			transactionChannel: (meta.transactionChannel as string) ?? "",
			...fraudFlagFields(fraud),
		},
	});
});

const FlagTransactionBodySchema = z.object({
	reason: z
		.string()
		.trim()
		.max(500)
		.optional()
		.openapi({ description: "Optional reason for flagging the transaction" }),
});

const FlagTransactionResponseSchema = z.object({
	transactionId: z.string(),
	alreadyFlagged: z.boolean(),
	flagged: z.literal(true),
	flaggedAt: z.number(),
	flaggedByAdminId: z.string(),
	flaggedByAdminName: z.string(),
	flagReason: z.string().nullable(),
});

const flagTransactionRoute = createRoute({
	method: "post",
	path: "/wallet-transactions/{id}/flag",
	tags: ["Admin - Wallet"],
	summary: "Flag a wallet transaction as fraud",
	description:
		"Record a fraud flag on a wallet transaction (who, when, optional reason) and write an admin activity-log entry. Idempotent if already flagged. Admin or super_admin with transactions permission required.",
	security: [{ BearerAuth: [] }],
	request: {
		params: TransactionSummaryParamsSchema,
		body: {
			content: {
				"application/json": {
					schema: FlagTransactionBodySchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Transaction flagged as fraud",
			content: {
				"application/json": {
					schema: successResponseSchema(FlagTransactionResponseSchema),
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

adminTransactionsRoute.openapi(flagTransactionRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json(
			{ success: false, error: "Unauthorized", details: null },
			401,
		);
	}

	const session = await validateAdminSession(c.env, token);
	if (
		!session ||
		(session.role !== "admin" && session.role !== "super_admin")
	) {
		return c.json(
			{ success: false, error: "Forbidden - admin only", details: null },
			403,
		);
	}

	if (
		session.role !== "super_admin" &&
		!requirePermission(session, "transaction_read")
	) {
		return c.json(
			{
				success: false,
				error: "Forbidden - transactions permission required",
				details: null,
			},
			403,
		);
	}

	const { id } = c.req.valid("param");
	const body = c.req.valid("json");
	const reason = body.reason?.trim() ? body.reason.trim() : null;

	const db = drizzle(c.env.DB, { schema });

	const [txn] = await db
		.select()
		.from(schema.walletTransaction)
		.where(eq(schema.walletTransaction.id, id))
		.limit(1);

	if (!txn) {
		return c.json(
			{ success: false, error: "Transaction not found", details: null },
			404,
		);
	}

	const meta = parseWalletTransactionMetadata(txn.metadata);
	const existing = readWalletFraudFlag(meta);
	if (existing) {
		return c.json({
			success: true,
			data: {
				transactionId: txn.id,
				alreadyFlagged: true,
				flagged: true as const,
				flaggedAt: existing.flaggedAt,
				flaggedByAdminId: existing.flaggedByAdminId,
				flaggedByAdminName: existing.flaggedByAdminName,
				flagReason: existing.reason,
			},
		});
	}

	const actor = await getAdminActivityActor(c.env, session.adminId);
	const flaggedByAdminName = actor?.name?.trim() || session.adminId;
	const flag: WalletFraudFlag = {
		flagged: true,
		flaggedAt: Date.now(),
		flaggedByAdminId: session.adminId,
		flaggedByAdminName,
		reason,
	};

	await db
		.update(schema.walletTransaction)
		.set({
			metadata: JSON.stringify(withWalletFraudFlag(meta, flag)),
		})
		.where(eq(schema.walletTransaction.id, txn.id));

	const [targetUser] = await db
		.select({
			id: schema.user.id,
			name: schema.user.name,
			email: schema.user.email,
			username: schema.user.mobileNumber,
		})
		.from(schema.user)
		.where(eq(schema.user.id, txn.userId))
		.limit(1);

	await recordActivityForSession(
		c.env,
		session.adminId,
		adminActivityActions.flagTransaction,
		{
			targetUser: targetUser
				? {
						id: targetUser.id,
						name: targetUser.name,
						email: targetUser.email,
						username: targetUser.username,
					}
				: undefined,
			details: {
				transactionId: txn.id,
				reason: reason ?? undefined,
			},
		},
	);

	return c.json({
		success: true,
		data: {
			transactionId: txn.id,
			alreadyFlagged: false,
			flagged: true as const,
			flaggedAt: flag.flaggedAt,
			flaggedByAdminId: flag.flaggedByAdminId,
			flaggedByAdminName: flag.flaggedByAdminName,
			flagReason: flag.reason,
		},
	});
});

export default adminTransactionsRoute;
