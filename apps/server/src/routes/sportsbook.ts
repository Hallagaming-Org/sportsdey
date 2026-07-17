import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import * as schema from "@/db/schema";
import { trackWebengageEvent } from "@/lib/webengage";
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
import { toWAT } from "@/utils";
import type { CloudflareBindings } from "../types";

const BET_TYPE_LABELS: Record<number, string> = {
	1: "single",
	2: "accumulator",
	3: "system",
	4: "chain",
	5: "conditional",
	6: "multi-single",
	7: "multi-accumulator",
	8: "live-series",
	9: "live-accumulator",
};

const sportsbookRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

export default sportsbookRoute;

async function databetFetch(
	env: CloudflareBindings,
	path: string,
	options: { method?: string; body?: unknown } = {},
): Promise<Response> {
	const proxyUrl = env.PROXY_URL;
	const proxySecret = env.PROXY_SECRET;

	const url = `${proxyUrl.replace(/\/+$/, "")}/${env.NODE_ENV === "staging" ? "sportsbook-staging" : "sportsbook"}${path.startsWith("/") ? path : `/${path}`}`;
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		"X-Proxy-Auth": proxySecret || "",
	};
	console.log("url", url);

	return fetch(url, {
		method: options.method || "GET",
		headers,
		body: options.body ? JSON.stringify(options.body) : undefined,
	});
}

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

	if (!c.env.PROXY_URL) {
		return c.json(
			{
				success: false as const,
				error: "Proxy URL not configured",
				details: null,
			},
			500,
		);
	}

	const requestBody = {
		locale: "en",
		currency: "NGN",
		...(user?.id ? { player_id: user.id } : {}),
		...(session?.id ? { params: { session_id: session.id } } : {}),
	};

	try {
		const response = await databetFetch(c.env, "/token/create", {
			method: "POST",
			body: requestBody,
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error("Sportsbook proxy error:", response.status, errorText);
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

	const existingRequest = await db.query.sportsbookBetEvent.findFirst({
		where: eq(schema.sportsbookBetEvent.requestId, result.data.request_id),
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
	const stakeKobo = Math.round(Number.parseFloat(result.data.bet_stake) * 100);
	const potentialPayout = result.data.total_odds_value
		? Math.round(
				Number.parseFloat(result.data.bet_stake) *
					Number.parseFloat(result.data.total_odds_value) *
					100,
			)
		: null;

	if (!isFreebet) {
		if (wallet.frozenBalance === wallet.balance) {
			return c.json(
				{
					error: {
						code: "not_enough_balance",
						data: {
							actual_balance: "0",
						},
					},
				},
				400,
			);
		}

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
		if (!isFreebet) {
			const walletUpdate = await db
				.update(schema.wallet)
				.set({ frozenBalance: wallet.frozenBalance + stakeKobo })
				.where(eq(schema.wallet.userId, session.userId))
				.returning({ userId: schema.wallet.userId });
			if (walletUpdate.length === 0) {
				return c.json(
					{
						error: {
							code: "custom_error",
							data: {
								code: "transaction_failed",
								message: "Failed to freeze wallet balance",
							},
						},
					},
					400,
				);
			}
		}

		const createdBet = await db
			.insert(schema.sportsbookBet)
			.values({
				id: result.data.bet_id,
				requestId: result.data.request_id,
				userId: session.userId,
				stake: stakeKobo,
				totalOdds: result.data.total_odds_value ?? null,
				betType: result.data.bet_type ?? null,
				betFreebetId: result.data.bet_freebet_id ?? null,
				betBoostId: result.data.bet_boost_id ?? null,
				status: "created",
				betData: JSON.stringify(result.data),
				createdAt: now,
				updatedAt: now,
			})
			.returning({ id: schema.sportsbookBet.id });
		if (createdBet.length === 0) {
			return c.json(
				{
					error: {
						code: "custom_error",
						data: {
							code: "transaction_failed",
							message: "Failed to record placed bet",
						},
					},
				},
				400,
			);
		}

		const createdEvent = await db
			.insert(schema.sportsbookBetEvent)
			.values({
				id: (globalThis as any).crypto?.randomUUID?.() ?? String(Date.now()),
				betId: result.data.bet_id,
				requestId: result.data.request_id,
				eventType: "place",
				eventData: JSON.stringify(result.data),
				balanceBefore: wallet.balance,
				balanceAfter: wallet.balance,
				createdAt: now,
			})
			.returning({ id: schema.sportsbookBetEvent.id });
		if (createdEvent.length === 0) {
			return c.json(
				{
					error: {
						code: "custom_error",
						data: {
							code: "transaction_failed",
							message: "Failed to create place event record",
						},
					},
				},
				400,
			);
		}

		const selections = result.data.bet_odds ?? [];
		const firstOdds = selections[0] as Record<string, unknown> | undefined;
		trackWebengageEvent(
			c.env,
			{
				userId: session.userId,
				eventName: "bet_slip_created",
				eventData: {
					sport: firstOdds?.meta?.sport_event_info_sport_id ?? "",
					league: firstOdds?.meta?.sport_event_info_tournament_id ?? "",
					match_id: firstOdds?.match_id ?? "",
					bet_type:
						BET_TYPE_LABELS[result.data.bet_type ? result.data.bet_type : 1] ??
						String(result.data.bet_type),
					stake_amount: result.data.bet_stake,
					odds_total: result.data.total_odds_value,
					potential_payout:
						potentialPayout !== null ? potentialPayout / 100 : null,
					odds: JSON.stringify(result.data.bet_odds),
				},
			},
			c.executionCtx,
		);

		return c.body(null, 204);
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

	const existingRequest = await db.query.sportsbookBetEvent.findFirst({
		where: eq(schema.sportsbookBetEvent.requestId, result.data.request_id),
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

	if (bet.status !== "created") {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "bet_not_in_created_status",
						current_status: bet.status,
					},
				},
			},
			400,
		);
	}

	let bal: number;
	let balAfter: number;

	try {
		const wallet = await db.query.wallet.findFirst({
			where: eq(schema.wallet.userId, bet.userId),
		});

		if (!wallet) {
			throw new Error("Wallet not found");
		}

		const balanceBefore = wallet.balance;
		bal = balanceBefore;
		balAfter = balanceBefore;

		if (!bet.betFreebetId) {
			const newBalance = wallet.balance - bet.stake;
			const newFrozenBalance = wallet.frozenBalance - bet.stake;
			balAfter = newBalance;

			const walletUpdate = await db
				.update(schema.wallet)
				.set({
					balance: newBalance,
					frozenBalance: newFrozenBalance,
				})
				.where(eq(schema.wallet.userId, bet.userId))
				.returning({ userId: schema.wallet.userId });
			if (walletUpdate.length === 0) {
				return c.json(
					{
						error: {
							code: "custom_error",
							data: {
								code: "transaction_failed",
								message: "Failed to move funds from frozen to spent balance",
							},
						},
					},
					400,
				);
			}

			const [walletTxn] = await db
				.insert(schema.walletTransaction)
				.values({
					id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
					userId: bet.userId,
					amount: bet.stake,
					type: "debit",
					reference: `sb_accept_${result.data.bet_id}_${crypto.randomUUID()}`,
					status: "success",
					paymentMethod: "sportsbook",
					balance: newBalance,
					metadata: JSON.stringify({
						action: "bet_accepted",
						betId: result.data.bet_id,
						stake: bet.stake,
					}),
				})
				.returning({ id: schema.walletTransaction.id });
			if (!walletTxn?.id) {
				console.error("Failed to record wallet transaction for bet accept");
			}
		}

		const betUpdate = await db
			.update(schema.sportsbookBet)
			.set({
				status: "accepted",
				betData: JSON.stringify(result.data),
				updatedAt: new Date(),
			})
			.where(eq(schema.sportsbookBet.id, result.data.bet_id))
			.returning({ id: schema.sportsbookBet.id });
		console.log("bet update", betUpdate);
		if (betUpdate.length === 0) {
			return c.json(
				{
					error: {
						code: "custom_error",
						data: {
							code: "transaction_failed",
							message: "Failed to update bet status to accept",
						},
					},
				},
				400,
			);
		}

		const now = new Date();
		// record accept event for idempotency instead of reinserting the bet row
		const createdEvent = await db
			.insert(schema.sportsbookBetEvent)
			.values({
				id: (globalThis as any).crypto?.randomUUID?.() ?? String(Date.now()),
				betId: result.data.bet_id,
				requestId: result.data.request_id,
				eventType: "accept",
				eventData: JSON.stringify(result.data),
				balanceBefore: balanceBefore,
				balanceAfter: balAfter,
				createdAt: now,
			})
			.returning({ id: schema.sportsbookBetEvent.id });
		console.log("created bet event", createdEvent);
		if (createdEvent.length === 0) {
			return c.json(
				{
					error: {
						code: "custom_error",
						data: {
							code: "transaction_failed",
							message: "Failed to create accepted bet event record",
						},
					},
				},
				400,
			);
		}
	} catch (error) {
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

	const selections = result.data.bet_odds as
		| Array<Record<string, unknown>>
		| undefined;
	const firstSelection = selections?.[0];

	const betPlacedPotentialPayout = result.data.total_odds_value
		? Math.round(
				Number.parseFloat(result.data.bet_stake) *
					Number.parseFloat(result.data.total_odds_value) *
					100,
			)
		: null;

	trackWebengageEvent(
		c.env,
		{
			userId: bet.userId,
			eventName: "bet_placed",
			eventData: {
				bet_id: result.data.bet_id,
				bet_type:
					BET_TYPE_LABELS[result.data.bet_type ?? 1] ??
					String(result.data.bet_type),
				stake_amount: Number.parseFloat(result.data.bet_stake),
				potential_payout:
					betPlacedPotentialPayout !== null
						? betPlacedPotentialPayout / 100
						: null,
				odds_total: result.data.total_odds_value
					? Number.parseFloat(result.data.total_odds_value)
					: null,
				selection_count: selections?.length ?? 0,
				sport: firstSelection?.meta?.sport_event_info_sport_id ?? "",
				league: firstSelection?.meta?.sport_event_info_tournament_id ?? "",
				match_ids: selections?.map((s) => s.match_id ?? "") ?? [],
				wallet_balance_after: balAfter / 100,
			},
		},
		c.executionCtx,
	);

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

	const existingRequest = await db.query.sportsbookBetEvent.findFirst({
		where: eq(schema.sportsbookBetEvent.requestId, result.data.request_id),
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
		const wallet = await db.query.wallet.findFirst({
			where: eq(schema.wallet.userId, bet.userId),
		});

		if (wallet && !bet.betFreebetId) {
			if (bet.status === "created") {
				const walletUpdate = await db
					.update(schema.wallet)
					.set({
						frozenBalance: wallet.frozenBalance - bet.stake,
					})
					.where(eq(schema.wallet.userId, bet.userId))
					.returning({ userId: schema.wallet.userId });
				console.log("wallet update", walletUpdate);
				if (walletUpdate.length === 0) {
					return c.json(
						{
							error: {
								code: "custom_error",
								data: {
									code: "transaction_failed",
									message: "Failed to unfreeze balance for declined bet",
								},
							},
						},
						400,
					);
				}
			} else if (bet.status === "accepted") {
				const newBalance = wallet.balance + bet.stake;
				const walletUpdate = await db
					.update(schema.wallet)
					.set({
						balance: newBalance,
					})
					.where(eq(schema.wallet.userId, bet.userId))
					.returning({ userId: schema.wallet.userId });
				console.log("wallet update", walletUpdate);
				if (walletUpdate.length === 0) {
					return c.json(
						{
							error: {
								code: "custom_error",
								data: {
									code: "transaction_failed",
									message: "Failed to refund balance for declined bet",
								},
							},
						},
						400,
					);
				}

				const [walletTxn] = await db
					.insert(schema.walletTransaction)
					.values({
						id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
						userId: bet.userId,
						amount: bet.stake,
						type: "refund",
						reference: `sb_decline_${bet.id}_${crypto.randomUUID()}`,
						status: "success",
						paymentMethod: "sportsbook",
						balance: newBalance,
						metadata: JSON.stringify({
							action: "bet_declined",
							betId: bet.id,
							stake: bet.stake,
						}),
					})
					.returning({ id: schema.walletTransaction.id });
				if (!walletTxn?.id) {
					console.error("Failed to record wallet transaction for bet decline");
				}
			}
		}

		const supportedRestrictionCodes = new Set(["not_enough_balance"]);
		const restrictions = result.data.restrictions ?? [];
		const hasSupportedRestriction = restrictions.some((restriction) => {
			const candidate = restriction as Record<string, unknown>;
			const code =
				typeof candidate?.code === "string"
					? candidate.code
					: typeof candidate?.type === "string"
						? candidate.type
						: null;
			return code ? supportedRestrictionCodes.has(code) : false;
		});
		const nextStatus = hasSupportedRestriction
			? "place_error"
			: "force_decline";

		const betUpdate = await db
			.update(schema.sportsbookBet)
			.set({
				status: nextStatus,
				betData: JSON.stringify(result.data),
				updatedAt: new Date(),
			})
			.where(eq(schema.sportsbookBet.id, result.data.bet_id))
			.returning({ id: schema.sportsbookBet.id });

		console.log("bet update", betUpdate);
		if (betUpdate.length === 0) {
			return c.json(
				{
					error: {
						code: "custom_error",
						data: {
							code: "transaction_failed",
							message: "Failed to update bet status to decline",
						},
					},
				},
				400,
			);
		}

		const now = new Date();
		const declineBalanceBefore = wallet?.balance ?? 0;
		const declineBalanceAfter =
			wallet && !bet.betFreebetId && bet.status === "accepted"
				? wallet.balance + bet.stake
				: declineBalanceBefore;
		const createdEvent = await db
			.insert(schema.sportsbookBetEvent)
			.values({
				id: (globalThis as any).crypto?.randomUUID?.() ?? String(Date.now()),
				betId: result.data.bet_id,
				requestId: result.data.request_id,
				eventType: nextStatus,
				eventData: JSON.stringify(result.data),
				balanceBefore: declineBalanceBefore,
				balanceAfter: declineBalanceAfter,
				createdAt: now,
			})
			.returning({ id: schema.sportsbookBetEvent.id });
		console.log("created bet event", createdEvent);
		if (createdEvent.length === 0) {
			return c.json(
				{
					error: {
						code: "custom_error",
						data: {
							code: "transaction_failed",
							message: "Failed to create declined bet event record",
						},
					},
				},
				400,
			);
		}
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

	const existingRequest = await db.query.sportsbookBetEvent.findFirst({
		where: eq(schema.sportsbookBetEvent.requestId, result.data.request_id),
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

	if (bet.status !== "accepted" && bet.status !== "unsettled") {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "bet_not_accepted_or_unsettled",
						current_status: bet.status,
					},
				},
			},
			400,
		);
	}

	const settleAmount = Math.round(
		Number.parseFloat(result.data.settle_amount) * 100,
	);
	const settleType = result.data.settle_type;

	try {
		const wallet = await db.query.wallet.findFirst({
			where: eq(schema.wallet.userId, bet.userId),
		});

		const isFreebetWin = bet.betFreebetId && settleType === 1;
		const shouldCredit = !bet.betFreebetId || isFreebetWin;

		if (wallet && shouldCredit) {
			const newBalance = wallet.balance + settleAmount;
			const walletUpdate = await db
				.update(schema.wallet)
				.set({
					balance: newBalance,
				})
				.where(eq(schema.wallet.userId, bet.userId))
				.returning({ userId: schema.wallet.userId });
			if (walletUpdate.length === 0) {
				return c.json(
					{
						error: {
							code: "custom_error",
							data: {
								code: "transaction_failed",
								message: "Failed to credit wallet for settled bet",
							},
						},
					},
					400,
				);
			}

			const settleTypeLabel =
				settleType === 1 ? "win" : settleType === 2 ? "refund" : "settled";
			const [walletTxn] = await db
				.insert(schema.walletTransaction)
				.values({
					id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
					userId: bet.userId,
					amount: settleAmount,
					type: "credit",
					reference: `sb_settle_${result.data.bet_id}_${crypto.randomUUID()}`,
					status: "success",
					paymentMethod: "sportsbook",
					balance: newBalance,
					metadata: JSON.stringify({
						action: "settled",
						betId: result.data.bet_id,
						settleType: settleTypeLabel,
						settleAmount,
					}),
				})
				.returning({ id: schema.walletTransaction.id });
			if (!walletTxn?.id) {
				console.error("Failed to record wallet transaction for bet settle");
			}
		}

		const newStatus =
			settleType === 2
				? bet.status === "unsettled"
					? "refunded_manually"
					: "rolled_back"
				: "settled";

		const betUpdate = await db
			.update(schema.sportsbookBet)
			.set({
				status: newStatus,
				settleAmount: settleAmount,
				settleType: settleType,
				betData: JSON.stringify(result.data),
				updatedAt: new Date(),
			})
			.where(eq(schema.sportsbookBet.id, result.data.bet_id))
			.returning({ id: schema.sportsbookBet.id });
		if (betUpdate.length === 0) {
			return c.json(
				{
					error: {
						code: "custom_error",
						data: {
							code: "transaction_failed",
							message: "Failed to update bet settlement",
						},
					},
				},
				400,
			);
		}

		const now = new Date();
		const settleBalanceBefore = wallet?.balance ?? 0;
		const settleBalanceAfter = shouldCredit
			? (wallet?.balance ?? 0) + settleAmount
			: (wallet?.balance ?? 0);
		const createdEvent = await db
			.insert(schema.sportsbookBetEvent)
			.values({
				id: (globalThis as any).crypto?.randomUUID?.() ?? String(Date.now()),
				betId: result.data.bet_id,
				requestId: result.data.request_id,
				eventType: newStatus,
				eventData: JSON.stringify(result.data),
				balanceBefore: settleBalanceBefore,
				balanceAfter: settleBalanceAfter,
				createdAt: now,
			})
			.returning({ id: schema.sportsbookBetEvent.id });
		console.log("created settle event", createdEvent);
		if (createdEvent.length === 0) {
			return c.json(
				{
					error: {
						code: "custom_error",
						data: {
							code: "transaction_failed",
							message: "Failed to create settle ledger record",
						},
					},
				},
				400,
			);
		}
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

	const settleTypeLabel =
		settleType === 1 ? "win" : settleType === 2 ? "refund" : "loss";

	const settleSelections = result.data.bet_odds as
		| Array<Record<string, unknown>>
		| undefined;
	const settleFirstOdds = settleSelections?.[0];

	trackWebengageEvent(
		c.env,
		{
			userId: bet.userId,
			eventName: "bet_settled",
			eventData: {
				bet_id: result.data.bet_id,
				payout_amount: result.data.settle_amount,
				outcome: settleTypeLabel,
				net_pnl: Number.parseInt(result.data.settle_amount) - bet.stake,
				sport: settleFirstOdds?.meta?.sport_event_info_sport_id ?? "",
				league: settleFirstOdds?.meta?.sport_event_info_tournament_id ?? "",
			},
		},
		c.executionCtx,
	);

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

	const existingRequest = await db.query.sportsbookBetEvent.findFirst({
		where: eq(schema.sportsbookBetEvent.requestId, result.data.request_id),
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

	if (
		bet.status !== "settled" &&
		bet.status !== "rolled_back" &&
		bet.status !== "refunded_manually"
	) {
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
		? Math.round(Number.parseFloat(result.data.unsettle_amount) * 100)
		: bet.settleAmount || 0;

	try {
		const wallet = await db.query.wallet.findFirst({
			where: eq(schema.wallet.userId, bet.userId),
		});

		if (wallet) {
			const newBalance = wallet.balance - unsettleAmount;
			const walletUpdate = await db
				.update(schema.wallet)
				.set({
					balance: newBalance,
				})
				.where(eq(schema.wallet.userId, bet.userId))
				.returning({ userId: schema.wallet.userId });
			if (walletUpdate.length === 0) {
				return c.json(
					{
						error: {
							code: "custom_error",
							data: {
								code: "transaction_failed",
								message: "Failed to reverse settled wallet amount",
							},
						},
					},
					400,
				);
			}

			const [walletTxn] = await db
				.insert(schema.walletTransaction)
				.values({
					id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
					userId: bet.userId,
					amount: -unsettleAmount,
					type: "debit",
					reference: `sb_unsettle_${result.data.bet_id}_${crypto.randomUUID()}`,
					status: "success",
					paymentMethod: "sportsbook",
					balance: newBalance,
					metadata: JSON.stringify({
						action: "unsettled",
						betId: result.data.bet_id,
						unsettleAmount,
					}),
				})
				.returning({ id: schema.walletTransaction.id });
			if (!walletTxn?.id) {
				console.error("Failed to record wallet transaction for bet unsettle");
			}
		}

		const betUpdate = await db
			.update(schema.sportsbookBet)
			.set({
				status: "unsettled",
				settleAmount: null,
				settleType: null,
				updatedAt: new Date(),
			})
			.where(eq(schema.sportsbookBet.id, result.data.bet_id))
			.returning({ id: schema.sportsbookBet.id });
		if (betUpdate.length === 0) {
			return c.json(
				{
					error: {
						code: "custom_error",
						data: {
							code: "transaction_failed",
							message: "Failed to unsettle bet status",
						},
					},
				},
				400,
			);
		}

		const now = new Date();
		const unsettleBalanceBefore = wallet?.balance ?? 0;
		const unsettleBalanceAfter = wallet ? wallet.balance - unsettleAmount : 0;
		const createdEvent = await db
			.insert(schema.sportsbookBetEvent)
			.values({
				id: (globalThis as any).crypto?.randomUUID?.() ?? String(Date.now()),
				betId: result.data.bet_id,
				requestId: result.data.request_id,
				eventType: "unsettle",
				eventData: JSON.stringify(result.data),
				balanceBefore: unsettleBalanceBefore,
				balanceAfter: unsettleBalanceAfter,
				createdAt: now,
			})
			.returning({ id: schema.sportsbookBetEvent.id });
		console.log("created unsettle event", createdEvent);
		if (createdEvent.length === 0) {
			return c.json(
				{
					error: {
						code: "custom_error",
						data: {
							code: "transaction_failed",
							message: "Failed to create unsettle ledger record",
						},
					},
				},
				400,
			);
		}
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

	const existingRequest = await db.query.sportsbookBetEvent.findFirst({
		where: eq(schema.sportsbookBetEvent.requestId, result.data.request_id),
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
		Number.parseFloat(result.data.refund_amount) * 100,
	);

	try {
		const wallet = await db.query.wallet.findFirst({
			where: eq(schema.wallet.userId, bet.userId),
		});

		if (wallet) {
			const newBalance = wallet.balance + refundAmountKobo;
			const walletUpdate = await db
				.update(schema.wallet)
				.set({
					balance: newBalance,
				})
				.where(eq(schema.wallet.userId, bet.userId))
				.returning({ userId: schema.wallet.userId });
			if (walletUpdate.length === 0) {
				return c.json(
					{
						error: {
							code: "custom_error",
							data: {
								code: "transaction_failed",
								message: "Failed to credit wallet for cashout acceptance",
							},
						},
					},
					400,
				);
			}

			const [walletTxn] = await db
				.insert(schema.walletTransaction)
				.values({
					id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
					userId: bet.userId,
					amount: refundAmountKobo,
					type: "credit",
					reference: `sb_cashout_${result.data.bet_id}_${result.data.cash_out_order_id}_${crypto.randomUUID()}`,
					status: "success",
					paymentMethod: "sportsbook",
					balance: newBalance,
					metadata: JSON.stringify({
						action: "cash_out_accepted",
						betId: result.data.bet_id,
						cashOutOrderId: result.data.cash_out_order_id,
						refundAmount: refundAmountKobo,
					}),
				})
				.returning({ id: schema.walletTransaction.id });
			if (!walletTxn?.id) {
				console.error(
					"Failed to record wallet transaction for cashout acceptance",
				);
			}
		}

		const existingOrderIds = bet.cashOutOrderIds
			? JSON.parse(bet.cashOutOrderIds)
			: [];
		const newOrderIds = [...existingOrderIds, result.data.cash_out_order_id];

		const betUpdate = await db
			.update(schema.sportsbookBet)
			.set({
				cashOutOrderIds: JSON.stringify(newOrderIds),
				betData: JSON.stringify(result.data),
				updatedAt: new Date(),
			})
			.where(eq(schema.sportsbookBet.id, result.data.bet_id))
			.returning({ id: schema.sportsbookBet.id });
		if (betUpdate.length === 0) {
			return c.json(
				{
					error: {
						code: "custom_error",
						data: {
							code: "transaction_failed",
							message: "Failed to update cashout acceptance state",
						},
					},
				},
				400,
			);
		}

		const now = new Date();
		const cashOutBalanceBefore = wallet?.balance ?? 0;
		const cashOutBalanceAfter = wallet ? wallet.balance + refundAmountKobo : 0;
		const createdEvent = await db
			.insert(schema.sportsbookBetEvent)
			.values({
				id: (globalThis as any).crypto?.randomUUID?.() ?? String(Date.now()),
				betId: result.data.bet_id,
				requestId: result.data.request_id,
				eventType: "cash_out_accepted",
				eventData: JSON.stringify(result.data),
				balanceBefore: cashOutBalanceBefore,
				balanceAfter: cashOutBalanceAfter,
				createdAt: now,
			})
			.returning({ id: schema.sportsbookBetEvent.id });
		console.log("created cashout accepted event", createdEvent);
		if (createdEvent.length === 0) {
			return c.json(
				{
					error: {
						code: "custom_error",
						data: {
							code: "transaction_failed",
							message: "Failed to create cashout accepted record",
						},
					},
				},
				400,
			);
		}
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

	trackWebengageEvent(
		c.env,
		{
			userId: bet.userId,
			eventName: "bet_cashout_requested",
			eventData: {
				bet_id: result.data.bet_id,
				cashout_value: result.data.refund_amount,
				original_stake: bet.stake,
				refund_amount: result.data.refund_amount,
				cashout_rate: bet.stake - result.data.refund_amount,
				original_potential_payout: result.data.amount,
			},
		},
		c.executionCtx,
	);

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

	const existingRequest = await db.query.sportsbookBetEvent.findFirst({
		where: eq(schema.sportsbookBetEvent.requestId, result.data.request_id),
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
		const wallet = await db.query.wallet.findFirst({
			where: eq(schema.wallet.userId, bet.userId),
		});

		const acceptedCashoutEvents = result.data.cash_out_order_ids.length
			? await db.query.sportsbookBetEvent.findMany({
					where: and(
						eq(schema.sportsbookBetEvent.betId, result.data.bet_id),
						eq(schema.sportsbookBetEvent.eventType, "cash_out_accepted"),
					),
				})
			: [];

		const acceptedRefundByOrderId = new Map<string, number>();
		for (const event of acceptedCashoutEvents) {
			if (!event.eventData) continue;
			try {
				const parsed = JSON.parse(event.eventData) as {
					cash_out_order_id?: string;
					refund_amount?: string;
				};
				if (!parsed.cash_out_order_id || !parsed.refund_amount) continue;
				const amountKobo = Math.round(
					Number.parseFloat(parsed.refund_amount) * 100,
				);
				if (!Number.isFinite(amountKobo) || amountKobo <= 0) continue;
				acceptedRefundByOrderId.set(parsed.cash_out_order_id, amountKobo);
			} catch {
				// Ignore malformed historical event payloads.
			}
		}

		const priorDeclinedEvents = await db.query.sportsbookBetEvent.findMany({
			where: and(
				eq(schema.sportsbookBetEvent.betId, result.data.bet_id),
				eq(schema.sportsbookBetEvent.eventType, "cash_out_declined"),
			),
		});

		const previouslyDeclinedOrderIds = new Set<string>();
		for (const event of priorDeclinedEvents) {
			if (!event.eventData) continue;
			try {
				const parsed = JSON.parse(event.eventData) as {
					cash_out_order_ids?: string[];
				};
				for (const orderId of parsed.cash_out_order_ids ?? []) {
					previouslyDeclinedOrderIds.add(orderId);
				}
			} catch {
				// Ignore malformed historical event payloads.
			}
		}

		const uniqueIncomingOrderIds = Array.from(
			new Set(result.data.cash_out_order_ids),
		);
		const orderIdsToReverse = uniqueIncomingOrderIds.filter(
			(orderId) => !previouslyDeclinedOrderIds.has(orderId),
		);
		const refundAmountKobo = orderIdsToReverse.reduce((sum, orderId) => {
			return sum + (acceptedRefundByOrderId.get(orderId) ?? 0);
		}, 0);

		if (wallet && refundAmountKobo > 0) {
			const newBalance = wallet.balance - refundAmountKobo;
			const walletUpdate = await db
				.update(schema.wallet)
				.set({
					balance: newBalance,
				})
				.where(eq(schema.wallet.userId, bet.userId))
				.returning({ userId: schema.wallet.userId });
			if (walletUpdate.length === 0) {
				return c.json(
					{
						error: {
							code: "custom_error",
							data: {
								code: "transaction_failed",
								message: "Failed to reverse wallet credit for cashout decline",
							},
						},
					},
					400,
				);
			}

			const [walletTxn] = await db
				.insert(schema.walletTransaction)
				.values({
					id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
					userId: bet.userId,
					amount: -refundAmountKobo,
					type: "debit",
					reference: `sb_cashout_decline_${result.data.bet_id}_${crypto.randomUUID()}`,
					status: "success",
					paymentMethod: "sportsbook",
					balance: newBalance,
					metadata: JSON.stringify({
						action: "cash_out_declined",
						betId: result.data.bet_id,
						refundAmount: refundAmountKobo,
					}),
				})
				.returning({ id: schema.walletTransaction.id });
			if (!walletTxn?.id) {
				console.error(
					"Failed to record wallet transaction for cashout decline",
				);
			}
		}

		const existingOrderIds = bet.cashOutOrderIds
			? JSON.parse(bet.cashOutOrderIds)
			: [];
		const newOrderIds = [...existingOrderIds, ...orderIdsToReverse];

		const betUpdate = await db
			.update(schema.sportsbookBet)
			.set({
				cashOutOrderIds: JSON.stringify(newOrderIds),
				betData: JSON.stringify(result.data),
				updatedAt: new Date(),
			})
			.where(eq(schema.sportsbookBet.id, result.data.bet_id))
			.returning({ id: schema.sportsbookBet.id });
		if (betUpdate.length === 0) {
			return c.json(
				{
					error: {
						code: "custom_error",
						data: {
							code: "transaction_failed",
							message: "Failed to update cashout decline state",
						},
					},
				},
				400,
			);
		}

		const now = new Date();
		const cashOutDeclinedBalanceBefore = wallet?.balance ?? 0;
		const cashOutDeclinedBalanceAfter =
			wallet && refundAmountKobo > 0
				? wallet.balance - refundAmountKobo
				: cashOutDeclinedBalanceBefore;
		const createdEvent = await db
			.insert(schema.sportsbookBetEvent)
			.values({
				id: (globalThis as any).crypto?.randomUUID?.() ?? String(Date.now()),
				betId: result.data.bet_id,
				requestId: result.data.request_id,
				eventType: "cash_out_declined",
				eventData: JSON.stringify(result.data),
				balanceBefore: cashOutDeclinedBalanceBefore,
				balanceAfter: cashOutDeclinedBalanceAfter,
				createdAt: now,
			})
			.returning({ id: schema.sportsbookBetEvent.id });
		console.log("created cashout declined event", createdEvent);
		if (createdEvent.length === 0) {
			return c.json(
				{
					error: {
						code: "custom_error",
						data: {
							code: "transaction_failed",
							message: "Failed to create cashout declined record",
						},
					},
				},
				400,
			);
		}
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
						expires_at: z.string(),
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
							expiresAt: z.string(),
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

	const result = await c.req.json().catch(() => null);
	if (
		!result ||
		!result.player_id ||
		!result.amount ||
		!result.currency ||
		!result.expires_at
	) {
		return c.json(
			{
				success: false as const,
				error:
					"Missing required fields: player_id, amount, currency, expires_at",
			},
			400,
		);
	}

	const id = crypto.randomUUID();
	const amountKobo = Math.round(result.amount * 100);

	const apiRequestBody = {
		player_id: result.player_id,
		idempotence_id: id,
		amount: {
			amount: result.amount.toString(),
			currency_code: result.currency,
		},
		expires_at: result.expires_at,
		conditions: result.conditions || [],
	};

	try {
		const response = await databetFetch(c.env, "/freebet/create", {
			method: "POST",
			body: apiRequestBody,
		});

		console.log("requestBody", apiRequestBody);

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
					expiresAt: toWAT(result.expires_at),
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
								expires_at: z.string(),
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
								expiresAt: z.string(),
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
			expires_at: string;
			conditions?: unknown[];
		}) => ({
			idempotence_id: crypto.randomUUID(),
			player_id: fb.player_id,
			amount: {
				amount: fb.amount.toString(),
				currency_code: fb.currency,
			},
			expires_at: fb.expires_at,
			conditions: fb.conditions || [],
		}),
	);

	try {
		const response = await databetFetch(c.env, "/freebet/create/bulk", {
			method: "POST",
			body: { freebets: freebetsData },
		});

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
							expires_at: string;
						},
						index: number,
					) => ({
						id: freebetsData[index].id,
						dataBetFreebetId: data.freebet_ids[index],
						amount: fb.amount,
						currency: fb.currency,
						expiresAt: toWAT(fb.expires_at),
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
								expiresAt: z.string().nullable(),
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

	const result = await c.req.json().catch(() => null);
	const playerId = result?.player_id;

	if (!playerId) {
		return c.json(
			{
				success: false as const,
				error: "Missing required field: player_id",
			},
			400,
		);
	}

	try {
		const response = await databetFetch(
			c.env,
			`/freebet/getList?player_id=${playerId}`,
		);

		if (!response.ok) {
			const errorText = await response.text();
			console.error("Data.Bet freebet list error:", response.status, errorText);
			return c.json(
				{
					success: false as const,
					error: `Failed to list freebets: ${response.status}`,
				},
				400,
			);
		}

		const data = (await response.json()) as {
			freebets: Array<{
				id: string;
				version: string;
				player_id: string;
				idempotence_id: string;
				conditions: unknown[];
				amount: { amount: string; currency_code: string };
				expires_at: string;
				foreign_params?: string;
				used_on_bet_id?: string;
				used_at?: string;
				status: number;
			}>;
		};

		return c.json(
			{
				success: true as const,
				data: data.freebets.map((fb) => ({
					id: fb.id,
					version: fb.version,
					dataBetFreebetId: fb.id,
					playerId: fb.player_id,
					idempotenceId: fb.idempotence_id,
					conditions: fb.conditions ? JSON.stringify(fb.conditions) : null,
					amount: Number.parseFloat(fb.amount.amount),
					currency: fb.amount.currency_code,
					expiresAt: toWAT(fb.expires_at),
					foreignParams: fb.foreign_params ?? null,
					usedOnBetId: fb.used_on_bet_id ?? null,
					usedAt: fb.used_at ? toWAT(fb.used_at) : null,
					status: fb.status,
					createdAt: toWAT(fb.used_at ?? fb.expires_at),
				})),
			},
			200,
		);
	} catch (error) {
		console.error("Freebet list error:", error);
		return c.json(
			{
				success: false as const,
				error:
					error instanceof Error ? error.message : "Failed to list freebets",
			},
			500,
		);
	}
});

const freebetUnusedListRoute = createRoute({
	method: "get",
	path: "/freebet/unused",
	tags: ["Sportsbook"],
	summary: "List user's unused freebets",
	description:
		"List all unused (new) freebets for a user. Requires authentication.",
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
								version: z.string(),
								dataBetFreebetId: z.string(),
								playerId: z.string(),
								idempotenceId: z.string(),
								conditions: z.string().nullable(),
								amount: z.number(),
								currency: z.string(),
								expiresAt: z.string(),
								foreignParams: z.string().nullable(),
								status: z.number(),
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

sportsbookRoute.openapi(freebetUnusedListRoute, async (c) => {
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

	const result = await c.req.json().catch(() => null);
	const playerId = result?.player_id;

	if (!playerId) {
		return c.json(
			{
				success: false as const,
				error: "Missing required field: player_id",
			},
			400,
		);
	}

	try {
		const response = await databetFetch(
			c.env,
			`/freebet/getListUnused?player_id=${playerId}`,
		);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(
				"Data.Bet freebet unused list error:",
				response.status,
				errorText,
			);
			return c.json(
				{
					success: false as const,
					error: `Failed to list unused freebets: ${response.status}`,
				},
				400,
			);
		}

		const data = (await response.json()) as {
			freebets: Array<{
				id: string;
				version: string;
				player_id: string;
				idempotence_id: string;
				conditions: unknown[];
				amount: { amount: string; currency_code: string };
				expires_at: string;
				foreign_params?: string;
				used_on_bet_id?: string;
				used_at?: string;
				status: number;
			}>;
		};

		return c.json(
			{
				success: true as const,
				data: data.freebets.map((fb) => ({
					id: fb.id,
					version: fb.version,
					dataBetFreebetId: fb.id,
					playerId: fb.player_id,
					idempotenceId: fb.idempotence_id,
					conditions: fb.conditions ? JSON.stringify(fb.conditions) : null,
					amount: Number.parseFloat(fb.amount.amount),
					currency: fb.amount.currency_code,
					expiresAt: toWAT(fb.expires_at),
					foreignParams: fb.foreign_params ?? null,
					status: fb.status,
					createdAt: toWAT(fb.expires_at),
				})),
			},
			200,
		);
	} catch (error) {
		console.error("Freebet unused list error:", error);
		return c.json(
			{
				success: false as const,
				error:
					error instanceof Error
						? error.message
						: "Failed to list unused freebets",
			},
			500,
		);
	}
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
							version: z.string(),
							dataBetFreebetId: z.string(),
							playerId: z.string(),
							idempotenceId: z.string(),
							conditions: z.string().nullable(),
							amount: z.number(),
							currency: z.string(),
							expiresAt: z.string(),
							foreignParams: z.string().nullable(),
							usedOnBetId: z.string().nullable(),
							usedAt: z.string().nullable(),
							status: z.number(),
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

	const { id } = c.req.param();

	try {
		const response = await databetFetch(c.env, `/freebet/${id}`);

		if (!response.ok) {
			const errorText = await response.text();
			console.error("Data.Bet freebet get error:", response.status, errorText);
			if (response.status === 404) {
				return c.json(
					{
						success: false as const,
						error: "Freebet not found",
					},
					404,
				);
			}
			return c.json(
				{
					success: false as const,
					error: `Failed to get freebet: ${response.status}`,
				},
				400,
			);
		}

		const data = (await response.json()) as {
			id: string;
			version: string;
			player_id: string;
			idempotence_id: string;
			conditions: unknown[];
			amount: { amount: string; currency_code: string };
			expires_at: string;
			foreign_params?: string;
			used_on_bet_id?: string;
			used_at?: string;
			status: number;
		};

		return c.json(
			{
				success: true as const,
				data: {
					id: data.id,
					version: data.version,
					dataBetFreebetId: data.id,
					playerId: data.player_id,
					idempotenceId: data.idempotence_id,
					conditions: data.conditions ? JSON.stringify(data.conditions) : null,
					amount: Number.parseFloat(data.amount.amount),
					currency: data.amount.currency_code,
					expiresAt: toWAT(data.expires_at),
					foreignParams: data.foreign_params ?? null,
					usedOnBetId: data.used_on_bet_id ?? null,
					usedAt: data.used_at ? toWAT(data.used_at) : null,
					status: data.status,
					createdAt: toWAT(data.used_at ?? data.expires_at),
				},
			},
			200,
		);
	} catch (error) {
		console.error("Freebet get error:", error);
		return c.json(
			{
				success: false as const,
				error: error instanceof Error ? error.message : "Failed to get freebet",
			},
			500,
		);
	}
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
						expires_at: z.string().optional(),
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

	if (result.expires_at) {
		apiRequestBody.expires_at = result.expires_at;
	}

	if (result.conditions) {
		apiRequestBody.conditions = result.conditions;
	}

	try {
		const response = await databetFetch(c.env, "/freebet/update", {
			method: "POST",
			body: apiRequestBody,
		});

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

const freebetCancelRoute = createRoute({
	method: "post",
	path: "/freebet/cancel",
	tags: ["Sportsbook"],
	summary: "Cancel a freebet",
	description:
		"Cancel a freebet, making it unavailable for use. Requires authentication.",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({
						freebet_id: z.string(),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: "Freebet canceled successfully",
			content: {
				"application/json": {
					schema: z.object({
						success: z.literal(true),
						data: z.object({
							id: z.string(),
							version: z.string(),
							dataBetFreebetId: z.string(),
							playerId: z.string(),
							idempotenceId: z.string(),
							conditions: z.string().nullable(),
							amount: z.number(),
							currency: z.string(),
							expiresAt: z.string(),
							foreignParams: z.string().nullable(),
							usedOnBetId: z.string().nullable(),
							usedAt: z.string().nullable(),
							status: z.number(),
							createdAt: z.string(),
						}),
					}),
				},
			},
		},
		400: {
			description: "Error canceling freebet",
		},
		401: {
			description: "Unauthorized",
		},
		404: {
			description: "Freebet not found",
		},
	},
});

sportsbookRoute.openapi(freebetCancelRoute, async (c) => {
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

	const result = await c.req.json().catch(() => null);
	if (!result || !result.freebet_id) {
		return c.json(
			{
				success: false as const,
				error: "Missing required field: freebet_id",
			},
			400,
		);
	}

	try {
		const response = await databetFetch(c.env, "/freebet/cancel", {
			method: "POST",
			body: { freebet_id: result.freebet_id },
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(
				"Data.Bet freebet cancel error:",
				response.status,
				errorText,
			);
			if (response.status === 404) {
				return c.json(
					{
						success: false as const,
						error: "Freebet not found",
					},
					404,
				);
			}
			return c.json(
				{
					success: false as const,
					error: `Failed to cancel freebet: ${response.status}`,
				},
				400,
			);
		}

		const data = (await response.json()) as {
			freebet: {
				id: string;
				version: string;
				player_id: string;
				idempotence_id: string;
				conditions: unknown[];
				amount: { amount: string; currency_code: string };
				expires_at: string;
				foreign_params?: string;
				used_on_bet_id?: string;
				used_at?: string;
				status: number;
			};
		};

		const fb = data.freebet;
		return c.json(
			{
				success: true as const,
				data: {
					id: fb.id,
					version: fb.version,
					dataBetFreebetId: fb.id,
					playerId: fb.player_id,
					idempotenceId: fb.idempotence_id,
					conditions: fb.conditions ? JSON.stringify(fb.conditions) : null,
					amount: Number.parseFloat(fb.amount.amount),
					currency: fb.amount.currency_code,
					expiresAt: toWAT(fb.expires_at),
					foreignParams: fb.foreign_params ?? null,
					usedOnBetId: fb.used_on_bet_id ?? null,
					usedAt: fb.used_at ? toWAT(fb.used_at) : null,
					status: fb.status,
					createdAt: toWAT(fb.used_at ?? fb.expires_at),
				},
			},
			200,
		);
	} catch (error) {
		console.error("Freebet cancel error:", error);
		return c.json(
			{
				success: false as const,
				error:
					error instanceof Error ? error.message : "Failed to cancel freebet",
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

	const result = await c.req.valid("json");

	const apiRequestBody: Record<string, unknown> = {
		idempotence_id: crypto.randomUUID(),
		player_id: result.player_id,
		currency_code: result.currency,
		initial_quantity: result.initial_quantity,
		applicable_conditions: result.applicable_conditions,
		required_conditions: result.required_conditions,
		expires_at: result.expires_at,
	};

	if (result.calculation_strategy) {
		apiRequestBody.calculation_strategy = result.calculation_strategy;
	}

	try {
		const response = await databetFetch(c.env, "/bet-boosts", {
			method: "POST",
			body: apiRequestBody,
		});

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

	try {
		const response = await databetFetch(c.env, "/bet-boosts");

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
					expiresAt: toWAT(bb.expires_at),
					createdAt: toWAT(bb.created_at),
					updatedAt: toWAT(bb.updated_at),
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

	try {
		const response = await databetFetch(c.env, `/bet-boosts/${id}`);

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
					expiresAt: toWAT(data.expires_at),
					createdAt: toWAT(data.created_at),
					updatedAt: toWAT(data.updated_at),
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
		const response = await databetFetch(
			c.env,
			`/bet-boosts/${result.boost_id}`,
			{
				method: "PUT",
				body: apiRequestBody,
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

	try {
		const response = await databetFetch(c.env, `/bet-boosts/${id}`, {
			method: "DELETE",
		});

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
