import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { Context } from "hono";
import { creditWallet, debitWallet } from "@/db/atomic-wallet";
import * as schema from "@/db/schema";
import { settleWithClaim } from "@/services/casino-settlement";
import { CasinoMoneyError, toKobo } from "@/utils/casino-money";
import {
	BONUS_ENGINE_NATIVE_PROVIDER_ID,
	casinoBetAmountFromKobo,
	optionalExecutionCtx,
	reportCasinoBetInBackground,
	reportCasinoBetResultInBackground,
} from "@/services/bonus-engine";
import {
	ThundrBalanceQuerySchema,
	ThundrBalanceRequestSchema,
	ThundrBalanceResponseSchema,
	ThundrErrorSchema,
	ThundrInsufficientBalanceErrorSchema,
	ThundrPlayRequestSchema,
	ThundrPlayResponseSchema,
	ThundrSessionErrorResponseSchema,
	ThundrSessionRequestSchema,
	ThundrSessionResponseSchema,
	ThundrTransactionErrorResponseSchema,
	ThundrTransactionRequestSchema,
	ThundrTransactionResponseSchema,
} from "@/schemas/thundr";
import type { CloudflareBindings } from "../types";

type ThundrContext = {
	Bindings: CloudflareBindings;
};

const thundrRoute = new OpenAPIHono<ThundrContext>();

async function verifyThundrSignature(
	c: Context,
	payload: string,
): Promise<boolean> {
	const receivedSignature = c.req.header("x-server-authorization");
	const serverSecret = (c as any).env?.THNDR_SERVER_SECRET;

	if (!receivedSignature || !serverSecret) {
		console.log("server secret");
		return false;
	}

	const crypto = await import("crypto");
	const computedSignature = crypto
		.createHmac("sha256", serverSecret)
		.update(payload)
		.digest("hex");

	return computedSignature === receivedSignature;
}

const playGameRoute = createRoute({
	method: "post",
	path: "/play/{gameId}",
	tags: ["Thundr Casino"],
	summary: "Launch a Thundr casino game",
	description: "Generate a game link with session ID for Thundr casino games",
	security: [{ BearerAuth: [] }],
	request: {
		params: ThundrPlayRequestSchema,
	},
	responses: {
		200: {
			description: "Game launch URL generated",
			content: {
				"application/json": {
					schema: ThundrPlayResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid request or game not found",
			content: {
				"application/json": {
					schema: ThundrErrorSchema,
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: ThundrErrorSchema,
				},
			},
		},
		500: {
			description: "Server error",
			content: {
				"application/json": {
					schema: ThundrErrorSchema,
				},
			},
		},
	},
});

thundrRoute.openapi(playGameRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(
			{
				success: false,
				error: "Unauthorized",
			},
			401,
		);
	}

	const { gameId } = c.req.valid("param");

	const db = drizzle(c.env.DB, { schema });

	const sessionId = crypto.randomUUID();

	const [session] = await db
		.insert(schema.thundrSessions)
		.values({
			sessionId,
			userId: user.id,
			gameId,
			status: "active",
		})
		.returning();

	if (!session?.sessionId) {
		return c.json({ success: false, error: "Failed to create session" }, 500);
	}

	const baseUrl = c.env.THNDR_BASE_URL || "https://game-sandbox.thndr-cdn.com";
	const operatorId = c.env.THNDR_OPERATOR_ID;

	if (!operatorId) {
		return c.json(
			{
				success: false,
				error: "Thundr operator not configured",
			},
			500,
		);
	}

	const url = new URL(baseUrl);
	url.searchParams.set("operatorId", operatorId);
	url.searchParams.set("gameId", gameId);
	url.searchParams.set("language", "en");
	url.searchParams.set("sessionId", sessionId);

	const launchUrl = url.toString();

	return c.json(
		{
			success: true,
			data: {
				url: launchUrl,
			},
		},
		200,
	);
});

const validateSessionRoute = createRoute({
	method: "get",
	path: "/sessions/{sessionToken}",
	tags: ["Thundr Casino"],
	summary: "Validate a Thundr session",
	description: "Validate session when Thundr calls back to authenticate user",
	security: [],
	request: {
		params: ThundrSessionRequestSchema,
	},
	responses: {
		200: {
			description: "Session valid",
			content: {
				"application/json": {
					schema: ThundrSessionResponseSchema,
				},
			},
		},
		403: {
			description: "Session expired or invalid signature",
			content: {
				"application/json": {
					schema: ThundrTransactionErrorResponseSchema,
				},
			},
		},
	},
});

thundrRoute.openapi(validateSessionRoute, async (c) => {
	const { sessionToken } = c.req.valid("param");

	const isValid = await verifyThundrSignature(c, sessionToken);
	if (!isValid) {
		return c.json(
			ThundrTransactionErrorResponseSchema.parse({
				errors: [{ code: "INVALID_SIGNATURE", isClientSafe: true }],
			}),
			403,
		);
	}

	const db = drizzle(c.env.DB, { schema });

	const session = await db.query.thundrSessions.findFirst({
		where: eq(schema.thundrSessions.sessionId, sessionToken),
	});

	if (!session) {
		return c.json(
			ThundrSessionErrorResponseSchema.parse({
				errors: [{ code: "SESSION_EXPIRED", isClientSafe: true }],
			}),
			403,
		);
	}

	// const oneHourAgo = Date.now() - 60 * 60 * 1000;
	// if (session.createdAt.getTime() < oneHourAgo) {
	// 	return c.json(
	// 		ThundrSessionErrorResponseSchema.parse({
	// 			errors: [{ code: "SESSION_EXPIRED", isClientSafe: true }],
	// 		}),
	// 		403,
	// 	);
	// }

	const user = await db.query.user.findFirst({
		where: eq(schema.user.id, session.userId),
	});

	if (!user) {
		return c.json(
			ThundrSessionErrorResponseSchema.parse({
				errors: [{ code: "SESSION_EXPIRED", isClientSafe: true }],
			}),
			403,
		);
	}

	return c.json(
		ThundrSessionResponseSchema.parse({
			userId: user.id,
			displayName: user.name,
			sessionId: session.sessionId,
			currency: "NGN",
		}),
		200,
	);
});

thundrRoute.post("/transactions", async (c) => {
	const rawBody = await c.req.text();

	const isValid = await verifyThundrSignature(c, rawBody);
	if (!isValid) {
		return c.json(
			ThundrTransactionErrorResponseSchema.parse({
				errors: [{ code: "INVALID_SIGNATURE", isClientSafe: true }],
			}),
			403,
		);
	}

	const db = drizzle(c.env.DB, { schema });
	const body = JSON.parse(rawBody);
	const result = ThundrTransactionRequestSchema.safeParse(body);

	if (!result.success) {
		return c.json(
			{
				success: false,
				error: "Invalid request",
			},
			400,
		);
	}

	const { data: tx } = result;

	const session = await db.query.thundrSessions.findFirst({
		where: eq(schema.thundrSessions.sessionId, tx.sessionId),
	});

	if (!session) {
		return c.json(
			ThundrSessionErrorResponseSchema.parse({
				errors: [{ code: "SESSION_EXPIRED", isClientSafe: true }],
			}),
			403,
		);
	}

	// Idempotency claim key. ROLLBACK dedupes on the ORIGINAL bet id so the
	// same bet can only ever be rolled back once, even if the provider retries
	// with a fresh rollback transactionId.
	const claimTransactionId =
		tx.type === "ROLLBACK"
			? `rollback:${tx.originalTransactionId}`
			: tx.transactionId;

	const echoResponse = (row: typeof schema.thundrTransactions.$inferSelect) =>
		c.json(
			ThundrTransactionResponseSchema.parse({
				transactionId: tx.transactionId,
				userId: row.userId,
				currency: "NGN",
				amount: row.amount,
				type: row.type as "BET" | "WIN" | "LOSE" | "DRAW" | "ROLLBACK",
			}),
			200,
		);

	const existingTx = await db.query.thundrTransactions.findFirst({
		where: eq(schema.thundrTransactions.transactionId, claimTransactionId),
	});

	if (existingTx) {
		return echoResponse(existingTx);
	}

	const operatorTxId = `thndr_tx_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, session.userId))
		.limit(1);

	const currentBalanceKobo = wallet?.balance ?? 0;
	let txAmountKobo = 0;

	if (tx.type === "BET" || tx.type === "WIN" || tx.type === "DRAW") {
		try {
			txAmountKobo = toKobo(tx.amount, "kobo");
		} catch (error) {
			return c.json(
				{
					success: false,
					error:
						error instanceof CasinoMoneyError
							? error.message
							: "Invalid amount",
				},
				400,
			);
		}
	}

	if (tx.type === "BET") {
		if (!wallet || currentBalanceKobo < txAmountKobo) {
			return c.json(
				ThundrInsufficientBalanceErrorSchema.parse({
					errors: [{ code: "INSUFFICIENT_BALANCE", isClientSafe: true }],
				}),
				403,
			);
		}
	}

	if ((tx.type === "WIN" || tx.type === "DRAW") && txAmountKobo > 0) {
		// A payout must correspond to a bet we actually debited for this round;
		// otherwise a spoofed/mis-sequenced callback mints money.
		const priorBet = await db.query.thundrTransactions.findFirst({
			where: and(
				eq(schema.thundrTransactions.userId, session.userId),
				eq(schema.thundrTransactions.roundId, tx.roundId),
				eq(schema.thundrTransactions.type, "BET"),
			),
		});
		if (!priorBet) {
			return c.json(
				ThundrTransactionErrorResponseSchema.parse({
					errors: [{ code: "BET_NOT_FOUND", isClientSafe: true }],
				}),
				403,
			);
		}
	}

	if (tx.type === "ROLLBACK") {
		const [originalTx] = await db
			.select()
			.from(schema.thundrTransactions)
			.where(
				eq(schema.thundrTransactions.transactionId, tx.originalTransactionId),
			)
			.limit(1);
		// Only BET rollbacks re-credit, and only for the ORIGINAL stored amount.
		// Anything else records a zero-amount marker so retries still dedupe.
		txAmountKobo =
			originalTx && originalTx.type === "BET" ? originalTx.amount : 0;
	}

	const walletTxnType =
		tx.type === "BET" ? "debit" : tx.type === "ROLLBACK" ? "refund" : "credit";
	const walletTxnAction =
		tx.type === "BET" ? "bet" : tx.type === "ROLLBACK" ? "rollback" : "win";

	const outcome = await settleWithClaim<
		typeof schema.thundrTransactions.$inferSelect
	>({
		context: {
			provider: "thndr",
			action: walletTxnAction,
			userId: session.userId,
			txId: tx.transactionId,
			roundId: tx.roundId,
			amountKobo: txAmountKobo,
		},
		insertClaim: () =>
			db.insert(schema.thundrTransactions).values({
				id: operatorTxId,
				transactionId: claimTransactionId,
				userId: session.userId,
				type: tx.type,
				amount: txAmountKobo,
				balanceBefore: currentBalanceKobo,
				balanceAfter: currentBalanceKobo,
				roundId: tx.roundId,
				gameId: tx.gameId,
				sessionId: tx.sessionId,
				originalTransactionId:
					tx.type === "ROLLBACK" ? tx.originalTransactionId : null,
			}),
		findExisting: () =>
			db.query.thundrTransactions.findFirst({
				where: eq(
					schema.thundrTransactions.transactionId,
					claimTransactionId,
				),
			}),
		releaseClaim: () =>
			db
				.delete(schema.thundrTransactions)
				.where(
					eq(schema.thundrTransactions.transactionId, claimTransactionId),
				),
		mutateWallet: () => {
			if (txAmountKobo === 0) {
				// LOSE / no-op rollback: nothing to move; keep current balance.
				return Promise.resolve({ balance: currentBalanceKobo });
			}
			return tx.type === "BET"
				? debitWallet(db, session.userId, txAmountKobo)
				: creditWallet(db, session.userId, txAmountKobo);
		},
		finalize: async (balanceAfter) => {
			if (txAmountKobo === 0) return;
			const balanceBefore =
				tx.type === "BET"
					? balanceAfter + txAmountKobo
					: balanceAfter - txAmountKobo;
			await db
				.update(schema.thundrTransactions)
				.set({ balanceBefore, balanceAfter })
				.where(
					eq(schema.thundrTransactions.transactionId, claimTransactionId),
				);
			await db.insert(schema.walletTransaction).values({
				id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
				userId: session.userId,
				amount: txAmountKobo,
				type: walletTxnType,
				reference: `thndr:${claimTransactionId}`,
				status: "success",
				paymentMethod: "thndr games",
				balance: balanceAfter,
				metadata: JSON.stringify({
					game: "thundr",
					roundId: tx.roundId,
					gameId: tx.gameId,
					action: walletTxnAction,
					...(tx.type === "ROLLBACK"
						? { originalTransactionId: tx.originalTransactionId }
						: {}),
				}),
			});
		},
	});

	if (outcome.status === "duplicate") {
		return echoResponse(outcome.existing);
	}

	if (outcome.status === "wallet_failed") {
		if (tx.type === "BET") {
			return c.json(
				ThundrInsufficientBalanceErrorSchema.parse({
					errors: [{ code: "INSUFFICIENT_BALANCE", isClientSafe: true }],
				}),
				403,
			);
		}
		return c.json({ success: false, error: "Failed to update wallet" }, 500);
	}

	if (tx.type === "BET") {
		await reportCasinoBetInBackground({
			env: c.env,
			executionCtx: optionalExecutionCtx(c),
			userId: session.userId,
			betId: tx.transactionId,
			amount: casinoBetAmountFromKobo(txAmountKobo),
			currency: "NGN",
			gameRef: tx.gameId,
			fallbackProviderId: BONUS_ENGINE_NATIVE_PROVIDER_ID.THNDR,
		});
	} else if (tx.type === "WIN" || tx.type === "DRAW") {
		await reportCasinoBetResultInBackground({
			env: c.env,
			executionCtx: optionalExecutionCtx(c),
			userId: session.userId,
			betId: tx.transactionId,
			totalWinAmount: casinoBetAmountFromKobo(txAmountKobo),
			isWin: 1,
		});
	} else if (tx.type === "ROLLBACK") {
		await reportCasinoBetResultInBackground({
			env: c.env,
			executionCtx: optionalExecutionCtx(c),
			userId: session.userId,
			betId: tx.originalTransactionId || tx.transactionId,
			totalWinAmount: casinoBetAmountFromKobo(txAmountKobo),
			isWin: 0,
			isRollback: 1,
		});
	}

	if (tx.type === "BET") {
		await reportCasinoBetInBackground({
			env: c.env,
			executionCtx: optionalExecutionCtx(c),
			userId: session.userId,
			betId: tx.transactionId,
			amount: casinoBetAmountFromKobo(txAmountKobo),
			currency: "NGN",
			gameRef: tx.gameId,
			fallbackProviderId: BONUS_ENGINE_NATIVE_PROVIDER_ID.THNDR,
		});
	} else if (tx.type === "WIN" || tx.type === "DRAW") {
		await reportCasinoBetResultInBackground({
			env: c.env,
			executionCtx: optionalExecutionCtx(c),
			userId: session.userId,
			betId: tx.transactionId,
			totalWinAmount: casinoBetAmountFromKobo(txAmountKobo),
			isWin: 1,
		});
	} else if (tx.type === "ROLLBACK") {
		await reportCasinoBetResultInBackground({
			env: c.env,
			executionCtx: optionalExecutionCtx(c),
			userId: session.userId,
			betId: tx.originalTransactionId || tx.transactionId,
			totalWinAmount: casinoBetAmountFromKobo(txAmountKobo),
			isWin: 0,
			isRollback: 1,
		});
	}

	return c.json(
		ThundrTransactionResponseSchema.parse({
			transactionId: tx.transactionId,
			userId: session.userId,
			currency: "NGN",
			amount: txAmountKobo,
			type: tx.type,
		}),
		200,
	);
});

const getBalanceRoute = createRoute({
	method: "get",
	path: "/users/{userId}/balance",
	tags: ["Thundr Casino"],
	summary: "Get player balance",
	description: "Return current player balance for Thundr",
	security: [],
	request: {
		params: ThundrBalanceRequestSchema,
		query: ThundrBalanceQuerySchema,
	},
	responses: {
		200: {
			description: "Player balance",
			content: {
				"application/json": {
					schema: ThundrBalanceResponseSchema,
				},
			},
		},
		403: {
			description: "Session expired or invalid",
			content: {
				"application/json": {
					schema: ThundrTransactionErrorResponseSchema,
				},
			},
		},
	},
});

thundrRoute.openapi(getBalanceRoute, async (c) => {
	const { userId } = c.req.valid("param");
	const { sessionId } = c.req.valid("query");

	const isValid = await verifyThundrSignature(c, userId);
	if (!isValid) {
		return c.json(
			ThundrTransactionErrorResponseSchema.parse({
				errors: [{ code: "INVALID_SIGNATURE", isClientSafe: true }],
			}),
			403,
		);
	}

	const db = drizzle(c.env.DB, { schema });

	const session = await db.query.thundrSessions.findFirst({
		where: eq(schema.thundrSessions.sessionId, sessionId),
	});

	if (!session) {
		return c.json(
			ThundrSessionErrorResponseSchema.parse({
				errors: [{ code: "SESSION_EXPIRED", isClientSafe: true }],
			}),
			403,
		);
	}

	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, userId))
		.limit(1);

	return c.json(
		ThundrBalanceResponseSchema.parse({
			balance: wallet?.balance ?? 0,
		}),
		200,
	);
});

export default thundrRoute;
