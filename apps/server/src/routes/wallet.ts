import crypto from "node:crypto";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, count, desc, eq, gte, lt, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { creditWallet, debitWallet } from "@/db/atomic-wallet";
import * as schema from "@/db/schema";
import { trackWebengageEvent } from "@/lib/webengage";
import {
	CallbackQuerySchema,
	CreateWithdrawalAccountErrorSchema,
	CreateWithdrawalAccountResponseSchema,
	CreateWithdrawalAccountSchema,
	FundWalletErrorSchema,
	FundWalletResponseSchema,
	FundWalletSchema,
	GetBanksErrorSchema,
	GetBanksResponseSchema,
	GetGameWalletErrorSchema,
	GetGameWalletResponseSchema,
	GetTransactionsErrorSchema,
	GetTransactionsQuerySchema,
	GetTransactionsResponseSchema,
	GetWalletErrorSchema,
	GetWalletResponseSchema,
	GetWithdrawalAccountsErrorSchema,
	GetWithdrawalAccountsResponseSchema,
	TransferErrorSchema,
	TransferResponseSchema,
	TransferSchema,
	TransferToGameWalletErrorSchema,
	TransferToGameWalletResponseSchema,
	TransferToGameWalletSchema,
	WithdrawResponseSchema as WalletWithdrawResponseSchema,
	WithdrawErrorSchema,
	WithdrawSchema,
} from "@/schemas/wallet";
import {
	BONUS_ENGINE_DEFAULT_CURRENCY,
	reportBonusEngineDeposit,
	runBonusEngineBackground,
} from "@/services/bonus-engine";
import { toWAT } from "@/utils";
import {
	getNigerianBanks,
	initializeTransaction,
	verifyAccountNumber,
	verifyTransaction,
} from "@/utils/paystack";
import {
	getClientIp,
	getDeviceInfo,
	getLocation,
	getTransactionChannel,
} from "@/utils/request";
import { generateUUIDv7 } from "@/utils/uuid";
import { syncWebengageUserProfile } from "@/utils/webengage-user-profile";
import type { CloudflareBindings } from "../types";

const walletRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const fundWalletRoute = createRoute({
	method: "post",
	path: "/fund",
	tags: ["Wallet"],
	summary: "Fund wallet",
	description: "Initialize a wallet funding transaction via Paystack",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: FundWalletSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Payment initialized successfully",
			content: {
				"application/json": {
					schema: FundWalletResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid request or payment failed",
			content: {
				"application/json": {
					schema: FundWalletErrorSchema,
				},
			},
		},
		401: {
			description: "Unauthorized - user not authenticated",
			content: {
				"application/json": {
					schema: FundWalletErrorSchema,
				},
			},
		},
	},
});

const getWalletRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["Wallet"],
	summary: "Get wallet",
	description: "Retrieve the authenticated user's wallet details",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Wallet retrieved successfully",
			content: {
				"application/json": {
					schema: GetWalletResponseSchema,
				},
			},
		},
		401: {
			description: "Unauthorized - user not authenticated",
			content: {
				"application/json": {
					schema: GetWalletErrorSchema,
				},
			},
		},
	},
});

const getTransactionsRoute = createRoute({
	method: "get",
	path: "/transactions",
	tags: ["Wallet"],
	summary: "Get wallet transactions",
	description: "Retrieve the authenticated user's wallet transaction history",
	security: [{ BearerAuth: [] }],
	request: {
		query: GetTransactionsQuerySchema,
	},
	responses: {
		200: {
			description: "Transactions retrieved successfully",
			content: {
				"application/json": {
					schema: GetTransactionsResponseSchema,
				},
			},
		},
		401: {
			description: "Unauthorized - user not authenticated",
			content: {
				"application/json": {
					schema: GetTransactionsErrorSchema,
				},
			},
		},
	},
});

const getBanksRoute = createRoute({
	method: "get",
	path: "/banks",
	tags: ["Wallet"],
	summary: "Get Nigerian banks",
	description:
		"Retrieve supported Nigerian banks and bank codes for wallet withdrawals",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Banks retrieved successfully",
			content: {
				"application/json": {
					schema: GetBanksResponseSchema,
				},
			},
		},
		401: {
			description: "Unauthorized - user not authenticated",
			content: {
				"application/json": {
					schema: GetBanksErrorSchema,
				},
			},
		},
		400: {
			description: "Failed to fetch banks",
			content: {
				"application/json": {
					schema: GetBanksErrorSchema,
				},
			},
		},
	},
});

// const webhookRoute = createRoute({
// 	method: "post",
// 	path: "/webhook",
// 	tags: ["Wallet"],
// 	summary: "Paystack webhook",
// 	description: "Handle Paystack webhook events for wallet funding",
// 	responses: {
// 		200: {
// 			description: "Webhook processed",
// 			content: {
// 				"application/json": {
// 					schema: WebhookResponseSchema,
// 				},
// 			},
// 		},
// 		400: {
// 			description: "Invalid signature or malformed request",
// 			content: {
// 				"application/json": {
// 					schema: WebhookErrorSchema,
// 				},
// 			},
// 		},
// 	},
// });

const callbackRoute = createRoute({
	method: "get",
	path: "/callback",
	tags: ["Wallet"],
	summary: "Paystack callback redirect",
	description:
		"Handles Paystack callback query params and redirects to wallet transaction status page.",
	request: {
		query: CallbackQuerySchema,
	},
	responses: {
		302: {
			description: "Redirect to wallet status page",
		},
	},
});

const withdrawRoute = createRoute({
	method: "post",
	path: "/withdraw",
	tags: ["Wallet"],
	summary: "Withdraw funds",
	description: "Withdraw funds from wallet to a bank account",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: WithdrawSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Withdrawal successful",
			content: {
				"application/json": {
					schema: WalletWithdrawResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid request or insufficient balance",
			content: {
				"application/json": {
					schema: WithdrawErrorSchema,
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: WithdrawErrorSchema,
				},
			},
		},
	},
});

const transferRoute = createRoute({
	method: "post",
	path: "/transfer",
	tags: ["Wallet"],
	summary: "Transfer funds",
	description:
		"Transfer funds from authenticated user's wallet to another wallet",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: TransferSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Transfer successful",
			content: {
				"application/json": {
					schema: TransferResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid request or insufficient balance",
			content: {
				"application/json": {
					schema: TransferErrorSchema,
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: TransferErrorSchema,
				},
			},
		},
	},
});

const createWithdrawalAccountRoute = createRoute({
	method: "post",
	path: "/accounts",
	tags: ["Wallet"],
	summary: "Create withdrawal account",
	description: "Save a bank account for future withdrawals",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: CreateWithdrawalAccountSchema,
				},
			},
		},
	},
	responses: {
		201: {
			description: "Withdrawal account created successfully",
			content: {
				"application/json": {
					schema: CreateWithdrawalAccountResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid request",
			content: {
				"application/json": {
					schema: CreateWithdrawalAccountErrorSchema,
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: CreateWithdrawalAccountErrorSchema,
				},
			},
		},
	},
});

const getWithdrawalAccountsRoute = createRoute({
	method: "get",
	path: "/accounts",
	tags: ["Wallet"],
	summary: "Get withdrawal accounts",
	description: "List all saved withdrawal accounts for the authenticated user",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Withdrawal accounts retrieved successfully",
			content: {
				"application/json": {
					schema: GetWithdrawalAccountsResponseSchema,
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: GetWithdrawalAccountsErrorSchema,
				},
			},
		},
	},
});

const getWithdrawalAccountRoute = createRoute({
	method: "get",
	path: "/accounts/{id}",
	tags: ["Wallet"],
	summary: "Get withdrawal account",
	description: "Get a single saved withdrawal account by ID",
	security: [{ BearerAuth: [] }],
	request: {
		params: z.object({
			id: z.string().openapi({ description: "Withdrawal account ID" }),
		}),
	},
	responses: {
		200: {
			description: "Withdrawal account retrieved successfully",
			content: {
				"application/json": {
					schema: CreateWithdrawalAccountResponseSchema,
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: CreateWithdrawalAccountErrorSchema,
				},
			},
		},
		404: {
			description: "Account not found",
			content: {
				"application/json": {
					schema: CreateWithdrawalAccountErrorSchema,
				},
			},
		},
	},
});

const deleteWithdrawalAccountRoute = createRoute({
	method: "delete",
	path: "/accounts/{id}",
	tags: ["Wallet"],
	summary: "Delete withdrawal account",
	description: "Remove a saved withdrawal account",
	security: [{ BearerAuth: [] }],
	request: {
		params: z.object({
			id: z.string().openapi({ description: "Withdrawal account ID" }),
		}),
	},
	responses: {
		200: {
			description: "Withdrawal account deleted successfully",
			content: {
				"application/json": {
					schema: z
						.object({
							success: z
								.literal(true)
								.openapi({ description: "Success status" }),
							data: z
								.object({
									deleted: z
										.literal(true)
										.openapi({ description: "Deleted status" }),
								})
								.openapi({ description: "Response data" }),
						})
						.openapi("DeleteWithdrawalAccountResponse"),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: CreateWithdrawalAccountErrorSchema,
				},
			},
		},
		404: {
			description: "Account not found",
			content: {
				"application/json": {
					schema: CreateWithdrawalAccountErrorSchema,
				},
			},
		},
	},
});

const getGameWalletRoute = createRoute({
	method: "get",
	path: "/game-wallet",
	tags: ["Wallet"],
	summary: "Get game wallet",
	description:
		"Retrieve the authenticated user's game wallet details. Auto-creates if not exists.",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Game wallet retrieved successfully",
			content: {
				"application/json": {
					schema: GetGameWalletResponseSchema,
				},
			},
		},
		401: {
			description: "Unauthorized - user not authenticated",
			content: {
				"application/json": {
					schema: GetGameWalletErrorSchema,
				},
			},
		},
	},
});

const transferToGameWalletRoute = createRoute({
	method: "post",
	path: "/transfer-to-game",
	tags: ["Wallet"],
	summary: "Transfer to game wallet",
	description:
		"Transfer funds from normal wallet to game wallet for gaming purposes",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: TransferToGameWalletSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Transfer successful",
			content: {
				"application/json": {
					schema: TransferToGameWalletResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid request or insufficient balance",
			content: {
				"application/json": {
					schema: TransferToGameWalletErrorSchema,
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: TransferToGameWalletErrorSchema,
				},
			},
		},
	},
});

walletRoute.openapi(fundWalletRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
				details: null,
			},
			401,
		);
	}

	const result = FundWalletSchema.safeParse(await c.req.json());
	if (!result.success) {
		return c.json(
			{
				success: false as const,
				error: "Invalid request",
				details: null,
			},
			400,
		);
	}

	const { amount } = result.data;
	const db = drizzle(c.env.DB, { schema });

	const userAgent = c.req.header("user-agent") || "";
	const ipAddress = getClientIp(c);
	const device = getDeviceInfo(userAgent);
	const location = getLocation(c);
	const transactionChannel = getTransactionChannel(userAgent);

	const transactionId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

	let currentBalance = 0;
	const [existingWallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, user.id))
		.limit(1);

	if (!existingWallet) {
		const [newWallet] = await db
			.insert(schema.wallet)
			.values({
				id: generateUUIDv7(),
				userId: user.id,
				balance: 0,
			})
			.returning();

		if (!newWallet?.id) {
			return c.json({ success: false, error: "Failed to create wallet" }, 500);
		}
	} else {
		currentBalance = existingWallet.balance;
	}

	const reference = `paystack_${crypto.randomUUID()}`;
	const [creditTxn] = await db
		.insert(schema.walletTransaction)
		.values({
			id: transactionId,
			userId: user.id,
			amount: amount * 100,
			type: "credit",
			reference,
			status: "pending",
			paymentMethod: "card",
			balance: currentBalance,
			createdAt: new Date(),
			metadata: JSON.stringify({
				source: "card",
				paystackReference: reference,
				ipAddress,
				device,
				location,
				transactionChannel,
				description: "Deposit to main Wallet",
				provider: "Paystack",
				fees: 0,
			}),
		})
		.returning();

	if (!creditTxn?.id) {
		return c.json(
			{ success: false, error: "Failed to record deposit transaction" },
			500,
		);
	}

	// Server-side initiated so WE receives it before deposit_completed (webhook).
	trackWebengageEvent(
		c.env,
		{
			userId: user.id,
			eventName: "deposit_initiated",
			eventData: {
				amount,
				currency: "NGN",
				payment_method: "card",
				transaction_id: reference,
			},
		},
		c.executionCtx,
	);

	let paystackResult: Awaited<ReturnType<typeof initializeTransaction>>;
	try {
		paystackResult = await initializeTransaction(
			c.env.PAYSTACK_SECRET_KEY,
			amount,
			user.email,
			{
				userId: user.id,
				type: "wallet_funding",
			},
			`${c.env.SERVER_URL}/wallet/callback`,
			c.env.PROXY_URL,
			c.env.PROXY_SECRET,
			reference,
		);
	} catch (error) {
		const [updatedTxn] = await db
			.update(schema.walletTransaction)
			.set({ status: "failed" })
			.where(eq(schema.walletTransaction.id, transactionId))
			.returning({ id: schema.walletTransaction.id });
		if (!updatedTxn?.id) {
			return c.json(
				{ success: false, error: "Failed to update deposit transaction" },
				500,
			);
		}
		trackWebengageEvent(
			c.env,
			{
				userId: user.id,
				eventName: "deposit_failed",
				eventData: {
					amount,
					payment_method: "card",
					failure_reason:
						error instanceof Error ? error.message : "Failed to initialize deposit",
					wallet_balance_after: currentBalance / 100,
				},
			},
			c.executionCtx,
		);
		console.error("Paystack initiate failed:", error);
		return c.json(
			{ success: false, error: "Failed to initialize deposit" },
			400,
		);
	}

	if (paystackResult.reference !== reference) {
		const [updatedTxn] = await db
			.update(schema.walletTransaction)
			.set({ reference: paystackResult.reference })
			.where(eq(schema.walletTransaction.id, transactionId))
			.returning({ id: schema.walletTransaction.id });
		if (!updatedTxn?.id) {
			return c.json(
				{ success: false, error: "Failed to update deposit reference" },
				500,
			);
		}
	}

	return c.json(
		{
			success: true as const,
			data: {
				authorizationUrl: paystackResult.authorizationUrl,
				reference: paystackResult.reference,
				balance: currentBalance + amount * 100,
			},
		},
		200,
	);
});

walletRoute.openapi(getWalletRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
				details: null,
			},
			401,
		);
	}

	const db = drizzle(c.env.DB, { schema });

	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, user.id))
		.limit(1);

	if (!wallet) {
		const [newWallet] = await db
			.insert(schema.wallet)
			.values({
				id: generateUUIDv7(),
				userId: user.id,
				balance: 0,
			})
			.returning();

		const walletResponse = {
			id: newWallet.id,
			balance: newWallet.balance / 100,
			createdAt: toWAT(newWallet.createdAt),
			updatedAt: toWAT(newWallet.updatedAt),
		};

		return c.json(
			{
				success: true as const,
				data: walletResponse,
			},
			200,
		);
	}

	const walletResponse = {
		id: wallet.id,
		balance: wallet.balance / 100,
		createdAt: toWAT(wallet.createdAt),
		updatedAt: toWAT(wallet.updatedAt),
	};

	return c.json(
		{
			success: true as const,
			data: walletResponse,
		},
		200,
	);
});

walletRoute.openapi(getTransactionsRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
				details: null,
			},
			401,
		);
	}

	const db = drizzle(c.env.DB, { schema });
	const query = c.req.valid("query");
	const filters = [eq(schema.walletTransaction.userId, user.id)];

	if (query.month) {
		const [yearString, monthString] = query.month.split("-");
		const year = Number(yearString);
		const monthIndex = Number(monthString) - 1;
		if (Number.isFinite(year) && Number.isFinite(monthIndex)) {
			const monthStart = new Date(Date.UTC(year, monthIndex, 1));
			const nextMonthStart = new Date(Date.UTC(year, monthIndex + 1, 1));
			filters.push(
				gte(schema.walletTransaction.createdAt, monthStart),
				lt(schema.walletTransaction.createdAt, nextMonthStart),
			);
		}
	} else {
		if (query.from) {
			const fromDate = new Date(`${query.from}T00:00:00.000Z`);
			if (!Number.isNaN(fromDate.getTime())) {
				filters.push(gte(schema.walletTransaction.createdAt, fromDate));
			}
		}

		if (query.to) {
			const toDate = new Date(`${query.to}T23:59:59.999Z`);
			if (!Number.isNaN(toDate.getTime())) {
				filters.push(lte(schema.walletTransaction.createdAt, toDate));
			}
		}
	}

	const page = query.page ?? 1;
	const limit = query.limit ?? 50;
	const offset = (page - 1) * limit;

	const whereClause = and(...filters);

	const [countResult] = await db
		.select({ value: count() })
		.from(schema.walletTransaction)
		.where(whereClause);

	const total = countResult?.value ?? 0;
	const totalPages = Math.ceil(total / limit);

	const transactions = await db
		.select()
		.from(schema.walletTransaction)
		.where(whereClause)
		.orderBy(desc(schema.walletTransaction.createdAt))
		.limit(limit)
		.offset(offset);

	const transactionsInNaira = transactions.map((tx) => ({
		...tx,
		amount: (tx.amount ?? 0) / 100,
		balance: (tx.balance ?? 0) / 100,
		createdAt: toWAT(tx.createdAt),
		...(tx.paymentMethod !== "wallet_transfer" && {
			recipientWalletId: undefined,
			recipientName: undefined,
		}),
		metadata: tx.metadata ? JSON.parse(tx.metadata) : undefined,
	}));

	return c.json(
		{
			success: true as const,
			data: transactionsInNaira,
			pagination: {
				page,
				limit,
				total,
				totalPages,
				hasMore: page < totalPages,
			},
		},
		200,
	);
});

walletRoute.openapi(getBanksRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
				details: null,
			},
			401,
		);
	}

	const banks = await getNigerianBanks(
		c.env.PAYSTACK_SECRET_KEY,
		c.env.PROXY_URL,
		c.env.PROXY_SECRET,
	);
	const normalizedBanks = banks
		.map((bank) => ({ name: bank.name, code: bank.code }))
		.sort((a, b) => a.name.localeCompare(b.name));

	return c.json(
		{
			success: true as const,
			data: normalizedBanks,
		},
		200,
	);
});

walletRoute.openapi(callbackRoute, async (c) => {
	const query = c.req.valid("query");
	const reference = query.reference || query.trxref || "";
	const db = drizzle(c.env.DB, { schema });

	let status = "pending";
	let txType = query.type || "deposit";

	if (reference) {
		const [transaction] = await db
			.select()
			.from(schema.walletTransaction)
			.where(eq(schema.walletTransaction.reference, reference))
			.limit(1);

		if (transaction) {
			txType = transaction.type === "credit" ? "deposit" : "withdrawal";
		}

		const tx = await verifyTransaction(
			c.env.PAYSTACK_SECRET_KEY,
			reference,
			c.env.PROXY_URL,
			c.env.PROXY_SECRET,
		).catch(() => null);

		if (tx) {
			const txStatus = tx.status.toLowerCase();
			status =
				txStatus === "success"
					? "success"
					: txStatus === "failed" || txStatus === "abandoned"
						? "failed"
						: "pending";

			const paymentMethod = tx.channel === "card" ? "card" : "bank_transfer";

			if (status === "failed" && transaction) {
				const [failedWallet] = await db
					.select({ balance: schema.wallet.balance })
					.from(schema.wallet)
					.where(eq(schema.wallet.userId, transaction.userId))
					.limit(1);
				trackWebengageEvent(
					c.env,
					{
						userId: transaction.userId,
						eventName: "deposit_failed",
						eventData: {
							amount: (tx.amount ?? transaction.amount) / 100,
							payment_method: paymentMethod,
							failure_reason: tx.gateway_response || "Payment failed",
							wallet_balance_after: (failedWallet?.balance ?? 0) / 100,
						},
					},
					c.executionCtx,
				);
			}

			if (status === "success") {
				if (transaction && transaction.status !== "success") {
					const [claimed] = await db
						.update(schema.walletTransaction)
						.set({ status: "pending" })
						.where(
							and(
								eq(schema.walletTransaction.reference, reference),
								eq(schema.walletTransaction.status, transaction.status),
							),
						)
						.returning({ id: schema.walletTransaction.id });
					if (!claimed) {
						return c.json({ success: true, data: { status } }, 200);
					}

					const [wallet] = await db
						.select()
						.from(schema.wallet)
						.where(eq(schema.wallet.userId, transaction.userId))
						.limit(1);

					let newBalance = wallet?.balance ?? 0;
					if (wallet) {
						const updatedWallet =
							transaction.type === "credit"
								? await creditWallet(db, transaction.userId, transaction.amount)
								: await debitWallet(db, transaction.userId, transaction.amount);
						if (!updatedWallet) {
							await db
								.update(schema.walletTransaction)
								.set({ status: "failed" })
								.where(eq(schema.walletTransaction.reference, reference));
							return c.json(
								{ success: false, error: "Wallet update failed" },
								409,
							);
						}
						newBalance = updatedWallet.balance;
					}

					let existingMeta: Record<string, unknown> = JSON.parse(
						transaction.metadata || "{}",
					);

					const auth = tx.authorization;
					if (transaction.type === "credit") {
						existingMeta = {
							...existingMeta,
							cardType: auth?.card_type || null,
							cardLast4: auth?.last4 || null,
							amountCredited: (tx.amount ?? transaction.amount) / 100,
							fees: (tx.fees ?? 0) / 100,
							provider: "Paystack",
						};
					}

					await db
						.update(schema.walletTransaction)
						.set({
							status: "success",
							paymentMethod,
							balance: newBalance,
							metadata: JSON.stringify(existingMeta),
						})
						.where(eq(schema.walletTransaction.reference, reference));

					trackWebengageEvent(
						c.env,
						{
							userId: transaction.userId,
							eventName: "deposit_completed",
							eventData: {
								amount: (tx.amount ?? transaction.amount) / 100,
								currency: "NGN",
								payment_method: paymentMethod,
								transaction_id: reference,
								type: "credit",
								wallet_balance_after: newBalance / 100,
							},
						},
						c.executionCtx,
					);

					await syncWebengageUserProfile(
						c.env,
						transaction.userId,
						c.executionCtx,
					);
				}
			}

			if (status === "success" && transaction?.type === "credit") {
				const depositAmountMajor = (tx.amount ?? transaction.amount) / 100;
				const depositReport = reportBonusEngineDeposit({
					env: c.env,
					deposit: {
						userId: transaction.userId,
						amount: depositAmountMajor,
						transactionId: reference,
						currency: BONUS_ENGINE_DEFAULT_CURRENCY,
					},
				})
					.then((result) => {
						if (!result.ok) {
							console.error("Bonus Engine deposit report failed", {
								transactionId: reference,
								userId: transaction.userId,
								status: result.status,
								error: result.error,
							});
						}
					})
					.catch((error: unknown) => {
						console.error("Bonus Engine deposit report error", {
							transactionId: reference,
							userId: transaction.userId,
							error,
						});
					});

				await runBonusEngineBackground(c.executionCtx, depositReport);
			}
		}
	}

	const isSuccess = status === "success";
	const isFailed = status === "failed";
	const title =
		txType === "withdraw"
			? isSuccess
				? "Withdrawal successful"
				: isFailed
					? "Withdrawal failed"
					: "Withdrawal pending"
			: isSuccess
				? "Deposit successful"
				: isFailed
					? "Deposit failed"
					: "Deposit pending";

	const description = isSuccess
		? "Your transaction was completed successfully."
		: isFailed
			? "This transaction failed. Please try again."
			: "Your transaction is still being processed.";

	const textColor = isSuccess ? "#14804A" : isFailed ? "#D13030" : "#B26A00";
	const bgCircle = isSuccess ? "#14804A" : isFailed ? "#D13030" : "#B26A00";
	const bgPing = isSuccess ? "#CCF3DD" : isFailed ? "#FADBD8" : "#F2CF93";
	const borderColor = isSuccess ? "#F2CF93" : isFailed ? "#FADBD8" : "#F2CF93";

	const redirectUrl = `${c.env.CORS_ORIGIN}/wallet`;

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${title}</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			background: #fafafa;
			min-height: 100vh;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		.container {
			background: white;
			border-radius: 16px;
			padding: 32px;
			text-align: center;
			box-shadow: 0 1px 3px rgba(0,0,0,0.1);
			max-width: 400px;
			width: 90%;
		}
		@media (prefers-color-scheme: dark) {
			body { background: #121212; }
			.container { background: #202120; }
		}
		.icon-container {
			display: flex;
			justify-content: center;
			margin-bottom: 24px;
		}
		${
			isSuccess
				? `
			.icon-wrapper {
				position: relative;
				width: 96px;
				height: 96px;
				display: flex;
				align-items: center;
				justify-content: center;
			}
			.ping {
				position: absolute;
				width: 96px;
				height: 96px;
				background: ${bgPing};
				border-radius: 50%;
				animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
			}
			.circle {
				position: relative;
				width: 80px;
				height: 80px;
				background: ${bgCircle};
				border-radius: 50%;
				display: flex;
				align-items: center;
				justify-content: center;
				color: white;
				font-size: 32px;
			}
			@keyframes ping {
				75%, 100% { transform: scale(2); opacity: 0; }
			}
		`
				: isFailed
					? `
			.circle {
				width: 80px;
				height: 80px;
				background: ${bgCircle};
				border-radius: 50%;
				display: flex;
				align-items: center;
				justify-content: center;
				color: white;
				font-size: 40px;
				animation: pulse 1.5s ease-in-out infinite;
			}
			@keyframes pulse {
				0%, 100% { opacity: 1; }
				50% { opacity: 0.6; }
			}
		`
					: `
			.spinner {
				width: 80px;
				height: 80px;
				border: 4px solid ${borderColor};
				border-top-color: ${bgCircle};
				border-radius: 50%;
				animation: spin 1s linear infinite;
			}
			@keyframes spin {
				to { transform: rotate(360deg); }
			}
		`
		}
		h1 {
			font-size: 24px;
			font-weight: 600;
			color: ${textColor};
			margin-bottom: 12px;
		}
		p {
			color: #6E6E6E;
			font-size: 14px;
			line-height: 1.5;
		}
		.reference {
			margin-top: 8px;
			font-size: 12px;
		}
		.close-msg {
			margin-top: 24px;
			padding-top: 16px;
			border-top: 1px solid #eee;
			font-size: 13px;
			color: #888;
		}
		@media (prefers-color-scheme: dark) {
			p { color: #aaa; }
			.close-msg { border-color: #333; }
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="icon-container">
			${
				isSuccess
					? `
				<div class="icon-wrapper">
					<div class="ping"></div>
					<div class="circle">✓</div>
				</div>
			`
					: isFailed
						? `
				<div class="circle">×</div>
			`
						: `
				<div class="spinner"></div>
			`
			}
		</div>
		<h1>${title}</h1>
		<p>${description}</p>
		${reference ? `<p class="reference">Reference: ${reference}</p>` : ""}
		<p class="close-msg">Redirecting to wallet in <span id="countdown">20</span>s...</p>
	</div>
	<script>
		let seconds = 20;
		const countdownEl = document.getElementById("countdown");
		const interval = setInterval(() => {
			seconds--;
			if (countdownEl) countdownEl.textContent = seconds;
			if (seconds <= 0) {
				clearInterval(interval);
				window.location.href = "${redirectUrl}";
			}
		}, 1000);
	</script>
</body>
</html>`;

	return c.html(html, 200);
});

// walletRoute.openapi(webhookRoute, async (c) => {
// 	const signature = c.req.header("x-paystack-signature");
// 	if (!signature) {
// 		return c.json(
// 			{
// 				success: false as const,
// 				error: "Missing signature",
// 				details: null,
// 			},
// 			400,
// 		);
// 	}

// 	const rawBody = await c.req.text();
// 	const crypto = await import("crypto");
// 	const hash = crypto
// 		.createHmac("sha512", c.env.PAYSTACK_SECRET_KEY)
// 		.update(rawBody)
// 		.digest("hex");

// 	if (hash !== signature) {
// 		return c.json(
// 			{
// 				success: false as const,
// 				error: "Invalid signature",
// 				details: null,
// 			},
// 			400,
// 		);
// 	}

// 	const parseResult = WebhookEventSchema.safeParse(JSON.parse(rawBody));
// 	if (!parseResult.success) {
// 		return c.json({ received: true }, 200);
// 	}

// 	const { event, data } = parseResult.data;

// 	if (event === "charge.success") {
// 		const reference = data.reference;
// 		const db = drizzle(c.env.DB, { schema });

// 		const [transaction] = await db
// 			.select()
// 			.from(schema.walletTransaction)
// 			.where(eq(schema.walletTransaction.reference, reference))
// 			.limit(1);

// 		if (!transaction) {
// 			return c.json({ received: true }, 200);
// 		}

// 		if (transaction.status !== "pending") {
// 			return c.json({ received: true }, 200);
// 		}

// 		try {
// 			const verifiedTx = await verifyTransaction(
// 				c.env.PAYSTACK_SECRET_KEY,
// 				reference,
// 			);

// 			if (verifiedTx.status.toLowerCase() !== "success") {
// 				await db
// 					.update(schema.walletTransaction)
// 					.set({ status: "failed" })
// 					.where(eq(schema.walletTransaction.reference, reference));

// 				return c.json({ received: true }, 200);
// 			}
// 		} catch {
// 			return c.json({ received: true }, 200);
// 		}

// 		await db
// 			.update(schema.walletTransaction)
// 			.set({ status: "success" })
// 			.where(eq(schema.walletTransaction.reference, reference));

// 		const [wallet] = await db
// 			.select()
// 			.from(schema.wallet)
// 			.where(eq(schema.wallet.userId, transaction.userId))
// 			.limit(1);

// 		if (wallet) {
// 			await db
// 				.update(schema.wallet)
// 				.set({
// 					balance: wallet.balance + transaction.amount,
// 				})
// 				.where(eq(schema.wallet.userId, transaction.userId));
// 		}
// 	}

// 	return c.json({ received: true }, 200);
// });

walletRoute.openapi(createWithdrawalAccountRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
				details: null,
			},
			401,
		);
	}

	const result = CreateWithdrawalAccountSchema.safeParse(await c.req.json());
	if (!result.success) {
		return c.json(
			{
				success: false as const,
				error: "Invalid request",
				details: null,
			},
			400,
		);
	}

	const db = drizzle(c.env.DB, { schema });
	const { bankCode, accountNumber, accountName } = result.data;

	const verification = await verifyAccountNumber(
		c.env.PAYSTACK_SECRET_KEY,
		accountNumber,
		bankCode,
		c.env.PROXY_URL,
		c.env.PROXY_SECRET,
	);

	if (!verification.isValid) {
		return c.json(
			{
				success: false as const,
				error: "Invalid account number or bank code",
				details: null,
			},
			400,
		);
	}

	const normalizedInput = accountName.toLowerCase().trim();
	const normalizedPaystack = verification.accountName.toLowerCase().trim();

	if (normalizedInput !== normalizedPaystack) {
		return c.json(
			{
				success: false as const,
				error: "Account holder name does not match bank records",
				details: null,
			},
			400,
		);
	}

	const [account] = await db
		.insert(schema.withdrawalAccount)
		.values({
			id: `wda_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
			userId: user.id,
			bankCode,
			bankName: result.data.bankName || "",
			accountNumber,
			accountName: verification.accountName,
		})
		.returning();

	return c.json(
		{
			success: true as const,
			data: {
				id: account.id,
				bankCode: account.bankCode,
				bankName: account.bankName,
				accountNumber: account.accountNumber,
				accountName: account.accountName,
				createdAt: toWAT(account.createdAt),
				updatedAt: toWAT(account.updatedAt),
			},
		},
		201,
	);
});

walletRoute.openapi(getWithdrawalAccountsRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
				details: null,
			},
			401,
		);
	}

	const db = drizzle(c.env.DB, { schema });

	const accounts = await db
		.select()
		.from(schema.withdrawalAccount)
		.where(eq(schema.withdrawalAccount.userId, user.id))
		.orderBy(desc(schema.withdrawalAccount.createdAt));

	return c.json(
		{
			success: true as const,
			data: accounts.map((account) => ({
				id: account.id,
				bankCode: account.bankCode,
				bankName: account.bankName,
				accountNumber: account.accountNumber,
				accountName: account.accountName,
				createdAt: toWAT(account.createdAt),
				updatedAt: toWAT(account.updatedAt),
			})),
		},
		200,
	);
});

walletRoute.openapi(getWithdrawalAccountRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
				details: null,
			},
			401,
		);
	}

	const { id } = c.req.valid("param");
	const db = drizzle(c.env.DB, { schema });

	const [account] = await db
		.select()
		.from(schema.withdrawalAccount)
		.where(eq(schema.withdrawalAccount.id, id))
		.limit(1);

	if (!account || account.userId !== user.id) {
		return c.json(
			{
				success: false as const,
				error: "Account not found",
				details: null,
			},
			404,
		);
	}

	return c.json(
		{
			success: true as const,
			data: {
				id: account.id,
				bankCode: account.bankCode,
				bankName: account.bankName,
				accountNumber: account.accountNumber,
				accountName: account.accountName,
				createdAt: toWAT(account.createdAt),
				updatedAt: toWAT(account.updatedAt),
			},
		},
		200,
	);
});

walletRoute.openapi(deleteWithdrawalAccountRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
				details: null,
			},
			401,
		);
	}

	const { id } = c.req.valid("param");
	const db = drizzle(c.env.DB, { schema });

	const [account] = await db
		.select()
		.from(schema.withdrawalAccount)
		.where(eq(schema.withdrawalAccount.id, id))
		.limit(1);

	if (!account || account.userId !== user.id) {
		return c.json(
			{
				success: false as const,
				error: "Account not found",
				details: null,
			},
			404,
		);
	}

	await db
		.delete(schema.withdrawalAccount)
		.where(eq(schema.withdrawalAccount.id, id));

	return c.json(
		{
			success: true as const,
			data: { deleted: true as const },
		},
		200,
	);
});

walletRoute.openapi(withdrawRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
				details: null,
			},
			401,
		);
	}

	const result = WithdrawSchema.safeParse(await c.req.json());
	if (!result.success) {
		return c.json(
			{
				success: false as const,
				error: "Invalid request",
				details: null,
			},
			400,
		);
	}

	const { amount, bankCode, accountNumber, accountName } = result.data;
	const db = drizzle(c.env.DB, { schema });

	const [userRecord] = await db
		.select({ verificationStatus: schema.user.verificationStatus })
		.from(schema.user)
		.where(eq(schema.user.id, user.id))
		.limit(1);

	if (!userRecord || userRecord.verificationStatus !== "approved") {
		return c.json(
			{
				success: false as const,
				error: "KYC verification required to make withdrawals",
				details: null,
			},
			400,
		);
	}

	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, user.id))
		.limit(1);

	if (!wallet || wallet.balance < amount * 100) {
		return c.json(
			{
				success: false as const,
				error: "Insufficient balance",
				details: null,
			},
			400,
		);
	}

	const userAgent = c.req.header("user-agent") || "";
	const ipAddress = getClientIp(c);
	const device = getDeviceInfo(userAgent);
	const location = getLocation(c);
	const transactionChannel = getTransactionChannel(userAgent);

	const reference = `wd_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
	const txnId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

	const amountInKobo = amount * 100;
	let newBalance = wallet.balance - amountInKobo;

	const [withdrawalTxn] = await db
		.insert(schema.walletTransaction)
		.values({
			id: txnId,
			userId: user.id,
			amount: amountInKobo,
			type: "debit",
			reference,
			status: "pending_approval",
			paymentMethod: "paystack",
			balance: newBalance,
			metadata: JSON.stringify({
				destinationBank: accountName,
				bankCode,
				accountNumber,
				accountName,
				balanceBefore: wallet.balance / 100,
				ipAddress,
				device,
				location,
				transactionChannel,
				feesAmount: 0,
			}),
		})
		.returning();

	if (!withdrawalTxn?.id) {
		return c.json(
			{ success: false, error: "Failed to record withdrawal request" },
			500,
		);
	}

	const debitedWallet = await debitWallet(db, user.id, amountInKobo);
	if (!debitedWallet) {
		await db
			.delete(schema.walletTransaction)
			.where(eq(schema.walletTransaction.id, txnId));
		return c.json({ success: false, error: "Insufficient balance" }, 400);
	}
	newBalance = debitedWallet.balance;
	await db
		.update(schema.walletTransaction)
		.set({ balance: newBalance })
		.where(eq(schema.walletTransaction.id, txnId));

	trackWebengageEvent(
		c.env,
		{
			userId: user.id,
			eventName: "withdrawal_requested",
			eventData: {
				amount,
				bank: bankCode,
				wallet_balance_before: wallet.balance / 100,
				account_number: accountNumber,
				account_name: accountName ?? "",
			},
		},
		c.executionCtx,
	);
	await syncWebengageUserProfile(c.env, user.id, c.executionCtx);

	const superAdmins = await db
		.select({ id: schema.admin.id })
		.from(schema.admin)
		.where(eq(schema.admin.role, "super_admin"));

	if (superAdmins.length > 0) {
		await db.insert(schema.adminNotification).values(
			superAdmins.map((sa) => ({
				id: `an_${crypto.randomUUID()}`,
				adminId: sa.id,
				title: "New Withdrawal Request",
				message: `${user.name || user.email} requested a withdrawal of ₦${amount}`,
				type: "withdrawal_request",
				referenceId: txnId,
			})),
		);
	}

	return c.json(
		{
			success: true as const,
			data: {
				reference,
				amount,
				status: "pending_approval",
				balance: newBalance / 100,
			},
		},
		200,
	);
});

walletRoute.openapi(transferRoute, async (c) => {
	const user = c.get("user");
	const result = TransferSchema.safeParse(await c.req.json());

	if (!user) {
		return c.json(
			{ success: false as const, error: "Unauthorized", details: null },
			401,
		);
	}

	if (!result.success) {
		return c.json(
			{
				success: false as const,
				error: "Invalid request body",
				details: null,
			},
			400,
		);
	}

	const { recipientWalletId, amount } = result.data;

	if (amount < 100) {
		return c.json(
			{
				success: false as const,
				error: "Minimum transfer amount is 100 Naira",
				details: null,
			},
			400,
		);
	}

	const db = drizzle(c.env.DB, { schema });

	const [senderWallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, user.id))
		.limit(1);

	if (!senderWallet) {
		return c.json(
			{
				success: false as const,
				error: "Sender wallet not found",
				details: null,
			},
			400,
		);
	}

	if (senderWallet.balance < amount * 100) {
		return c.json(
			{
				success: false as const,
				error: "Insufficient balance",
				details: null,
			},
			400,
		);
	}

	const [recipientWallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.id, recipientWalletId))
		.limit(1);

	if (!recipientWallet) {
		return c.json(
			{
				success: false as const,
				error: "Recipient wallet not found",
				details: null,
			},
			400,
		);
	}

	if (recipientWallet.userId === user.id) {
		return c.json(
			{
				success: false as const,
				error: "Cannot transfer to your own wallet",
				details: null,
			},
			400,
		);
	}

	const [recipientUser] = await db
		.select({ name: schema.user.name })
		.from(schema.user)
		.where(eq(schema.user.id, recipientWallet.userId))
		.limit(1);

	const recipientName = recipientUser?.name ?? "Unknown";

	const reference = `trf_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
	const amountKobo = amount * 100;

	// Await initiated so WE orders it before transfer_funds_completed in this request.
	await trackWebengageEvent(
		c.env,
		{
			userId: user.id,
			eventName: "transfer_funds_initiated",
			eventData: {
				wallet_id: recipientWalletId,
				amount,
			},
		},
		c.executionCtx,
	);

	const batchResults = await c.env.DB.batch([
		c.env.DB.prepare(
			"UPDATE wallet SET balance = balance - ?, updated_at = ? WHERE user_id = ? AND balance >= ?",
		).bind(amountKobo, Date.now(), user.id, amountKobo),
		c.env.DB.prepare(
			"UPDATE wallet SET balance = balance + ?, updated_at = ? WHERE id = ?",
		).bind(amountKobo, Date.now(), recipientWallet.id),
		c.env.DB.prepare(
			"INSERT INTO wallet_transaction (id, user_id, amount, type, reference, status, payment_method, balance, recipient_wallet_id, recipient_name, metadata) VALUES (?, ?, ?, 'debit', ?, 'completed', 'wallet_transfer', (SELECT balance FROM wallet WHERE user_id = ?), ?, ?, ?)",
		).bind(
			generateUUIDv7(),
			user.id,
			amountKobo,
			`${reference}_sender`,
			user.id,
			recipientWalletId,
			recipientName,
			JSON.stringify({
				transferType: "outgoing",
				recipientName,
				recipientWalletId,
			}),
		),
		c.env.DB.prepare(
			"INSERT INTO wallet_transaction (id, user_id, amount, type, reference, status, payment_method, balance, recipient_wallet_id, recipient_name, metadata) VALUES (?, ?, ?, 'credit', ?, 'completed', 'wallet_transfer', (SELECT balance FROM wallet WHERE user_id = ?), ?, ?, ?)",
		).bind(
			generateUUIDv7(),
			recipientWallet.userId,
			amountKobo,
			`${reference}_recipient`,
			recipientWallet.userId,
			recipientWalletId,
			senderWallet.userId,
			JSON.stringify({
				transferType: "incoming",
				senderName: user.name || "Unknown",
				senderWalletId: senderWallet.id,
			}),
		),
	]);

	const debitResult = batchResults[0];
	if (!debitResult || (debitResult as any).changes === 0) {
		return c.json({ success: false, error: "Insufficient balance" }, 400);
	}

	const [updatedSenderWallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.id, senderWallet.id))
		.limit(1);

	trackWebengageEvent(
		c.env,
		{
			userId: user.id,
			eventName: "transfer_funds_completed",
			eventData: {
				wallet_id: recipientWalletId,
				amount,
				transaction_id: reference,
				wallet_balance_after: (updatedSenderWallet?.balance ?? 0) / 100,
			},
		},
		c.executionCtx,
	);
	await syncWebengageUserProfile(c.env, user.id, c.executionCtx);

	return c.json(
		{
			success: true as const,
			data: {
				transactionId: reference,
				amount,
				recipientWalletId,
				recipientName,
			},
		},
		200,
	);
});

walletRoute.openapi(getGameWalletRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
				details: null,
			},
			401,
		);
	}

	const db = drizzle(c.env.DB, { schema });

	const [gameWallet] = await db
		.select()
		.from(schema.gameWallet)
		.where(eq(schema.gameWallet.userId, user.id))
		.limit(1);

	if (!gameWallet) {
		const [newGameWallet] = await db
			.insert(schema.gameWallet)
			.values({
				id: generateUUIDv7(),
				userId: user.id,
				balance: 0,
			})
			.returning();

		const walletResponse = {
			id: newGameWallet.id,
			balance: newGameWallet.balance,
			createdAt: toWAT(newGameWallet.createdAt),
			updatedAt: toWAT(newGameWallet.updatedAt),
		};

		return c.json(
			{
				success: true as const,
				data: walletResponse,
			},
			200,
		);
	}

	const walletResponse = {
		id: gameWallet.id,
		balance: gameWallet.balance / 100,
		createdAt: toWAT(gameWallet.createdAt),
		updatedAt: toWAT(gameWallet.updatedAt),
	};

	return c.json(
		{
			success: true as const,
			data: walletResponse,
		},
		200,
	);
});

walletRoute.openapi(transferToGameWalletRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}
	const result = TransferToGameWalletSchema.safeParse(await c.req.json());

	if (!result.success) {
		return c.json(
			{
				success: false as const,
				error: "Invalid request body",
				details: null,
			},
			400,
		);
	}

	const { amount } = result.data;

	if (amount < 100) {
		return c.json(
			{
				success: false as const,
				error: "Minimum transfer amount is 100 Naira",
				details: null,
			},
			400,
		);
	}

	const db = drizzle(c.env.DB, { schema });

	const [normalWallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, user.id))
		.limit(1);

	if (!normalWallet) {
		return c.json(
			{
				success: false as const,
				error: "Normal wallet not found",
				details: null,
			},
			400,
		);
	}

	if (normalWallet.balance < amount * 100) {
		return c.json(
			{
				success: false as const,
				error: "Insufficient balance in normal wallet",
				details: null,
			},
			400,
		);
	}

	let [gameWallet] = await db
		.select()
		.from(schema.gameWallet)
		.where(eq(schema.gameWallet.userId, user.id))
		.limit(1);

	if (!gameWallet) {
		const [newGameWallet] = await db
			.insert(schema.gameWallet)
			.values({
				id: generateUUIDv7(),
				userId: user.id,
				balance: 0,
			})
			.returning();
		if (!newGameWallet) {
			return c.json(
				{ success: false, error: "Failed to create game wallet" },
				500,
			);
		}
		gameWallet = newGameWallet;
	}

	const reference = `tg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
	const now = new Date();
	const nowMs = now.getTime();
	const amountKobo = amount * 100;

	await trackWebengageEvent(
		c.env,
		{
			userId: user.id,
			eventName: "transfer_funds_initiated",
			eventData: {
				wallet_id: "game_wallet",
				amount,
			},
		},
		c.executionCtx,
	);

	const batchResults = await c.env.DB.batch([
		c.env.DB.prepare(
			"UPDATE wallet SET balance = balance - ?, updated_at = ? WHERE user_id = ? AND balance >= ?",
		).bind(amountKobo, nowMs, user.id, amountKobo),
		c.env.DB.prepare(
			"UPDATE game_wallet SET balance = balance + ?, updated_at = ? WHERE id = ?",
		).bind(amountKobo, nowMs, gameWallet.id),
		c.env.DB.prepare(
			"INSERT INTO wallet_transaction (id, user_id, amount, type, reference, status, payment_method, balance, metadata) VALUES (?, ?, ?, 'debit', ?, 'completed', 'wallet_transfer', (SELECT balance FROM wallet WHERE user_id = ?), ?)",
		).bind(
			generateUUIDv7(),
			user.id,
			amountKobo,
			`${reference}_normal`,
			user.id,
			JSON.stringify({
				transferType: "to_game_wallet",
				gameWalletId: gameWallet.id,
			}),
		),
		c.env.DB.prepare(
			"INSERT INTO game_wallet_transaction (id, user_id, amount, type, reference, status) VALUES (?, ?, ?, 'credit', ?, 'completed')",
		).bind(generateUUIDv7(), user.id, amountKobo, `${reference}_game`),
	]);

	const debitResult = batchResults[0];
	if (!debitResult || (debitResult as any).changes === 0) {
		return c.json({ success: false, error: "Insufficient balance" }, 400);
	}

	const [updatedNormalWallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.id, normalWallet.id))
		.limit(1);

	const [updatedGameWallet] = await db
		.select()
		.from(schema.gameWallet)
		.where(eq(schema.gameWallet.id, gameWallet.id))
		.limit(1);

	trackWebengageEvent(
		c.env,
		{
			userId: user.id,
			eventName: "transfer_funds_completed",
			eventData: {
				wallet_id: "game_wallet",
				amount,
				transaction_id: reference,
				wallet_balance_after: (updatedNormalWallet?.balance ?? 0) / 100,
			},
		},
		c.executionCtx,
	);

	return c.json(
		{
			success: true as const,
			data: {
				transactionId: reference,
				amount,
				gameWalletId: gameWallet.id,
				normalWalletBalance: (updatedNormalWallet?.balance ?? 0) / 100,
				gameWalletBalance: (updatedGameWallet?.balance ?? amount * 100) / 100,
			},
		},
		200,
	);
});

export default walletRoute;
