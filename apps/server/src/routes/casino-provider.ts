import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
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
import type { CloudflareBindings } from "../types";

const casinoProviderRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

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
		return c.json({ success: false, error: "Failed to create game session" }, 500);
	}

	await db
		.update(schema.gameLaunchTokens)
		.set({ used: true })
		.where(eq(schema.gameLaunchTokens.token, user_token));

	console.log("auth data", {
		user_id: user.id,
		username: user.name ?? user.email.split("@")[0],
		balance: balance * 100,
		currency: currency ?? "NGN",
	});

	return c.json(
		{
			code: 200,
			data: {
				user_id: user.id,
				username: user.name ?? user.email.split("@")[0],
				balance: balance * 100,
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
		action,
		currency,
		provider,
	} = result.data;

	const [existingTx] = await db
		.select()
		.from(schema.gameTransactions)
		.where(eq(schema.gameTransactions.providerTxId, provider_tx_id))
		.limit(1);

	if (existingTx) {
		return c.json(
			{
				code: 409,
				error: "Duplicate transaction",
			},
			409,
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

	const balanceKobo = wallet?.balance ?? 0;
	const oldBalanceKobo = balanceKobo;

	if (!wallet || balanceKobo < amount) {
		return c.json(
			{
				code: 402,
				error: "Insufficient funds",
			},
			402,
		);
	}

	const operatorTxId = `gtxn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

	const newBalanceKobo = balanceKobo - amount / 10;
	await db
		.update(schema.wallet)
		.set({ balance: newBalanceKobo })
		.where(eq(schema.wallet.userId, user_id));

	const [betTxn] = await db
		.insert(schema.gameTransactions)
		.values({
			id: operatorTxId,
			userId: user_id,
			providerTxId: provider_tx_id,
			type: "BET",
			amount,
			sessionToken: session_token,
			game,
		})
		.returning();

	if (!betTxn?.id) {
		return c.json({ success: false, error: "Failed to record bet transaction" }, 500);
	}

	return c.json(
		{
			code: 200,
			data: {
				user_id,
				provider,
				provider_tx_id,
				old_balance: oldBalanceKobo,
				new_balance: newBalanceKobo,
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

	const [existingTx] = await db
		.select()
		.from(schema.gameTransactions)
		.where(eq(schema.gameTransactions.providerTxId, provider_tx_id))
		.limit(1);

	if (existingTx) {
		return c.json(
			{
				code: 409,
				error: "Duplicate transaction",
			},
			409,
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

	const balanceKobo = wallet?.balance ?? 0;
	const oldBalanceKobo = balanceKobo;
	const operatorTxId = `gtxn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

	const newBalanceKobo = balanceKobo + amount;
	await db
		.update(schema.wallet)
		.set({ balance: newBalanceKobo / 10 })
		.where(eq(schema.wallet.userId, user_id));

	const [winTxn] = await db
		.insert(schema.gameTransactions)
		.values({
			id: operatorTxId,
			userId: user_id,
			providerTxId: provider_tx_id,
			type: "WIN",
			amount,
			sessionToken: session_token,
			game,
		})
		.returning();

	if (!winTxn?.id) {
		return c.json({ success: false, error: "Failed to record win transaction" }, 500);
	}

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
				old_balance: oldBalanceKobo,
				new_balance: newBalanceKobo,
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

	const [existingTx] = await db
		.select()
		.from(schema.gameTransactions)
		.where(eq(schema.gameTransactions.providerTxId, rollback_provider_tx_id))
		.limit(1);

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

	const balanceKobo = wallet?.balance ?? 0;
	const oldBalanceKobo = balanceKobo;
	const adjustment = existingTx.type === "BET" ? amount : -amount;
	const operatorTxId = `gtxn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

	const newBalanceKobo = balanceKobo + adjustment;
	await db
		.update(schema.wallet)
		.set({ balance: newBalanceKobo / 10 })
		.where(eq(schema.wallet.userId, user_id));

	const [rollbackTxn] = await db
		.insert(schema.gameTransactions)
		.values({
			id: operatorTxId,
			userId: user_id,
			providerTxId: `rollback_${rollback_provider_tx_id}`,
			type: "ROLLBACK",
			amount,
			sessionToken: session_token,
			game,
		})
		.returning();

	if (!rollbackTxn?.id) {
		return c.json({ success: false, error: "Failed to record rollback transaction" }, 500);
	}

	return c.json(
		{
			code: 200,
			data: {
				user_id,
				provider,
				provider_tx_id: rollback_provider_tx_id,
				old_balance: oldBalanceKobo,
				new_balance: newBalanceKobo,
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
				balance: wallet?.balance ?? 0,
				currency: "NGN",
			},
		},
		200,
	);
});

export default casinoProviderRoute;
