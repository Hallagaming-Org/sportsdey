import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { Context, ExecutionContext } from "hono";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import * as schema from "@/db/schema";
import {
	normalizeScorpioCallbackBody,
	ScorpioBonusCancelSchema,
	ScorpioBonusRegisterSchema,
	ScorpioCallbackRawBodySchema,
	ScorpioCallbackRequestSchema,
	ScorpioCallbackResponseSchema,
	ScorpioErrorResponseSchema,
	ScorpioIssueIdParamSchema,
	ScorpioLaunchRequestSchema,
	ScorpioLaunchResponseSchema,
	ScorpioProviderIdParamSchema,
	ScorpioProviderSettingsParamSchema,
	ScorpioRoundQuerySchema,
	ScorpioSuccessDataSchema,
	ScorpioTransactionListQuerySchema,
} from "@/schemas/scorpio";
import { getClientIp } from "@/utils/request";
import {
	cancelBonusCall,
	createOperator,
	createPlayer,
	getBonusCallDetail,
	getOperatorInfo,
	getPlayerInfo,
	getProviderSettings,
	getProviderSettingsById,
	getScorpioConfig,
	getTransactionRound,
	kickPlayer,
	launchGame,
	listGames,
	listProviders,
	listTransactions,
	registerBonusCall,
	ScorpioApiError,
	scorpioErrorToHttpStatus,
	updateOperator,
} from "@/utils/scorpio";
import {
	BONUS_ENGINE_NATIVE_PROVIDER_ID,
	optionalExecutionCtx,
	reportCasinoBetInBackground,
	reportCasinoBetResultInBackground,
} from "@/services/bonus-engine";
import {
	processScorpioCallback,
	resolveScorpioUserId,
	scorpioCallbackResponse,
} from "@/utils/scorpio-callback";
import {
	loadScorpioSettings,
	ScorpioConfigError,
} from "@/utils/scorpio-config";
import {
	mapInBatches,
	mapScorpioCatalogGames,
	type ScorpioCatalogGame,
	type ScorpioCatalogProvider,
	type ScorpioCatalogRemoteGame,
} from "@/utils/scorpio-catalog";
import {
	isScorpioGameDisabled,
	loadDisabledScorpioCodes,
	overlayScorpioEnabled,
} from "@/utils/scorpio-game-flags";
import {
	assertScorpioCallbackIp,
	ScorpioIpForbiddenError,
	ScorpioSignatureError,
	verifyScorpioSignature,
} from "@/utils/scorpio-security";
import { generateUUIDv7 } from "@/utils/uuid";
import type { CloudflareBindings } from "../types";

const scorpioRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

/** Fresh catalog window. Stale copies are served while a refresh runs. */
const SCORPIO_CATALOG_TTL_MS = 10 * 60 * 1000;
const SCORPIO_CATALOG_STALE_MS = 60 * 60 * 1000;

function scorpioCatalogKv(env: CloudflareBindings) {
	return env.sportsdey_ns || env.staging_kv || null;
}

async function readScorpioCatalogCache<T>(
	env: CloudflareBindings,
	key: string,
): Promise<{ data: T; fresh: boolean } | null> {
	const kv = scorpioCatalogKv(env);
	if (!kv) return null;
	const cached = (await kv.get(key, "json")) as {
		data?: T;
		expiresAt?: number;
	} | null;
	if (!cached || cached.data == null || typeof cached.expiresAt !== "number") {
		return null;
	}
	const now = Date.now();
	if (now <= cached.expiresAt) return { data: cached.data, fresh: true };
	if (now <= cached.expiresAt + SCORPIO_CATALOG_STALE_MS) {
		return { data: cached.data, fresh: false };
	}
	return null;
}

async function writeScorpioCatalogCache(
	env: CloudflareBindings,
	key: string,
	data: unknown,
): Promise<void> {
	const kv = scorpioCatalogKv(env);
	if (!kv) return;
	await kv.put(
		key,
		JSON.stringify({
			data,
			expiresAt: Date.now() + SCORPIO_CATALOG_TTL_MS,
		}),
		{
			expirationTtl: Math.ceil(
				(SCORPIO_CATALOG_TTL_MS + SCORPIO_CATALOG_STALE_MS) / 1000,
			),
		},
	);
}

/**
 * Serves a cached Scorpio catalog payload. A fresh hit skips the provider.
 * A stale hit returns immediately and refreshes in the background.
 */
async function loadScorpioCatalog<T>(
	env: CloudflareBindings,
	executionCtx: ExecutionContext | undefined,
	key: string,
	loader: () => Promise<T>,
): Promise<T> {
	const cached = await readScorpioCatalogCache<T>(env, key);
	if (cached?.fresh) return cached.data;

	const refresh = () =>
		loader()
			.then((data) => writeScorpioCatalogCache(env, key, data))
			.catch((error) => {
				console.error("scorpio catalog refresh failed", { key, error });
			});

	if (cached) {
		executionCtx?.waitUntil(refresh());
		return cached.data;
	}

	const data = await loader();
	try {
		await writeScorpioCatalogCache(env, key, data);
	} catch (error) {
		console.error("scorpio catalog cache write failed", { key, error });
	}
	return data;
}

type ScorpioContext = Context<{ Bindings: CloudflareBindings }>;

type ScorpioHttpErrorStatus = 400 | 401 | 402 | 404 | 500 | 502 | 503 | 504;

const scorpioErrorHttpResponses = {
	400: {
		description: "Bad request",
		content: {
			"application/json": { schema: ScorpioErrorResponseSchema },
		},
	},
	401: {
		description: "Unauthorized",
		content: {
			"application/json": { schema: ScorpioErrorResponseSchema },
		},
	},
	402: {
		description: "Payment required / insufficient funds",
		content: {
			"application/json": { schema: ScorpioErrorResponseSchema },
		},
	},
	404: {
		description: "Not found",
		content: {
			"application/json": { schema: ScorpioErrorResponseSchema },
		},
	},
	500: {
		description: "Server error",
		content: {
			"application/json": { schema: ScorpioErrorResponseSchema },
		},
	},
	502: {
		description: "Upstream Scorpio error",
		content: {
			"application/json": { schema: ScorpioErrorResponseSchema },
		},
	},
	503: {
		description: "Scorpio unavailable",
		content: {
			"application/json": { schema: ScorpioErrorResponseSchema },
		},
	},
	504: {
		description: "Scorpio timeout",
		content: {
			"application/json": { schema: ScorpioErrorResponseSchema },
		},
	},
};

function scorpioErrorJson(error: unknown): {
	body: {
		success: false;
		error: string;
		code: string;
		details: unknown;
	};
	status: ScorpioHttpErrorStatus;
} {
	if (error instanceof ScorpioConfigError) {
		return {
			body: {
				success: false,
				error: error.message,
				code: "VALIDATION_ERROR",
				details: null,
			},
			status: 500,
		};
	}
	if (error instanceof ScorpioApiError) {
		const status = scorpioErrorToHttpStatus(error.code);
		const allowed = [400, 401, 402, 404, 500, 502, 503, 504] as const;
		const safeStatus = allowed.includes(status as (typeof allowed)[number])
			? (status as (typeof allowed)[number])
			: 400;
		return {
			body: {
				success: false,
				error: error.message,
				code: error.code,
				details: error.details,
			},
			status: safeStatus,
		};
	}
	return {
		body: {
			success: false,
			error: "Unexpected Scorpio error",
			code: "INTERNAL_SERVER_ERROR",
			details: null,
		},
		status: 500,
	};
}

/** OpenAPI route response unions are narrower than runtime Scorpio statuses. */
function respondScorpioError(
	c: { json: (body: unknown, status: ScorpioHttpErrorStatus) => unknown },
	error: unknown,
) {
	const mapped = scorpioErrorJson(error);
	return c.json(mapped.body, mapped.status) as never;
}

/** Hono OpenAPI infers handlers too narrowly for multi-status Scorpio routes. */
function mountScorpioRoute(
	route: unknown,
	handler: (c: ScorpioContext) => Promise<unknown> | unknown,
) {
	// biome-ignore lint/suspicious/noExplicitAny: OpenAPI status unions cannot be satisfied practically
	scorpioRoute.openapi(route as any, handler as any);
}

function validRequest<T>(c: ScorpioContext, target: "param" | "query"): T {
	return (c.req as unknown as { valid: (t: "param" | "query") => T }).valid(
		target,
	);
}

async function ensureScorpioPlayer(
	db: ReturnType<typeof drizzle>,
	config: ReturnType<typeof getScorpioConfig>,
	userId: string,
): Promise<number> {
	const [existing] = await db
		.select()
		.from(schema.scorpioPlayers)
		.where(eq(schema.scorpioPlayers.userId, userId))
		.limit(1);

	if (existing) {
		return existing.playerCode;
	}

	let playerCode: number;
	try {
		const created = await createPlayer(config, userId);
		playerCode = created.playerCode;
	} catch (error) {
		// Player may already exist on Scorpio without a local row
		try {
			const info = await getPlayerInfo(config, userId);
			playerCode = info.playerCode;
		} catch {
			throw error;
		}
	}

	await db
		.insert(schema.scorpioPlayers)
		.values({
			userId,
			playerCode,
		})
		.onConflictDoNothing();

	const [row] = await db
		.select()
		.from(schema.scorpioPlayers)
		.where(eq(schema.scorpioPlayers.userId, userId))
		.limit(1);

	return row?.playerCode ?? playerCode;
}

const unauthorized = {
	success: false as const,
	error: "Unauthorized",
	code: "PERMISSION_ERROR",
	details: null,
};

const forbidden = {
	success: false as const,
	error: "Forbidden - admin or super_admin only",
	code: "PERMISSION_ERROR",
	details: null,
};

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

const launchRoute = createRoute({
	method: "post",
	path: "/launch",
	tags: ["Scorpio Play"],
	summary: "Launch a Scorpio Play game",
	description:
		"Ensures the player exists in Scorpio, then returns a one-time game URL",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": { schema: ScorpioLaunchRequestSchema },
			},
		},
	},
	responses: {
		200: {
			description: "Launch URL",
			content: {
				"application/json": { schema: ScorpioLaunchResponseSchema },
			},
		},
		...scorpioErrorHttpResponses,
	},
});

mountScorpioRoute(launchRoute, async (c: ScorpioContext) => {
	const user = c.get("user");
	if (!user) {
		return c.json(unauthorized, 401);
	}

	const parsed = ScorpioLaunchRequestSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json(
			{
				success: false as const,
				error: "Invalid request",
				code: "VALIDATION_ERROR",
				details: parsed.error.flatten(),
			},
			400,
		);
	}

	const config = getScorpioConfig(c.env);
	const db = drizzle(c.env.DB, { schema });

	try {
		const { providerId, gameCode, language, currency, returnUrl, rtp } =
			parsed.data;

		let locallyDisabled = false;
		try {
			locallyDisabled = await isScorpioGameDisabled(db, providerId, gameCode);
		} catch (error) {
			console.error("scorpio disabled-flag lookup failed", error);
		}
		if (locallyDisabled) {
			return c.json(
				{
					success: false as const,
					error: "Game is disabled",
					code: "GAME_DISABLED",
					details: null,
				},
				404,
			);
		}

		const playerCode = await ensureScorpioPlayer(db, config, user.id);

		// Amusnet / Scorpio allow one active session per player. Switching games
		// without ending the previous session causes "NO CONNECTION" / technical errors.
		let endedPriorSession = false;
		try {
			await kickPlayer(config, user.id);
			endedPriorSession = true;
		} catch (error) {
			console.log("scorpio pre-launch kick skipped", {
				userId: user.id,
				error: error instanceof Error ? error.message : "unknown",
			});
		}
		// Give the provider a beat to tear down GS websockets before init.
		if (endedPriorSession) {
			await new Promise((resolve) => setTimeout(resolve, 800));
		}

		const launched = await launchGame(config, {
			playerExternalId: user.id,
			providerId,
			gameCode,
			language: language || "en",
			currency: currency || "NGN",
			returnUrl,
			rtp: rtp ?? 0,
		});

		return c.json(
			{
				success: true as const,
				data: {
					url: launched.gameUrl,
					playerCode,
				},
			},
			200,
		);
	} catch (error) {
		return respondScorpioError(c, error);
	}
});

const kickRoute = createRoute({
	method: "post",
	path: "/kick",
	tags: ["Scorpio Play"],
	summary: "Kick player from active Scorpio game session",
	description: "Kicks the authenticated user's own Scorpio session",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Kicked",
			content: { "application/json": { schema: ScorpioSuccessDataSchema } },
		},
		...scorpioErrorHttpResponses,
	},
});

mountScorpioRoute(kickRoute, async (c: ScorpioContext) => {
	const user = c.get("user");
	if (!user) {
		return c.json(unauthorized, 401);
	}

	// Only allow kicking the authenticated player's own session (same as launch).
	try {
		const data = await kickPlayer(getScorpioConfig(c.env), user.id);
		return c.json({ success: true as const, data: data ?? null }, 200);
	} catch (error) {
		return respondScorpioError(c, error);
	}
});

const providersRoute = createRoute({
	method: "get",
	path: "/providers",
	tags: ["Scorpio Play"],
	summary: "List Scorpio game providers",
	description: "Public catalog endpoint — no user session required",
	responses: {
		200: {
			description: "Providers",
			content: { "application/json": { schema: ScorpioSuccessDataSchema } },
		},
		...scorpioErrorHttpResponses,
	},
});

mountScorpioRoute(providersRoute, async (c: ScorpioContext) => {
	try {
		const data = await loadScorpioCatalog(
			c.env,
			optionalExecutionCtx(c),
			"scorpio:providers:v1",
			() => listProviders(getScorpioConfig(c.env)),
		);
		return c.json({ success: true as const, data }, 200);
	} catch (error) {
		return respondScorpioError(c, error);
	}
});

const providerSettingsRoute = createRoute({
	method: "get",
	path: "/providers/settings",
	tags: ["Scorpio Play"],
	summary: "Get Scorpio provider settings",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Settings",
			content: { "application/json": { schema: ScorpioSuccessDataSchema } },
		},
		...scorpioErrorHttpResponses,
	},
});

mountScorpioRoute(providerSettingsRoute, async (c: ScorpioContext) => {
	const user = c.get("user");
	if (!user) {
		return c.json(unauthorized, 401);
	}
	try {
		const data = await getProviderSettings(getScorpioConfig(c.env));
		return c.json({ success: true as const, data }, 200);
	} catch (error) {
		return respondScorpioError(c, error);
	}
});

const providerSettingsByIdRoute = createRoute({
	method: "get",
	path: "/providers/{providerId}/settings/{currency}",
	tags: ["Scorpio Play"],
	summary: "Get provider settings for currency",
	security: [{ BearerAuth: [] }],
	request: { params: ScorpioProviderSettingsParamSchema },
	responses: {
		200: {
			description: "Settings",
			content: { "application/json": { schema: ScorpioSuccessDataSchema } },
		},
		...scorpioErrorHttpResponses,
	},
});

mountScorpioRoute(providerSettingsByIdRoute, async (c: ScorpioContext) => {
	const user = c.get("user");
	if (!user) {
		return c.json(unauthorized, 401);
	}
	const { providerId, currency } = validRequest<{
		providerId: number;
		currency: string;
	}>(c, "param");
	try {
		const data = await getProviderSettingsById(
			getScorpioConfig(c.env),
			providerId,
			currency,
		);
		return c.json({ success: true as const, data }, 200);
	} catch (error) {
		return respondScorpioError(c, error);
	}
});

const CATALOG_PROVIDER_BATCH = 6;

function asCatalogProviders(data: unknown): ScorpioCatalogProvider[] {
	if (!Array.isArray(data)) return [];
	const out: ScorpioCatalogProvider[] = [];
	for (const row of data) {
		if (!row || typeof row !== "object") continue;
		const provider = row as {
			providerId?: unknown;
			providerName?: unknown;
			status?: unknown;
		};
		const providerId = Number(provider.providerId);
		const providerName =
			typeof provider.providerName === "string"
				? provider.providerName.trim()
				: "";
		if (!Number.isFinite(providerId) || providerId <= 0 || !providerName) {
			continue;
		}
		out.push({
			providerId,
			providerName,
			status: typeof provider.status === "number" ? provider.status : undefined,
		});
	}
	return out;
}

async function loadCombinedScorpioCatalog(
	env: CloudflareBindings,
	executionCtx: ExecutionContext | undefined,
): Promise<ScorpioCatalogGame[]> {
	const providers = asCatalogProviders(
		await loadScorpioCatalog(
			env,
			executionCtx,
			"scorpio:providers:v1",
			() => listProviders(getScorpioConfig(env)),
		),
	);
	const active = providers.filter((provider) => provider.status !== 0);
	const lists = await mapInBatches(active, CATALOG_PROVIDER_BATCH, async (provider) => {
		const games = await loadScorpioCatalog(
			env,
			executionCtx,
			`scorpio:games:v1:${provider.providerId}`,
			() => listGames(getScorpioConfig(env), provider.providerId),
		);
		return mapScorpioCatalogGames(
			provider,
			Array.isArray(games) ? (games as ScorpioCatalogRemoteGame[]) : [],
		);
	});
	return lists.flat();
}

const catalogRoute = createRoute({
	method: "get",
	path: "/catalog",
	tags: ["Scorpio Play"],
	summary: "List the full Scorpio game catalog",
	description:
		"One cached payload of every active provider's games. Used by admin game management so the browser does not fan out one request per provider.",
	responses: {
		200: {
			description: "Catalog",
			content: { "application/json": { schema: ScorpioSuccessDataSchema } },
		},
		...scorpioErrorHttpResponses,
	},
});

mountScorpioRoute(catalogRoute, async (c: ScorpioContext) => {
	try {
		const data = await loadScorpioCatalog(
			c.env,
			optionalExecutionCtx(c),
			"scorpio:catalog:v1",
			() => loadCombinedScorpioCatalog(c.env, optionalExecutionCtx(c)),
		);
		return c.json({ success: true as const, data }, 200);
	} catch (error) {
		return respondScorpioError(c, error);
	}
});

const gamesRoute = createRoute({
	method: "get",
	path: "/games/{providerId}",
	tags: ["Scorpio Play"],
	summary: "List games for a Scorpio provider",
	description: "Public catalog endpoint — no user session required",
	request: { params: ScorpioProviderIdParamSchema },
	responses: {
		200: {
			description: "Games",
			content: { "application/json": { schema: ScorpioSuccessDataSchema } },
		},
		...scorpioErrorHttpResponses,
	},
});

mountScorpioRoute(gamesRoute, async (c: ScorpioContext) => {
	const { providerId } = validRequest<{ providerId: number }>(c, "param");
	try {
		const data = await loadScorpioCatalog(
			c.env,
			optionalExecutionCtx(c),
			`scorpio:games:v1:${providerId}`,
			() => listGames(getScorpioConfig(c.env), providerId),
		);
		if (!Array.isArray(data)) {
			return c.json({ success: true as const, data }, 200);
		}

		let disabledCodes = new Set<string>();
		try {
			const db = drizzle(c.env.DB, { schema });
			disabledCodes = await loadDisabledScorpioCodes(db, providerId);
		} catch (error) {
			console.error("scorpio catalog overlay failed", error);
		}

		return c.json(
			{
				success: true as const,
				data: overlayScorpioEnabled(
					data as Record<string, unknown>[],
					providerId,
					disabledCodes,
				),
			},
			200,
		);
	} catch (error) {
		return respondScorpioError(c, error);
	}
});

const playerInfoRoute = createRoute({
	method: "get",
	path: "/player",
	tags: ["Scorpio Play"],
	summary: "Get Scorpio player info for the authenticated user",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Player info",
			content: { "application/json": { schema: ScorpioSuccessDataSchema } },
		},
		...scorpioErrorHttpResponses,
	},
});

mountScorpioRoute(playerInfoRoute, async (c: ScorpioContext) => {
	const user = c.get("user");
	if (!user) {
		return c.json(unauthorized, 401);
	}
	try {
		const data = await getPlayerInfo(getScorpioConfig(c.env), user.id);
		return c.json({ success: true as const, data }, 200);
	} catch (error) {
		return respondScorpioError(c, error);
	}
});

const operatorInfoRoute = createRoute({
	method: "get",
	path: "/operator",
	tags: ["Scorpio Play"],
	summary: "Get Scorpio operator info",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Operator info",
			content: { "application/json": { schema: ScorpioSuccessDataSchema } },
		},
		...scorpioErrorHttpResponses,
	},
});

mountScorpioRoute(operatorInfoRoute, async (c: ScorpioContext) => {
	const user = c.get("user");
	if (!user) {
		return c.json(unauthorized, 401);
	}
	try {
		const data = await getOperatorInfo(getScorpioConfig(c.env));
		return c.json({ success: true as const, data }, 200);
	} catch (error) {
		return respondScorpioError(c, error);
	}
});

const operatorCreateRoute = createRoute({
	method: "post",
	path: "/operator",
	tags: ["Scorpio Play"],
	summary: "Create Scorpio operator (Main API proxy)",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Created",
			content: { "application/json": { schema: ScorpioSuccessDataSchema } },
		},
		...scorpioErrorHttpResponses,
		403: {
			description: "Forbidden - admin only",
			content: {
				"application/json": { schema: ScorpioErrorResponseSchema },
			},
		},
	},
});

mountScorpioRoute(operatorCreateRoute, async (c: ScorpioContext) => {
	const admin = await requireAdmin(c);
	if (!admin) {
		return c.json(forbidden, 403);
	}
	try {
		const data = await createOperator(
			getScorpioConfig(c.env),
			(await c.req.json()) as Record<string, unknown>,
		);
		return c.json({ success: true as const, data }, 200);
	} catch (error) {
		return respondScorpioError(c, error);
	}
});

const operatorUpdateRoute = createRoute({
	method: "patch",
	path: "/operator",
	tags: ["Scorpio Play"],
	summary: "Update Scorpio operator (Main API proxy)",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Updated",
			content: { "application/json": { schema: ScorpioSuccessDataSchema } },
		},
		...scorpioErrorHttpResponses,
		403: {
			description: "Forbidden - admin only",
			content: {
				"application/json": { schema: ScorpioErrorResponseSchema },
			},
		},
	},
});

mountScorpioRoute(operatorUpdateRoute, async (c: ScorpioContext) => {
	const admin = await requireAdmin(c);
	if (!admin) {
		return c.json(forbidden, 403);
	}
	try {
		const data = await updateOperator(
			getScorpioConfig(c.env),
			(await c.req.json()) as Record<string, unknown>,
		);
		return c.json({ success: true as const, data }, 200);
	} catch (error) {
		return respondScorpioError(c, error);
	}
});

const transactionsRoute = createRoute({
	method: "get",
	path: "/transactions",
	tags: ["Scorpio Play"],
	summary: "List Scorpio transactions",
	security: [{ BearerAuth: [] }],
	request: { query: ScorpioTransactionListQuerySchema },
	responses: {
		200: {
			description: "Transactions",
			content: { "application/json": { schema: ScorpioSuccessDataSchema } },
		},
		...scorpioErrorHttpResponses,
	},
});

mountScorpioRoute(transactionsRoute, async (c: ScorpioContext) => {
	const user = c.get("user");
	if (!user) {
		return c.json(unauthorized, 401);
	}
	const query = validRequest<{
		startTime: string;
		endTime: string;
		offset: number;
		limit: number;
	}>(c, "query");
	try {
		const data = await listTransactions(getScorpioConfig(c.env), query);
		return c.json({ success: true as const, data }, 200);
	} catch (error) {
		return respondScorpioError(c, error);
	}
});

const transactionRoundRoute = createRoute({
	method: "get",
	path: "/transactions/round",
	tags: ["Scorpio Play"],
	summary: "Get Scorpio transaction round",
	security: [{ BearerAuth: [] }],
	request: { query: ScorpioRoundQuerySchema },
	responses: {
		200: {
			description: "Round",
			content: { "application/json": { schema: ScorpioSuccessDataSchema } },
		},
		...scorpioErrorHttpResponses,
	},
});

mountScorpioRoute(transactionRoundRoute, async (c: ScorpioContext) => {
	const user = c.get("user");
	if (!user) {
		return c.json(unauthorized, 401);
	}
	const query = validRequest<{
		roundId?: string;
		playerExternalId?: string;
		transId?: string;
	}>(c, "query");
	const filtered = Object.fromEntries(
		Object.entries(query).filter(([, v]) => v !== undefined),
	) as Record<string, string>;
	try {
		const data = await getTransactionRound(getScorpioConfig(c.env), filtered);
		return c.json({ success: true as const, data }, 200);
	} catch (error) {
		return respondScorpioError(c, error);
	}
});

const bonusRegisterRoute = createRoute({
	method: "post",
	path: "/bonus-call/register",
	tags: ["Scorpio Play"],
	summary: "Register a Scorpio bonus call",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": { schema: ScorpioBonusRegisterSchema },
			},
		},
	},
	responses: {
		200: {
			description: "Registered",
			content: { "application/json": { schema: ScorpioSuccessDataSchema } },
		},
		...scorpioErrorHttpResponses,
	},
});

mountScorpioRoute(bonusRegisterRoute, async (c: ScorpioContext) => {
	const user = c.get("user");
	if (!user) {
		return c.json(unauthorized, 401);
	}
	const parsed = ScorpioBonusRegisterSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json(
			{
				success: false as const,
				error: "Invalid request",
				code: "VALIDATION_ERROR",
				details: parsed.error.flatten(),
			},
			400,
		);
	}
	const body = {
		...parsed.data,
		playerExternalId: parsed.data.playerExternalId || user.id,
	};
	try {
		const data = await registerBonusCall(getScorpioConfig(c.env), body);
		return c.json({ success: true as const, data }, 200);
	} catch (error) {
		return respondScorpioError(c, error);
	}
});

const bonusCancelRoute = createRoute({
	method: "post",
	path: "/bonus-call/cancel",
	tags: ["Scorpio Play"],
	summary: "Cancel a Scorpio bonus call",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": { schema: ScorpioBonusCancelSchema },
			},
		},
	},
	responses: {
		200: {
			description: "Cancelled",
			content: { "application/json": { schema: ScorpioSuccessDataSchema } },
		},
		...scorpioErrorHttpResponses,
	},
});

mountScorpioRoute(bonusCancelRoute, async (c: ScorpioContext) => {
	const user = c.get("user");
	if (!user) {
		return c.json(unauthorized, 401);
	}
	const parsed = ScorpioBonusCancelSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json(
			{
				success: false as const,
				error: "Invalid request",
				code: "VALIDATION_ERROR",
				details: parsed.error.flatten(),
			},
			400,
		);
	}
	try {
		const data = await cancelBonusCall(getScorpioConfig(c.env), parsed.data);
		return c.json({ success: true as const, data: data ?? null }, 200);
	} catch (error) {
		return respondScorpioError(c, error);
	}
});

const bonusDetailRoute = createRoute({
	method: "get",
	path: "/bonus-call/{issueId}",
	tags: ["Scorpio Play"],
	summary: "Get Scorpio bonus call detail",
	security: [{ BearerAuth: [] }],
	request: { params: ScorpioIssueIdParamSchema },
	responses: {
		200: {
			description: "Detail",
			content: { "application/json": { schema: ScorpioSuccessDataSchema } },
		},
		...scorpioErrorHttpResponses,
	},
});

mountScorpioRoute(bonusDetailRoute, async (c: ScorpioContext) => {
	const user = c.get("user");
	if (!user) {
		return c.json(unauthorized, 401);
	}
	const { issueId } = validRequest<{ issueId: string }>(c, "param");
	try {
		const data = await getBonusCallDetail(getScorpioConfig(c.env), issueId);
		return c.json({ success: true as const, data }, 200);
	} catch (error) {
		return respondScorpioError(c, error);
	}
});

const callbackRoute = createRoute({
	method: "post",
	path: "/callback",
	tags: ["Scorpio Play"],
	summary: "Scorpio Seamless Wallet callback",
	description:
		"Receives balance/bet/win/cancel callbacks. Always responds HTTP 200 with statusCode per Scorpio docs.",
	request: {
		body: {
			content: {
				"application/json": { schema: ScorpioCallbackRawBodySchema },
			},
		},
	},
	responses: {
		200: {
			description: "Callback processed (check statusCode)",
			content: {
				"application/json": { schema: ScorpioCallbackResponseSchema },
			},
		},
		400: {
			description: "Malformed request",
			content: {
				"application/json": { schema: ScorpioCallbackResponseSchema },
			},
		},
		415: {
			description: "Unsupported content type",
			content: {
				"application/json": { schema: ScorpioCallbackResponseSchema },
			},
		},
	},
});

const callbackHealthRoute = createRoute({
	method: "get",
	path: "/callback",
	tags: ["Scorpio Play"],
	summary: "Scorpio callback health check",
	description:
		"Browser/portal reachability check. Scorpio wallet traffic must use POST.",
	responses: {
		200: {
			description: "Callback endpoint is reachable",
			content: {
				"application/json": {
					schema: z.object({
						ok: z.literal(true),
						endpoint: z.string(),
						methods: z.array(z.string()),
					}),
				},
			},
		},
	},
});

mountScorpioRoute(callbackHealthRoute, async (c: ScorpioContext) => {
	return c.json(
		{
			ok: true as const,
			endpoint: "POST /scorpio/callback",
			methods: ["POST"],
		},
		200,
	);
});

mountScorpioRoute(callbackRoute, async (c: ScorpioContext) => {
	const started = Date.now();
	const requestId = c.req.header("cf-ray") || generateUUIDv7();
	const remoteIp = getClientIp(c);
	const contentType = c.req.header("content-type") || "";

	if (!contentType.toLowerCase().includes("application/json")) {
		console.log("scorpio callback rejected", {
			timestamp: new Date().toISOString(),
			endpoint: "POST /scorpio/callback",
			remoteIp,
			requestId,
			command: null,
			latencyMs: Date.now() - started,
			responseStatus: 200,
			statusCode: "ERR_UNKNOWN",
			reason: "unsupported_content_type",
		});
		return c.json(
			await scorpioCallbackResponse(null, undefined, "ERR_UNKNOWN"),
			200,
		);
	}

	let body: Record<string, unknown>;
	try {
		body = (await c.req.json()) as Record<string, unknown>;
	} catch {
		console.log("scorpio callback rejected", {
			timestamp: new Date().toISOString(),
			endpoint: "POST /scorpio/callback",
			remoteIp,
			requestId,
			command: null,
			latencyMs: Date.now() - started,
			responseStatus: 200,
			statusCode: "ERR_UNKNOWN",
			reason: "malformed_json",
		});
		return c.json(
			await scorpioCallbackResponse(null, undefined, "ERR_UNKNOWN"),
			200,
		);
	}

	const queryCommand = c.req.query("command");
	if (
		(typeof body.command !== "string" || body.command.length === 0) &&
		queryCommand
	) {
		body.command = queryCommand;
	}
	const command = typeof body.command === "string" ? body.command : null;
	const settings = loadScorpioSettings(c.env);
	const signature = c.req.header("X-Request-Signature") || undefined;

	try {
		assertScorpioCallbackIp(remoteIp, settings);
		verifyScorpioSignature(body, signature, settings.apiToken);
	} catch (error) {
		const isSignature = error instanceof ScorpioSignatureError;
		const isIp = error instanceof ScorpioIpForbiddenError;
		const statusCode = isSignature
			? "ERR_INTEGRITY_CHECK_FAILED"
			: isIp
				? "ERR_NOT_AUTHENTICATED"
				: "ERR_UNKNOWN";
		// Semantic HTTP mapping for operators/logs: signature → 401, IP → 403.
		// Scorpio Seamless Wallet requires HTTP 200 with statusCode in the body.
		const semanticHttpStatus = isSignature ? 401 : isIp ? 403 : 401;

		console.log("scorpio callback security failure", {
			timestamp: new Date().toISOString(),
			endpoint: "POST /scorpio/callback",
			remoteIp,
			requestId,
			command,
			latencyMs: Date.now() - started,
			responseStatus: 200,
			semanticHttpStatus,
			statusCode,
			reason: error instanceof Error ? error.name : "security_error",
		});

		const db = drizzle(c.env.DB, { schema });
		const rawPlayerId =
			typeof body.playerId === "string" || typeof body.playerId === "number"
				? String(body.playerId)
				: undefined;
		return c.json(
			await scorpioCallbackResponse(db, rawPlayerId, statusCode),
			200,
		);
	}

	const parsed = ScorpioCallbackRequestSchema.safeParse(
		normalizeScorpioCallbackBody(body),
	);
	if (!parsed.success) {
		const fieldTypes = Object.fromEntries(
			Object.entries(body).map(([key, value]) => [
				key,
				value === null ? "null" : Array.isArray(value) ? "array" : typeof value,
			]),
		);
		console.log("scorpio callback rejected", {
			timestamp: new Date().toISOString(),
			endpoint: "POST /scorpio/callback",
			remoteIp,
			requestId,
			command,
			latencyMs: Date.now() - started,
			responseStatus: 200,
			statusCode: "ERR_UNKNOWN",
			reason: "validation_error",
			fieldTypes,
			issues: parsed.error.issues.map((issue) => ({
				path: issue.path.join("."),
				code: issue.code,
				message: issue.message,
			})),
		});
		const db = drizzle(c.env.DB, { schema });
		const normalized = normalizeScorpioCallbackBody(body) as Record<
			string,
			unknown
		>;
		const knownCommand = String(normalized.command ?? command ?? "");
		if (["balance", "bet", "win", "cancel"].includes(knownCommand)) {
			const result = await processScorpioCallback(db, normalized);
			console.log("scorpio callback processed after validation fallback", {
				command: knownCommand,
				statusCode: result.statusCode,
			});
			await reportScorpioBonusEngine(c, normalized, result.statusCode);
			return c.json(result, 200);
		}
		const rawPlayerId =
			typeof body.playerId === "string" || typeof body.playerId === "number"
				? String(body.playerId)
				: undefined;
		return c.json(
			await scorpioCallbackResponse(db, rawPlayerId, "ERR_UNKNOWN"),
			200,
		);
	}

	const db = drizzle(c.env.DB, { schema });
	const result = await processScorpioCallback(
		db,
		parsed.data as unknown as Record<string, unknown>,
	);

	console.log("scorpio callback", {
		timestamp: new Date().toISOString(),
		endpoint: "POST /scorpio/callback",
		remoteIp,
		requestId,
		command,
		latencyMs: Date.now() - started,
		responseStatus: 200,
		statusCode: result.statusCode,
	});

	await reportScorpioBonusEngine(
		c,
		parsed.data as unknown as Record<string, unknown>,
		result.statusCode,
	);

	return c.json(result, 200);
});

async function reportScorpioBonusEngine(
	c: ScorpioContext,
	body: Record<string, unknown>,
	statusCode: string,
): Promise<void> {
	try {
		if (statusCode !== "OK") return;
		const command = String(body.command ?? "");
		if (command !== "bet" && command !== "win" && command !== "cancel") return;

		const transactionId = String(body.transactionId ?? "").trim();
		if (!transactionId) return;

		const db = drizzle(c.env.DB, { schema });
		const userId = await resolveScorpioUserId(db, String(body.playerId ?? ""));
		if (!userId) return;

		const amount = Number(body.amount);
		const gameRef = String(body.gameCode ?? "").trim() || undefined;
		const currency = String(body.currency ?? "NGN");
		const executionCtx = optionalExecutionCtx(c);

		if (command === "bet") {
			if (!Number.isFinite(amount) || amount <= 0) return;
			await reportCasinoBetInBackground({
				env: c.env,
				executionCtx,
				userId,
				betId: transactionId,
				amount,
				currency,
				gameRef,
				fallbackProviderId: BONUS_ENGINE_NATIVE_PROVIDER_ID.SCORPIO,
			});
			return;
		}

		await reportCasinoBetResultInBackground({
			env: c.env,
			executionCtx,
			userId,
			betId:
				command === "cancel"
					? String(body.referenceId ?? transactionId).trim() || transactionId
					: transactionId,
			totalWinAmount: Number.isFinite(amount) ? amount : 0,
			isWin: command === "win" ? 1 : 0,
			isRollback: command === "cancel" ? 1 : 0,
		});
	} catch (error) {
		console.error("Bonus Engine scorpio report error", error);
	}
}

export default scorpioRoute;
