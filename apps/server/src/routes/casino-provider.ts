import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { creditWallet, debitWallet } from "@/db/atomic-wallet";
import * as schema from "@/db/schema";
import {
	AuthRequestSchema,
	AuthResponseSchema,
	CasinoProviderErrorSchema,
	DepositRequestSchema,
	DepositResponseSchema,
	PlayerInfoRequestSchema,
	PlayerInfoResponseSchema,
	RollbackRequestSchema,
	RollbackResponseSchema,
	WithdrawRequestSchema,
	CasinoWithdrawResponseSchema as WithdrawResponseSchema,
} from "@/schemas/casino-provider";
import {
	BONUS_ENGINE_NATIVE_PROVIDER_ID,
	casinoBetAmountFromKobo,
	optionalExecutionCtx,
	reportCasinoBetInBackground,
	reportCasinoBetResultInBackground,
} from "@/services/bonus-engine";
import type { CloudflareBindings } from "../types";

const casinoProviderRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

export function isUniqueConstraintError(error: unknown): boolean {
	let current: unknown = error;
	for (let i = 0; i < 5 && current; i++) {
		const message = current instanceof Error ? current.message : String(current);
		if (
			message.includes("UNIQUE constraint failed") ||
			(message.includes("D1_ERROR") && message.toUpperCase().includes("UNIQUE"))
		) {
			return true;
		}
		current =
			current instanceof Error && "cause" in current
				? current.cause
				: undefined;
	}
	return false;
}

export function rollbackLedgerTxId(originalProviderTxId: string): string {
	return `rollback_${originalProviderTxId}`;
}

function toProviderUnits(kobo: number | null | undefined): number {
	return (kobo ?? 0) * 10;
}

function newOperatorTxId(): string {
	return `gtxn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

type GameTxRow = typeof schema.gameTransactions.$inferSelect;
type CasinoDb = ReturnType<typeof drizzle<typeof schema>>;

async function findGameTxByProviderId(
	db: CasinoDb,
	providerTxId: string,
): Promise<GameTxRow | undefined> {
	const [row] = await db
		.select()
		.from(schema.gameTransactions)
		.where(eq(schema.gameTransactions.providerTxId, providerTxId))
		.limit(1);
	return row;
}

async function claimGameTx(
	db: CasinoDb,
	values: typeof schema.gameTransactions.$inferInsert,
): Promise<{ claimed: true; id: string } | { claimed: false; existing: GameTxRow }> {
	try {
		await db.insert(schema.gameTransactions).values(values);
		return { claimed: true, id: values.id };
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			const existing = await findGameTxByProviderId(db, values.providerTxId);
			if (existing) return { claimed: false, existing };
		}
		throw error;
	}
}

async function releaseClaimedGameTx(db: CasinoDb, providerTxId: string) {
	await db
		.delete(schema.gameTransactions)
		.where(eq(schema.gameTransactions.providerTxId, providerTxId));
}

/** Credit/debit after a unique claim. On any failure, drop the claim so a retry can settle. */
async function settleClaimedWallet(
	db: CasinoDb,
	providerTxId: string,
	mutate: () => Promise<{ balance: number } | undefined>,
): Promise<{ balance: number } | undefined> {
	try {
		const updated = await mutate();
		if (!updated) {
			await releaseClaimedGameTx(db, providerTxId);
		}
		return updated;
	} catch (error) {
		try {
			await releaseClaimedGameTx(db, providerTxId);
		} catch {
			// Keep the wallet error; the claim must not block a later retry.
		}
		throw error;
	}
}

async function recordLuckyWalletTx(
	db: CasinoDb,
	input: {
		userId: string;
		amount: number;
		type: "debit" | "credit" | "refund";
		balance: number;
		game: string;
		sessionToken: string;
		providerTxId: string;
		action: string;
	},
): Promise<void> {
	await db.insert(schema.walletTransaction).values({
		id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
		userId: input.userId,
		amount: input.amount,
		type: input.type,
		reference: null,
		status: "success",
		paymentMethod: "lucky games",
		balance: input.balance,
		metadata: JSON.stringify({
			game: input.game,
			sessionToken: input.sessionToken,
			providerTxId: input.providerTxId,
			action: input.action,
		}),
	});
}

const authRoute = createRoute({
	method: "post",
	path: "/auth",
	tags: ["Casino Provider"],
	summary: "Authenticate player",
	description: "Validate launch token and create game session",
	request: {
		body: {
			content: {
				"application/json": {
					schema: AuthRequestSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Authentication successful",
			content: {
				"application/json": {
					schema: AuthResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid request",
			content: {
				"application/json": {
					schema: CasinoProviderErrorSchema,
				},
			},
		},
		401: {
			description: "Invalid token",
			content: {
				"application/json": {
					schema: CasinoProviderErrorSchema,
				},
			},
		},
		403: {
			description: "Token expired",
			content: {
				"application/json": {
					schema: CasinoProviderErrorSchema,
				},
			},
		},
	},
});

const withdrawRoute = createRoute({
	method: "post",
	path: "/withdraw_spribe",
	tags: ["Casino Provider"],
	summary: "Process bet",
	description: "Deduct bet amount from user wallet",
	request: {
		body: {
			content: {
				"application/json": {
					schema: WithdrawRequestSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Bet processed",
			content: {
				"application/json": {
					schema: WithdrawResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid request",
			content: {
				"application/json": {
					schema: CasinoProviderErrorSchema,
				},
			},
		},
		401: {
			description: "Invalid session",
			content: {
				"application/json": {
					schema: CasinoProviderErrorSchema,
				},
			},
		},
		402: {
			description: "Insufficient funds",
			content: {
				"application/json": {
					schema: CasinoProviderErrorSchema,
				},
			},
		},
		409: {
			description: "Duplicate transaction",
			content: {
				"application/json": {
					schema: CasinoProviderErrorSchema,
				},
			},
		},
	},
});

const depositRoute = createRoute({
	method: "post",
	path: "/deposit_spribe",
	tags: ["Casino Provider"],
	summary: "Process win",
	description: "Credit win amount to user wallet",
	request: {
		body: {
			content: {
				"application/json": {
					schema: DepositRequestSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Win processed",
			content: {
				"application/json": {
					schema: DepositResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid request",
			content: {
				"application/json": {
					schema: CasinoProviderErrorSchema,
				},
			},
		},
		401: {
			description: "Invalid session",
			content: {
				"application/json": {
					schema: CasinoProviderErrorSchema,
				},
			},
		},
		409: {
			description: "Duplicate transaction",
			content: {
				"application/json": {
					schema: CasinoProviderErrorSchema,
				},
			},
		},
		500: {
			description: "Failed to update wallet",
			content: {
				"application/json": {
					schema: CasinoProviderErrorSchema,
				},
			},
		},
	},
});

const rollbackRoute = createRoute({
	method: "post",
	path: "/rollback_spribe",
	tags: ["Casino Provider"],
	summary: "Rollback transaction",
	description: "Reverse a previous transaction",
	request: {
		body: {
			content: {
				"application/json": {
					schema: RollbackRequestSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Rollback processed",
			content: {
				"application/json": {
					schema: RollbackResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid request",
			content: {
				"application/json": {
					schema: CasinoProviderErrorSchema,
				},
			},
		},
		401: {
			description: "Invalid session",
			content: {
				"application/json": {
					schema: CasinoProviderErrorSchema,
				},
			},
		},
		404: {
			description: "Transaction not found",
			content: {
				"application/json": {
					schema: CasinoProviderErrorSchema,
				},
			},
		},
		402: {
			description: "Insufficient funds",
			content: {
				"application/json": {
					schema: CasinoProviderErrorSchema,
				},
			},
		},
		500: {
			description: "Failed to update wallet",
			content: {
				"application/json": {
					schema: CasinoProviderErrorSchema,
				},
			},
		},
	},
});

const playerInfoRoute = createRoute({
	method: "post",
	path: "/player_info",
	tags: ["Casino Provider"],
	summary: "Get player balance",
	description: "Return current player balance",
	request: {
		body: {
			content: {
				"application/json": {
					schema: PlayerInfoRequestSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Balance retrieved",
			content: {
				"application/json": {
					schema: PlayerInfoResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid request",
			content: {
				"application/json": {
					schema: CasinoProviderErrorSchema,
				},
			},
		},
		401: {
			description: "Invalid session",
			content: {
				"application/json": {
					schema: CasinoProviderErrorSchema,
				},
			},
		},
	},
});

casinoProviderRoute.openapi(authRoute, async (c) => {
	const db = drizzle(c.env.DB, { schema });
	const body = await c.req.json();
	const result = AuthRequestSchema.safeParse(body);

	if (!result.success) {
		return c.json(
			{
				code: 400,
				error: "Invalid request",
			},
			400,
		);
	}

	const { user_token, session_token, currency } = result.data;

	const [launchToken] = await db
		.select()
		.from(schema.gameLaunchTokens)
		.where(
			and(
				eq(schema.gameLaunchTokens.token, user_token),
				eq(schema.gameLaunchTokens.used, false),
			),
		)
		.limit(1);

	if (!launchToken) {
		return c.json(
			{
				code: 403,
				error: "Token expired",
			},
			403,
		);
	}

	const [user] = await db
		.select()
		.from(schema.user)
		.where(eq(schema.user.id, launchToken.userId))
		.limit(1);

	if (!user) {
		return c.json(
			{
				code: 401,
				error: "Invalid token",
			},
			401,
		);
	}

	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, user.id))
		.limit(1);

	const balance = wallet?.balance ?? 0;

	const [gameSession] = await db
		.insert(schema.gameSessions)
		.values({
			sessionToken: session_token,
			userId: user.id,
			game: launchToken.game,
			status: "active",
		})
		.returning();

	if (!gameSession?.sessionToken) {
		return c.json(
			{ success: false, error: "Failed to create game session" },
			500,
		);
	}

	await db
		.update(schema.gameLaunchTokens)
		.set({ used: true })
		.where(eq(schema.gameLaunchTokens.token, user_token));

	return c.json(
		{
			code: 200,
			data: {
				user_id: user.id,
				username: user.name ?? user.email.split("@")[0],
				balance: balance * 10,
				currency: currency ?? "NGN",
			},
		},
		200,
	);
});

casinoProviderRoute.openapi(withdrawRoute, async (c) => {
	const db = drizzle(c.env.DB, { schema });
	const body = await c.req.json();
	const result = WithdrawRequestSchema.safeParse(body);

	if (!result.success) {
		return c.json(
			{
				code: 400,
				error: "Invalid request",
			},
			400,
		);
	}

	const {
		user_id,
		amount,
		provider_tx_id,
		session_token,
		game,
		currency,
		provider,
	} = result.data;

	const existingTx = await findGameTxByProviderId(db, provider_tx_id);
	if (existingTx) {
		return c.json(
			{
				code: 200,
				data: {
					user_id,
					provider,
					provider_tx_id,
					old_balance: toProviderUnits(existingTx.balanceBefore),
					new_balance: toProviderUnits(existingTx.balanceAfter),
					operator_tx_id: existingTx.id,
					currency,
				},
			},
			200,
		);
	}

	const [session] = await db
		.select()
		.from(schema.gameSessions)
		.where(
			and(
				eq(schema.gameSessions.sessionToken, session_token),
				eq(schema.gameSessions.userId, user_id),
				eq(schema.gameSessions.status, "active"),
			),
		)
		.limit(1);

	if (!session) {
		return c.json(
			{
				code: 401,
				error: "Invalid session",
			},
			401,
		);
	}

	const [user] = await db
		.select()
		.from(schema.user)
		.where(eq(schema.user.id, user_id))
		.limit(1);

	if (!user) {
		return c.json(
			{
				code: 401,
				error: "Invalid user",
			},
			401,
		);
	}

	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, user_id))
		.limit(1);

	const oldBalanceKobo = wallet?.balance ?? 0;
	const amountKobo = Math.round(amount / 10);

	if (!wallet || oldBalanceKobo < amountKobo) {
		return c.json(
			{
				code: 402,
				error: "Insufficient funds",
			},
			402,
		);
	}

	const operatorTxId = newOperatorTxId();
	const claimed = await claimGameTx(db, {
		id: operatorTxId,
		userId: user_id,
		providerTxId: provider_tx_id,
		type: "BET",
		amount: amountKobo,
		balanceBefore: oldBalanceKobo,
		balanceAfter: oldBalanceKobo - amountKobo,
		sessionToken: session_token,
		game,
	});

	if (!claimed.claimed) {
		return c.json(
			{
				code: 200,
				data: {
					user_id,
					provider,
					provider_tx_id,
					old_balance: toProviderUnits(claimed.existing.balanceBefore),
					new_balance: toProviderUnits(claimed.existing.balanceAfter),
					operator_tx_id: claimed.existing.id,
					currency,
				},
			},
			200,
		);
	}

	const updatedWallet = await settleClaimedWallet(db, provider_tx_id, () =>
		debitWallet(db, user_id, amountKobo),
	);

	if (!updatedWallet) {
		return c.json(
			{
				code: 402,
				error: "Insufficient funds",
			},
			402,
		);
	}
	const newBalanceKobo = updatedWallet.balance;

	await db
		.update(schema.gameTransactions)
		.set({
			balanceBefore: oldBalanceKobo,
			balanceAfter: newBalanceKobo,
		})
		.where(eq(schema.gameTransactions.providerTxId, provider_tx_id));

	try {
		await recordLuckyWalletTx(db, {
			userId: user_id,
			amount: amountKobo,
			type: "debit",
			balance: newBalanceKobo,
			game,
			sessionToken: session_token,
			providerTxId: provider_tx_id,
			action: "bet",
		});
	} catch {
		// Ledger already claimed; do not 500 or LuckyWorld will retry and we
		// must not reverse a completed debit.
	}

	await reportCasinoBetInBackground({
		env: c.env,
		executionCtx: optionalExecutionCtx(c),
		userId: user_id,
		betId: provider_tx_id,
		amount: casinoBetAmountFromKobo(amountKobo),
		currency,
		gameRef: game,
		fallbackProviderId: BONUS_ENGINE_NATIVE_PROVIDER_ID.LUCKYWORLD,
	});

	return c.json(
		{
			code: 200,
			data: {
				user_id,
				provider,
				provider_tx_id,
				old_balance: oldBalanceKobo * 10,
				new_balance: newBalanceKobo * 10,
				operator_tx_id: operatorTxId,
				currency,
			},
		},
		200,
	);
});

casinoProviderRoute.openapi(depositRoute, async (c) => {
	const db = drizzle(c.env.DB, { schema });
	const body = await c.req.json();
	const result = DepositRequestSchema.safeParse(body);

	if (!result.success) {
		return c.json(
			{
				code: 400,
				error: "Invalid request",
			},
			400,
		);
	}

	const {
		user_id,
		amount,
		provider_tx_id,
		session_token,
		provider,
		game,
		currency,
	} = result.data;

	const existingTx = await findGameTxByProviderId(db, provider_tx_id);
	if (existingTx) {
		return c.json(
			{
				code: 200,
				data: {
					user_id,
					provider_tx_id,
					operator_tx_id: existingTx.id,
					amount,
					provider,
					currency,
					old_balance: toProviderUnits(existingTx.balanceBefore),
					new_balance: toProviderUnits(existingTx.balanceAfter),
				},
			},
			200,
		);
	}

	const [session] = await db
		.select()
		.from(schema.gameSessions)
		.where(
			and(
				eq(schema.gameSessions.sessionToken, session_token),
				eq(schema.gameSessions.userId, user_id),
				eq(schema.gameSessions.status, "active"),
			),
		)
		.limit(1);

	if (!session) {
		return c.json(
			{
				code: 401,
				error: "Invalid session",
			},
			401,
		);
	}

	const [user] = await db
		.select()
		.from(schema.user)
		.where(eq(schema.user.id, user_id))
		.limit(1);

	if (!user) {
		return c.json(
			{
				code: 401,
				error: "Invalid user",
			},
			401,
		);
	}

	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, user_id))
		.limit(1);

	const oldBalanceKobo = wallet?.balance ?? 0;
	const amountKobo = Math.round(amount / 10);
	const operatorTxId = newOperatorTxId();

	const claimed = await claimGameTx(db, {
		id: operatorTxId,
		userId: user_id,
		providerTxId: provider_tx_id,
		type: "WIN",
		amount: amountKobo,
		balanceBefore: oldBalanceKobo,
		balanceAfter: oldBalanceKobo + amountKobo,
		sessionToken: session_token,
		game,
	});

	if (!claimed.claimed) {
		return c.json(
			{
				code: 200,
				data: {
					user_id,
					provider_tx_id,
					operator_tx_id: claimed.existing.id,
					amount,
					provider,
					currency,
					old_balance: toProviderUnits(claimed.existing.balanceBefore),
					new_balance: toProviderUnits(claimed.existing.balanceAfter),
				},
			},
			200,
		);
	}

	const updatedWallet = await settleClaimedWallet(db, provider_tx_id, () =>
		creditWallet(db, user_id, amountKobo),
	);

	if (!updatedWallet) {
		return c.json(
			{
				code: 500,
				error: "Failed to update wallet",
			},
			500,
		);
	}
	const newBalanceKobo = updatedWallet.balance;

	await db
		.update(schema.gameTransactions)
		.set({
			balanceBefore: oldBalanceKobo,
			balanceAfter: newBalanceKobo,
		})
		.where(eq(schema.gameTransactions.providerTxId, provider_tx_id));

	try {
		await recordLuckyWalletTx(db, {
			userId: user_id,
			amount: amountKobo,
			type: "credit",
			balance: newBalanceKobo,
			game,
			sessionToken: session_token,
			providerTxId: provider_tx_id,
			action: "win",
		});
	} catch {
		// Ledger already claimed; returning 500 would reprint the win on retry.
	}

	await reportCasinoBetResultInBackground({
		env: c.env,
		executionCtx: optionalExecutionCtx(c),
		userId: user_id,
		betId: provider_tx_id,
		totalWinAmount: casinoBetAmountFromKobo(amountKobo),
		isWin: 1,
	});

	return c.json(
		{
			code: 200,
			data: {
				user_id,
				provider_tx_id,
				operator_tx_id: operatorTxId,
				amount,
				provider,
				currency,
				old_balance: oldBalanceKobo * 10,
				new_balance: newBalanceKobo * 10,
			},
		},
		200,
	);
});

casinoProviderRoute.openapi(rollbackRoute, async (c) => {
	const db = drizzle(c.env.DB, { schema });
	const body = await c.req.json();
	const result = RollbackRequestSchema.safeParse(body);

	if (!result.success) {
		return c.json(
			{
				code: 400,
				error: "Invalid request",
			},
			400,
		);
	}

	const {
		user_id,
		amount,
		rollback_provider_tx_id,
		session_token,
		provider,
		game,
	} = result.data;

	const rollbackTxId = rollbackLedgerTxId(rollback_provider_tx_id);

	const existingRollback = await findGameTxByProviderId(db, rollbackTxId);
	if (existingRollback) {
		return c.json(
			{
				code: 200,
				data: {
					user_id,
					provider,
					provider_tx_id: rollback_provider_tx_id,
					old_balance: toProviderUnits(existingRollback.balanceBefore),
					new_balance: toProviderUnits(existingRollback.balanceAfter),
					operator_tx_id: existingRollback.id,
					currency: "NGN",
				},
			},
			200,
		);
	}

	const existingTx = await findGameTxByProviderId(db, rollback_provider_tx_id);

	if (!existingTx) {
		return c.json(
			{
				code: 404,
				error: "Transaction not found",
			},
			404,
		);
	}

	const [session] = await db
		.select()
		.from(schema.gameSessions)
		.where(
			and(
				eq(schema.gameSessions.sessionToken, session_token),
				eq(schema.gameSessions.userId, user_id),
				eq(schema.gameSessions.status, "active"),
			),
		)
		.limit(1);

	if (!session) {
		return c.json(
			{
				code: 401,
				error: "Invalid session",
			},
			401,
		);
	}

	const [user] = await db
		.select()
		.from(schema.user)
		.where(eq(schema.user.id, user_id))
		.limit(1);

	if (!user) {
		return c.json(
			{
				code: 401,
				error: "Invalid user",
			},
			401,
		);
	}

	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, user_id))
		.limit(1);

	const oldBalanceKobo = wallet?.balance ?? 0;
	const amountKobo = Math.round(amount / 10);
	const adjustment = existingTx.type === "BET" ? amountKobo : -amountKobo;
	const operatorTxId = newOperatorTxId();

	if (existingTx.type !== "BET" && (!wallet || oldBalanceKobo < amountKobo)) {
		return c.json(
			{
				code: 402,
				error: "Insufficient funds",
			},
			402,
		);
	}

	const claimed = await claimGameTx(db, {
		id: operatorTxId,
		userId: user_id,
		providerTxId: rollbackTxId,
		type: "ROLLBACK",
		amount: amountKobo,
		balanceBefore: oldBalanceKobo,
		balanceAfter: oldBalanceKobo + adjustment,
		sessionToken: session_token,
		game,
	});

	if (!claimed.claimed) {
		// Another request holds this claim and may not have credited yet.
		// 200 here would let LuckyWorld stop retrying if that credit later fails.
		return c.json(
			{
				code: 500,
				error: "Failed to update wallet",
			},
			500,
		);
	}

	let updatedWallet: { balance: number } | undefined;
	try {
		updatedWallet = await settleClaimedWallet(db, rollbackTxId, () =>
			existingTx.type === "BET"
				? creditWallet(db, user_id, amountKobo)
				: debitWallet(db, user_id, amountKobo),
		);
	} catch {
		return c.json(
			{
				code: 500,
				error: "Failed to update wallet",
			},
			500,
		);
	}

	if (!updatedWallet) {
		return c.json(
			{
				code: 500,
				error: "Failed to update wallet",
			},
			500,
		);
	}
	const newBalanceKobo = updatedWallet.balance;

	await db
		.update(schema.gameTransactions)
		.set({
			balanceBefore: oldBalanceKobo,
			balanceAfter: newBalanceKobo,
		})
		.where(eq(schema.gameTransactions.providerTxId, rollbackTxId));

	try {
		await recordLuckyWalletTx(db, {
			userId: user_id,
			amount: adjustment,
			type: "refund",
			balance: newBalanceKobo,
			game,
			sessionToken: session_token,
			providerTxId: rollback_provider_tx_id,
			action: "rollback",
		});
	} catch {
		// Money already moved under a unique rollback id; 500 would reprint it.
	}

	await reportCasinoBetResultInBackground({
		env: c.env,
		executionCtx: optionalExecutionCtx(c),
		userId: user_id,
		betId: rollback_provider_tx_id,
		totalWinAmount: casinoBetAmountFromKobo(amountKobo),
		isWin: 0,
		isRollback: 1,
	});

	return c.json(
		{
			code: 200,
			data: {
				user_id,
				provider,
				provider_tx_id: rollback_provider_tx_id,
				old_balance: oldBalanceKobo * 10,
				new_balance: newBalanceKobo * 10,
				operator_tx_id: operatorTxId,
				currency: "NGN",
			},
		},
		200,
	);
});

casinoProviderRoute.openapi(playerInfoRoute, async (c) => {
	const db = drizzle(c.env.DB, { schema });
	const body = await c.req.json();
	const result = PlayerInfoRequestSchema.safeParse(body);

	if (!result.success) {
		return c.json(
			{
				code: 400,
				error: "Invalid request",
			},
			400,
		);
	}

	const { user_id, session_token } = result.data;

	const [session] = await db
		.select()
		.from(schema.gameSessions)
		.where(
			and(
				eq(schema.gameSessions.sessionToken, session_token),
				eq(schema.gameSessions.userId, user_id),
				eq(schema.gameSessions.status, "active"),
			),
		)
		.limit(1);

	if (!session) {
		return c.json(
			{
				code: 401,
				error: "Invalid session",
			},
			401,
		);
	}

	const [user] = await db
		.select()
		.from(schema.user)
		.where(eq(schema.user.id, user_id))
		.limit(1);

	if (!user) {
		return c.json(
			{
				code: 401,
				error: "Invalid user",
			},
			401,
		);
	}

	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, user_id))
		.limit(1);

	return c.json(
		{
			code: 200,
			data: {
				balance: (wallet?.balance ?? 0) * 10,
				currency: "NGN",
			},
		},
		200,
	);
});

export default casinoProviderRoute;
