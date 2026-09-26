import crypto from "node:crypto";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import * as schema from "@/db/schema";
import { ErrorResponseSchema, successResponseSchema } from "@/schemas";
import { toWAT } from "@/utils";
import { collapseGamesByCode } from "@/utils/game-catalog";
import { isD1CapacityError } from "@/utils/d1-errors";
import type { CloudflareBindings } from "../types";

const gamesRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const GameParamsSchema = z
	.object({
		id: z.string().openapi({ description: "Game ID" }),
	})
	.openapi("GameParams");

const CreateGameSchema = z
	.object({
		name: z.string().min(1).openapi({ description: "Game name" }),
		code: z.string().min(1).openapi({ description: "Short code for provider" }),
		imageUrl: z
			.string()
			.nullable()
			.optional()
			.openapi({ description: "Image URL (optional)" }),
		categoryIds: z
			.array(z.string())
			.optional()
			.openapi({ description: "Category IDs to assign" }),
		enabled: z
			.boolean()
			.optional()
			.default(true)
			.openapi({ description: "Whether game is enabled" }),
	})
	.openapi("CreateGame");

const CreateGamesSchema = z
	.array(CreateGameSchema)
	.min(1)
	.max(100)
	.openapi({ description: "Array of games to create" });

const UpdateGameSchema = CreateGameSchema.partial().openapi("UpdateGame");

const EnableDisableResponseSchema = z
	.object({
		success: z.literal(true).openapi({ description: "Success status" }),
		data: z
			.object({
				id: z.string().openapi({ description: "Game ID" }),
				enabled: z.boolean().openapi({ description: "Enabled status" }),
			})
			.openapi({ description: "Response data" }),
	})
	.openapi("EnableDisableResponse");

const GameResponseSchema = z
	.object({
		id: z.string().openapi({ description: "Game ID" }),
		name: z.string().openapi({ description: "Game name" }),
		code: z.string().openapi({ description: "Game code" }),
		imageUrl: z.string().nullable().openapi({ description: "Image URL" }),
		categories: z
			.array(
				z.object({
					id: z.string(),
					name: z.string(),
					slug: z.string(),
				}),
			)
			.openapi({ description: "Game categories" }),
		enabled: z.boolean().openapi({ description: "Enabled status" }),
		createdAt: z
			.string()
			.openapi({ description: "Created at (WAT ISO string)" }),
		updatedAt: z
			.string()
			.openapi({ description: "Updated at (WAT ISO string)" }),
	})
	.openapi("GameResponse");

const GameListResponseSchema = z
	.array(GameResponseSchema)
	.openapi("GameListResponse");

const GameListQuerySchema = z
	.object({
		category: z
			.string()
			.optional()
			.openapi({ description: "Filter by game category slug" }),
		search: z
			.string()
			.optional()
			.openapi({ description: "Search games by name" }),
		sort: z
			.enum(["asc", "desc"])
			.optional()
			.openapi({
				description: "Sort order (default: Aviator-first then alphabetical)",
			}),
		offset: z.coerce
			.number()
			.int()
			.min(0)
			.optional()
			.openapi({ description: "Offset for pagination" }),
		limit: z.coerce
			.number()
			.int()
			.min(1)
			.max(100)
			.optional()
			.openapi({ description: "Limit for pagination" }),
	})
	.openapi("GameListQuery");

const GAMES_CATALOG_CACHE_KEY = "games:catalog:v2";
const GAMES_CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;

type GameListItem = {
	id: string;
	name: string;
	code: string;
	imageUrl: string | null;
	enabled: boolean;
	createdAt: string;
	updatedAt: string;
	categories: Array<{ id: string; name: string; slug: string }>;
};

type GameListQuery = z.infer<typeof GameListQuerySchema>;

function getKvNamespace(env: CloudflareBindings) {
	return env.sportsdey_ns || env.staging_kv || null;
}

async function invalidateGamesCatalogCache(
	env: CloudflareBindings,
): Promise<void> {
	const kv = getKvNamespace(env);
	if (!kv) return;
	try {
		await kv.delete(GAMES_CATALOG_CACHE_KEY);
	} catch (error) {
		console.error("Failed to invalidate games catalog cache", error);
	}
}

async function isAdminCatalogRequest(
	env: CloudflareBindings,
	headers: Headers,
): Promise<boolean> {
	const token = getSessionToken(headers);
	if (!token) return false;
	return Boolean(await validateAdminSession(env, token));
}

function applyGameListQuery(
	mapped: GameListItem[],
	query: GameListQuery,
): GameListItem[] {
	let result = mapped;

	if (query.category) {
		const slug = query.category.toLowerCase();
		result = result.filter((g) =>
			g.categories.some((c) => c.slug.toLowerCase() === slug),
		);
	}

	if (query.search) {
		const q = query.search.toLowerCase();
		result = result.filter(
			(g) =>
				g.name.toLowerCase().includes(q) || g.code.toLowerCase().includes(q),
		);
	}

	if (query.sort === "asc") {
		result = [...result].sort((a, b) => a.name.localeCompare(b.name));
	} else if (query.sort === "desc") {
		result = [...result].sort((a, b) => b.name.localeCompare(a.name));
	}

	result = collapseGamesByCode(result);

	const offset = query.offset ?? 0;
	const limit = query.limit;
	if (limit != null) {
		return result.slice(offset, offset + limit);
	}
	if (offset > 0) {
		return result.slice(offset);
	}
	return result;
}

async function loadGamesCatalogFromDb(
	env: CloudflareBindings,
): Promise<GameListItem[]> {
	const db = drizzle(env.DB, { schema });
	const games = await db.query.game.findMany({
		with: {
			categories: {
				with: {
					category: true,
				},
			},
		},
	});

	return games.map((g) => ({
		id: g.id,
		name: g.name,
		code: g.code,
		imageUrl: g.imageUrl,
		enabled: g.enabled,
		createdAt: toWAT(g.createdAt),
		updatedAt: toWAT(g.updatedAt),
		categories: [
			...new Map(
				g.categories.map((gc) => [
					gc.category.slug,
					{
						id: gc.category.id,
						name: gc.category.name,
						slug: gc.category.slug,
					},
				]),
			).values(),
		],
	}));
}

gamesRoute.openapi(
	createRoute({
		method: "get",
		path: "/",
		summary: "List all games",
		description: "Returns all games, optionally filtered by category",
		request: {
			query: GameListQuerySchema,
		},
		responses: {
			200: {
				content: {
					"application/json": {
						schema: successResponseSchema(GameListResponseSchema),
					},
				},
				description: "Successfully retrieved games",
			},
		},
		tags: ["Games"],
	}),
	async (c) => {
		const query = c.req.valid("query");
		const kv = getKvNamespace(c.env);
		const skipCache = await isAdminCatalogRequest(c.env, c.req.raw.headers);
		let cachedCatalog: { data: GameListItem[]; expiresAt: number } | null =
			null;

		if (kv && !skipCache) {
			cachedCatalog = (await kv.get(GAMES_CATALOG_CACHE_KEY, "json")) as {
				data: GameListItem[];
				expiresAt: number;
			} | null;
			if (cachedCatalog && Date.now() <= cachedCatalog.expiresAt) {
				return c.json(
					{
						success: true as const,
						data: applyGameListQuery(cachedCatalog.data, query),
					},
					200,
				);
			}
		}

		try {
			const catalog = await loadGamesCatalogFromDb(c.env);
			if (kv && !skipCache) {
				await kv.put(
					GAMES_CATALOG_CACHE_KEY,
					JSON.stringify({
						data: catalog,
						expiresAt: Date.now() + GAMES_CATALOG_CACHE_TTL_MS,
					}),
				);
			}
			return c.json(
				{
					success: true as const,
					data: applyGameListQuery(catalog, query),
				},
				200,
			);
		} catch (error) {
			if (isD1CapacityError(error) && cachedCatalog?.data?.length) {
				console.warn("Serving stale games catalog from KV after D1 capacity error");
				return c.json(
					{
						success: true as const,
						data: applyGameListQuery(cachedCatalog.data, query),
					},
					200,
				);
			}
			throw error;
		}
	},
);

gamesRoute.openapi(
	createRoute({
		method: "get",
		path: "/{id}",
		summary: "Get a single game",
		description: "Returns a game by ID",
		request: {
			params: GameParamsSchema,
		},
		responses: {
			200: {
				content: {
					"application/json": {
						schema: successResponseSchema(GameResponseSchema),
					},
				},
				description: "Successfully retrieved game",
			},
			404: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Game not found",
			},
		},
		tags: ["Games"],
	}),
	async (c) => {
		const { id } = c.req.valid("param");
		const db = drizzle(c.env.DB, { schema });
		const game = await db
			.select()
			.from(schema.game)
			.where(eq(schema.game.id, id))
			.get();

		if (!game) {
			return c.json(
				{ success: false as const, error: "Game not found", details: null },
				404,
			);
		}

		const categories = await db
			.select({
				id: schema.category.id,
				name: schema.category.name,
				slug: schema.category.slug,
			})
			.from(schema.gameCategory)
			.innerJoin(
				schema.category,
				eq(schema.gameCategory.categoryId, schema.category.id),
			)
			.where(eq(schema.gameCategory.gameId, game.id));

		return c.json(
			{
				success: true as const,
				data: {
					...game,
					categories: [...new Map(categories.map((c) => [c.slug, c])).values()],
					createdAt: toWAT(game.createdAt),
					updatedAt: toWAT(game.updatedAt),
				},
			},
			200,
		);
	},
);

gamesRoute.openapi(
	createRoute({
		method: "post",
		path: "/",
		summary: "Create games",
		description: "Create one or multiple games. Requires admin authentication.",
		security: [{ BearerAuth: [] }],
		request: {
			body: {
				content: {
					"application/json": {
						schema: CreateGamesSchema,
					},
				},
			},
		},
		responses: {
			201: {
				content: {
					"application/json": {
						schema: successResponseSchema(GameListResponseSchema),
					},
				},
				description: "Successfully created games",
			},
			400: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Invalid request body",
			},
			401: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Unauthorized",
			},
			500: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Failed to create games",
			},
		},
		tags: ["Games"],
	}),
	async (c) => {
		const token = getSessionToken(c.req.raw.headers);
		if (!token) {
			return c.json(
				{ success: false as const, error: "Unauthorized", details: null },
				401,
			);
		}

		const session = await validateAdminSession(c.env, token);
		if (!session) {
			return c.json(
				{ success: false as const, error: "Unauthorized", details: null },
				401,
			);
		}

		const body = await c.req.json();
		const result = CreateGamesSchema.safeParse(body);
		if (!result.success) {
			return c.json(
				{
					success: false as const,
					error: "Invalid request body",
					details: null,
				},
				400,
			);
		}

		const db = drizzle(c.env.DB, { schema });
		const now = new Date();
		const inserted: (typeof schema.game.$inferSelect)[] = [];

		for (const game of result.data) {
			const existingRows = await db
				.select()
				.from(schema.game)
				.where(eq(schema.game.code, game.code));

			if (existingRows.length > 0) {
				const updated = await db
					.update(schema.game)
					.set({
						name: game.name,
						imageUrl: game.imageUrl ?? existingRows[0]?.imageUrl ?? null,
						enabled: game.enabled ?? existingRows[0]?.enabled ?? true,
						updatedAt: now,
					})
					.where(eq(schema.game.code, game.code))
					.returning();
				const row =
					updated.find((item) => item.id === existingRows[0]?.id) ??
					updated[0];
				if (!row) {
					return c.json(
						{
							success: false as const,
							error: "Failed to create game",
							details: null,
						},
						500,
					);
				}
				inserted.push(row);
				continue;
			}

			const [created] = await db
				.insert(schema.game)
				.values({
					id: crypto.randomUUID(),
					name: game.name,
					code: game.code,
					imageUrl: game.imageUrl ?? null,
					enabled: game.enabled ?? true,
					createdAt: now,
					updatedAt: now,
				})
				.returning();

			if (!created) {
				return c.json(
					{
						success: false as const,
						error: "Failed to create game",
						details: null,
					},
					500,
				);
			}
			inserted.push(created);
		}

		if (inserted.length === 0) {
			return c.json(
				{
					success: false as const,
					error: "Failed to create game",
					details: null,
				},
				500,
			);
		}

		const gameCategoryValues: { gameId: string; categoryId: string }[] = [];
		for (const [i, insertedGame] of inserted.entries()) {
			const categoryIds = result.data[i]?.categoryIds;
			if (categoryIds) {
				for (const catId of categoryIds) {
					gameCategoryValues.push({
						gameId: insertedGame.id,
						categoryId: catId,
					});
				}
			}
		}
		if (gameCategoryValues.length > 0) {
			await db
				.insert(schema.gameCategory)
				.values(gameCategoryValues)
				.onConflictDoNothing();
		}

		await invalidateGamesCatalogCache(c.env);

		const ids = inserted.map((g) => g.id);
		const categoryMap: Record<
			string,
			{ id: string; name: string; slug: string }[]
		> = {};
		if (ids.length > 0) {
			const gameCategories = await db
				.select({
					gameId: schema.gameCategory.gameId,
					id: schema.category.id,
					name: schema.category.name,
					slug: schema.category.slug,
				})
				.from(schema.gameCategory)
				.innerJoin(
					schema.category,
					eq(schema.gameCategory.categoryId, schema.category.id),
				)
				.where(inArray(schema.gameCategory.gameId, ids));

			for (const gc of gameCategories) {
				(categoryMap[gc.gameId] ??= []).push({
					id: gc.id,
					name: gc.name,
					slug: gc.slug,
				});
			}
		}

		return c.json(
			{
				success: true as const,
				data: inserted.map((g) => ({
					...g,
					categories: categoryMap[g.id] ?? [],
					createdAt: toWAT(g.createdAt),
					updatedAt: toWAT(g.updatedAt),
				})),
			},
			201,
		);
	},
);

gamesRoute.openapi(
	createRoute({
		method: "patch",
		path: "/{id}",
		summary: "Update a game",
		description: "Update a game by ID. Requires admin authentication.",
		security: [{ BearerAuth: [] }],
		request: {
			params: GameParamsSchema,
			body: {
				content: {
					"application/json": {
						schema: UpdateGameSchema,
					},
				},
			},
		},
		responses: {
			200: {
				content: {
					"application/json": {
						schema: successResponseSchema(GameResponseSchema),
					},
				},
				description: "Successfully updated game",
			},
			400: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Invalid request body",
			},
			401: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Unauthorized",
			},
			404: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Game not found",
			},
		},
		tags: ["Games"],
	}),
	async (c) => {
		const token = getSessionToken(c.req.raw.headers);
		if (!token) {
			return c.json(
				{ success: false as const, error: "Unauthorized", details: null },
				401,
			);
		}

		const session = await validateAdminSession(c.env, token);
		if (!session) {
			return c.json(
				{ success: false as const, error: "Unauthorized", details: null },
				401,
			);
		}

		const { id } = c.req.valid("param");
		const body = await c.req.json();
		const result = UpdateGameSchema.safeParse(body);
		if (!result.success) {
			return c.json(
				{
					success: false as const,
					error: "Invalid request body",
					details: null,
				},
				400,
			);
		}

		const db = drizzle(c.env.DB, { schema });
		const existing = await db
			.select()
			.from(schema.game)
			.where(eq(schema.game.id, id))
			.get();

		if (!existing) {
			return c.json(
				{ success: false as const, error: "Game not found", details: null },
				404,
			);
		}

		const { categoryIds, ...updateFields } = result.data;
		const [updated] = await db
			.update(schema.game)
			.set({ ...updateFields, updatedAt: new Date() })
			.where(eq(schema.game.id, id))
			.returning();

		if (!updated) {
			return c.json(
				{ success: false as const, error: "Game not found", details: null },
				404,
			);
		}

		if (categoryIds) {
			await db
				.delete(schema.gameCategory)
				.where(eq(schema.gameCategory.gameId, id));
			await db
				.insert(schema.gameCategory)
				.values(
					categoryIds.map((catId) => ({ gameId: id, categoryId: catId })),
				);
		}

		await invalidateGamesCatalogCache(c.env);

		const categories = await db
			.select({
				id: schema.category.id,
				name: schema.category.name,
				slug: schema.category.slug,
			})
			.from(schema.gameCategory)
			.innerJoin(
				schema.category,
				eq(schema.gameCategory.categoryId, schema.category.id),
			)
			.where(eq(schema.gameCategory.gameId, id));

		return c.json(
			{
				success: true as const,
				data: {
					...updated,
					categories,
					createdAt: toWAT(updated.createdAt),
					updatedAt: toWAT(updated.updatedAt),
				},
			},
			200,
		);
	},
);

gamesRoute.openapi(
	createRoute({
		method: "patch",
		path: "/{id}/enable",
		summary: "Enable a game",
		description: "Enable a game by ID. Requires admin authentication.",
		security: [{ BearerAuth: [] }],
		request: {
			params: GameParamsSchema,
		},
		responses: {
			200: {
				content: {
					"application/json": {
						schema: EnableDisableResponseSchema,
					},
				},
				description: "Successfully enabled game",
			},
			401: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Unauthorized",
			},
			404: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Game not found",
			},
		},
		tags: ["Games"],
	}),
	async (c) => {
		const token = getSessionToken(c.req.raw.headers);
		if (!token) {
			return c.json(
				{ success: false as const, error: "Unauthorized", details: null },
				401,
			);
		}

		const session = await validateAdminSession(c.env, token);
		if (!session) {
			return c.json(
				{ success: false as const, error: "Unauthorized", details: null },
				401,
			);
		}

		const { id } = c.req.valid("param");

		const db = drizzle(c.env.DB, { schema });
		const existing = await db
			.select()
			.from(schema.game)
			.where(eq(schema.game.id, id));

		if (!existing.length || !existing[0]) {
			return c.json(
				{ success: false as const, error: "Game not found", details: null },
				404,
			);
		}

		const updatedRows = await db
			.update(schema.game)
			.set({ enabled: true, updatedAt: new Date() })
			.where(eq(schema.game.code, existing[0].code))
			.returning();

		const updated =
			updatedRows.find((row) => row.id === id) ?? updatedRows[0];

		if (!updated) {
			return c.json(
				{ success: false as const, error: "Game not found", details: null },
				404,
			);
		}

		await invalidateGamesCatalogCache(c.env);

		return c.json(
			{
				success: true as const,
				data: { id: updated.id, enabled: updated.enabled },
			},
			200,
		);
	},
);

gamesRoute.openapi(
	createRoute({
		method: "patch",
		path: "/{id}/disable",
		summary: "Disable a game",
		description: "Disable a game by ID. Requires admin authentication.",
		security: [{ BearerAuth: [] }],
		request: {
			params: GameParamsSchema,
		},
		responses: {
			200: {
				content: {
					"application/json": {
						schema: EnableDisableResponseSchema,
					},
				},
				description: "Successfully disabled game",
			},
			401: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Unauthorized",
			},
			404: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Game not found",
			},
		},
		tags: ["Games"],
	}),
	async (c) => {
		const token = getSessionToken(c.req.raw.headers);
		if (!token) {
			return c.json(
				{ success: false as const, error: "Unauthorized", details: null },
				401,
			);
		}

		const session = await validateAdminSession(c.env, token);
		if (!session) {
			return c.json(
				{ success: false as const, error: "Unauthorized", details: null },
				401,
			);
		}

		const { id } = c.req.valid("param");

		const db = drizzle(c.env.DB, { schema });
		const existing = await db
			.select()
			.from(schema.game)
			.where(eq(schema.game.id, id));

		if (!existing.length || !existing[0]) {
			return c.json(
				{ success: false as const, error: "Game not found", details: null },
				404,
			);
		}

		const updatedRows = await db
			.update(schema.game)
			.set({ enabled: false, updatedAt: new Date() })
			.where(eq(schema.game.code, existing[0].code))
			.returning();

		const updated =
			updatedRows.find((row) => row.id === id) ?? updatedRows[0];

		if (!updated) {
			return c.json(
				{ success: false as const, error: "Game not found", details: null },
				404,
			);
		}

		await invalidateGamesCatalogCache(c.env);

		return c.json(
			{
				success: true as const,
				data: { id: updated.id, enabled: updated.enabled },
			},
			200,
		);
	},
);

export default gamesRoute;
