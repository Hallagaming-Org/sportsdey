import crypto from "node:crypto";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import * as schema from "@/db/schema";
import { ErrorResponseSchema, successResponseSchema } from "@/schemas";
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
		category: z
			.string()
			.nullable()
			.optional()
			.openapi({ description: "Game category" }),
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
		category: z.string().nullable().openapi({ description: "Game category" }),
		enabled: z.boolean().openapi({ description: "Enabled status" }),
		createdAt: z.number().openapi({ description: "Created at timestamp" }),
		updatedAt: z.number().openapi({ description: "Updated at timestamp" }),
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
			.openapi({ description: "Filter by game category" }),
		offset: z
			.coerce.number()
			.int()
			.min(0)
			.optional()
			.openapi({ description: "Offset for pagination" }),
		limit: z
			.coerce.number()
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
		const { category, offset, limit } = c.req.valid("query");
		const db = drizzle(c.env.DB, { schema });
		let query: any = db.select().from(schema.game).orderBy(schema.game.name);
		if (category) {
			query = query.where(eq(schema.game.category, category));
		}
		if (offset !== undefined) {
			query = query.offset(offset);
		}
		if (limit !== undefined) {
			query = query.limit(limit);
		}
		const games = await query;
		return c.json({ success: true as const, data: games }, 200);
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

		return c.json({ success: true as const, data: game }, 200);
	},
);

gamesRoute.openapi(
	createRoute({
		method: "post",
		path: "/",
		summary: "Create games",
		description: "Create one or multiple games. Requires admin authentication.",
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
		const now = Date.now();

		const gamesToInsert = result.data.map((game) => ({
			id: crypto.randomUUID(),
			name: game.name,
			code: game.code,
			imageUrl: game.imageUrl ?? null,
			category: game.category ?? null,
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
				{ success: false as const, error: "Failed to create game" },
				500,
			);
		}

		return c.json({ success: true as const, data: inserted }, 201);
	},
);

gamesRoute.openapi(
	createRoute({
		method: "patch",
		path: "/{id}",
		summary: "Update a game",
		description: "Update a game by ID. Requires admin authentication.",
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

		const [updated] = await db
			.update(schema.game)
			.set({ ...result.data, updatedAt: Date.now() })
			.where(eq(schema.game.id, id))
			.returning();

		return c.json({ success: true as const, data: updated }, 200);
	},
);

gamesRoute.openapi(
	createRoute({
		method: "patch",
		path: "/{id}/enable",
		summary: "Enable a game",
		description: "Enable a game by ID. Requires admin authentication.",
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

		if (!existing) {
			return c.json(
				{ success: false as const, error: "Game not found", details: null },
				404,
			);
		}

		const [updated] = await db
			.update(schema.game)
			.set({ enabled: true, updatedAt: Date.now() })
			.where(eq(schema.game.id, id))
			.returning();

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

		if (!existing) {
			return c.json(
				{ success: false as const, error: "Game not found", details: null },
				404,
			);
		}

		const [updated] = await db
			.update(schema.game)
			.set({ enabled: false, updatedAt: Date.now() })
			.where(eq(schema.game.id, id))
			.returning();

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
