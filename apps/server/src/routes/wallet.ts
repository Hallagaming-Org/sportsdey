import crypto from "node:crypto";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, count, desc, eq, gte, lt, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
	creditWallet,
	debitWallet,
	debitWithdrawableWallet,
} from "@/db/atomic-wallet";
import { walletFundsFromRow } from "@/db/bonus-wallet";
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
	optionalExecutionCtx,
	reportBonusEngineDepositInBackground,
} from "@/services/bonus-engine";
import { toWAT } from "@/utils";
import {
	getNigerianBanks,
	initializeTransaction,
	verifyAccountNumber,
	verifyTransaction,
} from "@/utils/paystack";
import { isPhonePlaceholderEmail } from "@/utils/phone-user";
import {
	getClientIp,
	getDeviceInfo,
	getLocation,
	getTransactionChannel,
} from "@/utils/request";
import { generateUUIDv7 } from "@/utils/uuid";
import { maskBankAccountNumber } from "@/utils/webengage-event";
import { syncWebengageUserProfile } from "@/utils/webengage-user-profile";
import type { CloudflareBindings } from "../types";

/**
 * GET /wallet figures in Naira. Bonus Engine funds sit inside `balance` as a
 * locked part, so the cash figure excludes them and games see the total.
 */
function walletBalancesNaira(wallet: {
	balance: number;
	frozenBalance?: number | null;
	bonusBalance?: number | null;
}) {
	const funds = walletFundsFromRow(wallet);
	return {
		balance: funds.realKobo / 100,
		bonusBalance: funds.bonusKobo / 100,
		withdrawableBalance: funds.withdrawableKobo / 100,
		totalBalance: funds.balanceKobo / 100,
	};
}

function insufficientWithdrawableMessage(
	wallet:
		| { balance: number; frozenBalance?: number | null; bonusBalance?: number | null }
		| undefined,
): string {
	if (!wallet) return "Insufficient balance";
	const funds = walletFundsFromRow(wallet);
	if (funds.bonusKobo > 0 || funds.frozenKobo > 0) {
		return `Insufficient withdrawable balance. Available: ₦${(funds.withdrawableKobo / 100).toFixed(2)} (bonus funds and stakes on open bets cannot be withdrawn)`;
	}
	return "Insufficient balance";
}

const walletRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

/** Paystack rejects `.local` placeholder emails used by phone OTP accounts. */
function paystackCustomerEmail(user: {
	email: string;
	mobileNumber?: string | null;
}): string {
	if (!isPhonePlaceholderEmail(user.email)) {
		return user.email;
	}
	const digits = (user.mobileNumber || user.email).replace(/\D/g, "");
	return `phone_${digits || "user"}@users.sportsdey.com`;
}

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

const paystackWebhookRoute = createRoute({
	method: "post",
	path: "/paystack/webhook",
	tags: ["Wallet"],
	summary: "Paystack payout webhook",
	description:
		"Receives verified Paystack transfer status updates. This endpoint is server-to-server only.",
	responses: {
		200: { description: "Webhook received" },
		400: { description: "Invalid webhook signature or body" },
	},
});

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
	summary: "Transfer to game wallet (retired)",
	description:
		"Retired: the game wallet is no longer spendable. Bonus funds live in the main wallet as a locked balance, so there is nothing to transfer. Always returns 410.",
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
		410: {
			description: "Game wallet retired",
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

	// Await so WE records initiated before this request ends (and before
	// deposit_completed from the later Paystack webhook).
	await trackWebengageEvent(
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
		const serverUrl = c.env.SERVER_URL?.trim();
		if (!serverUrl) {
			throw new Error("SERVER_URL is not configured on this Worker");
		}
		if (!c.env.PAYSTACK_SECRET_KEY?.trim()) {
			throw new Error("PAYSTACK_SECRET_KEY is not configured on this Worker");
		}

		paystackResult = await initializeTransaction(
			c.env.PAYSTACK_SECRET_KEY,
			amount,
			paystackCustomerEmail({
				email: user.email,
				mobileNumber: user.mobileNumber,
			}),
			{
				userId: user.id,
				type: "wallet_funding",
			},
			`${serverUrl.replace(/\/$/, "")}/wallet/callback`,
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
			...walletBalancesNaira(newWallet ?? { balance: 0 }),
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
		...walletBalancesNaira(wallet),
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

const SAFE_REFERENCE = /^[A-Za-z0-9._-]{1,64}$/;

function escapeHtml(value: string) {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

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

			let creditedNow = false;
			if (status === "success" && transaction?.type === "credit") {
				if (transaction.status !== "success") {
					const markDepositNeedsRetry = async () => {
						await db
							.update(schema.walletTransaction)
							.set({ status: "needs_retry" })
							.where(
								and(
									eq(schema.walletTransaction.reference, reference),
									eq(schema.walletTransaction.status, "processing"),
								),
							);
					};

					const settleClaimedDeposit = async () => {
						let creditedBalance: number | null = null;
						try {
							const [wallet] = await db
								.select()
								.from(schema.wallet)
								.where(eq(schema.wallet.userId, transaction.userId))
								.limit(1);
							if (!wallet) {
								await markDepositNeedsRetry();
								console.error(
									JSON.stringify({
										tag: "deposit_credit_failed_after_claim",
										reference,
										userId: transaction.userId,
										reason: "wallet_not_found",
									}),
								);
								return {
									ok: false as const,
									status: 409 as const,
									error: "Wallet update failed",
								};
							}

							const updatedWallet = await creditWallet(
								db,
								transaction.userId,
								transaction.amount,
							);
							if (!updatedWallet) {
								await markDepositNeedsRetry();
								console.error(
									JSON.stringify({
										tag: "deposit_credit_failed_after_claim",
										reference,
										userId: transaction.userId,
										reason: "wallet_update_returned_empty",
									}),
								);
								return {
									ok: false as const,
									status: 409 as const,
									error: "Wallet update failed",
								};
							}
							creditedBalance = updatedWallet.balance;

							let existingMeta: Record<string, unknown> = JSON.parse(
								transaction.metadata || "{}",
							);
							const auth = tx.authorization;
							existingMeta = {
								...existingMeta,
								cardType: auth?.card_type || null,
								cardLast4: auth?.last4 || null,
								amountCredited: (tx.amount ?? transaction.amount) / 100,
								fees: (tx.fees ?? 0) / 100,
								provider: "Paystack",
							};

							await db
								.update(schema.walletTransaction)
								.set({
									status: "success",
									paymentMethod,
									balance: creditedBalance,
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
										wallet_balance_after: creditedBalance / 100,
									},
								},
								c.executionCtx,
							);
							await syncWebengageUserProfile(
								c.env,
								transaction.userId,
								c.executionCtx,
							);
							return { ok: true as const, balance: creditedBalance };
						} catch (error) {
							if (creditedBalance === null) {
								try {
									await markDepositNeedsRetry();
								} catch {
									// Keep the wallet error; the claim must not look settled.
								}
								console.error(
									JSON.stringify({
										tag: "deposit_credit_failed_after_claim",
										reference,
										userId: transaction.userId,
										error:
											error instanceof Error ? error.message : "unknown",
									}),
								);
								return {
									ok: false as const,
									status: 500 as const,
									error: "Deposit credit failed after claim",
								};
							}
							console.error(
								JSON.stringify({
									tag: "deposit_credited_finalize_failed",
									reference,
									userId: transaction.userId,
									error:
										error instanceof Error ? error.message : "unknown",
								}),
							);
							try {
								await db
									.update(schema.walletTransaction)
									.set({
										status: "success",
										paymentMethod,
										balance: creditedBalance,
									})
									.where(eq(schema.walletTransaction.reference, reference));
							} catch {
								// Already credited; retry must not credit again.
							}
							return { ok: true as const, balance: creditedBalance };
						}
					};

					const reclaimable =
						transaction.status === "pending" ||
						transaction.status === "needs_retry";
					if (reclaimable) {
						const [claimed] = await db
							.update(schema.walletTransaction)
							.set({ status: "processing" })
							.where(
								and(
									eq(schema.walletTransaction.reference, reference),
									eq(schema.walletTransaction.status, transaction.status),
								),
							)
							.returning({ id: schema.walletTransaction.id });
						if (!claimed) {
							const [latest] = await db
								.select({ status: schema.walletTransaction.status })
								.from(schema.walletTransaction)
								.where(eq(schema.walletTransaction.reference, reference))
								.limit(1);
							if (latest?.status === "success") {
								// Concurrent callback already settled this deposit.
							} else if (
								latest?.status === "processing" ||
								latest?.status === "needs_retry"
							) {
								const settled = await settleClaimedDeposit();
								if (!settled.ok) {
									return c.json(
										{ success: false, error: settled.error },
										settled.status,
									);
								}
								creditedNow = true;
							} else {
								return c.json({ success: true, data: { status } }, 200);
							}
						} else {
							const settled = await settleClaimedDeposit();
							if (!settled.ok) {
								return c.json(
									{ success: false, error: settled.error },
									settled.status,
								);
							}
							creditedNow = true;
						}
					} else if (transaction.status === "processing") {
						console.warn(
							JSON.stringify({
								tag: "deposit_stale_processing_repair",
								reference,
								userId: transaction.userId,
							}),
						);
						const settled = await settleClaimedDeposit();
						if (!settled.ok) {
							return c.json(
								{ success: false, error: settled.error },
								settled.status,
							);
						}
						creditedNow = true;
					}
				}
			} else if (status === "success") {
				if (
					transaction &&
					transaction.status !== "success" &&
					transaction.status !== "processing"
				) {
					// Withdrawal callback claim — leave this path unchanged (CR3/CR10).
					const [claimed] = await db
						.update(schema.walletTransaction)
						.set({ status: "processing" })
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
						const updatedWallet = await debitWallet(
							db,
							transaction.userId,
							transaction.amount,
						);
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
			// Only the request that credited the wallet reports the deposit.
			if (creditedNow && transaction?.type === "credit") {
				await reportBonusEngineDepositInBackground({
					env: c.env,
					executionCtx: optionalExecutionCtx(c),
					userId: transaction.userId,
					amountKobo: tx.amount ?? transaction.amount,
					transactionId: reference,
					paymentMethod: "paystack",
				});
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

	const redirectUrl = isSuccess
		? `${c.env.CORS_ORIGIN}/wallet?deposit=success`
		: `${c.env.CORS_ORIGIN}/wallet`;

	// The reference comes straight off the query string, so it is only shown when
	// it looks like one of our references, and it is escaped even then.
	const displayReference = SAFE_REFERENCE.test(reference)
		? escapeHtml(reference)
		: "";

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
		${displayReference ? `<p class="reference">Reference: ${displayReference}</p>` : ""}
		<p class="close-msg">Redirecting to wallet in <span id="countdown">10</span>s...</p>
	</div>
	<script>
		let seconds = 10;
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

walletRoute.openapi(paystackWebhookRoute, async (c) => {
	const signature = c.req.header("x-paystack-signature");
	if (!signature) {
		return c.json({ received: false }, 400);
	}

	const rawBody = await c.req.text();
	const expectedSignature = crypto
		.createHmac("sha512", c.env.PAYSTACK_SECRET_KEY)
		.update(rawBody)
		.digest("hex");
	const expectedBytes = new TextEncoder().encode(expectedSignature);
	const suppliedBytes = new TextEncoder().encode(signature);
	if (
		expectedBytes.length !== suppliedBytes.length ||
		!crypto.timingSafeEqual(expectedBytes, suppliedBytes)
	) {
		return c.json({ received: false }, 400);
	}

	let payload: {
		event?: unknown;
		data?: { reference?: unknown };
	};
	try {
		payload = JSON.parse(rawBody);
	} catch {
		return c.json({ received: false }, 400);
	}

	const transferFailed =
		payload.event === "transfer.failed" ||
		payload.event === "transfer.reversed";
	if (
		(payload.event !== "transfer.success" && !transferFailed) ||
		typeof payload.data?.reference !== "string"
	) {
		return c.json({ received: true }, 200);
	}

	const db = drizzle(c.env.DB, { schema });
	const [transaction] = await db
		.select()
		.from(schema.walletTransaction)
		.where(eq(schema.walletTransaction.reference, payload.data.reference))
		.limit(1);
	if (!transaction || transaction.status !== "processing") {
		return c.json({ received: true }, 200);
	}

	if (transferFailed) {
		// Claim the row first: the refund must happen exactly once even if
		// Paystack retries the webhook.
		const [reversed] = await db
			.update(schema.walletTransaction)
			.set({ status: "failed" })
			.where(
				and(
					eq(schema.walletTransaction.id, transaction.id),
					eq(schema.walletTransaction.status, "processing"),
				),
			)
			.returning({ id: schema.walletTransaction.id });
		if (!reversed) {
			return c.json({ received: true }, 200);
		}

		const refunded = await creditWallet(
			db,
			transaction.userId,
			transaction.amount,
		);
		if (!refunded) {
			console.error("Withdrawal reversal could not refund the wallet", {
				transactionId: transaction.id,
			});
			return c.json({ received: true }, 200);
		}

		void trackWebengageEvent(
			c.env,
			{
				userId: transaction.userId,
				eventName: "withdrawal_failed",
				eventData: {
					amount: transaction.amount / 100,
					transaction_id: payload.data.reference,
					failure_reason:
						payload.event === "transfer.reversed"
							? "Transfer reversed"
							: "Transfer failed",
					wallet_balance_after: refunded.balance / 100,
				},
			},
			c.executionCtx,
		);
		void syncWebengageUserProfile(c.env, transaction.userId, c.executionCtx);

		return c.json({ received: true }, 200);
	}

	const [completed] = await db
		.update(schema.walletTransaction)
		.set({ status: "success" })
		.where(
			and(
				eq(schema.walletTransaction.id, transaction.id),
				eq(schema.walletTransaction.status, "processing"),
			),
		)
		.returning({ id: schema.walletTransaction.id });
	if (!completed) {
		return c.json({ received: true }, 200);
	}

	let metadata: Record<string, unknown> = {};
	try {
		metadata = JSON.parse(transaction.metadata || "{}");
	} catch {
	}
	const bankCode = typeof metadata.bankCode === "string" ? metadata.bankCode : "";
	const accountNumber =
		typeof metadata.accountNumber === "string" ? metadata.accountNumber : undefined;
	const accountName =
		typeof metadata.accountName === "string" ? metadata.accountName : "";

	void trackWebengageEvent(
		c.env,
		{
			userId: transaction.userId,
			eventName: "withdrawal_completed",
			eventData: {
				amount: transaction.amount / 100,
				transaction_id: payload.data.reference,
				bank: bankCode,
				bank_code: bankCode,
				wallet_balance_after: (transaction.balance ?? 0) / 100,
				account_number_last4: maskBankAccountNumber(accountNumber),
				account_name: accountName,
			},
		},
		c.executionCtx,
	);
	void syncWebengageUserProfile(c.env, transaction.userId, c.executionCtx);

	return c.json({ received: true }, 200);
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

	if (!wallet || walletFundsFromRow(wallet).withdrawableKobo < amount * 100) {
		return c.json(
			{
				success: false as const,
				error: insufficientWithdrawableMessage(wallet),
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

	const debitedWallet = await debitWithdrawableWallet(db, user.id, amountInKobo);
	if (!debitedWallet) {
		await db
			.delete(schema.walletTransaction)
			.where(eq(schema.walletTransaction.id, txnId));
		return c.json(
			{ success: false, error: insufficientWithdrawableMessage(wallet) },
			400,
		);
	}
	newBalance = debitedWallet.balance;
	await db
		.update(schema.walletTransaction)
		.set({ balance: newBalance })
		.where(eq(schema.walletTransaction.id, txnId));

	void trackWebengageEvent(
		c.env,
		{
			userId: user.id,
			eventName: "withdrawal_requested",
			eventData: {
				amount,
				bank: bankCode,
				bank_code: bankCode,
				wallet_balance_before: wallet.balance / 100,
				account_number_last4: maskBankAccountNumber(accountNumber),
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

	if (walletFundsFromRow(senderWallet).withdrawableKobo < amount * 100) {
		return c.json(
			{
				success: false as const,
				error: insufficientWithdrawableMessage(senderWallet),
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

	// Ledger-first: the sender's debit row is only written when withdrawable
	// funds cover the amount, and every other statement is conditional on that
	// row, so a race past the pre-check can never credit the recipient alone.
	const senderReference = `${reference}_sender`;
	const senderDebited =
		"EXISTS (SELECT 1 FROM wallet_transaction WHERE reference = ?)";
	const now = Date.now();
	await c.env.DB.batch([
		c.env.DB.prepare(
			"INSERT INTO wallet_transaction (id, user_id, amount, type, reference, status, payment_method, balance, recipient_wallet_id, recipient_name, metadata) SELECT ?, user_id, ?, 'debit', ?, 'completed', 'wallet_transfer', balance - ?, ?, ?, ? FROM wallet WHERE user_id = ? AND balance - frozen_balance - bonus_balance >= ?",
		).bind(
			generateUUIDv7(),
			amountKobo,
			senderReference,
			amountKobo,
			recipientWalletId,
			recipientName,
			JSON.stringify({
				transferType: "outgoing",
				recipientName,
				recipientWalletId,
			}),
			user.id,
			amountKobo,
		),
		c.env.DB.prepare(
			`UPDATE wallet SET balance = balance - ?, updated_at = ? WHERE user_id = ? AND ${senderDebited}`,
		).bind(amountKobo, now, user.id, senderReference),
		c.env.DB.prepare(
			`UPDATE wallet SET balance = balance + ?, updated_at = ? WHERE id = ? AND ${senderDebited}`,
		).bind(amountKobo, now, recipientWallet.id, senderReference),
		c.env.DB.prepare(
			`INSERT INTO wallet_transaction (id, user_id, amount, type, reference, status, payment_method, balance, recipient_wallet_id, recipient_name, metadata) SELECT ?, ?, ?, 'credit', ?, 'completed', 'wallet_transfer', (SELECT balance FROM wallet WHERE user_id = ?), ?, ?, ? WHERE ${senderDebited}`,
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
			senderReference,
		),
	]);

	const senderDebit = await c.env.DB.prepare(
		"SELECT 1 AS found FROM wallet_transaction WHERE reference = ? LIMIT 1",
	)
		.bind(senderReference)
		.first();
	if (!senderDebit) {
		return c.json(
			{
				success: false as const,
				error: insufficientWithdrawableMessage(senderWallet),
				details: null,
			},
			400,
		);
	}

	const [updatedSenderWallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.id, senderWallet.id))
		.limit(1);
	const [updatedRecipientWallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.id, recipientWallet.id))
		.limit(1);

	const balancesVerified = Boolean(updatedSenderWallet && updatedRecipientWallet);
	if (!balancesVerified) {
		console.error(
			JSON.stringify({
				tag: "wallet_transfer_balance_verification_failed",
				reference,
				senderWalletId: senderWallet.id,
				recipientWalletId: recipientWallet.id,
				senderFound: Boolean(updatedSenderWallet),
				recipientFound: Boolean(updatedRecipientWallet),
			}),
		);
	}

	trackWebengageEvent(
		c.env,
		{
			userId: user.id,
			eventName: "transfer_funds_completed",
			eventData: {
				wallet_id: recipientWalletId,
				amount,
				transaction_id: reference,
				wallet_balance_after: updatedSenderWallet
					? updatedSenderWallet.balance / 100
					: null,
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
				senderWalletBalance: updatedSenderWallet
					? updatedSenderWallet.balance / 100
					: null,
				recipientWalletBalance: updatedRecipientWallet
					? updatedRecipientWallet.balance / 100
					: null,
				balanceVerification: balancesVerified ? "verified" : "failed",
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
			balance: newGameWallet.balance / 100,
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
		return c.json(
			{ success: false as const, error: "Unauthorized", details: null },
			401,
		);
	}
	// game_wallet is no longer read by any game or by GET /wallet; moving cash
	// into it would strand the player's money.
	return c.json(
		{
			success: false as const,
			error:
				"The game wallet has been retired. Bonus funds are part of your main wallet.",
			details: null,
		},
		410,
	);
});

export default walletRoute;
