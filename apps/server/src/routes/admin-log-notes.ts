import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import * as schema from "@/db/schema";
import { requirePermission } from "@/middleware/admin-permissions";
import { ErrorResponseSchema, successResponseSchema } from "@/schemas";
import { toWAT } from "@/utils";
import {
	adminActivityActions,
	recordActivityForSession,
} from "@/utils/admin-activity-log";
import type { CloudflareBindings } from "../types";

const adminLogNotesRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const LogNoteSchema = z.object({
	id: z.string(),
	userId: z.string(),
	adminId: z.string(),
	adminName: z.string(),
	adminRole: z.string(),
	adminEmail: z.string(),
	note: z.string(),
	createdAt: z.string(),
});

const createLogNoteRoute = createRoute({
	method: "post",
	path: "/log-notes",
	tags: ["Admin - Log Notes"],
	summary: "Create a log note for a user",
	description:
		"Creates a log note for a specific user. Requires create_log_note permission.",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({
						userId: z.string().openapi({ description: "User ID" }),
						note: z.string().min(1).openapi({ description: "Note content" }),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: "Log note created",
			content: {
				"application/json": {
					schema: successResponseSchema(z.object({ logNote: LogNoteSchema })),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		403: {
			description: "Forbidden",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

const deleteLogNoteRoute = createRoute({
	method: "delete",
	path: "/log-notes/{id}",
	tags: ["Admin - Log Notes"],
	summary: "Delete a log note",
	description: "Deletes a log note by ID. Super admin only.",
	security: [{ BearerAuth: [] }],
	request: {
		params: z.object({
			id: z.string().openapi({ description: "Log note ID" }),
		}),
	},
	responses: {
		200: {
			description: "Log note deleted",
			content: {
				"application/json": {
					schema: successResponseSchema(z.object({ success: z.literal(true) })),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		403: {
			description: "Forbidden - super admin only",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		404: {
			description: "Log note not found",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

const getUserLogNotesRoute = createRoute({
	method: "get",
	path: "/log-notes/user/{userId}",
	tags: ["Admin - Log Notes"],
	summary: "Get all log notes for a user",
	description:
		"Returns all log notes for a specific user, ordered by newest first.",
	security: [{ BearerAuth: [] }],
	request: {
		params: z.object({
			userId: z.string().openapi({ description: "User ID" }),
		}),
	},
	responses: {
		200: {
			description: "Log notes retrieved",
			content: {
				"application/json": {
					schema: successResponseSchema(
						z.object({
							logNotes: z.array(LogNoteSchema),
						}),
					),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		403: {
			description: "Forbidden",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

adminLogNotesRoute.openapi(createLogNoteRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	if (
		session.role !== "super_admin" &&
		!requirePermission(session, "create_log_note")
	) {
		return c.json(
			{
				success: false,
				error: "Forbidden - create_log_note permission required",
			},
			403,
		);
	}

	const { userId, note } = c.req.valid("json");

	const db = drizzle(c.env.DB, { schema });

	const [userRecord] = await db
		.select({ id: schema.user.id })
		.from(schema.user)
		.where(eq(schema.user.id, userId))
		.limit(1);

	if (!userRecord) {
		return c.json({ success: false, error: "User not found" }, 404);
	}

	const [adminRecord] = await db
		.select({
			name: schema.admin.name,
			role: schema.admin.role,
			email: schema.admin.email,
		})
		.from(schema.admin)
		.where(eq(schema.admin.id, session.adminId))
		.limit(1);

	if (!adminRecord) {
		return c.json({ success: false, error: "Admin not found" }, 404);
	}

	const id = crypto.randomUUID();

	await db.insert(schema.adminLogNote).values({
		id,
		userId,
		adminId: session.adminId,
		adminName: adminRecord.name,
		adminRole: adminRecord.role,
		note,
	});

	const [created] = await db
		.select()
		.from(schema.adminLogNote)
		.where(eq(schema.adminLogNote.id, id))
		.limit(1);

	if (!created) {
		return c.json({ success: false, error: "Failed to create log note" }, 500);
	}
	await recordActivityForSession(
		c.env,
		session.adminId,
		adminActivityActions.createLogNote,
	);

	return c.json({
		success: true,
		data: {
			logNote: {
				id: created.id,
				userId: created.userId,
				adminId: created.adminId,
				adminName: created.adminName,
				adminRole: created.adminRole,
				adminEmail: adminRecord.email,
				note: created.note,
				createdAt: toWAT(created.createdAt),
			},
		},
	});
});

const deleteUserLogNotesRoute = createRoute({
	method: "delete",
	path: "/log-notes/user/{userId}",
	tags: ["Admin - Log Notes"],
	summary: "Delete all log notes for a user",
	description: "Deletes all log notes for a specific user. Super admin only.",
	security: [{ BearerAuth: [] }],
	request: {
		params: z.object({
			userId: z.string().openapi({ description: "User ID" }),
		}),
	},
	responses: {
		200: {
			description: "Log notes deleted",
			content: {
				"application/json": {
					schema: successResponseSchema(z.object({ deleted: z.number() })),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		403: {
			description: "Forbidden - super admin only",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		404: {
			description: "User not found",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

adminLogNotesRoute.openapi(deleteLogNoteRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	if (session.role !== "super_admin") {
		return c.json(
			{
				success: false,
				error: "Forbidden - super admin only",
			},
			403,
		);
	}

	const { id } = c.req.valid("param");
	const db = drizzle(c.env.DB, { schema });

	const [existing] = await db
		.select()
		.from(schema.adminLogNote)
		.where(eq(schema.adminLogNote.id, id))
		.limit(1);

	if (!existing) {
		return c.json({ success: false, error: "Log note not found" }, 404);
	}

	await db.delete(schema.adminLogNote).where(eq(schema.adminLogNote.id, id));
	await recordActivityForSession(
		c.env,
		session.adminId,
		adminActivityActions.deleteLogNote,
	);

	return c.json({ success: true, data: { success: true as const } });
});

adminLogNotesRoute.openapi(deleteUserLogNotesRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	if (session.role !== "super_admin") {
		return c.json(
			{
				success: false,
				error: "Forbidden - super admin only",
			},
			403,
		);
	}

	const { userId } = c.req.valid("param");
	const db = drizzle(c.env.DB, { schema });

	const [userRecord] = await db
		.select({ id: schema.user.id })
		.from(schema.user)
		.where(eq(schema.user.id, userId))
		.limit(1);

	if (!userRecord) {
		return c.json({ success: false, error: "User not found" }, 404);
	}

	const result = await db
		.delete(schema.adminLogNote)
		.where(eq(schema.adminLogNote.userId, userId));
	await recordActivityForSession(
		c.env,
		session.adminId,
		adminActivityActions.deleteLogNote,
	);

	return c.json({
		success: true,
		data: { deleted: result.meta.changes },
	});
});

adminLogNotesRoute.openapi(getUserLogNotesRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const { userId } = c.req.valid("param");
	const db = drizzle(c.env.DB, { schema });

	const logNotes = await db
		.select({
			id: schema.adminLogNote.id,
			userId: schema.adminLogNote.userId,
			adminId: schema.adminLogNote.adminId,
			adminName: schema.adminLogNote.adminName,
			adminRole: schema.adminLogNote.adminRole,
			adminEmail: schema.admin.email,
			note: schema.adminLogNote.note,
			createdAt: schema.adminLogNote.createdAt,
		})
		.from(schema.adminLogNote)
		.innerJoin(schema.admin, eq(schema.adminLogNote.adminId, schema.admin.id))
		.where(eq(schema.adminLogNote.userId, userId))
		.orderBy(desc(schema.adminLogNote.createdAt));

	return c.json({
		success: true,
		data: {
			logNotes: logNotes.map((n) => ({
				id: n.id,
				userId: n.userId,
				adminId: n.adminId,
				adminName: n.adminName,
				adminRole: n.adminRole,
				adminEmail: n.adminEmail,
				note: n.note,
				createdAt: toWAT(n.createdAt),
			})),
		},
	});
});

export default adminLogNotesRoute;
