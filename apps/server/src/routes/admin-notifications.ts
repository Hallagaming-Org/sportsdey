import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import * as schema from "@/db/schema";
import { ErrorResponseSchema, successResponseSchema } from "@/schemas";
import { toWAT } from "@/utils";
import {
	adminActivityActions,
	recordActivityForSession,
} from "@/utils/admin-activity-log";
import type { CloudflareBindings } from "../types";

const adminNotificationsRoute = new OpenAPIHono<{
	Bindings: CloudflareBindings;
}>();

const NotificationSchema = z.object({
	id: z.string(),
	title: z.string(),
	message: z.string(),
	type: z.string(),
	referenceId: z.string().nullable(),
	isRead: z.boolean(),
	createdAt: z.string(),
});

const getNotificationsRoute = createRoute({
	method: "get",
	path: "/notifications",
	tags: ["Admin - Notifications"],
	summary: "Get admin notifications",
	description: "Retrieve notifications for the authenticated admin (paginated)",
	security: [{ BearerAuth: [] }],
	request: {
		query: z.object({
			page: z.coerce.number().int().min(1).default(1),
			limit: z.coerce.number().int().min(1).max(100).default(20),
		}),
	},
	responses: {
		200: {
			description: "Notifications retrieved",
			content: {
				"application/json": {
					schema: successResponseSchema(
						z.object({
							notifications: z.array(NotificationSchema),
							pagination: z.object({
								page: z.number(),
								limit: z.number(),
								total: z.number(),
								totalPages: z.number(),
							}),
						}),
					),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

const getUnreadCountRoute = createRoute({
	method: "get",
	path: "/notifications/unread-count",
	tags: ["Admin - Notifications"],
	summary: "Get unread notification count",
	description: "Get the count of unread notifications for the admin",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Unread count retrieved",
			content: {
				"application/json": {
					schema: successResponseSchema(z.object({ count: z.number() })),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

const getNotificationCountRoute = createRoute({
	method: "get",
	path: "/notifications/count",
	tags: ["Admin - Notifications"],
	summary: "Get total and unread notification count",
	description:
		"Get the total count and unread count of notifications for the admin",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Counts retrieved",
			content: {
				"application/json": {
					schema: successResponseSchema(
						z.object({
							total: z.number(),
							unread: z.number(),
						}),
					),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

const markReadRoute = createRoute({
	method: "patch",
	path: "/notifications/{id}/read",
	tags: ["Admin - Notifications"],
	summary: "Mark notification as read",
	description: "Mark a specific notification as read",
	security: [{ BearerAuth: [] }],
	request: {
		params: z.object({
			id: z.string().openapi({ description: "Notification ID" }),
		}),
	},
	responses: {
		200: {
			description: "Marked as read",
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
		404: {
			description: "Notification not found",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

adminNotificationsRoute.openapi(getNotificationsRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const query = c.req.valid("query");
	const page = query.page;
	const limit = query.limit;
	const offset = (page - 1) * limit;
	const db = drizzle(c.env.DB, { schema });

	const countResult = await db
		.select({ count: schema.adminNotification.id })
		.from(schema.adminNotification)
		.where(eq(schema.adminNotification.adminId, session.adminId));

	const total = countResult.length;
	const totalPages = Math.ceil(total / limit);

	const notifications = await db
		.select()
		.from(schema.adminNotification)
		.where(eq(schema.adminNotification.adminId, session.adminId))
		.orderBy(desc(schema.adminNotification.createdAt))
		.limit(limit)
		.offset(offset);

	return c.json({
		success: true,
		data: {
			notifications: notifications.map((n) => ({
				id: n.id,
				title: n.title,
				message: n.message,
				type: n.type,
				referenceId: n.referenceId,
				isRead: n.isRead,
				createdAt: toWAT(n.createdAt),
			})),
			pagination: { page, limit, total, totalPages },
		},
	});
});

adminNotificationsRoute.openapi(getUnreadCountRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const db = drizzle(c.env.DB, { schema });

	const notifications = await db
		.select({ count: schema.adminNotification.id })
		.from(schema.adminNotification)
		.where(
			and(
				eq(schema.adminNotification.adminId, session.adminId),
				eq(schema.adminNotification.isRead, false),
			),
		);

	return c.json({
		success: true,
		data: { count: notifications.length },
	});
});

adminNotificationsRoute.openapi(getNotificationCountRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const db = drizzle(c.env.DB, { schema });

	const [totalResult, unreadResult] = await Promise.all([
		db
			.select({ count: schema.adminNotification.id })
			.from(schema.adminNotification)
			.where(eq(schema.adminNotification.adminId, session.adminId)),
		db
			.select({ count: schema.adminNotification.id })
			.from(schema.adminNotification)
			.where(
				and(
					eq(schema.adminNotification.adminId, session.adminId),
					eq(schema.adminNotification.isRead, false),
				),
			),
	]);

	return c.json({
		success: true,
		data: {
			total: totalResult.length,
			unread: unreadResult.length,
		},
	});
});

adminNotificationsRoute.openapi(markReadRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const { id } = c.req.valid("param");
	const db = drizzle(c.env.DB, { schema });

	const [notification] = await db
		.select()
		.from(schema.adminNotification)
		.where(
			and(
				eq(schema.adminNotification.id, id),
				eq(schema.adminNotification.adminId, session.adminId),
			),
		)
		.limit(1);

	if (!notification) {
		return c.json({ success: false, error: "Notification not found" }, 404);
	}

	await db
		.update(schema.adminNotification)
		.set({ isRead: true })
		.where(eq(schema.adminNotification.id, id));
	await recordActivityForSession(
		c.env,
		session.adminId,
		adminActivityActions.markNotificationRead,
	);

	return c.json({ success: true, data: { success: true as const } });
});

export default adminNotificationsRoute;
