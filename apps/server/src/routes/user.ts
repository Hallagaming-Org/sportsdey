import crypto from "node:crypto";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, asc, desc, eq, gte, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { z } from "zod";
import {
	generateSessionToken,
	getSessionToken,
	validateAdminSession,
} from "@/auth/admin";
import * as schema from "@/db/schema";
import type { CloudflareBindings } from "../types";

const userRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const UpdateUserSchema = z.object({
	name: z.string().min(1).openapi({
		description: "User's full name",
		example: "John Doe",
	}),
	country: z.string().optional().openapi({
		description: "User's country",
		example: "Nigeria",
	}),
	mobileNumber: z.string().optional().openapi({
		description: "User's mobile number",
		example: "+2348012345678",
	}),
});

const UserResponseSchema = z.object({
	id: z.string().openapi({ description: "User ID" }),
	name: z.string().openapi({ description: "User's name" }),
	email: z.string().openapi({ description: "User's email" }),
	emailVerified: z
		.boolean()
		.openapi({ description: "Email verification status" }),
	image: z
		.string()
		.nullable()
		.openapi({ description: "User's profile image URL" }),
	country: z.string().nullable().openapi({ description: "User's country" }),
	mobileNumber: z
		.string()
		.nullable()
		.openapi({ description: "User's mobile number" }),
	suspended: z.boolean().openapi({ description: "Suspension status" }),
	createdAt: z.string().openapi({ description: "Creation timestamp" }),
	updatedAt: z.string().openapi({ description: "Last update timestamp" }),
});

const UpdateUserErrorSchema = z.object({
	success: z.literal(false),
	error: z.string(),
	details: z.null(),
});

const UpdateUserResponseSchema = z.object({
	success: z.literal(true),
	data: UserResponseSchema,
});

const GetAllUsersQuerySchema = z.object({
	page: z
		.string()
		.optional()
		.openapi({ description: "Page number (default: 1)", example: "1" }),
	limit: z
		.string()
		.optional()
		.openapi({
			description: "Items per page (default: 10, max: 100)",
			example: "10",
		}),
	sort: z
		.enum(["asc", "desc"])
		.optional()
		.openapi({ description: "Sort order", example: "asc" }),
	search: z
		.string()
		.optional()
		.openapi({
			description: "Search by name, email, or user ID",
			example: "john",
		}),
	tab: z
		.enum(["all", "recent", "pending"])
		.optional()
		.openapi({ description: "Filter by tab", example: "all" }),
});

const UserListItemSchema = z.object({
	id: z.string().openapi({ description: "User ID" }),
	name: z.string().openapi({ description: "User's name" }),
	email: z.string().openapi({ description: "User's email" }),
	wallet: z.number().openapi({ description: "Wallet balance" }),
	status: z.string().openapi({ description: "Verification status" }),
	suspended: z.boolean().openapi({ description: "Suspension status" }),
	registeredDate: z.string().openapi({ description: "Registration date" }),
});

const GetAllUsersResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		users: z.array(UserListItemSchema),
		total: z.number().openapi({ description: "Total number of users" }),
		page: z.number().openapi({ description: "Current page" }),
		limit: z.number().openapi({ description: "Items per page" }),
		totalPages: z.number().openapi({ description: "Total number of pages" }),
	}),
});

const getUserRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["User"],
	summary: "Get current user",
	description: "Retrieve the authenticated user's profile details",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "User retrieved successfully",
			content: {
				"application/json": {
					schema: UpdateUserResponseSchema,
				},
			},
		},
		401: {
			description: "Unauthorized - user not authenticated",
			content: {
				"application/json": {
					schema: UpdateUserErrorSchema,
				},
			},
		},
	},
});

const updateUserRoute = createRoute({
	method: "patch",
	path: "/",
	tags: ["User"],
	summary: "Update user profile",
	description: "Update the authenticated user's profile information",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: UpdateUserSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "User updated successfully",
			content: {
				"application/json": {
					schema: UpdateUserResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid request",
			content: {
				"application/json": {
					schema: UpdateUserErrorSchema,
				},
			},
		},
		401: {
			description: "Unauthorized - user not authenticated",
			content: {
				"application/json": {
					schema: UpdateUserErrorSchema,
				},
			},
		},
	},
});

userRoute.openapi(getUserRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
				details: null,
			},
			401,
		);
	}

	const db = drizzle(c.env.DB, { schema });

	const [existingUser] = await db
		.select()
		.from(schema.user)
		.where(eq(schema.user.id, user.id))
		.limit(1);

	if (!existingUser) {
		return c.json(
			{
				success: false as const,
				error: "User not found",
				details: null,
			},
			404,
		);
	}

	const userResponse = {
		id: existingUser.id,
		name: existingUser.name,
		email: existingUser.email,
		emailVerified: existingUser.emailVerified,
		image: existingUser.image,
		country: existingUser.country,
		mobileNumber: existingUser.mobileNumber,
		suspended: existingUser.suspended,
		createdAt: existingUser.createdAt,
		updatedAt: existingUser.updatedAt,
		verificationStatus: existingUser.verificationStatus,
	};

	return c.json(
		{
			success: true as const,
			data: userResponse,
		},
		200,
	);
});

userRoute.openapi(updateUserRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
				details: null,
			},
			401,
		);
	}

	const result = UpdateUserSchema.safeParse(await c.req.json());
	if (!result.success) {
		return c.json(
			{
				success: false as const,
				error: "Invalid request",
				details: null,
			},
			400,
		);
	}

	const { name, country, mobileNumber } = result.data;
	const db = drizzle(c.env.DB, { schema });

	const [updatedUser] = await db
		.update(schema.user)
		.set({
			name,
			country: country ?? null,
			mobileNumber: mobileNumber ?? null,
		})
		.where(eq(schema.user.id, user.id))
		.returning();

	if (!updatedUser) {
		return c.json(
			{
				success: false as const,
				error: "User not found",
				details: null,
			},
			404,
		);
	}

	const userResponse = {
		id: updatedUser.id,
		name: updatedUser.name,
		email: updatedUser.email,
		emailVerified: updatedUser.emailVerified,
		image: updatedUser.image,
		country: updatedUser.country,
		mobileNumber: updatedUser.mobileNumber,
		suspended: updatedUser.suspended,
		createdAt: updatedUser.createdAt,
		updatedAt: updatedUser.updatedAt,
	};

	return c.json(
		{
			success: true as const,
			data: userResponse,
		},
		200,
	);
});

const getAllUsersRoute = createRoute({
	method: "get",
	path: "/all",
	tags: ["User"],
	summary: "Get all users (admin only)",
	description:
		"Retrieve all users with pagination, sorting, search, and filtering options (admin only)",
	security: [{ BearerAuth: [] }],
	request: {
		query: GetAllUsersQuerySchema,
	},
	responses: {
		200: {
			description: "Users retrieved successfully",
			content: {
				"application/json": {
					schema: GetAllUsersResponseSchema,
				},
			},
		},
		401: {
			description: "Unauthorized - admin not authenticated",
			content: {
				"application/json": {
					schema: z.object({
						success: z.literal(false),
						error: z.string(),
					}),
				},
			},
		},
		403: {
			description: "Forbidden - admin only",
			content: {
				"application/json": {
					schema: z.object({
						success: z.literal(false),
						error: z.string(),
					}),
				},
			},
		},
	},
});

userRoute.openapi(getAllUsersRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
				details: null,
			},
			401,
		);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session) {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - admin only",
				details: null,
			},
			403,
		);
	}

	const db = drizzle(c.env.DB, { schema });

	const page = Math.max(1, Number.parseInt(c.req.query("page") || "1", 10));
	const limit = Math.min(
		100,
		Math.max(1, Number.parseInt(c.req.query("limit") || "10", 10)),
	);
	const sort = c.req.query("sort") === "desc" ? "desc" : "asc";
	const offset = (page - 1) * limit;
	const search = c.req.query("search")?.trim();
	const tab = c.req.query("tab") as "all" | "recent" | "pending" | undefined;

	const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

	let baseQuery = db
		.select({
			id: schema.user.id,
			name: schema.user.name,
			email: schema.user.email,
			wallet: schema.wallet.balance,
			status: schema.user.verificationStatus,
			suspended: schema.user.suspended,
			registeredDate: schema.user.createdAt,
		})
		.from(schema.user)
		.leftJoin(schema.wallet, eq(schema.wallet.userId, schema.user.id));

	let countQuery = db
		.select({ count: sql<number>`count(*)` })
		.from(schema.user)
		.leftJoin(schema.wallet, eq(schema.wallet.userId, schema.user.id));

	if (tab === "recent") {
		const recentCondition = and(gte(schema.user.createdAt, sevenDaysAgo));
		baseQuery = baseQuery.where(recentCondition) as typeof baseQuery;
		countQuery = countQuery.where(recentCondition) as typeof countQuery;
	}

	if (tab === "pending") {
		const pendingCondition = and(
			eq(schema.user.verificationStatus, "pending_verification"),
		);
		baseQuery = baseQuery.where(pendingCondition) as typeof baseQuery;
		countQuery = countQuery.where(pendingCondition) as typeof countQuery;
	}

	if (search) {
		const searchCondition = or(
			like(schema.user.name, `%${search}%`),
			like(schema.user.email, `%${search}%`),
			eq(schema.user.id, search),
		);
		baseQuery = baseQuery.where(searchCondition) as typeof baseQuery;
		countQuery = countQuery.where(searchCondition) as typeof countQuery;
	}

	const orderByClause =
		sort === "desc" ? desc(schema.user.name) : asc(schema.user.name);

	const rawUsers = await baseQuery
		.orderBy(orderByClause)
		.limit(limit)
		.offset(offset);

	const countResult = await countQuery;
	const total = countResult[0]?.count || 0;

	const users = rawUsers.map((u) => ({
		id: u.id,
		name: u.name,
		email: u.email,
		wallet: u.wallet ?? 0,
		status: u.status,
		suspended: u.suspended,
		registeredDate: u.registeredDate,
	}));

	const totalPages = Math.ceil(total / limit);

	return c.json(
		{
			success: true as const,
			data: {
				users,
				total,
				page,
				limit,
				totalPages,
			},
		},
		200,
	);
});

const CreateUserSchema = z.object({
	name: z.string().min(1).openapi({
		description: "User's full name",
		example: "John Doe",
	}),
	email: z.string().email().openapi({
		description: "User's email address",
		example: "john@example.com",
	}),
	country: z.string().optional().openapi({
		description: "User's country",
		example: "Nigeria",
	}),
	mobileNumber: z.string().optional().openapi({
		description: "User's mobile number",
		example: "+2348012345678",
	}),
});

const CreateUserResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		id: z.string(),
		name: z.string(),
		email: z.string(),
		emailVerified: z.boolean(),
		verificationStatus: z.string(),
		createdAt: z.number(),
	}),
});

userRoute.openapi(
	createRoute({
		method: "post",
		path: "/",
		tags: ["User"],
		summary: "Create user (admin only)",
		description: "Create a new user (admin only)",
		security: [{ BearerAuth: [] }],
		request: {
			body: {
				content: {
					"application/json": {
						schema: CreateUserSchema,
					},
				},
			},
		},
		responses: {
			201: {
				description: "User created successfully",
				content: {
					"application/json": {
						schema: CreateUserResponseSchema,
					},
				},
			},
			400: {
				description: "Invalid request",
				content: {
					"application/json": {
						schema: z.object({
							success: z.literal(false),
							error: z.string(),
						}),
					},
				},
			},
			401: {
				description: "Unauthorized - admin not authenticated",
				content: {
					"application/json": {
						schema: z.object({
							success: z.literal(false),
							error: z.string(),
						}),
					},
				},
			},
		},
	}),
	async (c) => {
		const token = getSessionToken(c.req.raw.headers);
		console.log(token);
		if (!token) {
			return c.json({ success: false as const, error: "Unauthorized" }, 401);
		}

		const session = await validateAdminSession(c.env, token);
		if (!session) {
			return c.json(
				{ success: false as const, error: "Forbidden - admin only" },
				403,
			);
		}

		const result = CreateUserSchema.safeParse(await c.req.json());
		if (!result.success) {
			return c.json(
				{ success: false as const, error: "Invalid request body" },
				400,
			);
		}

		const { name, email, country, mobileNumber } = result.data;
		const db = drizzle(c.env.DB, { schema });

		const existingUser = await db
			.select()
			.from(schema.user)
			.where(eq(schema.user.email, email))
			.limit(1);

		if (existingUser.length > 0) {
			return c.json(
				{ success: false as const, error: "Email already exists" },
				400,
			);
		}

		const [newUser] = await db
			.insert(schema.user)
			.values({
				id: `user_${crypto.randomUUID()}`,
				name,
				email,
				emailVerified: false,
				verificationStatus: "not_verified",
				country: country ?? null,
				mobileNumber: mobileNumber ?? null,
			})
			.returning();

		return c.json(
			{
				success: true as const,
				data: {
					id: newUser.id,
					name: newUser.name,
					email: newUser.email,
					emailVerified: newUser.emailVerified,
					verificationStatus: newUser.verificationStatus,
					createdAt: newUser.createdAt,
				},
			},
			201,
		);
	},
);

const ToggleSuspendedSchema = z.object({
	userId: z.string().min(1).openapi({
		description: "User ID to toggle suspension",
		example: "user_123",
	}),
});

const ToggleSuspendedResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		id: z.string(),
		suspended: z.boolean(),
	}),
});

userRoute.openapi(
	createRoute({
		method: "patch",
		path: "/{userId}/suspended",
		tags: ["User"],
		summary: "Toggle user suspension",
		description: "Toggle a user's suspended state (admin only)",
		security: [{ BearerAuth: [] }],
		request: {
			params: z.object({
				userId: z.string(),
			}),
		},
		responses: {
			200: {
				description: "User suspension toggled successfully",
				content: {
					"application/json": {
						schema: ToggleSuspendedResponseSchema,
					},
				},
			},
			400: {
				description: "Invalid request",
				content: {
					"application/json": {
						schema: z.object({
							success: z.literal(false),
							error: z.string(),
						}),
					},
				},
			},
			401: {
				description: "Unauthorized - admin not authenticated",
				content: {
					"application/json": {
						schema: z.object({
							success: z.literal(false),
							error: z.string(),
						}),
					},
				},
			},
			403: {
				description: "Forbidden - super admin or admin only",
				content: {
					"application/json": {
						schema: z.object({
							success: z.literal(false),
							error: z.string(),
						}),
					},
				},
			},
			404: {
				description: "User not found",
				content: {
					"application/json": {
						schema: z.object({
							success: z.literal(false),
							error: z.string(),
						}),
					},
				},
			},
		},
	}),
	async (c) => {
		const token = getSessionToken(c.req.raw.headers);
		if (!token) {
			return c.json(
				{ success: false as const, error: "Unauthorized" },
				401,
			);
		}

		const session = await validateAdminSession(c.env, token);
		if (!session) {
			return c.json(
				{ success: false as const, error: "Forbidden - admin only" },
				403,
			);
		}

		if (session.role !== "super_admin" && session.role !== "admin") {
			return c.json(
				{ success: false as const, error: "Forbidden - super admin or admin only" },
				403,
			);
		}

		const userId = c.req.param("userId");
		if (!userId) {
			return c.json(
				{ success: false as const, error: "User ID is required" },
				400,
			);
		}

		const db = drizzle(c.env.DB, { schema });

		const [existingUser] = await db
			.select()
			.from(schema.user)
			.where(eq(schema.user.id, userId))
			.limit(1);

		if (!existingUser) {
			return c.json(
				{ success: false as const, error: "User not found" },
				404,
			);
		}

		const newSuspendedState = !existingUser.suspended;

		const [updatedUser] = await db
			.update(schema.user)
			.set({ suspended: newSuspendedState })
			.where(eq(schema.user.id, userId))
			.returning();

		return c.json(
			{
				success: true as const,
				data: {
					id: updatedUser.id,
					suspended: updatedUser.suspended,
				},
			},
			200,
		);
	},
);

export default userRoute;