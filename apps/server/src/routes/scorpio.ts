import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import {
	ScorpioBonusCancelSchema,
	ScorpioBonusRegisterSchema,
	ScorpioErrorResponseSchema,
	ScorpioIssueIdParamSchema,
	ScorpioKickRequestSchema,
	ScorpioLaunchRequestSchema,
	ScorpioLaunchResponseSchema,
	ScorpioProviderIdParamSchema,
	ScorpioProviderSettingsParamSchema,
	ScorpioRoundQuerySchema,
	ScorpioSuccessDataSchema,
	ScorpioTransactionListQuerySchema,
} from "@/schemas/scorpio";
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
import type { CloudflareBindings } from "../types";

const scorpioRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

function scorpioErrorJson(error: unknown): {
	body: {
		success: false;
		error: string;
		code: string;
		details: unknown;
	};
	status: 400 | 401 | 402 | 404 | 500 | 502 | 503 | 504;
} {
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
		500: {
			description: "Server error",
			content: {
				"application/json": { schema: ScorpioErrorResponseSchema },
			},
		},
	},
});

scorpioRoute.openapi(launchRoute, async (c) => {
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
		const playerCode = await ensureScorpioPlayer(db, config, user.id);
		const { providerId, gameCode, language, currency, returnUrl, rtp } =
			parsed.data;

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
		const mapped = scorpioErrorJson(error);
		return c.json(mapped.body, mapped.status);
	}
});

const kickRoute = createRoute({
	method: "post",
	path: "/kick",
	tags: ["Scorpio Play"],
	summary: "Kick player from active Scorpio game session",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": { schema: ScorpioKickRequestSchema },
			},
		},
	},
	responses: {
		200: {
			description: "Kicked",
			content: { "application/json": { schema: ScorpioSuccessDataSchema } },
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": { schema: ScorpioErrorResponseSchema },
			},
		},
	},
});

scorpioRoute.openapi(kickRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(unauthorized, 401);
	}

	const body = ScorpioKickRequestSchema.safeParse(
		(await c.req.json().catch(() => ({}))) ?? {},
	);
	const playerExternalId = body.success
		? body.data.playerExternalId || user.id
		: user.id;

	try {
		const data = await kickPlayer(getScorpioConfig(c.env), playerExternalId);
		return c.json({ success: true as const, data: data ?? null }, 200);
	} catch (error) {
		const mapped = scorpioErrorJson(error);
		return c.json(mapped.body, mapped.status);
	}
});

const providersRoute = createRoute({
	method: "get",
	path: "/providers",
	tags: ["Scorpio Play"],
	summary: "List Scorpio game providers",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Providers",
			content: { "application/json": { schema: ScorpioSuccessDataSchema } },
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": { schema: ScorpioErrorResponseSchema },
			},
		},
	},
});

scorpioRoute.openapi(providersRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(unauthorized, 401);
	}
	try {
		const data = await listProviders(getScorpioConfig(c.env));
		return c.json({ success: true as const, data }, 200);
	} catch (error) {
		const mapped = scorpioErrorJson(error);
		return c.json(mapped.body, mapped.status);
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
		401: {
			description: "Unauthorized",
			content: {
				"application/json": { schema: ScorpioErrorResponseSchema },
			},
		},
	},
});

scorpioRoute.openapi(providerSettingsRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(unauthorized, 401);
	}
	try {
		const data = await getProviderSettings(getScorpioConfig(c.env));
		return c.json({ success: true as const, data }, 200);
	} catch (error) {
		const mapped = scorpioErrorJson(error);
		return c.json(mapped.body, mapped.status);
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
		401: {
			description: "Unauthorized",
			content: {
				"application/json": { schema: ScorpioErrorResponseSchema },
			},
		},
	},
});

scorpioRoute.openapi(providerSettingsByIdRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(unauthorized, 401);
	}
	const { providerId, currency } = c.req.valid("param");
	try {
		const data = await getProviderSettingsById(
			getScorpioConfig(c.env),
			providerId,
			currency,
		);
		return c.json({ success: true as const, data }, 200);
	} catch (error) {
		const mapped = scorpioErrorJson(error);
		return c.json(mapped.body, mapped.status);
	}
});

const gamesRoute = createRoute({
	method: "get",
	path: "/games/{providerId}",
	tags: ["Scorpio Play"],
	summary: "List games for a Scorpio provider",
	security: [{ BearerAuth: [] }],
	request: { params: ScorpioProviderIdParamSchema },
	responses: {
		200: {
			description: "Games",
			content: { "application/json": { schema: ScorpioSuccessDataSchema } },
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": { schema: ScorpioErrorResponseSchema },
			},
		},
	},
});

scorpioRoute.openapi(gamesRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(unauthorized, 401);
	}
	const { providerId } = c.req.valid("param");
	try {
		const data = await listGames(getScorpioConfig(c.env), providerId);
		return c.json({ success: true as const, data }, 200);
	} catch (error) {
		const mapped = scorpioErrorJson(error);
		return c.json(mapped.body, mapped.status);
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
		401: {
			description: "Unauthorized",
			content: {
				"application/json": { schema: ScorpioErrorResponseSchema },
			},
		},
	},
});

scorpioRoute.openapi(playerInfoRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(unauthorized, 401);
	}
	try {
		const data = await getPlayerInfo(getScorpioConfig(c.env), user.id);
		return c.json({ success: true as const, data }, 200);
	} catch (error) {
		const mapped = scorpioErrorJson(error);
		return c.json(mapped.body, mapped.status);
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
		401: {
			description: "Unauthorized",
			content: {
				"application/json": { schema: ScorpioErrorResponseSchema },
			},
		},
	},
});

scorpioRoute.openapi(operatorInfoRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(unauthorized, 401);
	}
	try {
		const data = await getOperatorInfo(getScorpioConfig(c.env));
		return c.json({ success: true as const, data }, 200);
	} catch (error) {
		const mapped = scorpioErrorJson(error);
		return c.json(mapped.body, mapped.status);
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
		401: {
			description: "Unauthorized",
			content: {
				"application/json": { schema: ScorpioErrorResponseSchema },
			},
		},
	},
});

scorpioRoute.openapi(operatorCreateRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(unauthorized, 401);
	}
	try {
		const data = await createOperator(
			getScorpioConfig(c.env),
			(await c.req.json()) as Record<string, unknown>,
		);
		return c.json({ success: true as const, data }, 200);
	} catch (error) {
		const mapped = scorpioErrorJson(error);
		return c.json(mapped.body, mapped.status);
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
		401: {
			description: "Unauthorized",
			content: {
				"application/json": { schema: ScorpioErrorResponseSchema },
			},
		},
	},
});

scorpioRoute.openapi(operatorUpdateRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(unauthorized, 401);
	}
	try {
		const data = await updateOperator(
			getScorpioConfig(c.env),
			(await c.req.json()) as Record<string, unknown>,
		);
		return c.json({ success: true as const, data }, 200);
	} catch (error) {
		const mapped = scorpioErrorJson(error);
		return c.json(mapped.body, mapped.status);
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
		401: {
			description: "Unauthorized",
			content: {
				"application/json": { schema: ScorpioErrorResponseSchema },
			},
		},
	},
});

scorpioRoute.openapi(transactionsRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(unauthorized, 401);
	}
	const query = c.req.valid("query");
	try {
		const data = await listTransactions(getScorpioConfig(c.env), query);
		return c.json({ success: true as const, data }, 200);
	} catch (error) {
		const mapped = scorpioErrorJson(error);
		return c.json(mapped.body, mapped.status);
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
		401: {
			description: "Unauthorized",
			content: {
				"application/json": { schema: ScorpioErrorResponseSchema },
			},
		},
	},
});

scorpioRoute.openapi(transactionRoundRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(unauthorized, 401);
	}
	const query = c.req.valid("query");
	const filtered = Object.fromEntries(
		Object.entries(query).filter(([, v]) => v !== undefined),
	) as Record<string, string>;
	try {
		const data = await getTransactionRound(getScorpioConfig(c.env), filtered);
		return c.json({ success: true as const, data }, 200);
	} catch (error) {
		const mapped = scorpioErrorJson(error);
		return c.json(mapped.body, mapped.status);
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
		401: {
			description: "Unauthorized",
			content: {
				"application/json": { schema: ScorpioErrorResponseSchema },
			},
		},
	},
});

scorpioRoute.openapi(bonusRegisterRoute, async (c) => {
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
		const mapped = scorpioErrorJson(error);
		return c.json(mapped.body, mapped.status);
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
		401: {
			description: "Unauthorized",
			content: {
				"application/json": { schema: ScorpioErrorResponseSchema },
			},
		},
	},
});

scorpioRoute.openapi(bonusCancelRoute, async (c) => {
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
		const mapped = scorpioErrorJson(error);
		return c.json(mapped.body, mapped.status);
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
		401: {
			description: "Unauthorized",
			content: {
				"application/json": { schema: ScorpioErrorResponseSchema },
			},
		},
	},
});

scorpioRoute.openapi(bonusDetailRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(unauthorized, 401);
	}
	const { issueId } = c.req.valid("param");
	try {
		const data = await getBonusCallDetail(getScorpioConfig(c.env), issueId);
		return c.json({ success: true as const, data }, 200);
	} catch (error) {
		const mapped = scorpioErrorJson(error);
		return c.json(mapped.body, mapped.status);
	}
});

export default scorpioRoute;
