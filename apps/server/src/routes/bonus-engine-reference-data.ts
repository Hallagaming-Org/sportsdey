import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
	BONUS_ENGINE_HEADER,
	BONUS_ENGINE_INVALID_SIGNATURE_STATUS,
	getBonusEngineConfig,
	isBonusEngineConfigured,
	listBonusEngineChampionships,
	listBonusEngineEventMarkets,
	listBonusEngineGameProviders,
	listBonusEngineGames,
	listBonusEngineSportCategories,
	listBonusEngineSportEvents,
	listBonusEngineSports,
	verifyBonusEngineSecureDataHeader,
} from "@/services/bonus-engine";
import type { CloudflareBindings } from "../types";

const referenceDataRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const SecureDataHeaderSchema = z.object({
	[BONUS_ENGINE_HEADER.SECURE_DATA]: z.string().openapi({
		param: { name: BONUS_ENGINE_HEADER.SECURE_DATA, in: "header" },
		description:
			"Required header for security; Crypt this Header Name as Value with your PrivateKey.",
	}),
});

/**
 * Validates X-Secure-Data before returning catalog payloads for Admin dropdowns.
 */
async function requireSecureData(
	c: {
		req: { header: (name: string) => string | undefined };
		env: CloudflareBindings;
		json: (body: unknown, status?: 401 | 413 | 503) => Response;
	},
): Promise<Response | null> {
	if (!isBonusEngineConfigured(c.env)) {
		return c.json(
			{ success: false, error: "Bonus Engine is not configured" },
			503,
		);
	}

	const headerValue = c.req.header(BONUS_ENGINE_HEADER.SECURE_DATA) || "";
	const config = getBonusEngineConfig(c.env);
	const valid = await verifyBonusEngineSecureDataHeader({
		headerValue,
		privateKeyPem: config.privateKeyPem,
		callbackPublicKeyPem: config.callbackPublicKeyPem,
	});
	if (!valid) {
		return c.json(
			{
				status: BONUS_ENGINE_INVALID_SIGNATURE_STATUS,
				message: "INVALID_SIGNATURE",
			},
			BONUS_ENGINE_INVALID_SIGNATURE_STATUS,
		);
	}
	return null;
}

const gameProvidersRoute = createRoute({
	method: "get",
	path: "/casino/game-providers",
	tags: ["Bonus Engine Reference Data"],
	summary: "Gets the game providers",
	description: "Returns a list of casino game providers.",
	request: { headers: SecureDataHeaderSchema },
	responses: {
		200: {
			description: "OK",
			content: {
				"application/json": {
					schema: z.array(
						z.object({
							name: z.string(),
							unique_id: z.string(),
							is_live_game: z.number(),
						}),
					),
				},
			},
		},
		413: { description: "Invalid X-Secure-Data" },
		503: { description: "Bonus Engine not configured" },
	},
});

referenceDataRoute.openapi(gameProvidersRoute, async (c) => {
	const rejected = await requireSecureData(c);
	if (rejected) return rejected;
	const data = await listBonusEngineGameProviders(c.env);
	return c.json(data, 200);
});

const gamesRoute = createRoute({
	method: "get",
	path: "/casino/games",
	tags: ["Bonus Engine Reference Data"],
	summary: "Gets the games",
	description: "Returns a list of games.",
	request: {
		headers: SecureDataHeaderSchema,
		query: z.object({
			gameProvider: z.string().optional().openapi({
				param: { name: "gameProvider", in: "query" },
			}),
		}),
	},
	responses: {
		200: {
			description: "OK",
			content: {
				"application/json": {
					schema: z.array(
						z.object({
							provider_unique_id: z.string(),
							name: z.string(),
							unique_id: z.string(),
							free_spin: z.number(),
						}),
					),
				},
			},
		},
		413: { description: "Invalid X-Secure-Data" },
		503: { description: "Bonus Engine not configured" },
	},
});

referenceDataRoute.openapi(gamesRoute, async (c) => {
	const rejected = await requireSecureData(c);
	if (rejected) return rejected;
	const { gameProvider } = c.req.valid("query");
	const data = await listBonusEngineGames({ env: c.env, gameProvider });
	return c.json(data, 200);
});

const sportsRoute = createRoute({
	method: "get",
	path: "/sportsbook/sports",
	tags: ["Bonus Engine Reference Data"],
	summary: "Gets the sports",
	description: "Returns a list of sports.",
	request: { headers: SecureDataHeaderSchema },
	responses: {
		200: {
			description: "OK",
			content: {
				"application/json": {
					schema: z.array(
						z.object({
							SportId: z.number(),
							Name: z.string(),
						}),
					),
				},
			},
		},
		413: { description: "Invalid X-Secure-Data" },
		503: { description: "Bonus Engine not configured" },
	},
});

referenceDataRoute.openapi(sportsRoute, async (c) => {
	const rejected = await requireSecureData(c);
	if (rejected) return rejected;
	return c.json(listBonusEngineSports(), 200);
});

const categoriesRoute = createRoute({
	method: "get",
	path: "/sportsbook/categories",
	tags: ["Bonus Engine Reference Data"],
	summary: "Gets the list of sport categories",
	description: "Returns a list of sport categories.",
	request: {
		headers: SecureDataHeaderSchema,
		query: z.object({
			sportId: z.string().optional(),
			categoryId: z.string().optional(),
		}),
	},
	responses: {
		200: {
			description: "OK",
			content: {
				"application/json": {
					schema: z.array(
						z.object({
							categoryId: z.number(),
							name: z.string(),
						}),
					),
				},
			},
		},
		413: { description: "Invalid X-Secure-Data" },
		503: { description: "Bonus Engine not configured" },
	},
});

referenceDataRoute.openapi(categoriesRoute, async (c) => {
	const rejected = await requireSecureData(c);
	if (rejected) return rejected;
	const query = c.req.valid("query");
	return c.json(listBonusEngineSportCategories(query), 200);
});

const championshipRoute = createRoute({
	method: "get",
	path: "/sportsbook/championship",
	tags: ["Bonus Engine Reference Data"],
	summary: "Gets the list of championships",
	description: "Returns a list of championships.",
	request: {
		headers: SecureDataHeaderSchema,
		query: z.object({
			sportId: z.string().optional(),
			categoryId: z.string().optional(),
			championshipId: z.string().optional(),
		}),
	},
	responses: {
		200: {
			description: "OK",
			content: {
				"application/json": {
					schema: z.array(
						z.object({
							championshipId: z.number(),
							name: z.string(),
						}),
					),
				},
			},
		},
		413: { description: "Invalid X-Secure-Data" },
		503: { description: "Bonus Engine not configured" },
	},
});

referenceDataRoute.openapi(championshipRoute, async (c) => {
	const rejected = await requireSecureData(c);
	if (rejected) return rejected;
	const query = c.req.valid("query");
	return c.json(listBonusEngineChampionships(query), 200);
});

const eventsRoute = createRoute({
	method: "get",
	path: "/sportsbook/events",
	tags: ["Bonus Engine Reference Data"],
	summary: "Gets the list of sport events",
	description: "Returns a list of events.",
	request: {
		headers: SecureDataHeaderSchema,
		query: z.object({
			sportId: z.string().optional(),
			categoryId: z.string().optional(),
			championshipId: z.string().optional(),
		}),
	},
	responses: {
		200: {
			description: "OK",
			content: {
				"application/json": {
					schema: z.array(
						z.object({
							EventId: z.number(),
							EventName: z.string(),
						}),
					),
				},
			},
		},
		413: { description: "Invalid X-Secure-Data" },
		503: { description: "Bonus Engine not configured" },
	},
});

referenceDataRoute.openapi(eventsRoute, async (c) => {
	const rejected = await requireSecureData(c);
	if (rejected) return rejected;
	const query = c.req.valid("query");
	return c.json(listBonusEngineSportEvents(query), 200);
});

const eventMarketsRoute = createRoute({
	method: "get",
	path: "/sportsbook/events/markets",
	tags: ["Bonus Engine Reference Data"],
	summary: "Gets event markets",
	description: "Returns a list of markets for a given sport event.",
	request: {
		headers: SecureDataHeaderSchema,
		query: z.object({
			eventId: z.string().optional(),
		}),
	},
	responses: {
		200: {
			description: "OK",
			content: {
				"application/json": {
					schema: z.array(
						z.object({
							EventId: z.number(),
							EventName: z.string(),
							MarketId: z.number().optional(),
							MarketName: z.string().optional(),
						}),
					),
				},
			},
		},
		413: { description: "Invalid X-Secure-Data" },
		503: { description: "Bonus Engine not configured" },
	},
});

referenceDataRoute.openapi(eventMarketsRoute, async (c) => {
	const rejected = await requireSecureData(c);
	if (rejected) return rejected;
	const { eventId } = c.req.valid("query");
	return c.json(listBonusEngineEventMarkets({ eventId }), 200);
});

export default referenceDataRoute;
