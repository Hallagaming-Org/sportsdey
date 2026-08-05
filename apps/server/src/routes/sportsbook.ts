import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq, gte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import {
	creditWallet,
	debitWallet,
	freezeWallet,
	unfreezeWallet,
} from "@/db/atomic-wallet";
import * as schema from "@/db/schema";
import { trackWebengageEvent } from "@/lib/webengage";
import { requirePermission } from "@/middleware/admin-permissions";
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
	SportEventQuerySchema,
	SportEventsResponseSchema,
	SportsbookTokenErrorSchema,
	TournamentQuerySchema,
	TournamentsResponseSchema,
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

const SPORT_IDS: Record<"Football" | "Basketball" | "Tennis", string> = {
	Football: "football",
	Basketball: "basketball",
	Tennis: "tennis",
};

const sportsbookRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

export default sportsbookRoute;

type SportsbookSelection = {
	match_id?: string | number;
	meta?: {
		sport_event_info_sport_id?: string | number;
		sport_event_info_tournament_id?: string | number;
	};
};

function selectionSport(selection: SportsbookSelection | undefined): string {
	const value = selection?.meta?.sport_event_info_sport_id;
	return value == null ? "" : String(value);
}

function selectionLeague(selection: SportsbookSelection | undefined): string {
	const value = selection?.meta?.sport_event_info_tournament_id;
	return value == null ? "" : String(value);
}

function selectionMatchId(selection: SportsbookSelection | undefined): string {
	const value = selection?.match_id;
	return value == null ? "" : String(value);
}

async function databetFetch(
	env: CloudflareBindings,
	path: string,
	options: {
		method?: string;
		body?: unknown;
		query?: Record<string, string | string[] | undefined>;
		headers?: Record<string, string>;
	} = {},
): Promise<Response> {
	const proxyUrl = env.PROXY_URL?.trim();
	const proxySecret = env.PROXY_SECRET?.trim();

	if (!proxyUrl) {
		throw new Error("PROXY_URL not configured");
	}
	if (!proxySecret) {
		throw new Error("PROXY_SECRET not configured");
	}

	const searchParams = new URLSearchParams();
	if (options.query) {
		for (const [key, value] of Object.entries(options.query)) {
			if (value === undefined) {
				continue;
			}
			for (const item of Array.isArray(value) ? value : [value]) {
				searchParams.append(Array.isArray(value) ? `${key}[]` : key, item);
			}
		}
	}

	const baseUrl = `${proxyUrl.replace(/\/+$/, "")}/${env.NODE_ENV === "staging" ? "sportsbook-staging" : "sportsbook"}${path.startsWith("/") ? path : `/${path}`}`;
	const url =
		searchParams.size > 0 ? `${baseUrl}?${searchParams.toString()}` : baseUrl;
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		"X-Proxy-Auth": proxySecret,
		...options.headers,
	};

	try {
		return await fetch(url, {
			method: options.method || "GET",
			headers,
			body: options.body ? JSON.stringify(options.body) : undefined,
		});
	} catch (error) {
		console.error("Sportsbook proxy request threw", {
			path,
			nodeEnv: env.NODE_ENV,
			proxyTarget: url,
			hasProxyUrl: Boolean(proxyUrl),
			hasProxySecret: Boolean(proxySecret),
			// DATABET_CERT is documented at the architecture level, but current
			// sportsbook traffic is actually proxied through apps/proxy, where the
			// mTLS cert is attached by nginx rather than the Worker fetch itself.
			hasDatabetCertBinding: Boolean(
				(env as unknown as Record<string, unknown>).DATABET_CERT,
			),
			error:
				error instanceof Error
					? {
							name: error.name,
							message: error.message,
							stack: error.stack,
						}
					: String(error),
		});
		throw error;
	}
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

	if (!c.env.PROXY_URL?.trim()) {
		return c.json(
			{
				success: false as const,
				error: "Proxy URL not configured",
				details: null,
			},
			500,
		);
	}
	if (!c.env.PROXY_SECRET?.trim()) {
		return c.json(
			{
				success: false as const,
				error: "Proxy secret not configured",
				details: null,
			},
			500,
		);
	}

	const db = drizzle(c.env.DB, { schema });
	let sessionId = "";

	if (user) {
		const now = new Date();
		const sportsbookSessionId = crypto.randomUUID();
		sessionId = sportsbookSessionId;

		const sportsbookSession = await db
			.insert(schema.sportsbookSession)
			.values({
				id: sportsbookSessionId,
				userId: user.id,
				createdAt: now,
				updatedAt: now,
			})
			.returning();
		if (sportsbookSession.length === 0) {
			return c.json(
				{
					success: false as const,
					error: "An error occured",
					details: null,
				},
				500,
			);
		}
	}

	const requestBody = {
		locale: "en",
		currency: "NGN",
		...(user ? { player_id: user.id } : {}),
		...(sessionId === "" ? {} : { params: { session_id: sessionId } }),
	};

	let response: Response;
	try {
		response = await databetFetch(c.env, "/token/create", {
			method: "POST",
			body: requestBody,
		});
	} catch (error) {
		console.error("Sportsbook token/create failed before upstream response", {
			nodeEnv: c.env.NODE_ENV,
			hasProxyUrl: Boolean(c.env.PROXY_URL?.trim()),
			hasProxySecret: Boolean(c.env.PROXY_SECRET?.trim()),
			hasDatabetCertBinding: Boolean(
				(c.env as unknown as Record<string, unknown>).DATABET_CERT,
			),
			requestBody,
			error:
				error instanceof Error
					? {
							name: error.name,
							message: error.message,
							stack: error.stack,
						}
					: String(error),
		});
		return c.json(
			{
				success: false as const,
				error: "Betting API request failed",
				details:
					error instanceof Error
						? error.message
						: "Unknown proxy request error",
			},
			500,
		);
	}

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

	const foreignParams = JSON.parse(foreignParamsHeader) as {
		session_id: string;
		[key: string]: unknown;
	};

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

	const sportsbookSession = await db.query.sportsbookSession.findFirst({
		where: eq(schema.sportsbookSession.id, session_id),
	});

	if (!sportsbookSession) {
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

	let session_id: string;
	try {
		const foreignParams = JSON.parse(foreignParamsHeader) as {
			session_id: string;
			[key: string]: unknown;
		};
		session_id = foreignParams.session_id;
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

	const sportsbookSession = await db.query.sportsbookSession.findFirst({
		where: eq(schema.sportsbookSession.id, session_id as string),
	});

	if (!sportsbookSession) {
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

	const wallet = await db.query.wallet.findFirst({
		where: eq(schema.wallet.userId, sportsbookSession.userId),
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

	const now = new Date();
	if (!isFreebet) {
		const walletUpdate = await freezeWallet(
			db,
			sportsbookSession.userId,
			stakeKobo,
		);
		if (!walletUpdate) {
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
			userId: sportsbookSession.userId,
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
	const firstOdds = selections[0] as Record<string, any> | undefined;
	trackWebengageEvent(
		c.env,
		{
			userId: sportsbookSession.userId,
			eventName: "bet_slip_created",
			eventData: {
				sport: selectionSport(firstOdds),
				league: selectionLeague(firstOdds),
				match_id: selectionMatchId(firstOdds),
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

	let session_id: string;
	try {
		const foreignParams = JSON.parse(foreignParamsHeader) as {
			session_id: string;
			[key: string]: unknown;
		};
		session_id = foreignParams.session_id;
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

	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "invalid_request_body",
						message: "Request body is not valid JSON",
					},
				},
			},
			400,
		);
	}

	const result = BetPlaceRequestSchema.safeParse(body);
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

	const sportsbookSession = await db.query.sportsbookSession.findFirst({
		where: eq(schema.sportsbookSession.id, session_id as string),
	});

	if (!sportsbookSession) {
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

	// if (bet.status !== "created") {
	// 	return c.json(
	// 		{
	// 			error: {
	// 				code: "custom_error",
	// 				data: {
	// 					code: "bet_not_in_created_status",
	// 					current_status: bet.status,
	// 				},
	// 			},
	// 		},
	// 		400,
	// 	);
	// }

	let balAfter: number;

	const wallet = await db.query.wallet.findFirst({
		where: eq(schema.wallet.userId, bet.userId),
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

	const balanceBefore = wallet.balance;
	balAfter = balanceBefore;

	if (!bet.betFreebetId) {
		const walletUpdate = await db
			.update(schema.wallet)
			.set({
				balance: sql`${schema.wallet.balance} - ${bet.stake}`,
				frozenBalance: sql`${schema.wallet.frozenBalance} - ${bet.stake}`,
			})
			.where(
				and(
					eq(schema.wallet.userId, bet.userId),
					gte(schema.wallet.frozenBalance, bet.stake),
				),
			)
			.returning({
				userId: schema.wallet.userId,
				balance: schema.wallet.balance,
			});
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
		const newBalance = walletUpdate[0]!.balance;
		balAfter = newBalance;

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

	const selections = result.data.bet_odds as
		| Array<Record<string, any>>
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
				sport: selectionSport(firstSelection),
				league: selectionLeague(firstSelection),
				match_ids: selections?.map((s) => selectionMatchId(s)) ?? [],
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
	bet_player_id: z.string(),
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

	let session_id: string;
	try {
		const foreignParams = JSON.parse(foreignParamsHeader) as {
			session_id: string;
			[key: string]: unknown;
		};
		session_id = foreignParams.session_id;
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

	const sportsbookSession = await db.query.sportsbookSession.findFirst({
		where: eq(schema.sportsbookSession.id, session_id as string),
	});

	if (!sportsbookSession) {
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

	const wallet = await db.query.wallet.findFirst({
		where: eq(schema.wallet.userId, bet.userId),
	});

	if (wallet && !bet.betFreebetId) {
		if (bet.status === "created") {
			const walletUpdate = await unfreezeWallet(db, bet.userId, bet.stake);
			console.log("wallet update", walletUpdate);
			if (!walletUpdate) {
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
			const walletUpdate = await creditWallet(db, bet.userId, bet.stake);
			console.log("wallet update", walletUpdate);
			if (!walletUpdate) {
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
					balance: walletUpdate.balance,
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
	const nextStatus = hasSupportedRestriction ? "place_error" : "force_decline";

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

	let session_id: string;
	try {
		const foreignParams = JSON.parse(foreignParamsHeader) as {
			session_id: string;
			[key: string]: unknown;
		};
		session_id = foreignParams.session_id;
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

	const sportsbookSession = await db.query.sportsbookSession.findFirst({
		where: eq(schema.sportsbookSession.id, session_id as string),
	});

	if (!sportsbookSession) {
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

	const newStatus =
		settleType === 3
			? "loss"
			: settleType === 2
				? bet.status === "unsettled"
					? "refunded_manually"
					: "rolled_back"
				: "win";

	const betClaim = await db
		.update(schema.sportsbookBet)
		.set({
			status: newStatus,
			settleAmount: settleAmount,
			settleType: settleType,
			betData: JSON.stringify(result.data),
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(schema.sportsbookBet.id, result.data.bet_id),
				or(
					eq(schema.sportsbookBet.status, "accepted"),
					eq(schema.sportsbookBet.status, "unsettled"),
				),
			),
		)
		.returning({ id: schema.sportsbookBet.id });
	if (betClaim.length === 0) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "bet_already_settled",
						current_status: bet.status,
					},
				},
			},
			400,
		);
	}

	const wallet = await db.query.wallet.findFirst({
		where: eq(schema.wallet.userId, bet.userId),
	});

	const isFreebetWin = bet.betFreebetId && settleType === 1;
	const shouldCredit = !bet.betFreebetId || isFreebetWin;

	if (wallet && shouldCredit) {
		const walletUpdate = await creditWallet(db, bet.userId, settleAmount);
		if (!walletUpdate) {
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
		const newBalance = walletUpdate.balance;

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

	const settleTypeLabel =
		settleType === 1 ? "win" : settleType === 2 ? "refund" : "loss";

	const settleSelections = result.data.bet_odds as
		| Array<Record<string, any>>
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
				net_pnl: Number.parseFloat(result.data.settle_amount) * 100 - bet.stake,
				sport: selectionSport(settleFirstOdds),
				league: selectionLeague(settleFirstOdds),
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

	let session_id: string;
	try {
		const foreignParams = JSON.parse(foreignParamsHeader) as {
			session_id: string;
			[key: string]: unknown;
		};
		session_id = foreignParams.session_id;
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

	const sportsbookSession = await db.query.sportsbookSession.findFirst({
		where: eq(schema.sportsbookSession.id, session_id as string),
	});

	if (!sportsbookSession) {
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

	const betClaim = await db
		.update(schema.sportsbookBet)
		.set({
			status: "unsettled",
			settleAmount: null,
			settleType: null,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(schema.sportsbookBet.id, result.data.bet_id),
				or(
					eq(schema.sportsbookBet.status, "settled"),
					eq(schema.sportsbookBet.status, "rolled_back"),
					eq(schema.sportsbookBet.status, "refunded_manually"),
				),
			),
		)
		.returning({ id: schema.sportsbookBet.id });
	if (betClaim.length === 0) {
		return c.json(
			{
				error: {
					code: "custom_error",
					data: {
						code: "bet_already_unsettle",
						current_status: bet.status,
					},
				},
			},
			400,
		);
	}

	const wallet = await db.query.wallet.findFirst({
		where: eq(schema.wallet.userId, bet.userId),
	});

	if (wallet) {
		const walletUpdate = await debitWallet(db, bet.userId, unsettleAmount);
		if (!walletUpdate) {
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
		const newBalance = walletUpdate.balance;

		const [walletTxn] = await db
			.insert(schema.walletTransaction)
			.values({
				id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
				userId: bet.userId,
				amount: unsettleAmount,
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

	let session_id: string;
	try {
		const foreignParams = JSON.parse(foreignParamsHeader) as {
			session_id: string;
			[key: string]: unknown;
		};
		session_id = foreignParams.session_id;
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

	const sportsbookSession = await db.query.sportsbookSession.findFirst({
		where: eq(schema.sportsbookSession.id, session_id as string),
	});

	if (!sportsbookSession) {
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

	const existingOrderIds = bet.cashOutOrderIds
		? JSON.parse(bet.cashOutOrderIds)
		: [];
	if (existingOrderIds.includes(result.data.cash_out_order_id)) {
		return c.body(null, 204);
	}
	const newOrderIds = [...existingOrderIds, result.data.cash_out_order_id];

	const betClaim = await db
		.update(schema.sportsbookBet)
		.set({
			cashOutOrderIds: JSON.stringify(newOrderIds),
			betData: JSON.stringify(result.data),
			updatedAt: new Date(),
		})
		.where(eq(schema.sportsbookBet.id, result.data.bet_id))
		.returning({ id: schema.sportsbookBet.id });
	if (betClaim.length === 0) {
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

	const wallet = await db.query.wallet.findFirst({
		where: eq(schema.wallet.userId, bet.userId),
	});

	if (wallet) {
		const walletUpdate = await creditWallet(db, bet.userId, refundAmountKobo);
		if (!walletUpdate) {
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
		const newBalance = walletUpdate.balance;

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
				cashout_rate: bet.stake - Number.parseFloat(result.data.refund_amount),
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

	let session_id: string;
	try {
		const foreignParams = JSON.parse(foreignParamsHeader) as {
			session_id: string;
			[key: string]: unknown;
		};
		session_id = foreignParams.session_id;
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

	const sportsbookSession = await db.query.sportsbookSession.findFirst({
		where: eq(schema.sportsbookSession.id, session_id as string),
	});

	if (!sportsbookSession) {
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
		const parsed = JSON.parse(event.eventData) as {
			cash_out_order_ids?: string[];
		};
		for (const orderId of parsed.cash_out_order_ids ?? []) {
			previouslyDeclinedOrderIds.add(orderId);
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

	if (orderIdsToReverse.length > 0) {
		const existingOrderIds = bet.cashOutOrderIds
			? JSON.parse(bet.cashOutOrderIds)
			: [];
		const newOrderIds = [...existingOrderIds, ...orderIdsToReverse];

		const betClaim = await db
			.update(schema.sportsbookBet)
			.set({
				cashOutOrderIds: JSON.stringify(newOrderIds),
				betData: JSON.stringify(result.data),
				updatedAt: new Date(),
			})
			.where(eq(schema.sportsbookBet.id, result.data.bet_id))
			.returning({ id: schema.sportsbookBet.id });
		if (betClaim.length === 0) {
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

		const wallet = await db.query.wallet.findFirst({
			where: eq(schema.wallet.userId, bet.userId),
		});

		if (wallet && refundAmountKobo > 0) {
			const walletUpdate = await debitWallet(db, bet.userId, refundAmountKobo);
			if (!walletUpdate) {
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
			const newBalance = walletUpdate.balance;

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

	const response = await databetFetch(c.env, "/freebet/create", {
		method: "POST",
		body: apiRequestBody,
	});

	console.log("requestBody", apiRequestBody);

	if (!response.ok) {
		const errorText = await response.text();
		console.error("Data.Bet freebet create error:", response.status, errorText);
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
					id: freebetsData[index].idempotence_id,
					dataBetFreebetId: data.freebet_ids[index],
					amount: fb.amount,
					currency: fb.currency,
					expiresAt: toWAT(fb.expires_at),
				}),
			),
		},
		200,
	);
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

	const response = await databetFetch(c.env, "/freebet/update", {
		method: "POST",
		body: apiRequestBody,
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error("Data.Bet freebet update error:", response.status, errorText);
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

	const response = await databetFetch(c.env, "/freebet/cancel", {
		method: "POST",
		body: { freebet_id: result.freebet_id },
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error("Data.Bet freebet cancel error:", response.status, errorText);
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

	const db = drizzle(c.env.DB, { schema });

	const sportIds = result.eligibleSports.map((sport) => SPORT_IDS[sport]);
	const multiplier = (1 + result.boostPercentage / 100).toFixed(2);
	const expiresAt = new Date(result.endDateTime).toISOString();

	const buildPerOddConditions = () => ({
		sport: {
			type: "sport",
			match_all_odds: true,
			sport_ids: sportIds,
		},
		...(result.competitionIDs.length > 0
			? {
					tournament: {
						type: "tournament",
						match_all_odds: true,
						tournament_ids: result.competitionIDs,
					},
				}
			: {}),
		...(result.eligibleEventsID.length > 0
			? {
					sport_event: {
						type: "sport_event",
						match_all_odds: true,
						sport_event_ids: result.eligibleEventsID,
					},
				}
			: {}),
		odd_value: {
			type: "odd_value",
			match_all_odds: true,
			min: result.minimumOddsPerSelection.toFixed(2),
		},
	});

	const buildRequiredConditions = (): Array<Record<string, unknown>> => [
		{
			type: "bet_details",
			bet_details: [
				{
					bet_type: 2,
					data: {
						...buildPerOddConditions(),
						odds_count: {
							type: "odds_count",
							min: result.minimumSelections,
							max: result.maximumSelections,
						},
					},
				},
			],
		},
	];

	const buildApplicableConditions = (): Array<Record<string, unknown>> => [
		{
			type: "bet_details",
			bet_details: [
				{
					bet_type: 2,
					data: buildPerOddConditions(),
				},
			],
		},
	];

	const buildPayload = (playerId?: string) => ({
		idempotence_id: crypto.randomUUID(),
		...(playerId ? { player_id: playerId } : {}),
		currency_code: "NGN",
		initial_quantity: 0,
		expires_at: expiresAt,
		calculation_strategy: {
			type: "static",
			strategy: {
				conditions: [],
				params: {
					multiplier,
					min_selections: result.minimumSelections,
				},
			},
		},
		required_conditions: buildRequiredConditions(),
		applicable_conditions: buildApplicableConditions(),
	});

	let targetPlayerIds: string[] | undefined;
	if (result.eligibleUsers === "new") {
		const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
		const newUsers = await db
			.select({ id: schema.user.id })
			.from(schema.user)
			.where(gte(schema.user.createdAt, new Date(sevenDaysAgo)));
		targetPlayerIds = newUsers.map((newUser) => newUser.id);
		if (targetPlayerIds.length === 0) {
			return c.json(
				{
					success: false as const,
					error: "No new users found in the last 7 days",
				},
				400,
			);
		}
	}

	const targets: Array<string | undefined> =
		targetPlayerIds && targetPlayerIds.length > 0
			? targetPlayerIds
			: [undefined];

	const promotionId = crypto.randomUUID();

	const created: Array<{
		id: string;
		dataBetBoostId: string;
		playerId: string | null;
	}> = [];
	console.log("targets", targets);

	for (const playerId of targets) {
		const apiRequestBody = buildPayload(playerId);

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

		const data = (await response.json()) as {
			id: string;
		};

		console.log("responseData", data)

		const createdBoost = data;
		if (!createdBoost) {
			return c.json(
				{
					success: false as const,
					error: "No boost created",
				},
				400,
			);
		}

		created.push({
			id: crypto.randomUUID(),
			dataBetBoostId: createdBoost.id,
			playerId: playerId ?? null,
		});
	}

	await db.insert(schema.sportsbookPromotion).values({
		id: promotionId,
		promotionType: "bet_boost",
		name: result.boostName,
		description: result.description,
		eligibleUsers: result.eligibleUsers,
		eligibleSports: JSON.stringify(result.eligibleSports),
		competitionIds:
			result.competitionIDs.length > 0
				? JSON.stringify(result.competitionIDs)
				: null,
		eligibleEventIds:
			result.eligibleEventsID.length > 0
				? JSON.stringify(result.eligibleEventsID)
				: null,
		boostPercentage: result.boostPercentage,
		minimumSelections: result.minimumSelections,
		maximumSelections: result.maximumSelections,
		minimumOddsPerSelection: result.minimumOddsPerSelection,
		...(result.maximumWin !== undefined
			? { maximumWin: result.maximumWin }
			: {}),
		endDateTime: new Date(result.endDateTime),
	});

	for (const boost of created) {
		await db.insert(schema.sportsbookBetBoost).values({
			id: boost.id,
			dataBetBoostId: boost.dataBetBoostId,
			playerId: boost.playerId,
			boostName: result.boostName,
			description: result.description,
			boostPercentage: result.boostPercentage,
			minimumSelections: result.minimumSelections,
			maximumSelections: result.maximumSelections,
			minimumOddsPerSelection: result.minimumOddsPerSelection,
			eligibleUsers: result.eligibleUsers,
			eligibleSports: JSON.stringify(result.eligibleSports),
			promotionId,
			...(result.maximumWin !== undefined
				? { maximumWin: result.maximumWin }
				: {}),
		});
	}

	return c.json(
		{
			success: true as const,
			data: created,
		},
		200,
	);
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

	const response = await databetFetch(c.env, "/bet-boosts");

	if (!response.ok) {
		const errorText = await response.text();
		console.error("Data.Bet bet-boost list error:", response.status, errorText);
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

	const response = await databetFetch(c.env, `/bet-boosts/${id}`);

	if (!response.ok) {
		const errorText = await response.text();
		console.error("Data.Bet bet-boost get error:", response.status, errorText);
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

	const response = await databetFetch(c.env, `/bet-boosts/${result.boost_id}`, {
		method: "PUT",
		body: apiRequestBody,
	});

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
		200: {
			description: "Bet boost deleted successfully",
			content: {
				"application/json": {
					schema: z.object({ success: z.literal(true) }),
				},
			},
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

	const response = await databetFetch(c.env, `/bet-boosts/${id}`, {
		method: "DELETE",
	});

	if (!response.ok && response.status !== 404) {
		const errorText = await response.text();
		console.error(
			"Data.Bet bet-boost delete error:",
			response.status,
			errorText,
		);
		return c.json(
			{
				success: false as const,
				error: `Failed to delete bet boost: ${response.status}`,
			},
			400,
		);
	}

	const db = drizzle(c.env.DB, { schema });

	const boosts = await db
		.select({
			id: schema.sportsbookBetBoost.id,
			promotionId: schema.sportsbookBetBoost.promotionId,
		})
		.from(schema.sportsbookBetBoost)
		.where(eq(schema.sportsbookBetBoost.dataBetBoostId, id));

	const promotionIds = new Set<string>();
	for (const boost of boosts) {
		if (boost.promotionId) promotionIds.add(boost.promotionId);
		await db
			.delete(schema.sportsbookBetBoost)
			.where(eq(schema.sportsbookBetBoost.id, boost.id));
	}

	for (const promotionId of promotionIds) {
		const [remaining] = await db
			.select({ count: sql<number>`COUNT(*)` })
			.from(schema.sportsbookBetBoost)
			.where(eq(schema.sportsbookBetBoost.promotionId, promotionId));
		if (Number(remaining?.count ?? 0) === 0) {
			await db
				.delete(schema.sportsbookPromotion)
				.where(eq(schema.sportsbookPromotion.id, promotionId));
		}
	}

	return c.json({ success: true as const }, 200);
});

const sportsbookEventsRoute = createRoute({
	method: "get",
	path: "/events",
	tags: ["Sportsbook"],
	summary: "List sport events by sport and match status",
	description:
		"Fetch all sport events matching the given sport ids and match status from the Data.Bet sportsbook. Requires admin or super_admin authentication, or an admin with the create_promotion permission.",
	security: [{ BearerAuth: [] }],
	request: {
		query: SportEventQuerySchema,
	},
	responses: {
		200: {
			description: "Sport events retrieved successfully",
			content: {
				"application/json": {
					schema: SportEventsResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid query parameters",
		},
		401: {
			description: "Unauthorized",
		},
		403: {
			description: "Forbidden - create_promotion permission required",
		},
		500: {
			description: "Failed to fetch sport events from Data.Bet",
		},
	},
});

sportsbookRoute.openapi(sportsbookEventsRoute, async (c) => {
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

	if (
		session.role !== "super_admin" &&
		!requirePermission(session, "create_promotion")
	) {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - create_promotion permission required",
			},
			403,
		);
	}

	const query = c.req.valid("query");
	const sportIds = Array.isArray(query.sportId)
		? query.sportId
		: [query.sportId];
	const matchStatus = query.status === "live" ? "LIVE" : "NOT_STARTED";

	try {
		const events: Array<{ id: string; title: string }> = [];
		const limit = 100;
		let offset = 0;
		const dateFrom = new Date();
		const dateTo = new Date(dateFrom.getTime() + 365 * 24 * 60 * 60 * 1000);

		while (true) {
			const response = await databetFetch(
				c.env,
				"/sport-events-fixtures/search",
				{
					query: {
						locale: "en",
						sportIds,
						matchStatuses: [matchStatus],
						sportEventTypes: ["MATCH"],
						dateFrom: dateFrom.toISOString(),
						dateTo: dateTo.toISOString(),
						offset: String(offset),
						limit: String(limit),
					},
				},
			);
			console.log("requestUrl", response.url);

			if (!response.ok) {
				const errorText = await response.text();
				console.error(
					"Data.Bet sport events search error:",
					response.status,
					errorText,
				);
				return c.json(
					{
						success: false as const,
						error: `Failed to fetch sport events: ${response.status}`,
						details: errorText,
					},
					500,
				);
			}

			const data = (await response.json()) as {
				data?: {
					sportEventsByFilters?: Array<{
						id?: string;
						fixture?: { title?: string };
					}>;
				};
			};

			const page = data.data?.sportEventsByFilters ?? [];
			for (const sportEvent of page) {
				if (sportEvent.id && sportEvent.fixture?.title) {
					events.push({
						id: sportEvent.id,
						title: sportEvent.fixture.title,
					});
				}
			}

			if (page.length < limit) {
				break;
			}
			offset += limit;
		}

		return c.json(
			{
				success: true as const,
				data: events,
			},
			200,
		);
	} catch (error) {
		console.error("Data.Bet sport events search threw", {
			error: error instanceof Error ? error.message : String(error),
		});
		return c.json(
			{
				success: false as const,
				error: "Failed to fetch sport events",
			},
			500,
		);
	}
});

const sportsbookTournamentsRoute = createRoute({
	method: "get",
	path: "/tournaments",
	tags: ["Sportsbook"],
	summary: "List sportbook tournaments by sport",
	description:
		"Fetch a page of tournaments for the given sports from the Data.Bet sportsbook, honoring the limit and offset query params. Requires admin or super_admin authentication, or an admin with the create_promotion permission.",
	security: [{ BearerAuth: [] }],
	request: {
		query: TournamentQuerySchema,
	},
	responses: {
		200: {
			description: "Tournaments retrieved successfully",
			content: {
				"application/json": {
					schema: TournamentsResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid query parameters",
		},
		401: {
			description: "Unauthorized",
		},
		403: {
			description: "Forbidden - create_promotion permission required",
		},
		500: {
			description: "Failed to fetch tournaments from Data.Bet",
		},
	},
});

sportsbookRoute.openapi(sportsbookTournamentsRoute, async (c) => {
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

	if (
		session.role !== "super_admin" &&
		!requirePermission(session, "create_promotion")
	) {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - create_promotion permission required",
			},
			403,
		);
	}

	const query = c.req.valid("query");
	const sports = Array.isArray(query.sport) ? query.sport : [query.sport];
	const { offset, limit } = query;

	try {
		const fetchSport = async (
			sportId: string,
		): Promise<{
			page: Array<{ id: string; title: string }>;
			fullPage: boolean;
		}> => {
			const response = await databetFetch(c.env, "/v2/tournaments/by-filters", {
				method: "POST",
				headers: { "Api-Locale": "en" },
				body: { sport: sportId, limit, offset },
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error(
					"Data.Bet tournaments by-filters error:",
					sportId,
					response.status,
					errorText,
				);
				throw new Error(
					`Failed to fetch tournaments for ${sportId}: ${response.status}`,
				);
			}

			const data = (await response.json()) as {
				data?: {
					tournaments_by_filters?: Array<{
						id?: string;
						name?: string;
					}>;
				};
			};

			const rawPage = data.data?.tournaments_by_filters ?? [];
			const page: Array<{ id: string; title: string }> = [];
			for (const tournament of rawPage) {
				if (tournament.id && tournament.name) {
					page.push({
						id: tournament.id,
						title: tournament.name,
					});
				}
			}

			return { page, fullPage: rawPage.length === limit };
		};

		const pagesBySport = await Promise.all(sports.map(fetchSport));

		const seen = new Set<string>();
		const tournaments: Array<{ id: string; title: string }> = [];
		for (const result of pagesBySport) {
			for (const tournament of result.page) {
				if (seen.has(tournament.id)) {
					continue;
				}
				seen.add(tournament.id);
				tournaments.push(tournament);
			}
		}

		const hasMore = pagesBySport.some((result) => result.fullPage);

		return c.json(
			{
				success: true as const,
				data: {
					tournaments,
					pagination: {
						offset,
						limit,
						total: offset + tournaments.length,
						hasMore,
					},
				},
			},
			200,
		);
	} catch (error) {
		console.error("Data.Bet tournaments fetch threw", {
			error: error instanceof Error ? error.message : String(error),
		});
		return c.json(
			{
				success: false as const,
				error: "Failed to fetch tournaments",
				details: error instanceof Error ? error.message : String(error),
			},
			500,
		);
	}
});
