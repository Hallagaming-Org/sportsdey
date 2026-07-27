import crypto from "node:crypto";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import * as schema from "@/db/schema";
import { ErrorResponseSchema, successResponseSchema } from "@/schemas";
import { toWAT } from "@/utils";
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
		const db = drizzle(c.env.DB, { schema });
		const query = c.req.valid("query");

		const games = await db.query.game.findMany({
			with: {
				categories: {
					with: {
						category: true,
					},
				},
			},
		});

		let mapped = games.map((g) => ({
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

		if (query.category) {
			const slug = query.category.toLowerCase();
			mapped = mapped.filter((g) =>
				g.categories.some((c) => c.slug.toLowerCase() === slug),
			);
		}

		if (query.search) {
			const q = query.search.toLowerCase();
			mapped = mapped.filter(
				(g) =>
					g.name.toLowerCase().includes(q) ||
					g.code.toLowerCase().includes(q),
			);
		}

		if (query.sort === "asc") {
			mapped.sort((a, b) => a.name.localeCompare(b.name));
		} else if (query.sort === "desc") {
			mapped.sort((a, b) => b.name.localeCompare(a.name));
		}

		const offset = query.offset ?? 0;
		const limit = query.limit;
		if (limit != null) {
			mapped = mapped.slice(offset, offset + limit);
		} else if (offset > 0) {
			mapped = mapped.slice(offset);
		}

		return c.json(
			{
				success: true as const,
				data: mapped,
			},
			200,
		);
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

		const gamesToInsert = result.data.map((game) => ({
			id: crypto.randomUUID(),
			name: game.name,
			code: game.code,
			imageUrl: game.imageUrl ?? null,
			enabled: game.enabled ?? true,
			createdAt: now,
			updatedAt: now,
		}));

		const inserted = await db
			.insert(schema.game)
			.values(gamesToInsert)
			.returning();

		if (!inserted || inserted.length === 0) {
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

		if (!existing.length) {
			return c.json(
				{ success: false as const, error: "Game not found", details: null },
				404,
			);
		}

		const [updated] = await db
			.update(schema.game)
			.set({ enabled: true, updatedAt: new Date() })
			.where(eq(schema.game.id, id))
			.returning();

		if (!updated) {
			return c.json(
				{ success: false as const, error: "Game not found", details: null },
				404,
			);
		}

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
		console.log("id", id);

		const db = drizzle(c.env.DB, { schema });
		const existing = await db
			.select()
			.from(schema.game)
			.where(eq(schema.game.id, id));

		console.log("existing", existing);

		if (!existing.length) {
			return c.json(
				{ success: false as const, error: "Game not found", details: null },
				404,
			);
		}

		const [updated] = await db
			.update(schema.game)
			.set({ enabled: false, updatedAt: new Date() })
			.where(eq(schema.game.id, id))
			.returning();

		if (!updated) {
			return c.json(
				{ success: false as const, error: "Game not found", details: null },
				404,
			);
		}

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
