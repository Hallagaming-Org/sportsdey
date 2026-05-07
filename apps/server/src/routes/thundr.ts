import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { Context } from "hono";
import * as schema from "@/db/schema";
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
				launchUrl,
				// sessionId,
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

	const existingTx = await db.query.thundrTransactions.findFirst({
		where: eq(schema.thundrTransactions.transactionId, tx.transactionId),
	});

	if (existingTx) {
		return c.json(
			ThundrTransactionResponseSchema.parse({
				transactionId: existingTx.transactionId,
				userId: existingTx.userId,
				currency: "NGN",
				amount: existingTx.amount * 100,
				type: existingTx.type as "BET" | "WIN" | "LOSE" | "DRAW" | "ROLLBACK",
			}),
			200,
		);
	}

	const operatorTxId = `thndr_tx_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, session.userId))
		.limit(1);

	const currentBalanceKobo = wallet?.balance ?? 0;
	let newBalanceKobo = currentBalanceKobo;
	let txAmountKobo = 0;

	if (tx.type === "BET") {
		if (currentBalanceKobo < tx.amount) {
			return c.json(
				ThundrInsufficientBalanceErrorSchema.parse({
					errors: [{ code: "INSUFFICIENT_BALANCE", isClientSafe: true }],
				}),
				403,
			);
		}
		txAmountKobo = tx.amount;
		newBalanceKobo = currentBalanceKobo - txAmountKobo;
		await db
			.update(schema.wallet)
			.set({ balance: newBalanceKobo })
			.where(eq(schema.wallet.userId, session.userId));
	} else if (tx.type === "WIN" || tx.type === "DRAW") {
		txAmountKobo = tx.amount;
		newBalanceKobo = currentBalanceKobo + txAmountKobo;
		await db
			.update(schema.wallet)
			.set({ balance: newBalanceKobo })
			.where(eq(schema.wallet.userId, session.userId));
	} else if (tx.type === "ROLLBACK") {
		const [originalTx] = await db
			.select()
			.from(schema.thundrTransactions)
			.where(
				eq(schema.thundrTransactions.transactionId, tx.originalTransactionId),
			)
			.limit(1);

		if (originalTx && originalTx.type === "BET") {
			txAmountKobo = Math.round(originalTx.amount * 100);
			newBalanceKobo = currentBalanceKobo + txAmountKobo;
			await db
				.update(schema.wallet)
				.set({ balance: newBalanceKobo })
				.where(eq(schema.wallet.userId, session.userId));
		}
	}

	const [thundrTxn] = await db
		.insert(schema.thundrTransactions)
		.values({
			id: operatorTxId,
			transactionId: tx.transactionId,
			userId: session.userId,
			type: tx.type,
			amount: txAmountKobo / 100,
			roundId: tx.roundId,
			gameId: tx.gameId,
			sessionId: tx.sessionId,
			originalTransactionId:
				tx.type === "ROLLBACK" ? tx.originalTransactionId : null,
		})
		.returning();

	if (!thundrTxn?.id) {
		return c.json({ success: false, error: "Failed to record transaction" }, 500);
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
