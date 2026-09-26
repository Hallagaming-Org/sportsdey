import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import * as schema from "@/db/schema";
import {
	handleBalance,
	handleBet,
	handleRefund,
	handleWin,
} from "@/integrations/swipegames/adapter";
import { mapSwipeGamesLobbyGame } from "@/integrations/swipegames/catalog";
import { SwipeGamesClient, SwipeGamesApiError } from "@/integrations/swipegames/client";
import {
	assertSwipeGamesCallbackIp,
	getSwipeGamesConfig,
	requireSwipeGamesConfig,
	SwipeGamesConfigError,
	SwipeGamesIpForbiddenError,
} from "@/integrations/swipegames/config";
import { getClientIp } from "@/utils/request";
import { nairaDecimalToKobo } from "@/integrations/swipegames/money";
import {
	verifyQuerySignature,
	verifyRawBodySignature,
} from "@/integrations/swipegames/sign";
import type {
	BetRequest,
	RefundRequest,
	WinRequest,
} from "@/integrations/swipegames/types";
import {
	BONUS_ENGINE_NATIVE_PROVIDER_ID,
	casinoBetAmountFromKobo,
	optionalExecutionCtx,
	reportCasinoBetInBackground,
	reportCasinoBetResultInBackground,
} from "@/services/bonus-engine";
import type { CloudflareBindings } from "../types";

type SwipeGamesContext = {
	Bindings: CloudflareBindings;
};

const swipegamesRoute = new OpenAPIHono<SwipeGamesContext>();

const GAMES_CACHE_KEY = "swipegames:games:v1";
const GAMES_CACHE_TTL_SECONDS = 60 * 60;

const AdapterErrorSchema = z
	.object({
		message: z.string(),
		details: z.string().optional(),
		code: z.string().optional(),
		action: z.string().optional(),
		actionData: z.string().optional(),
	})
	.openapi("SwipeGamesAdapterError");

const BalanceResponseSchema = z
	.object({
		balance: z.string(),
	})
	.openapi("SwipeGamesBalanceResponse");

const TxResponseSchema = z
	.object({
		balance: z.string(),
		txID: z.string(),
	})
	.openapi("SwipeGamesTxResponse");

const LaunchRequestSchema = z
	.object({
		gameId: z.string().min(1).openapi({ description: "Swipe Games game ID" }),
		device: z.enum(["desktop", "mobile"]).optional(),
		returnUrl: z.string().url().optional(),
		demo: z.boolean().optional(),
	})
	.openapi("SwipeGamesLaunchRequest");

const LaunchResponseSchema = z
	.object({
		success: z.boolean(),
		data: z.object({ url: z.string() }).optional(),
		error: z.string().optional(),
		details: z.any().optional(),
	})
	.openapi("SwipeGamesLaunchResponse");

const LobbyGameSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		code: z.string(),
		imageUrl: z.string().nullable(),
		categories: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				slug: z.string(),
			}),
		),
		enabled: z.boolean(),
		createdAt: z.number(),
		updatedAt: z.number(),
		provider: z.literal("swipegames"),
		hasFreeSpins: z.boolean(),
	})
	.openapi("SwipeGamesLobbyGame");

const CreateFreeRoundsBodySchema = z
	.object({
		extID: z.string().min(1),
		currency: z.string().min(1).default("NGN"),
		quantity: z.number().int().min(1).max(99),
		betLine: z.number().int().min(1).max(99),
		validFrom: z.string(),
		validUntil: z.string().optional(),
		gameIDs: z.array(z.string()).optional(),
		userIDs: z.array(z.string()).optional(),
	})
	.openapi("SwipeGamesCreateFreeRoundsRequest");

function adapterErrorResponses() {
	return {
		400: {
			description: "Bad request",
			content: { "application/json": { schema: AdapterErrorSchema } },
		},
		401: {
			description: "Invalid signature",
			content: { "application/json": { schema: AdapterErrorSchema } },
		},
		403: {
			description: "Callback IP is not allowlisted",
			content: { "application/json": { schema: AdapterErrorSchema } },
		},
		404: {
			description: "Session not found",
			content: { "application/json": { schema: AdapterErrorSchema } },
		},
		500: {
			description: "Server error",
			content: { "application/json": { schema: AdapterErrorSchema } },
		},
	} as const;
}

async function requireAdmin(c: {
	env: CloudflareBindings;
	req: { raw: { headers: Headers } };
}) {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) return null;
	const session = await validateAdminSession(c.env, token);
	if (
		!session ||
		(session.role !== "admin" && session.role !== "super_admin")
	) {
		return null;
	}
	return session;
}

function invalidSignature() {
	return { message: "Invalid signature" };
}

const balanceRoute = createRoute({
	method: "get",
	path: "/balance",
	tags: ["Swipe Games"],
	summary: "Get player balance (Swipe Games reverse call)",
	request: {
		query: z.object({ sessionID: z.string() }),
		headers: z.object({
			"x-request-sign": z.string().optional(),
		}),
	},
	responses: {
		200: {
			description: "Current balance",
			content: { "application/json": { schema: BalanceResponseSchema } },
		},
		...adapterErrorResponses(),
	},
});

const betRoute = createRoute({
	method: "post",
	path: "/bet",
	tags: ["Swipe Games"],
	summary: "Place a bet (Swipe Games reverse call)",
	responses: {
		200: {
			description: "Bet applied",
			content: { "application/json": { schema: TxResponseSchema } },
		},
		...adapterErrorResponses(),
	},
});

const winRoute = createRoute({
	method: "post",
	path: "/win",
	tags: ["Swipe Games"],
	summary: "Credit a win (Swipe Games reverse call)",
	responses: {
		200: {
			description: "Win applied",
			content: { "application/json": { schema: TxResponseSchema } },
		},
		...adapterErrorResponses(),
	},
});

const refundRoute = createRoute({
	method: "post",
	path: "/refund",
	tags: ["Swipe Games"],
	summary: "Refund a bet (Swipe Games reverse call)",
	responses: {
		200: {
			description: "Refund applied",
			content: { "application/json": { schema: TxResponseSchema } },
		},
		...adapterErrorResponses(),
	},
});

const gamesRoute = createRoute({
	method: "get",
	path: "/games",
	tags: ["Swipe Games"],
	summary: "List Swipe Games for the casino lobby",
	responses: {
		200: {
			description: "Lobby games",
			content: {
				"application/json": { schema: z.array(LobbyGameSchema) },
			},
		},
		500: {
			description: "Not configured or upstream error",
			content: { "application/json": { schema: AdapterErrorSchema } },
		},
	},
});

const launchRoute = createRoute({
	method: "post",
	path: "/launch",
	tags: ["Swipe Games"],
	summary: "Create a Swipe Games session and return the launcher URL",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: { "application/json": { schema: LaunchRequestSchema } },
		},
	},
	responses: {
		200: {
			description: "Launch URL",
			content: { "application/json": { schema: LaunchResponseSchema } },
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: LaunchResponseSchema } },
		},
		400: {
			description: "Invalid request",
			content: { "application/json": { schema: LaunchResponseSchema } },
		},
		500: {
			description: "Configuration or upstream error",
			content: { "application/json": { schema: LaunchResponseSchema } },
		},
	},
});

const launchDemoRoute = createRoute({
	method: "post",
	path: "/launch-demo",
	tags: ["Swipe Games"],
	summary: "Create a Swipe Games demo session",
	request: {
		body: {
			content: { "application/json": { schema: LaunchRequestSchema } },
		},
	},
	responses: {
		200: {
			description: "Demo launch URL",
			content: { "application/json": { schema: LaunchResponseSchema } },
		},
		400: {
			description: "Invalid request",
			content: { "application/json": { schema: LaunchResponseSchema } },
		},
		500: {
			description: "Configuration or upstream error",
			content: { "application/json": { schema: LaunchResponseSchema } },
		},
	},
});

const createFreeRoundsRoute = createRoute({
	method: "post",
	path: "/free-rounds",
	tags: ["Swipe Games"],
	summary: "Create a Swipe Games free-rounds campaign (admin)",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: { "application/json": { schema: CreateFreeRoundsBodySchema } },
		},
	},
	responses: {
		200: {
			description: "Campaign created",
			content: { "application/json": { schema: z.any() } },
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: AdapterErrorSchema } },
		},
	},
});

const getFreeRoundsRoute = createRoute({
	method: "get",
	path: "/free-rounds",
	tags: ["Swipe Games"],
	summary: "Get a Swipe Games free-rounds campaign (admin)",
	security: [{ BearerAuth: [] }],
	request: {
		query: z.object({
			id: z.string().optional(),
			extID: z.string().optional(),
		}),
	},
	responses: {
		200: {
			description: "Campaign info",
			content: { "application/json": { schema: z.any() } },
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: AdapterErrorSchema } },
		},
	},
});

const deleteFreeRoundsRoute = createRoute({
	method: "delete",
	path: "/free-rounds",
	tags: ["Swipe Games"],
	summary: "Cancel a Swipe Games free-rounds campaign (admin)",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({
						id: z.string().optional(),
						extID: z.string().optional(),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: "Cancelled",
			content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: AdapterErrorSchema } },
		},
	},
});

function ipDenied() {
	return { message: "IP is not allowed", code: "ip_not_allowed" };
}

swipegamesRoute.openapi(balanceRoute, async (c) => {
	const config = getSwipeGamesConfig(c.env);
	if (!config) {
		return c.json({ message: "Swipe Games is not configured" }, 500);
	}
	try {
		assertSwipeGamesCallbackIp(getClientIp(c), config);
	} catch (error) {
		if (error instanceof SwipeGamesIpForbiddenError) {
			return c.json(ipDenied(), 403);
		}
		throw error;
	}
	const signature =
		c.req.header("x-request-sign") ?? c.req.header("X-REQUEST-SIGN");
	const query = c.req.query();
	if (!(await verifyQuerySignature(config.integrationApiKey, query, signature))) {
		return c.json(invalidSignature(), 401);
	}
	const sessionID = c.req.query("sessionID");
	if (!sessionID) {
		return c.json({ message: "sessionID is required", code: "session_not_found" }, 400);
	}
	const db = drizzle(c.env.DB, { schema });
	const result = await handleBalance(db, sessionID);
	return c.json(result.body, result.status);
});

async function readVerifiedJson<T>(c: {
	env: CloudflareBindings;
	req: {
		arrayBuffer: () => Promise<ArrayBuffer>;
		header: (name: string) => string | undefined;
	};
}): Promise<
	| { ok: true; body: T }
	| {
			ok: false;
			status: 401 | 400 | 403;
			body: { message: string; code?: string };
	  }
> {
	const config = getSwipeGamesConfig(c.env);
	if (!config) {
		return {
			ok: false,
			status: 400,
			body: { message: "Swipe Games is not configured" },
		};
	}
	try {
		assertSwipeGamesCallbackIp(
			c.req.header("cf-connecting-ip") ||
				c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
				"",
			config,
		);
	} catch (error) {
		if (error instanceof SwipeGamesIpForbiddenError) {
			return { ok: false, status: 403, body: ipDenied() };
		}
		throw error;
	}
	const raw = new Uint8Array(await c.req.arrayBuffer());
	const signature =
		c.req.header("x-request-sign") ?? c.req.header("X-REQUEST-SIGN");
	if (
		!(await verifyRawBodySignature(config.integrationApiKey, raw, signature))
	) {
		return { ok: false, status: 401, body: invalidSignature() };
	}
	try {
		return { ok: true, body: JSON.parse(new TextDecoder().decode(raw)) as T };
	} catch {
		return { ok: false, status: 400, body: { message: "Invalid JSON body" } };
	}
}

swipegamesRoute.openapi(betRoute, async (c) => {
	const verified = await readVerifiedJson<BetRequest>(c);
	if (!verified.ok) {
		return c.json(verified.body, verified.status);
	}
	const db = drizzle(c.env.DB, { schema });
	const result = await handleBet(db, verified.body);
	if (result.ok && verified.body.type === "regular") {
		const [row] = await db
			.select({
				userId: schema.swipegamesSessions.userId,
				gameId: schema.swipegamesSessions.gameId,
			})
			.from(schema.swipegamesSessions)
			.where(eq(schema.swipegamesSessions.sessionId, verified.body.sessionID))
			.limit(1);
		if (row) {
			try {
				const amountKobo = nairaDecimalToKobo(verified.body.amount);
				if (amountKobo > 0) {
					await reportCasinoBetInBackground({
						env: c.env,
						executionCtx: optionalExecutionCtx(c),
						userId: row.userId,
						betId: verified.body.txID,
						amount: casinoBetAmountFromKobo(amountKobo),
						currency: "NGN",
						gameRef: row.gameId,
						fallbackProviderId: BONUS_ENGINE_NATIVE_PROVIDER_ID.SWIPEGAMES,
					});
				}
			} catch (error) {
				console.error("Swipe Games bonus-engine report failed", error);
			}
		}
	}
	return c.json(result.body, result.status);
});

swipegamesRoute.openapi(winRoute, async (c) => {
	const verified = await readVerifiedJson<WinRequest>(c);
	if (!verified.ok) {
		return c.json(verified.body, verified.status);
	}
	const db = drizzle(c.env.DB, { schema });
	const result = await handleWin(db, verified.body);
	if (result.ok) {
		const [row] = await db
			.select({ userId: schema.swipegamesSessions.userId })
			.from(schema.swipegamesSessions)
			.where(eq(schema.swipegamesSessions.sessionId, verified.body.sessionID))
			.limit(1);
		if (row) {
			try {
				const amountKobo = nairaDecimalToKobo(verified.body.amount);
				await reportCasinoBetResultInBackground({
					env: c.env,
					executionCtx: optionalExecutionCtx(c),
					userId: row.userId,
					betId: verified.body.txID,
					totalWinAmount: casinoBetAmountFromKobo(amountKobo),
					isWin: amountKobo > 0 ? 1 : 0,
				});
			} catch (error) {
				console.error("Swipe Games bonus-engine betResult report failed", error);
			}
		}
	}
	return c.json(result.body, result.status);
});

swipegamesRoute.openapi(refundRoute, async (c) => {
	const verified = await readVerifiedJson<RefundRequest>(c);
	if (!verified.ok) {
		return c.json(verified.body, verified.status);
	}
	const db = drizzle(c.env.DB, { schema });
	const result = await handleRefund(db, verified.body);
	if (result.ok) {
		const [row] = await db
			.select({ userId: schema.swipegamesSessions.userId })
			.from(schema.swipegamesSessions)
			.where(eq(schema.swipegamesSessions.sessionId, verified.body.sessionID))
			.limit(1);
		if (row) {
			try {
				const amountKobo = nairaDecimalToKobo(verified.body.amount);
				await reportCasinoBetResultInBackground({
					env: c.env,
					executionCtx: optionalExecutionCtx(c),
					userId: row.userId,
					betId: verified.body.txID,
					totalWinAmount: casinoBetAmountFromKobo(amountKobo),
					isWin: 0,
					isRollback: 1,
				});
			} catch (error) {
				console.error("Swipe Games bonus-engine betResult report failed", error);
			}
		}
	}
	return c.json(result.body, result.status);
});

function asGameList(value: unknown): unknown[] {
	if (Array.isArray(value)) return value;
	if (value && typeof value === "object") {
		const record = value as { games?: unknown; data?: unknown };
		if (Array.isArray(record.games)) return record.games;
		if (Array.isArray(record.data)) return record.data;
	}
	return [];
}

swipegamesRoute.openapi(gamesRoute, async (c) => {
	const config = getSwipeGamesConfig(c.env);
	if (!config) {
		console.error("Swipe Games list skipped: missing CID/extCID/API keys");
		return c.json([], 200);
	}
	try {
		const cached = await c.env.sportsdey_ns.get(GAMES_CACHE_KEY);
		if (cached) {
			const parsed = JSON.parse(cached) as unknown;
			if (Array.isArray(parsed) && parsed.length > 0) {
				return c.json(parsed, 200);
			}
		}
	} catch {
		// continue without cache
	}

	try {
		const client = new SwipeGamesClient(config);
		let games = asGameList(
			await client.listGames({
				excludeBetLines: true,
				currencyFilters: "main_fiat",
				additionalCurrencies: "NGN",
			}),
		);
		if (games.length === 0) {
			games = asGameList(await client.listGames({ excludeBetLines: true }));
		}
		const lobby = games
			.map((game) => mapSwipeGamesLobbyGame(game as Parameters<typeof mapSwipeGamesLobbyGame>[0]))
			.filter((game): game is NonNullable<typeof game> => game !== null);
		if (lobby.length > 0) {
			try {
				await c.env.sportsdey_ns.put(GAMES_CACHE_KEY, JSON.stringify(lobby), {
					expirationTtl: GAMES_CACHE_TTL_SECONDS,
				});
			} catch {
				// ignore cache write failures
			}
		}
		if (lobby.length === 0) {
			console.error("Swipe Games list returned no mappable games", {
				env: config.env,
				extCid: config.extCid,
			});
		}
		return c.json(lobby, 200);
	} catch (error) {
		console.error("Swipe Games list failed", {
			message: error instanceof Error ? error.message : String(error),
			status: error instanceof SwipeGamesApiError ? error.status : undefined,
			details: error instanceof SwipeGamesApiError ? error.details : undefined,
			viaProxy: Boolean(config.proxyUrl && config.proxySecret),
			env: config.env,
		});
		return c.json([], 200);
	}
});

function resolveLaunchUrls(
	env: CloudflareBindings,
	returnUrl?: string,
): { returnURL?: string; depositURL?: string } {
	const frontend = env.FRONTEND_URL?.replace(/\/$/, "") || "";
	return {
		returnURL: returnUrl || (frontend ? `${frontend}/game-exit` : undefined),
		depositURL: frontend ? `${frontend}/wallet` : undefined,
	};
}

async function launchGame(
	c: {
		env: CloudflareBindings;
		req: { json: () => Promise<unknown> };
		get: (key: "user") => { id: string; name?: string | null } | null;
		json: (...args: never[]) => unknown;
	},
	forceDemo: boolean,
) {
	const user = c.get("user");
	const parsed = LaunchRequestSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return {
			status: 400 as const,
			body: {
				success: false,
				error: "Invalid request parameters",
				details: parsed.error.flatten(),
			},
		};
	}

	let config;
	try {
		config = requireSwipeGamesConfig(c.env);
	} catch (error) {
		return {
			status: 500 as const,
			body: {
				success: false,
				error:
					error instanceof SwipeGamesConfigError
						? error.message
						: "Swipe Games is not configured",
			},
		};
	}

	const demo = forceDemo || parsed.data.demo === true;
	if (!demo && !user) {
		return {
			status: 401 as const,
			body: { success: false, error: "Unauthorized" },
		};
	}

	const sessionID = crypto.randomUUID();
	const platform = parsed.data.device ?? "desktop";
	const urls = resolveLaunchUrls(c.env, parsed.data.returnUrl);
	const client = new SwipeGamesClient(config);

	try {
		const created = await client.createNewGame({
			gameID: parsed.data.gameId,
			demo,
			platform,
			currency: "NGN",
			locale: "en_us",
			fallbackToDefaultLocale: true,
			sessionID: demo ? undefined : sessionID,
			returnURL: urls.returnURL,
			depositURL: demo ? undefined : urls.depositURL,
			user: demo
				? undefined
				: {
						id: user!.id,
						nickName: user!.name || user!.id,
					},
		});

		if (!demo && user) {
			const db = drizzle(c.env.DB, { schema });
			await db.insert(schema.swipegamesSessions).values({
				sessionId: sessionID,
				userId: user.id,
				gameId: parsed.data.gameId,
				gsId: created.gsID,
				currency: "NGN",
				demo: false,
				status: "active",
			});
		}

		return {
			status: 200 as const,
			body: { success: true, data: { url: created.gameURL } },
		};
	} catch (error) {
		if (error instanceof SwipeGamesApiError) {
			return {
				status: 502 as const,
				body: {
					success: false,
					error: error.message,
					details: { code: error.code, details: error.details },
				},
			};
		}
		console.error("Swipe Games launch failed", error);
		return {
			status: 500 as const,
			body: { success: false, error: "Failed to launch game" },
		};
	}
}

swipegamesRoute.openapi(launchRoute, async (c) => {
	const result = await launchGame(c, false);
	if (result.status === 200) return c.json(result.body, 200);
	if (result.status === 401) return c.json(result.body, 401);
	if (result.status === 400) return c.json(result.body, 400);
	return c.json(result.body, 500);
});

swipegamesRoute.openapi(launchDemoRoute, async (c) => {
	const result = await launchGame(c, true);
	if (result.status === 200) return c.json(result.body, 200);
	if (result.status === 400) return c.json(result.body, 400);
	return c.json(result.body, 500);
});

swipegamesRoute.openapi(createFreeRoundsRoute, async (c) => {
	if (!(await requireAdmin(c))) {
		return c.json({ message: "Unauthorized" }, 401);
	}
	const parsed = CreateFreeRoundsBodySchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json({ message: "Invalid request" }, 400);
	}
	try {
		const client = new SwipeGamesClient(requireSwipeGamesConfig(c.env));
		const created = await client.createFreeRounds(parsed.data);
		return c.json(created, 200);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Free rounds failed";
		return c.json({ message }, 500);
	}
});

swipegamesRoute.openapi(getFreeRoundsRoute, async (c) => {
	if (!(await requireAdmin(c))) {
		return c.json({ message: "Unauthorized" }, 401);
	}
	const id = c.req.query("id");
	const extID = c.req.query("extID");
	if (!id && !extID) {
		return c.json({ message: "id or extID is required" }, 400);
	}
	try {
		const client = new SwipeGamesClient(requireSwipeGamesConfig(c.env));
		const info = await client.getFreeRounds({ id, extID });
		return c.json(info, 200);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Free rounds failed";
		return c.json({ message }, 500);
	}
});

swipegamesRoute.openapi(deleteFreeRoundsRoute, async (c) => {
	if (!(await requireAdmin(c))) {
		return c.json({ message: "Unauthorized" }, 401);
	}
	const body = (await c.req.json()) as { id?: string; extID?: string };
	if (!body.id && !body.extID) {
		return c.json({ message: "id or extID is required" }, 400);
	}
	try {
		const client = new SwipeGamesClient(requireSwipeGamesConfig(c.env));
		await client.deleteFreeRounds(body);
		return c.json({ success: true }, 200);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Free rounds failed";
		return c.json({ message }, 500);
	}
});

export default swipegamesRoute;
