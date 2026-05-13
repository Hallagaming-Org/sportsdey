import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import * as schema from "@/db/schema";
import {
	BetBoostCreateResponseSchema,
	BetBoostCreateSchema,
	BetBoostGetResponseSchema,
	BetBoostGetSchema,
	BetBoostListQuerySchema,
	BetBoostListResponseSchema,
	BetBoostUpdateResponseSchema,
	BetBoostUpdateSchema,
	BetErrorResponseSchema,
	BetPlaceRequestSchema,
	BetSettleRequestSchema,
	BetUnsettleRequestSchema,
	CashOutAcceptedRequestSchema,
	CashOutDeclinedRequestSchema,
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

	const existingRequest = await db.query.sportsbookBet.findFirst({
		where: eq(schema.sportsbookBet.requestId, result.data.request_id),
	});

	if (existingRequest) {
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

	const isFreebet = !!result.data.bet_freebet_id;
	const stakeKobo = Math.round(parseFloat(result.data.bet_stake) * 100);

	if (!isFreebet) {
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
	}

	try {
		const now = new Date();
		await db.transaction(async (tx) => {
			if (!isFreebet) {
				await tx
					.update(schema.wallet)
					.set({ frozenBalance: wallet.frozenBalance + stakeKobo })
					.where(eq(schema.wallet.userId, session.userId));
			}

			await tx.insert(schema.sportsbookBet).values({
				id: result.data.bet_id,
				requestId: result.data.request_id,
				userId: session.userId,
				stake: stakeKobo,
				totalOdds: result.data.total_odds_value ?? null,
				betType: result.data.bet_type ?? null,
				betFreebetId: result.data.bet_freebet_id ?? null,
				betBoostId: result.data.bet_boost_id ?? null,
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

	const existingRequest = await db.query.sportsbookBet.findFirst({
		where: eq(schema.sportsbookBet.requestId, result.data.request_id),
	});

	if (existingRequest) {
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

			if (!bet.betFreebetId) {
				const newBalance = wallet.balance - bet.stake;
				const newFrozenBalance = wallet.frozenBalance - bet.stake;

				await tx
					.update(schema.wallet)
					.set({
						balance: newBalance,
						frozenBalance: newFrozenBalance,
					})
					.where(eq(schema.wallet.userId, bet.userId));
			}

			await tx
				.update(schema.sportsbookBet)
				.set({
					status: "accept",
					betData: JSON.stringify(result.data),
					updatedAt: new Date(),
				})
				.where(eq(schema.sportsbookBet.id, result.data.bet_id));

			const now = new Date();
			await tx.insert(schema.sportsbookBet).values({
				id: result.data.bet_id,
				requestId: result.data.request_id,
				userId: session.userId,
				stake: bet.stake,
				totalOdds: result.data.total_odds_value ?? null,
				betType: result.data.bet_type ?? null,
				betFreebetId: bet.betFreebetId ?? null,
				betBoostId: bet.betBoostId ?? null,
				status: "accept",
				betData: JSON.stringify(result.data),
				createdAt: now,
				updatedAt: now,
			});
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

	const existingRequest = await db.query.sportsbookBet.findFirst({
		where: eq(schema.sportsbookBet.requestId, result.data.request_id),
	});

	if (existingRequest) {
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

			if (wallet && !bet.betFreebetId) {
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

			const now = new Date();
			await tx.insert(schema.sportsbookBet).values({
				id: result.data.bet_id,
				requestId: result.data.request_id,
				userId: session.userId,
				stake: bet.stake,
				totalOdds: bet.totalOdds,
				betType: bet.betType,
				betFreebetId: bet.betFreebetId ?? null,
				betBoostId: bet.betBoostId ?? null,
				status: "decline",
				betData: JSON.stringify(result.data),
				createdAt: now,
				updatedAt: now,
			});
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

	const existingRequest = await db.query.sportsbookBet.findFirst({
		where: eq(schema.sportsbookBet.requestId, result.data.request_id),
	});

	if (existingRequest) {
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

			const isFreebetWin = bet.betFreebetId && settleType === 1;
			const shouldCredit = !bet.betFreebetId || isFreebetWin;

			if (wallet && shouldCredit) {
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

			const now = new Date();
			await tx.insert(schema.sportsbookBet).values({
				id: result.data.bet_id,
				requestId: result.data.request_id,
				userId: session.userId,
				stake: bet.stake,
				totalOdds: result.data.total_odds_value ?? bet.totalOdds,
				betType: bet.betType,
				betFreebetId: bet.betFreebetId ?? null,
				betBoostId: bet.betBoostId ?? null,
				status: settleType === 2 ? "rolled_back" : "settle",
				settleAmount: settleAmount,
				settleType: settleType,
				betData: JSON.stringify(result.data),
				createdAt: now,
				updatedAt: now,
			});
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

	const existingRequest = await db.query.sportsbookBet.findFirst({
		where: eq(schema.sportsbookBet.requestId, result.data.request_id),
	});

	if (existingRequest) {
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

			const now = new Date();
			await tx.insert(schema.sportsbookBet).values({
				id: result.data.bet_id,
				requestId: result.data.request_id,
				userId: session.userId,
				stake: bet.stake,
				totalOdds: bet.totalOdds,
				betType: bet.betType,
				betFreebetId: bet.betFreebetId ?? null,
				betBoostId: bet.betBoostId ?? null,
				status: "accept",
				betData: JSON.stringify(result.data),
				createdAt: now,
				updatedAt: now,
			});
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

	const existingRequest = await db.query.sportsbookBet.findFirst({
		where: eq(schema.sportsbookBet.requestId, result.data.request_id),
	});

	if (existingRequest) {
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

	const refundAmountKobo = Math.round(
		parseFloat(result.data.refund_amount) * 100,
	);

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

			const now = new Date();
			await tx.insert(schema.sportsbookBet).values({
				id: result.data.bet_id,
				requestId: result.data.request_id,
				userId: session.userId,
				stake: bet.stake,
				totalOdds: bet.totalOdds,
				betType: bet.betType,
				betFreebetId: bet.betFreebetId ?? null,
				betBoostId: bet.betBoostId ?? null,
				status: "cash_out_accepted",
				cashOutOrderIds: JSON.stringify([result.data.cash_out_order_id]),
				betData: JSON.stringify(result.data),
				createdAt: now,
				updatedAt: now,
			});
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

	const existingRequest = await db.query.sportsbookBet.findFirst({
		where: eq(schema.sportsbookBet.requestId, result.data.request_id),
	});

	if (existingRequest) {
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
			const newOrderIds = [
				...existingOrderIds,
				...result.data.cash_out_order_ids,
			];

			await tx
				.update(schema.sportsbookBet)
				.set({
					cashOutOrderIds: JSON.stringify(newOrderIds),
					betData: JSON.stringify(result.data),
					updatedAt: new Date(),
				})
				.where(eq(schema.sportsbookBet.id, result.data.bet_id));

			const now = new Date();
			await tx.insert(schema.sportsbookBet).values({
				id: result.data.bet_id,
				requestId: result.data.request_id,
				userId: session.userId,
				stake: bet.stake,
				totalOdds: bet.totalOdds,
				betType: bet.betType,
				betFreebetId: bet.betFreebetId ?? null,
				betBoostId: bet.betBoostId ?? null,
				status: "cash_out_declined",
				cashOutOrderIds: JSON.stringify(result.data.cash_out_order_ids),
				betData: JSON.stringify(result.data),
				createdAt: now,
				updatedAt: now,
			});
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

const freebetCreateRoute = createRoute({
	method: "post",
	path: "/freebet/create",
	tags: ["Sportsbook"],
	summary: "Create a freebet",
	description:
		"Create a freebet for a user via Data.Bet API and store locally. Requires authentication.",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({
						player_id: z.string(),
						amount: z.number(),
						currency: z.string(),
						expired_at: z.string(),
						conditions: z.array(z.any()).optional(),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: "Freebet created successfully",
			content: {
				"application/json": {
					schema: z.object({
						success: z.literal(true),
						data: z.object({
							id: z.string(),
							dataBetFreebetId: z.string(),
							amount: z.number(),
							currency: z.string(),
							expiredAt: z.string(),
						}),
					}),
				},
			},
		},
		400: {
			description: "Error creating freebet",
		},
		500: {
			description: "Internal server error",
		},
	},
});

sportsbookRoute.openapi(freebetCreateRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
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
			},
			500,
		);
	}

	const result = await c.req.json().catch(() => null);
	if (
		!result ||
		!result.player_id ||
		!result.amount ||
		!result.currency ||
		!result.expired_at
	) {
		return c.json(
			{
				success: false as const,
				error:
					"Missing required fields: player_id, amount, currency, expired_at",
			},
			400,
		);
	}

	const id = crypto.randomUUID();
	const amountKobo = Math.round(result.amount * 100);

	const apiRequestBody = {
		player_id: result.player_id,
		idempotency_id: id,
		amount: {
			amount: result.amount.toString(),
			currency_code: result.currency,
		},
		expires_at: result.expired_at,
		conditions: result.conditions || [],
	};

	try {
		const response = await c.env.DATABET_CERT.fetch(
			`https://${bettingHost}/freebet/create`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(apiRequestBody),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(
				"Data.Bet freebet create error:",
				response.status,
				errorText,
			);
			return c.json(
				{
					success: false as const,
					error: `Failed to create freebet: ${response.status}`,
					details: errorText,
				},
				400,
			);
		}

		const data = (await response.json()) as { freebet_id?: string };

		const createdFreebetId = data.freebet_id;

		return c.json(
			{
				success: true as const,
				data: {
					id: id,
					dataBetFreebetId: createdFreebetId,
					amount: result.amount,
					currency: result.currency,
					expiredAt: result.expired_at,
				},
			},
			200,
		);
	} catch (error) {
		console.error("Freebet create error:", error);
		return c.json(
			{
				success: false as const,
				error:
					error instanceof Error ? error.message : "Failed to create freebet",
			},
			500,
		);
	}
});

const freebetBulkCreateRoute = createRoute({
	method: "post",
	path: "/freebet/create/bulk",
	tags: ["Sportsbook"],
	summary: "Create multiple freebets",
	description:
		"Create multiple freebets for users via Data.Bet API and store locally. Requires authentication.",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({
						freebets: z.array(
							z.object({
								player_id: z.string(),
								amount: z.number(),
								currency: z.string(),
								expired_at: z.string(),
								conditions: z.array(z.any()).optional(),
							}),
						),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: "Freebets created successfully",
			content: {
				"application/json": {
					schema: z.object({
						success: z.literal(true),
						data: z.array(
							z.object({
								id: z.string(),
								dataBetFreebetId: z.string(),
								amount: z.number(),
								currency: z.string(),
								expiredAt: z.string(),
							}),
						),
					}),
				},
			},
		},
		400: {
			description: "Error creating freebets",
		},
		500: {
			description: "Internal server error",
		},
	},
});

sportsbookRoute.openapi(freebetBulkCreateRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
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
			},
			500,
		);
	}

	const result = await c.req.json().catch(() => null);
	if (!result || !result.freebets || !Array.isArray(result.freebets)) {
		return c.json(
			{
				success: false as const,
				error: "Missing required field: freebets array",
			},
			400,
		);
	}

	const freebetsData = result.freebets.map(
		(fb: {
			player_id: string;
			amount: number;
			currency: string;
			expired_at: string;
			conditions?: unknown[];
		}) => ({
			idempotency_id: crypto.randomUUID(),
			player_id: fb.player_id,
			amount: {
				amount: fb.amount.toString(),
				currency_code: fb.currency,
			},
			expires_at: fb.expired_at,
			conditions: fb.conditions || [],
		}),
	);

	try {
		const response = await c.env.DATABET_CERT.fetch(
			`https://${bettingHost}/freebet/create/bulk`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ freebets: freebetsData }),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(
				"Data.Bet freebet bulk create error:",
				response.status,
				errorText,
			);
			return c.json(
				{
					success: false as const,
					error: `Failed to create freebets: ${response.status}`,
					details: errorText,
				},
				400,
			);
		}

		const data = (await response.json()) as {
			freebet_ids: string[];
		};

		return c.json(
			{
				success: true as const,
				data: result.freebets.map(
					(
						fb: {
							amount: number;
							currency: string;
							expired_at: string;
						},
						index: number,
					) => ({
						id: freebetsData[index].id,
						dataBetFreebetId: data.freebet_ids[index],
						amount: fb.amount,
						currency: fb.currency,
						expiredAt: fb.expired_at,
					}),
				),
			},
			200,
		);
	} catch (error) {
		console.error("Freebet bulk create error:", error);
		return c.json(
			{
				success: false as const,
				error:
					error instanceof Error ? error.message : "Failed to create freebets",
			},
			500,
		);
	}
});

const freebetListRoute = createRoute({
	method: "get",
	path: "/freebet/list",
	tags: ["Sportsbook"],
	summary: "List user's freebets",
	description: "List all freebets for a user. Requires authentication.",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Freebets retrieved successfully",
			content: {
				"application/json": {
					schema: z.object({
						success: z.literal(true),
						data: z.array(
							z.object({
								id: z.string(),
								dataBetFreebetId: z.string(),
								amount: z.number(),
								currency: z.string(),
								expiredAt: z.string().nullable(),
								status: z.string(),
								used: z.boolean(),
								createdAt: z.string(),
							}),
						),
					}),
				},
			},
		},
		401: {
			description: "Unauthorized",
		},
	},
});

sportsbookRoute.openapi(freebetListRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
			},
			401,
		);
	}

	return c.json(
		{
			success: true as const,
			data: [],
		},
		200,
	);
});

const freebetGetRoute = createRoute({
	method: "get",
	path: "/freebet/{id}",
	tags: ["Sportsbook"],
	summary: "Get a freebet",
	description: "Get a specific freebet by ID. Requires authentication.",
	security: [{ BearerAuth: [] }],
	request: {
		params: z.object({
			id: z.string(),
		}),
	},
	responses: {
		200: {
			description: "Freebet retrieved successfully",
			content: {
				"application/json": {
					schema: z.object({
						success: z.literal(true),
						data: z.object({
							id: z.string(),
							dataBetFreebetId: z.string(),
							amount: z.number(),
							currency: z.string(),
							expiredAt: z.string().nullable(),
							conditions: z.any().nullable(),
							status: z.string(),
							used: z.boolean(),
							createdAt: z.string(),
						}),
					}),
				},
			},
		},
		401: {
			description: "Unauthorized",
		},
		404: {
			description: "Freebet not found",
		},
	},
});

sportsbookRoute.openapi(freebetGetRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
			},
			401,
		);
	}

	const { id } = c.req.param();

	return c.json(
		{
			success: false as const,
			error: "Freebet not found",
		},
		404,
	);
});

const freebetUpdateRoute = createRoute({
	method: "post",
	path: "/freebet/update",
	tags: ["Sportsbook"],
	summary: "Update a freebet",
	description:
		"Update a freebet's conditions or expiry via Data.Bet API. Requires authentication.",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({
						player_id: z.string(),
						freebet_id: z.string(),
						expired_at: z.string().optional(),
						conditions: z.array(z.any()).optional(),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: "Freebet updated successfully",
			content: {
				"application/json": {
					schema: z.object({
						success: z.literal(true),
						data: z.object({
							dataBetFreebetId: z.string(),
						}),
					}),
				},
			},
		},
		400: {
			description: "Error updating freebet",
		},
		500: {
			description: "Internal server error",
		},
	},
});

sportsbookRoute.openapi(freebetUpdateRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
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
			},
			500,
		);
	}

	const result = await c.req.json().catch(() => null);
	if (!result || !result.player_id || !result.freebet_id) {
		return c.json(
			{
				success: false as const,
				error: "Missing required fields: player_id, freebet_id",
			},
			400,
		);
	}

	const apiRequestBody: Record<string, unknown> = {
		player_id: result.player_id,
		freebet_id: result.freebet_id,
	};

	if (result.expired_at) {
		apiRequestBody.expired_at = result.expired_at;
	}

	if (result.conditions) {
		apiRequestBody.conditions = result.conditions;
	}

	try {
		const response = await c.env.DATABET_CERT.fetch(
			`https://${bettingHost}/freebet/update`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(apiRequestBody),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(
				"Data.Bet freebet update error:",
				response.status,
				errorText,
			);
			return c.json(
				{
					success: false as const,
					error: `Failed to update freebet: ${response.status}`,
					details: errorText,
				},
				400,
			);
		}

		return c.json(
			{
				success: true as const,
				data: {
					dataBetFreebetId: result.freebet_id,
				},
			},
			200,
		);
	} catch (error) {
		console.error("Freebet update error:", error);
		return c.json(
			{
				success: false as const,
				error:
					error instanceof Error ? error.message : "Failed to update freebet",
			},
			500,
		);
	}
});

const betBoostCreateRoute = createRoute({
	method: "post",
	path: "/bet-boost",
	tags: ["Sportsbook"],
	summary: "Create a bet boost",
	description:
		"Create a bet boost for a user via Data.Bet API and store locally. Requires authentication.",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: BetBoostCreateSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Bet boost created successfully",
			content: {
				"application/json": {
					schema: BetBoostCreateResponseSchema,
				},
			},
		},
		400: {
			description: "Error creating bet boost",
		},
		500: {
			description: "Internal server error",
		},
	},
});

sportsbookRoute.openapi(betBoostCreateRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
			},
			401,
		);
	}

	const session = await validateAdminSession(c.env, token);
	if (
		!session ||
		(session.role !== "admin" && session.role !== "super_admin")
	) {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - admin or super_admin only",
			},
			403,
		);
	}

	const bettingHost = c.env.BETTING_API_HOST;
	if (!bettingHost) {
		return c.json(
			{
				success: false as const,
				error: "Betting API host not configured",
			},
			500,
		);
	}

	const result = await c.req.json().catch(() => null);
	if (
		!result ||
		!result.player_id ||
		!result.currency_code ||
		!result.initial_quantity ||
		!result.applicable_conditions ||
		!result.required_conditions ||
		!result.expires_at
	) {
		return c.json(
			{
				success: false as const,
				error:
					"Missing required fields: player_id, currency_code, initial_quantity, applicable_conditions, required_conditions, expires_at",
			},
			400,
		);
	}

	const apiRequestBody: Record<string, unknown> = {
		idempotence_id: result.idempotence_id || crypto.randomUUID(),
		player_id: result.player_id,
		currency_code: result.currency_code,
		initial_quantity: result.initial_quantity,
		applicable_conditions: result.applicable_conditions,
		required_conditions: result.required_conditions,
		expires_at: result.expires_at,
	};

	if (result.calculation_strategy) {
		apiRequestBody.calculation_strategy = result.calculation_strategy;
	}

	try {
		const response = await c.env.DATABET_CERT.fetch(
			`https://${bettingHost}/bet-boosts`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(apiRequestBody),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(
				"Data.Bet bet-boost create error:",
				response.status,
				errorText,
			);
			return c.json(
				{
					success: false as const,
					error: `Failed to create bet boost: ${response.status}`,
					details: errorText,
				},
				400,
			);
		}

		const data = (await response.json()) as Array<{
			id: string;
			currency_code: string;
			calculation_strategy: unknown;
		}>;

		const createdBoost = data[0];
		if (!createdBoost) {
			return c.json(
				{
					success: false as const,
					error: "No boost created",
				},
				400,
			);
		}

		const idempotenceId = apiRequestBody.idempotence_id as string;

		return c.json(
			{
				success: true as const,
				data: {
					id: idempotenceId,
					dataBetBoostId: createdBoost.id,
				},
			},
			200,
		);
	} catch (error) {
		console.error("Bet boost create error:", error);
		return c.json(
			{
				success: false as const,
				error:
					error instanceof Error ? error.message : "Failed to create bet boost",
			},
			500,
		);
	}
});

const betBoostListRoute = createRoute({
	method: "get",
	path: "/bet-boost",
	tags: ["Sportsbook"],
	summary: "List user's bet boosts",
	description:
		"List bet boosts for a specific user. Requires admin or super_admin authentication.",
	security: [{ BearerAuth: [] }],
	request: {
		query: BetBoostListQuerySchema,
	},
	responses: {
		200: {
			description: "Bet boosts retrieved successfully",
			content: {
				"application/json": {
					schema: BetBoostListResponseSchema,
				},
			},
		},
		400: {
			description: "Error listing bet boosts",
		},
		401: {
			description: "Unauthorized",
		},
		403: {
			description: "Forbidden - admin or super_admin only",
		},
	},
});

sportsbookRoute.openapi(betBoostListRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
			},
			401,
		);
	}

	const session = await validateAdminSession(c.env, token);
	if (
		!session ||
		(session.role !== "admin" && session.role !== "super_admin")
	) {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - admin or super_admin only",
			},
			403,
		);
	}

	const bettingHost = c.env.BETTING_API_HOST;

	try {
		const response = await c.env.DATABET_CERT.fetch(
			`https://${bettingHost}/bet-boosts`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(
				"Data.Bet bet-boost list error:",
				response.status,
				errorText,
			);
			return c.json(
				{
					success: false as const,
					error: `Failed to list bet boosts: ${response.status}`,
				},
				400,
			);
		}

		const data = (await response.json()) as Array<{
			id: string;
			version: string;
			currency_code: string;
			player_id: string;
			initial_quantity: number;
			remaining_quantity: number;
			expires_at: string;
			created_at: string;
			updated_at: string;
			calculation_strategy?: object;
			applicable_conditions?: object[];
			required_conditions?: object[];
		}>;

		return c.json(
			{
				success: true as const,
				data: data.map((bb) => ({
					id: bb.id,
					version: bb.version,
					currencyCode: bb.currency_code,
					playerId: bb.player_id,
					initialQuantity: bb.initial_quantity,
					remainingQuantity: bb.remaining_quantity,
					expiresAt: bb.expires_at,
					createdAt: bb.created_at,
					updatedAt: bb.updated_at,
					calculationStrategy: bb.calculation_strategy
						? JSON.stringify(bb.calculation_strategy)
						: null,
					applicableConditions: bb.applicable_conditions
						? JSON.stringify(bb.applicable_conditions)
						: null,
					requiredConditions: bb.required_conditions
						? JSON.stringify(bb.required_conditions)
						: null,
				})),
			},
			200,
		);
	} catch (error) {
		console.error("Bet boost list error:", error);
		return c.json(
			{
				success: false as const,
				error:
					error instanceof Error ? error.message : "Failed to list bet boosts",
			},
			500,
		);
	}
});

const betBoostGetRoute = createRoute({
	method: "get",
	path: "/bet-boost/{id}",
	tags: ["Sportsbook"],
	summary: "Get a specific bet boost",
	description:
		"Get a specific bet boost by ID. Requires admin or super_admin authentication.",
	security: [{ BearerAuth: [] }],
	request: {
		params: BetBoostGetSchema,
	},
	responses: {
		200: {
			description: "Bet boost retrieved successfully",
			content: {
				"application/json": {
					schema: BetBoostGetResponseSchema,
				},
			},
		},
		400: {
			description: "Error retrieving bet boost",
		},
		401: {
			description: "Unauthorized",
		},
		403: {
			description: "Forbidden - admin or super_admin only",
		},
		404: {
			description: "Bet boost not found",
		},
	},
});

sportsbookRoute.openapi(betBoostGetRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
			},
			401,
		);
	}

	const session = await validateAdminSession(c.env, token);
	if (
		!session ||
		(session.role !== "admin" && session.role !== "super_admin")
	) {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - admin or super_admin only",
			},
			403,
		);
	}

	const { id } = c.req.valid("param");

	const bettingHost = c.env.BETTING_API_HOST;

	try {
		const response = await c.env.DATABET_CERT.fetch(
			`https://${bettingHost}/bet-boosts/${id}`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(
				"Data.Bet bet-boost get error:",
				response.status,
				errorText,
			);
			if (response.status === 404) {
				return c.json(
					{
						success: false as const,
						error: "Bet boost not found",
					},
					404,
				);
			}
			return c.json(
				{
					success: false as const,
					error: `Failed to get bet boost: ${response.status}`,
				},
				400,
			);
		}

		const data = (await response.json()) as {
			id: string;
			version: string;
			currency_code: string;
			player_id: string;
			initial_quantity: number;
			remaining_quantity: number;
			expires_at: string;
			created_at: string;
			updated_at: string;
			calculation_strategy?: object;
			applicable_conditions?: object[];
			required_conditions?: object[];
		};

		return c.json(
			{
				success: true as const,
				data: {
					id: data.id,
					version: data.version,
					currencyCode: data.currency_code,
					playerId: data.player_id,
					initialQuantity: data.initial_quantity,
					remainingQuantity: data.remaining_quantity,
					expiresAt: data.expires_at,
					createdAt: data.created_at,
					updatedAt: data.updated_at,
					calculationStrategy: data.calculation_strategy
						? JSON.stringify(data.calculation_strategy)
						: null,
					applicableConditions: data.applicable_conditions
						? JSON.stringify(data.applicable_conditions)
						: null,
					requiredConditions: data.required_conditions
						? JSON.stringify(data.required_conditions)
						: null,
				},
			},
			200,
		);
	} catch (error) {
		console.error("Bet boost get error:", error);
		return c.json(
			{
				success: false as const,
				error:
					error instanceof Error ? error.message : "Failed to get bet boost",
			},
			500,
		);
	}
});

const betBoostUpdateRoute = createRoute({
	method: "put",
	path: "/bet-boost",
	tags: ["Sportsbook"],
	summary: "Update a bet boost",
	description:
		"Update a bet boost via Data.Bet API. Requires admin or super_admin authentication.",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: BetBoostUpdateSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Bet boost updated successfully",
			content: {
				"application/json": {
					schema: BetBoostUpdateResponseSchema,
				},
			},
		},
		400: {
			description: "Error updating bet boost",
		},
		401: {
			description: "Unauthorized",
		},
		403: {
			description: "Forbidden - admin or super_admin only",
		},
	},
});

sportsbookRoute.openapi(betBoostUpdateRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
			},
			401,
		);
	}

	const session = await validateAdminSession(c.env, token);
	if (
		!session ||
		(session.role !== "admin" && session.role !== "super_admin")
	) {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - admin or super_admin only",
			},
			403,
		);
	}

	const bettingHost = c.env.BETTING_API_HOST;
	if (!bettingHost) {
		return c.json(
			{
				success: false as const,
				error: "Betting API host not configured",
			},
			500,
		);
	}

	const result = await c.req.json().catch(() => null);
	if (!result || !result.player_id || !result.boost_id) {
		return c.json(
			{
				success: false as const,
				error: "Missing required fields: player_id, boost_id",
			},
			400,
		);
	}

	const apiRequestBody: Record<string, unknown> = {
		player_id: result.player_id,
	};

	if (result.calculation_strategy) {
		apiRequestBody.calculation_strategy = result.calculation_strategy;
	}

	if (result.applicable_conditions) {
		apiRequestBody.applicable_conditions = result.applicable_conditions;
	}

	if (result.required_conditions) {
		apiRequestBody.required_conditions = result.required_conditions;
	}

	if (result.expires_at) {
		apiRequestBody.expires_at = result.expires_at;
	}

	try {
		const response = await c.env.DATABET_CERT.fetch(
			`https://${bettingHost}/bet-boosts/${result.boost_id}`,
			{
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(apiRequestBody),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(
				"Data.Bet bet-boost update error:",
				response.status,
				errorText,
			);
			return c.json(
				{
					success: false as const,
					error: `Failed to update bet boost: ${response.status}`,
					details: errorText,
				},
				400,
			);
		}

		const data = (await response.json()) as { id: string };

		return c.json(
			{
				success: true as const,
				data: {
					boost_id: data.id,
				},
			},
			200,
		);
	} catch (error) {
		console.error("Bet boost update error:", error);
		return c.json(
			{
				success: false as const,
				error:
					error instanceof Error ? error.message : "Failed to update bet boost",
			},
			500,
		);
	}
});

const betBoostDeleteRoute = createRoute({
	method: "delete",
	path: "/bet-boost/{id}",
	tags: ["Sportsbook"],
	summary: "Delete a bet boost",
	description:
		"Delete a bet boost by ID. Requires admin or super_admin authentication.",
	security: [{ BearerAuth: [] }],
	request: {
		params: BetBoostGetSchema,
	},
	responses: {
		204: {
			description: "Bet boost deleted successfully",
		},
		400: {
			description: "Error deleting bet boost",
		},
		401: {
			description: "Unauthorized",
		},
		403: {
			description: "Forbidden - admin or super_admin only",
		},
		404: {
			description: "Bet boost not found",
		},
	},
});

sportsbookRoute.openapi(betBoostDeleteRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
			},
			401,
		);
	}

	const session = await validateAdminSession(c.env, token);
	if (
		!session ||
		(session.role !== "admin" && session.role !== "super_admin")
	) {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - admin or super_admin only",
			},
			403,
		);
	}

	const { id } = c.req.valid("param");

	const bettingHost = c.env.BETTING_API_HOST;
	if (!bettingHost) {
		return c.json(
			{
				success: false as const,
				error: "Betting API host not configured",
			},
			500,
		);
	}

	try {
		const response = await c.env.DATABET_CERT.fetch(
			`https://${bettingHost}/bet-boosts/${id}`,
			{
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
				},
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(
				"Data.Bet bet-boost delete error:",
				response.status,
				errorText,
			);
			if (response.status === 404) {
				return c.json(
					{
						success: false as const,
						error: "Bet boost not found",
					},
					404,
				);
			}
			return c.json(
				{
					success: false as const,
					error: `Failed to delete bet boost: ${response.status}`,
				},
				400,
			);
		}

		return c.body(null, 204);
	} catch (error) {
		console.error("Bet boost delete error:", error);
		return c.json(
			{
				success: false as const,
				error:
					error instanceof Error ? error.message : "Failed to delete bet boost",
			},
			500,
		);
	}
});

export default sportsbookRoute;
