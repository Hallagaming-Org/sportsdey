import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import {
	BetPlaceRequestSchema,
	BetSettleRequestSchema,
	BetUnsettleRequestSchema,
	CashOutAcceptedRequestSchema,
	CashOutDeclinedRequestSchema,
	BetErrorResponseSchema,
	CreateSportsbookTokenResponseSchema,
	SportsbookTokenErrorSchema,
} from "@/schemas/sportsbook";
import type { CloudflareBindings } from "../types";

const sportsbookRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const createTokenRoute = createRoute({
	method: "post",
	path: "/token/create",
	tags: ["Sportsbook"],
	summary: "Create sportsbook token",
	description:
		"Create a betting session token for the Data.Bet sportsbook API. Requires authentication.",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Token created successfully",
			content: {
				"application/json": {
					schema: z.object({
						success: z.literal(true),
						data: CreateSportsbookTokenResponseSchema,
					}),
				},
			},
		},
		400: {
			description: "Invalid request",
			content: {
				"application/json": {
					schema: SportsbookTokenErrorSchema,
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: SportsbookTokenErrorSchema,
				},
			},
		},
		500: {
			description: "Internal server error",
			content: {
				"application/json": {
					schema: SportsbookTokenErrorSchema,
				},
			},
		},
	},
});

sportsbookRoute.openapi(createTokenRoute, async (c) => {
	const user = c.get("user");
	const session = c.get("session");
	if (!user || !session) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
				details: null,
			},
			401,
		);
	}

	const bettingHost = c.env.BETTING_API_HOST;

	if (!bettingHost) {
		return c.json(
			{
				success: false as const,
				error: "Betting API host not configured",
				details: null,
			},
			500,
		);
	}

	const requestBody = {
		locale: "en",
		currency: "NGN",
		params: { session_id: session.id },
	};

	try {
		const response = await c.env.DATABET_CERT.fetch(
			`https://${bettingHost}/token/create`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(requestBody),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			console.error("Data.Bet API error:", response.status, errorText);
			return c.json(
				{
					success: false as const,
					error: `Betting API error: ${response.status}`,
					details: errorText,
				},
				500,
			);
		}

		const data = (await response.json()) as { token: string };

		if (!data.token) {
			return c.json(
				{
					success: false as const,
					error: "Invalid response from betting API",
					details: null,
				},
				500,
			);
		}

		return c.json(
			{
				success: true as const,
				data: {
					token: data.token,
				},
			},
			200,
		);
	} catch (error) {
		console.error("Sportsbook token creation error:", error);
		return c.json(
			{
				success: false as const,
				error:
					error instanceof Error
						? error.message
						: "Failed to create sportsbook token",
				details: null,
			},
			500,
		);
	}
});

const heartbeatRoute = createRoute({
	method: "post",
	path: "/heartbeat",
	tags: ["Sportsbook"],
	summary: "Heartbeat callback",
	description:
		"Called periodically by Data.Bet to verify session is still valid. No authentication required.",
	responses: {
		204: {
			description: "Session is valid",
		},
		404: {
			description: "Session not found or expired",
		},
		500: {
			description: "Internal server error",
			content: {
				"application/json": {
					schema: SportsbookTokenErrorSchema,
				},
			},
		},
	},
});

sportsbookRoute.openapi(heartbeatRoute, async (c) => {
	const foreignParamsHeader = c.req.header("Foreign-Params");

	if (!foreignParamsHeader) {
		return c.json(
			{
				success: false as const,
				error: "Missing Foreign-Params header",
				details: null,
			},
			400,
		);
	}

	let foreignParams: { session_id: string; [key: string]: unknown };
	try {
		foreignParams = JSON.parse(foreignParamsHeader);
	} catch {
		return c.json(
			{
				success: false as const,
				error: "Invalid Foreign-Params JSON",
				details: null,
			},
			400,
		);
	}

	const { session_id } = foreignParams;

	if (!session_id) {
		return c.json(
			{
				success: false as const,
				error: "Missing session_id in Foreign-Params",
				details: null,
			},
			400,
		);
	}

	const db = drizzle(c.env.DB, { schema });

	const now = new Date();

	const session = await db.query.session.findFirst({
		where: eq(schema.session.id, session_id),
	});

	if (!session) {
		return c.body(null, 404);
	}

	if (session.expiresAt && session.expiresAt.getTime() < now.getTime()) {
		return c.body(null, 404);
	}

	return c.body(null, 204);
});

const betPlaceRoute = createRoute({
	method: "post",
	path: "/bet/place",
	tags: ["Sportsbook"],
	summary: "Place bet callback",
	description:
		"Called by Data.Bet when a player places a bet. Reserves/freezes the stake amount on the user's wallet.",
	responses: {
		204: {
			description: "Bet placed successfully",
		},
		400: {
			description: "Error placing bet",
			content: {
				"application/json": {
					schema: BetErrorResponseSchema,
				},
			},
		},
	},
});

sportsbookRoute.openapi(betPlaceRoute, async (c) => {
	const foreignParamsHeader = c.req.header("Foreign-Params");

	if (!foreignParamsHeader) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "missing_foreign_params",
					},
				},
			},
			400,
		);
	}

	let foreignParams: { session_id: string; [key: string]: unknown };
	try {
		foreignParams = JSON.parse(foreignParamsHeader);
	} catch {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "invalid_foreign_params",
					},
				},
			},
			400,
		);
	}

	const { session_id } = foreignParams;

	if (!session_id) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "missing_session_id",
					},
				},
			},
			400,
		);
	}

	const result = BetPlaceRequestSchema.safeParse(await c.req.json());
	if (!result.success) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "invalid_request_body",
						issues: result.error.issues,
					},
				},
			},
			400,
		);
	}

	const db = drizzle(c.env.DB, { schema });

	const existingBet = await db.query.sportsbookBet.findFirst({
		where: eq(schema.sportsbookBet.requestId, result.data.request_id),
	});

	if (existingBet) {
		return c.body(null, 204);
	}

	const session = await db.query.session.findFirst({
		where: eq(schema.session.id, session_id as string),
	});

	if (!session) {
		return c.json(
			{
				error: {
					code: "auth_session_unknown",
					data: {},
				},
			},
			400,
		);
	}

	if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
		return c.json(
			{
				error: {
					code: "auth_credentials_expired",
					data: {},
				},
			},
			400,
		);
	}

	const wallet = await db.query.wallet.findFirst({
		where: eq(schema.wallet.userId, session.userId),
	});

	if (!wallet) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "wallet_not_found",
					},
				},
			},
			400,
		);
	}

	const stakeKobo = Math.round(parseFloat(result.data.bet_stake) * 100);
	const availableBalance = wallet.balance - wallet.frozenBalance;

	if (availableBalance < stakeKobo) {
		return c.json(
			{
				error: {
					code: "not_enough_balance",
					data: {
						actual_balance: (availableBalance / 100).toString(),
					},
				},
			},
			400,
		);
	}

	try {
		await db.transaction(async (tx) => {
			await tx
				.update(schema.wallet)
				.set({ frozenBalance: wallet.frozenBalance + stakeKobo })
				.where(eq(schema.wallet.userId, session.userId));

			const now = new Date();
			await tx.insert(schema.sportsbookBet).values({
				id: result.data.bet_id,
				requestId: result.data.request_id,
				userId: session.userId,
				stake: stakeKobo,
				totalOdds: result.data.total_odds_value ?? null,
				betType: result.data.bet_type ?? null,
				status: "place",
				betData: JSON.stringify(result.data),
				createdAt: now,
				updatedAt: now,
			});
		});
	} catch (error) {
		console.error("Bet place transaction error:", error);
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "transaction_failed",
						message: error instanceof Error ? error.message : "Unknown error",
					},
				},
			},
			400,
		);
	}

	return c.body(null, 204);
});

const betAcceptRoute = createRoute({
	method: "post",
	path: "/bet/accept",
	tags: ["Sportsbook"],
	summary: "Accept bet callback",
	description:
		"Called by Data.Bet to confirm a bet has been accepted. No wallet changes needed as funds were already frozen in /bet/place.",
	responses: {
		204: {
			description: "Bet accepted successfully",
		},
		400: {
			description: "Error accepting bet",
			content: {
				"application/json": {
					schema: BetErrorResponseSchema,
				},
			},
		},
	},
});

sportsbookRoute.openapi(betAcceptRoute, async (c) => {
	const foreignParamsHeader = c.req.header("Foreign-Params");

	if (!foreignParamsHeader) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "missing_foreign_params",
					},
				},
			},
			400,
		);
	}

	let foreignParams: { session_id: string; [key: string]: unknown };
	try {
		foreignParams = JSON.parse(foreignParamsHeader);
	} catch {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "invalid_foreign_params",
					},
				},
			},
			400,
		);
	}

	const { session_id } = foreignParams;

	if (!session_id) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "missing_session_id",
					},
				},
			},
			400,
		);
	}

	const result = BetPlaceRequestSchema.safeParse(await c.req.json());
	if (!result.success) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "invalid_request_body",
						issues: result.error.issues,
					},
				},
			},
			400,
		);
	}

	const db = drizzle(c.env.DB, { schema });

	const existingBet = await db.query.sportsbookBet.findFirst({
		where: eq(schema.sportsbookBet.requestId, result.data.request_id),
	});

	if (existingBet) {
		if (existingBet.status === "accept") {
			return c.body(null, 204);
		}
	}

	const session = await db.query.session.findFirst({
		where: eq(schema.session.id, session_id as string),
	});

	if (!session) {
		return c.json(
			{
				error: {
					code: "auth_session_unknown",
					data: {},
				},
			},
			400,
		);
	}

	if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
		return c.json(
			{
				error: {
					code: "auth_credentials_expired",
					data: {},
				},
			},
			400,
		);
	}

	const bet = await db.query.sportsbookBet.findFirst({
		where: eq(schema.sportsbookBet.id, result.data.bet_id),
	});

	if (!bet) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "bet_not_found",
					},
				},
			},
			400,
		);
	}

	if (bet.status !== "place") {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "bet_not_in_place_status",
						current_status: bet.status,
					},
				},
			},
			400,
		);
	}

	try {
		await db.transaction(async (tx) => {
			const wallet = await tx.query.wallet.findFirst({
				where: eq(schema.wallet.userId, bet.userId),
			});

			if (!wallet) {
				throw new Error("Wallet not found");
			}

			const newBalance = wallet.balance - bet.stake;
			const newFrozenBalance = wallet.frozenBalance - bet.stake;

			await tx
				.update(schema.wallet)
				.set({
					balance: newBalance,
					frozenBalance: newFrozenBalance,
				})
				.where(eq(schema.wallet.userId, bet.userId));

			await tx
				.update(schema.sportsbookBet)
				.set({
					status: "accept",
					betData: JSON.stringify(result.data),
					updatedAt: new Date(),
				})
				.where(eq(schema.sportsbookBet.id, result.data.bet_id));
		});
	} catch (error) {
		console.error("Bet accept transaction error:", error);
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "transaction_failed",
						message: error instanceof Error ? error.message : "Unknown error",
					},
				},
			},
			400,
		);
	}

	return c.body(null, 204);
});

const betDeclineRoute = createRoute({
	method: "post",
	path: "/bet/decline",
	tags: ["Sportsbook"],
	summary: "Decline bet callback",
	description:
		"Called by Data.Bet to decline a bet. Releases the reserved/frozen funds back to the player's balance.",
	responses: {
		204: {
			description: "Bet declined successfully",
		},
		400: {
			description: "Error declining bet",
			content: {
				"application/json": {
					schema: BetErrorResponseSchema,
				},
			},
		},
	},
});

const BetDeclineRequestSchema = z.object({
	request_id: z.string(),
	bet_id: z.string(),
	bet_player_id: z.string().optional(),
	restrictions: z.array(z.any()).optional(),
});

sportsbookRoute.openapi(betDeclineRoute, async (c) => {
	const foreignParamsHeader = c.req.header("Foreign-Params");

	if (!foreignParamsHeader) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "missing_foreign_params",
					},
				},
			},
			400,
		);
	}

	let foreignParams: { session_id: string; [key: string]: unknown };
	try {
		foreignParams = JSON.parse(foreignParamsHeader);
	} catch {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "invalid_foreign_params",
					},
				},
			},
			400,
		);
	}

	const { session_id } = foreignParams;

	if (!session_id) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "missing_session_id",
					},
				},
			},
			400,
		);
	}

	const result = BetDeclineRequestSchema.safeParse(await c.req.json());
	if (!result.success) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "invalid_request_body",
						issues: result.error.issues,
					},
				},
			},
			400,
		);
	}

	const db = drizzle(c.env.DB, { schema });

	const existingBet = await db.query.sportsbookBet.findFirst({
		where: eq(schema.sportsbookBet.requestId, result.data.request_id),
	});

	if (existingBet && existingBet.status === "decline") {
		return c.body(null, 204);
	}

	const session = await db.query.session.findFirst({
		where: eq(schema.session.id, session_id as string),
	});

	if (!session) {
		return c.json(
			{
				error: {
					code: "auth_session_unknown",
					data: {},
				},
			},
			400,
		);
	}

	if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
		return c.json(
			{
				error: {
					code: "auth_credentials_expired",
					data: {},
				},
			},
			400,
		);
	}

	const bet = await db.query.sportsbookBet.findFirst({
		where: eq(schema.sportsbookBet.id, result.data.bet_id),
	});

	if (!bet) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "bet_not_found",
					},
				},
			},
			400,
		);
	}

	try {
		await db.transaction(async (tx) => {
			const wallet = await tx.query.wallet.findFirst({
				where: eq(schema.wallet.userId, bet.userId),
			});

			if (wallet) {
				if (bet.status === "place") {
					await tx
						.update(schema.wallet)
						.set({
							frozenBalance: wallet.frozenBalance - bet.stake,
						})
						.where(eq(schema.wallet.userId, bet.userId));
				} else if (bet.status === "accept") {
					await tx
						.update(schema.wallet)
						.set({
							balance: wallet.balance + bet.stake,
						})
						.where(eq(schema.wallet.userId, bet.userId));
				}
			}

			await tx
				.update(schema.sportsbookBet)
				.set({
					status: "decline",
					betData: JSON.stringify(result.data),
					updatedAt: new Date(),
				})
				.where(eq(schema.sportsbookBet.id, result.data.bet_id));
		});
	} catch (error) {
		console.error("Bet decline transaction error:", error);
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "transaction_failed",
						message: error instanceof Error ? error.message : "Unknown error",
					},
				},
			},
			400,
		);
	}

	return c.body(null, 204);
});

const betSettleRoute = createRoute({
	method: "post",
	path: "/bet/settle",
	tags: ["Sportsbook"],
	summary: "Settle bet callback",
	description:
		"Called by Data.Bet to settle a bet. Pays out winnings or keeps stake based on settle_type.",
	responses: {
		204: {
			description: "Bet settled successfully",
		},
		400: {
			description: "Error settling bet",
			content: {
				"application/json": {
					schema: BetErrorResponseSchema,
				},
			},
		},
	},
});

sportsbookRoute.openapi(betSettleRoute, async (c) => {
	const foreignParamsHeader = c.req.header("Foreign-Params");

	if (!foreignParamsHeader) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "missing_foreign_params",
					},
				},
			},
			400,
		);
	}

	let foreignParams: { session_id: string; [key: string]: unknown };
	try {
		foreignParams = JSON.parse(foreignParamsHeader);
	} catch {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "invalid_foreign_params",
					},
				},
			},
			400,
		);
	}

	const { session_id } = foreignParams;

	if (!session_id) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "missing_session_id",
					},
				},
			},
			400,
		);
	}

	const result = BetSettleRequestSchema.safeParse(await c.req.json());
	if (!result.success) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "invalid_request_body",
						issues: result.error.issues,
					},
				},
			},
			400,
		);
	}

	const db = drizzle(c.env.DB, { schema });

	const existingBet = await db.query.sportsbookBet.findFirst({
		where: eq(schema.sportsbookBet.requestId, result.data.request_id),
	});

	if (existingBet && existingBet.status === "settle") {
		return c.body(null, 204);
	}

	const session = await db.query.session.findFirst({
		where: eq(schema.session.id, session_id as string),
	});

	if (!session) {
		return c.json(
			{
				error: {
					code: "auth_session_unknown",
					data: {},
				},
			},
			400,
		);
	}

	if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
		return c.json(
			{
				error: {
					code: "auth_credentials_expired",
					data: {},
				},
			},
			400,
		);
	}

	const bet = await db.query.sportsbookBet.findFirst({
		where: eq(schema.sportsbookBet.id, result.data.bet_id),
	});

	if (!bet) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "bet_not_found",
					},
				},
			},
			400,
		);
	}

	if (bet.status !== "accept") {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "bet_not_accepted",
						current_status: bet.status,
					},
				},
			},
			400,
		);
	}

	const settleAmount = Math.round(parseFloat(result.data.settle_amount) * 100);
	const settleType = result.data.settle_type;

	try {
		await db.transaction(async (tx) => {
			const wallet = await tx.query.wallet.findFirst({
				where: eq(schema.wallet.userId, bet.userId),
			});

			if (wallet) {
				await tx
					.update(schema.wallet)
					.set({
						balance: wallet.balance + settleAmount,
					})
					.where(eq(schema.wallet.userId, bet.userId));
			}

			const newStatus = settleType === 2 ? "rolled_back" : "settle";

			await tx
				.update(schema.sportsbookBet)
				.set({
					status: newStatus,
					settleAmount: settleAmount,
					settleType: settleType,
					betData: JSON.stringify(result.data),
					updatedAt: new Date(),
				})
				.where(eq(schema.sportsbookBet.id, result.data.bet_id));
		});
	} catch (error) {
		console.error("Bet settle transaction error:", error);
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "transaction_failed",
						message: error instanceof Error ? error.message : "Unknown error",
					},
				},
			},
			400,
		);
	}

	return c.body(null, 204);
});

const betUnsettleRoute = createRoute({
	method: "post",
	path: "/bet/unsettle",
	tags: ["Sportsbook"],
	summary: "Unsettle bet callback",
	description:
		"Called by Data.Bet to cancel a bet settlement and recalculate. Reverses the settlement.",
	responses: {
		204: {
			description: "Bet unsettled successfully",
		},
		400: {
			description: "Error unsettle bet",
			content: {
				"application/json": {
					schema: BetErrorResponseSchema,
				},
			},
		},
	},
});

sportsbookRoute.openapi(betUnsettleRoute, async (c) => {
	const foreignParamsHeader = c.req.header("Foreign-Params");

	if (!foreignParamsHeader) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "missing_foreign_params",
					},
				},
			},
			400,
		);
	}

	let foreignParams: { session_id: string; [key: string]: unknown };
	try {
		foreignParams = JSON.parse(foreignParamsHeader);
	} catch {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "invalid_foreign_params",
					},
				},
			},
			400,
		);
	}

	const { session_id } = foreignParams;

	if (!session_id) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "missing_session_id",
					},
				},
			},
			400,
		);
	}

	const result = BetUnsettleRequestSchema.safeParse(await c.req.json());
	if (!result.success) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "invalid_request_body",
						issues: result.error.issues,
					},
				},
			},
			400,
		);
	}

	const db = drizzle(c.env.DB, { schema });

	const session = await db.query.session.findFirst({
		where: eq(schema.session.id, session_id as string),
	});

	if (!session) {
		return c.json(
			{
				error: {
					code: "auth_session_unknown",
					data: {},
				},
			},
			400,
		);
	}

	if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
		return c.json(
			{
				error: {
					code: "auth_credentials_expired",
					data: {},
				},
			},
			400,
		);
	}

	const bet = await db.query.sportsbookBet.findFirst({
		where: eq(schema.sportsbookBet.id, result.data.bet_id),
	});

	if (!bet) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "bet_not_found",
					},
				},
			},
			400,
		);
	}

	if (bet.status !== "settle" && bet.status !== "rolled_back") {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "bet_not_settled",
						current_status: bet.status,
					},
				},
			},
			400,
		);
	}

	const unsettleAmount = result.data.unsettle_amount
		? Math.round(parseFloat(result.data.unsettle_amount) * 100)
		: bet.settleAmount || 0;

	try {
		await db.transaction(async (tx) => {
			const wallet = await tx.query.wallet.findFirst({
				where: eq(schema.wallet.userId, bet.userId),
			});

			if (wallet) {
				await tx
					.update(schema.wallet)
					.set({
						balance: wallet.balance - unsettleAmount,
					})
					.where(eq(schema.wallet.userId, bet.userId));
			}

			await tx
				.update(schema.sportsbookBet)
				.set({
					status: "accept",
					settleAmount: null,
					settleType: null,
					updatedAt: new Date(),
				})
				.where(eq(schema.sportsbookBet.id, result.data.bet_id));
		});
	} catch (error) {
		console.error("Bet unsettle transaction error:", error);
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "transaction_failed",
						message: error instanceof Error ? error.message : "Unknown error",
					},
				},
			},
			400,
		);
	}

	return c.body(null, 204);
});

const cashOutAcceptedRoute = createRoute({
	method: "post",
	path: "/bet/cash-out-orders/accepted",
	tags: ["Sportsbook"],
	summary: "Cash out accepted callback",
	description:
		"Called by Data.Bet when a cash out request is accepted. Credits the player's balance with the refund amount.",
	responses: {
		204: {
			description: "Cash out accepted successfully",
		},
		400: {
			description: "Error processing cash out",
			content: {
				"application/json": {
					schema: BetErrorResponseSchema,
				},
			},
		},
	},
});

sportsbookRoute.openapi(cashOutAcceptedRoute, async (c) => {
	const foreignParamsHeader = c.req.header("Foreign-Params");

	if (!foreignParamsHeader) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "missing_foreign_params",
					},
				},
			},
			400,
		);
	}

	let foreignParams: { session_id: string; [key: string]: unknown };
	try {
		foreignParams = JSON.parse(foreignParamsHeader);
	} catch {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "invalid_foreign_params",
					},
				},
			},
			400,
		);
	}

	const { session_id } = foreignParams;

	if (!session_id) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "missing_session_id",
					},
				},
			},
			400,
		);
	}

	const result = CashOutAcceptedRequestSchema.safeParse(await c.req.json());
	if (!result.success) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "invalid_request_body",
						issues: result.error.issues,
					},
				},
			},
			400,
		);
	}

	const db = drizzle(c.env.DB, { schema });

	const existingBet = await db.query.sportsbookBet.findFirst({
		where: eq(schema.sportsbookBet.requestId, result.data.request_id),
	});

	if (existingBet && existingBet.status === "cash_out_accepted") {
		return c.body(null, 204);
	}

	const session = await db.query.session.findFirst({
		where: eq(schema.session.id, session_id as string),
	});

	if (!session) {
		return c.json(
			{
				error: {
					code: "auth_session_unknown",
					data: {},
				},
			},
			400,
		);
	}

	if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
		return c.json(
			{
				error: {
					code: "auth_credentials_expired",
					data: {},
				},
			},
			400,
		);
	}

	const bet = await db.query.sportsbookBet.findFirst({
		where: eq(schema.sportsbookBet.id, result.data.bet_id),
	});

	if (!bet) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "bet_not_found",
					},
				},
			},
			400,
		);
	}

	const refundAmountKobo = Math.round(parseFloat(result.data.refund_amount) * 100);

	try {
		await db.transaction(async (tx) => {
			const wallet = await tx.query.wallet.findFirst({
				where: eq(schema.wallet.userId, bet.userId),
			});

			if (wallet) {
				await tx
					.update(schema.wallet)
					.set({
						balance: wallet.balance + refundAmountKobo,
					})
					.where(eq(schema.wallet.userId, bet.userId));
			}

			const existingOrderIds = bet.cashOutOrderIds
				? JSON.parse(bet.cashOutOrderIds)
				: [];
			const newOrderIds = [...existingOrderIds, result.data.cash_out_order_id];

			await tx
				.update(schema.sportsbookBet)
				.set({
					cashOutOrderIds: JSON.stringify(newOrderIds),
					betData: JSON.stringify(result.data),
					updatedAt: new Date(),
				})
				.where(eq(schema.sportsbookBet.id, result.data.bet_id));
		});
	} catch (error) {
		console.error("Cash out accepted transaction error:", error);
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "transaction_failed",
						message: error instanceof Error ? error.message : "Unknown error",
					},
				},
			},
			400,
		);
	}

	return c.body(null, 204);
});

const cashOutDeclinedRoute = createRoute({
	method: "post",
	path: "/bet/cash-out-orders/declined",
	tags: ["Sportsbook"],
	summary: "Cash out declined callback",
	description:
		"Called by Data.Bet when a cash out request is declined. Withdraws the reserved refund amount from the player's balance.",
	responses: {
		204: {
			description: "Cash out declined successfully",
		},
		400: {
			description: "Error processing cash out decline",
			content: {
				"application/json": {
					schema: BetErrorResponseSchema,
				},
			},
		},
	},
});

sportsbookRoute.openapi(cashOutDeclinedRoute, async (c) => {
	const foreignParamsHeader = c.req.header("Foreign-Params");

	if (!foreignParamsHeader) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "missing_foreign_params",
					},
				},
			},
			400,
		);
	}

	let foreignParams: { session_id: string; [key: string]: unknown };
	try {
		foreignParams = JSON.parse(foreignParamsHeader);
	} catch {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "invalid_foreign_params",
					},
				},
			},
			400,
		);
	}

	const { session_id } = foreignParams;

	if (!session_id) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "missing_session_id",
					},
				},
			},
			400,
		);
	}

	const result = CashOutDeclinedRequestSchema.safeParse(await c.req.json());
	if (!result.success) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "invalid_request_body",
						issues: result.error.issues,
					},
				},
			},
			400,
		);
	}

	const db = drizzle(c.env.DB, { schema });

	const existingBet = await db.query.sportsbookBet.findFirst({
		where: eq(schema.sportsbookBet.requestId, result.data.request_id),
	});

	if (existingBet && existingBet.status === "cash_out_declined") {
		return c.body(null, 204);
	}

	const session = await db.query.session.findFirst({
		where: eq(schema.session.id, session_id as string),
	});

	if (!session) {
		return c.json(
			{
				error: {
					code: "auth_session_unknown",
					data: {},
				},
			},
			400,
		);
	}

	if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
		return c.json(
			{
				error: {
					code: "auth_credentials_expired",
					data: {},
				},
			},
			400,
		);
	}

	const bet = await db.query.sportsbookBet.findFirst({
		where: eq(schema.sportsbookBet.id, result.data.bet_id),
	});

	if (!bet) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "bet_not_found",
					},
				},
			},
			400,
		);
	}

	const refundAmountKobo = bet.settleAmount || 0;

	try {
		await db.transaction(async (tx) => {
			const wallet = await tx.query.wallet.findFirst({
				where: eq(schema.wallet.userId, bet.userId),
			});

			if (wallet && refundAmountKobo > 0) {
				await tx
					.update(schema.wallet)
					.set({
						balance: wallet.balance - refundAmountKobo,
					})
					.where(eq(schema.wallet.userId, bet.userId));
			}

			const existingOrderIds = bet.cashOutOrderIds
				? JSON.parse(bet.cashOutOrderIds)
				: [];
			const newOrderIds = [...existingOrderIds, ...result.data.cash_out_order_ids];

			await tx
				.update(schema.sportsbookBet)
				.set({
					cashOutOrderIds: JSON.stringify(newOrderIds),
					betData: JSON.stringify(result.data),
					updatedAt: new Date(),
				})
				.where(eq(schema.sportsbookBet.id, result.data.bet_id));
		});
	} catch (error) {
		console.error("Cash out declined transaction error:", error);
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "transaction_failed",
						message: error instanceof Error ? error.message : "Unknown error",
					},
				},
			},
			400,
		);
	}

	return c.body(null, 204);
});

export default sportsbookRoute;
