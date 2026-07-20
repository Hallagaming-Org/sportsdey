import crypto from "node:crypto";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, count, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import * as schema from "@/db/schema";
import { requirePermission } from "@/middleware/admin-permissions";
import { ErrorResponseSchema } from "@/schemas";
import { toWAT } from "@/utils";
import {
	CreateUserNotificationSchema,
	NotificationAcknowledgementSchema,
	TicketStatusNotificationSchema,
	UnreadCountResponseSchema,
	UserNotificationListResponseSchema,
	UserNotificationSingleResponseSchema,
} from "@/schemas/notifications";
import { sendSms } from "@/utils/sms";
import { jsonZodErrorFormatter } from "@/utils/zod";

const notificationsRoute = new OpenAPIHono<{ Bindings: Cloudflare.Env }>();

const GetNotificationsQuerySchema = z
	.object({
		page: z
			.string()
			.optional()
			.openapi({ description: "Page number (default: 1)", example: "1" }),
		limit: z.string().optional().openapi({
			description: "Items per page (default: 10, max: 100)",
			example: "10",
		}),
	})
	.openapi("GetNotificationsQuery");

const getNotificationsRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["Notifications"],
	summary: "Get user notifications",
	description: "Retrieve all notifications for the authenticated user",
	security: [{ BearerAuth: [] }],
	request: {
		query: GetNotificationsQuerySchema,
	},
	responses: {
		200: {
			description: "Notifications retrieved successfully",
			content: {
				"application/json": {
					schema: UserNotificationListResponseSchema,
				},
			},
		},
		401: {
			description: "Unauthorized - user not authenticated",
			content: {
				"application/json": {
					schema: ErrorResponseSchema,
				},
			},
		},
	},
});

notificationsRoute.openapi(getNotificationsRoute, async (c) => {
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

	const page = Math.max(1, Number.parseInt(c.req.query("page") || "1", 10));
	const limit = Math.min(
		100,
		Math.max(1, Number.parseInt(c.req.query("limit") || "10", 10)),
	);
	const offset = (page - 1) * limit;

	const notifications = await db
		.select({
			id: schema.userNotification.id,
			userId: schema.userNotification.userId,
			title: schema.userNotification.title,
			message: schema.userNotification.message,
			read: schema.userNotification.read,
			createdAt: schema.userNotification.createdAt,
		})
		.from(schema.userNotification)
		.where(eq(schema.userNotification.userId, user.id))
		.orderBy(desc(schema.userNotification.createdAt))
		.limit(limit)
		.offset(offset);

	const countResult = await db
		.select({ count: schema.userNotification.id })
		.from(schema.userNotification)
		.where(eq(schema.userNotification.userId, user.id));

	const total = countResult[0]?.count || 0;
	const totalPages = Math.ceil(total / limit);

	return c.json(
		{
			success: true as const,
			data: {
				notifications: notifications.map((n) => ({
					...n,
					createdAt: toWAT(n.createdAt),
				})),
				total,
				page,
				limit,
				totalPages,
			},
		},
		200,
	);
});

const unreadCountRoute = createRoute({
	method: "get",
	path: "/unread-count",
	tags: ["Notifications"],
	summary: "Get unread notifications count",
	description: "Get the count of unread notifications for the authenticated user",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Unread count retrieved successfully",
			content: {
				"application/json": {
					schema: UnreadCountResponseSchema,
				},
			},
		},
		401: {
			description: "Unauthorized - user not authenticated",
			content: {
				"application/json": {
					schema: ErrorResponseSchema,
				},
			},
		},
	},
});

notificationsRoute.openapi(unreadCountRoute, async (c) => {
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

	const [result] = await db
		.select({ count: count() })
		.from(schema.userNotification)
		.where(
			and(
				eq(schema.userNotification.userId, user.id),
				eq(schema.userNotification.read, false),
			),
		);

	return c.json(
		{
			success: true as const,
			data: {
				count: result?.count ?? 0,
			},
		},
		200,
	);
});

const getNotificationByIdRoute = createRoute({
	method: "get",
	path: "/{id}",
	tags: ["Notifications"],
	summary: "Get notification by ID",
	description: "Retrieve a specific notification by ID",
	security: [{ BearerAuth: [] }],
	request: {
		params: z.object({
			id: z.string(),
		}),
	},
	responses: {
		200: {
			description: "Notification retrieved successfully",
			content: {
				"application/json": {
					schema: UserNotificationSingleResponseSchema,
				},
			},
		},
		401: {
			description: "Unauthorized - user not authenticated",
			content: {
				"application/json": {
					schema: ErrorResponseSchema,
				},
			},
		},
		404: {
			description: "Notification not found",
			content: {
				"application/json": {
					schema: ErrorResponseSchema,
				},
			},
		},
	},
});

notificationsRoute.openapi(getNotificationByIdRoute, async (c) => {
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

	const notificationId = c.req.param("id");
	const db = drizzle(c.env.DB, { schema });

	const [notification] = await db
		.select({
			id: schema.userNotification.id,
			userId: schema.userNotification.userId,
			title: schema.userNotification.title,
			message: schema.userNotification.message,
			read: schema.userNotification.read,
			createdAt: schema.userNotification.createdAt,
		})
		.from(schema.userNotification)
		.where(
			and(
				eq(schema.userNotification.id, notificationId),
				eq(schema.userNotification.userId, user.id),
			),
		)
		.limit(1);

	if (!notification) {
		return c.json(
			{
				success: false as const,
				error: "Notification not found",
				details: null,
			},
			404,
		);
	}

	return c.json(
		{
			success: true as const,
			data: { ...notification, createdAt: toWAT(notification.createdAt) },
		},
		200,
	);
});

const sendNotificationRoute = createRoute({
	method: "post",
	path: "/send",
	tags: ["Notifications"],
	summary: "Send notification to user (admin only)",
	description:
		"Send a notification to a specific user (admin/super_admin only)",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: CreateUserNotificationSchema,
				},
			},
		},
	},
	responses: {
		201: {
			description: "Notification sent successfully",
			content: {
				"application/json": {
					schema: UserNotificationSingleResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid request",
			content: {
				"application/json": {
					schema: ErrorResponseSchema,
				},
			},
		},
		401: {
			description: "Unauthorized - admin not authenticated",
			content: {
				"application/json": {
					schema: ErrorResponseSchema,
				},
			},
		},
		403: {
			description: "Forbidden - admin/super_admin only",
			content: {
				"application/json": {
					schema: ErrorResponseSchema,
				},
			},
		},
		404: {
			description: "User not found",
			content: {
				"application/json": {
					schema: ErrorResponseSchema,
				},
			},
		},
	},
});

notificationsRoute.openapi(sendNotificationRoute, async (c) => {
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
				error: "Forbidden - admin/super_admin only",
				details: null,
			},
			403,
		);
	}

	if (session.role !== "super_admin" && session.role !== "admin") {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - admin/super_admin only",
				details: null,
			},
			403,
		);
	}

	if (
		session.role !== "super_admin" &&
		!requirePermission(session, "send_notifications")
	) {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - send_notifications permission required",
			},
			403,
		);
	}

	const result = CreateUserNotificationSchema.safeParse(await c.req.json());
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

	const { title, message, userId } = result.data;
	const db = drizzle(c.env.DB, { schema });

	const [existingUser] = await db
		.select()
		.from(schema.user)
		.where(eq(schema.user.id, userId))
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

	const [notification] = await db
		.insert(schema.userNotification)
		.values({
			id: `notif_${crypto.randomUUID()}`,
			userId,
			title,
			message,
		})
		.returning();

	return c.json(
		{
			success: true as const,
			data: { ...notification, createdAt: toWAT(notification.createdAt) },
		},
		201,
	);
});

const markNotificationReadRoute = createRoute({
	method: "post",
	path: "/{id}/read",
	tags: ["Notifications"],
	summary: "Mark notification as read",
	description: "Mark a specific notification as read",
	security: [{ BearerAuth: [] }],
	request: {
		params: z.object({
			id: z.string(),
		}),
	},
	responses: {
		200: {
			description: "Notification marked as read",
			content: {
				"application/json": {
					schema: UserNotificationSingleResponseSchema,
				},
			},
		},
		401: {
			description: "Unauthorized - user not authenticated",
			content: {
				"application/json": {
					schema: ErrorResponseSchema,
				},
			},
		},
		404: {
			description: "Notification not found",
			content: {
				"application/json": {
					schema: ErrorResponseSchema,
				},
			},
		},
	},
});

notificationsRoute.openapi(markNotificationReadRoute, async (c) => {
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

	const notificationId = c.req.param("id");
	const db = drizzle(c.env.DB, { schema });

	const [existing] = await db
		.select({ id: schema.userNotification.id })
		.from(schema.userNotification)
		.where(
			and(
				eq(schema.userNotification.id, notificationId),
				eq(schema.userNotification.userId, user.id),
			),
		)
		.limit(1);

	if (!existing) {
		return c.json(
			{
				success: false as const,
				error: "Notification not found",
				details: null,
			},
			404,
		);
	}

	const [notification] = await db
		.update(schema.userNotification)
		.set({ read: true })
		.where(eq(schema.userNotification.id, notificationId))
		.returning({
			id: schema.userNotification.id,
			userId: schema.userNotification.userId,
			title: schema.userNotification.title,
			message: schema.userNotification.message,
			read: schema.userNotification.read,
			createdAt: schema.userNotification.createdAt,
		});

	return c.json(
		{
			success: true as const,
			data: { ...notification, createdAt: toWAT(notification.createdAt) },
		},
		200,
	);
});

/**
 * POST /notifications/ticket-status
 * Receives ticket status notifications from Betstack
 * Does not perform header or signature validation
 */

notificationsRoute.openapi(
	createRoute({
		method: "post",
		path: "/ticket-status",
		request: {
			body: {
				content: {
					"application/json": {
						schema: TicketStatusNotificationSchema,
					},
				},
			},
		},
		responses: {
			200: {
				content: {
					"application/json": {
						schema: NotificationAcknowledgementSchema,
					},
				},
				description: "Notification received successfully",
			},
			400: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Invalid request body",
			},
			500: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Internal server error",
			},
		},
		tags: ["Notifications"],
		summary: "Receive Betstack ticket status notification",
		description:
			"Endpoint to receive and validate ticket status notifications from Betstack",
	}),
	async (c) => {
		const payload = c.req.valid("json");

		const data = payload.data;
		const ticketCode = data.ticket_code || data.ticket_id;
		const recipients = data.msisdn || "";

		const result = (data.result || "").toString().toLowerCase();
		let message = "";

		switch (result) {
			case "pending":
				message = `Payment Received! Your ticket code is ${ticketCode} You can check your status in bet.sportsdey.com/track/${ticketCode}`;
				break;
			case "won":
				message = `Congratulations! Your bet won. Check the ticket details on bet.sportsdey.com/track/${ticketCode}`;
				break;
			case "lost":
				message = `Opps! Your ticket ${ticketCode} didn't win. Check results on bet.sportsdey.com/track/${ticketCode} But the next win could be yours`;
				break;
			case "void":
				message = `Your ticket ${ticketCode} has been voided. Check details on bet.sportsdey.com/track/${ticketCode}`;
				break;
		}

		if (!message || !recipients) {
			return c.json(
				{ success: false as const, error: "sms_not_sent", details: null },
				400,
			);
		}

		const refId = (
			Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
		).slice(0, 15);

		const sms = await sendSms({
			ref_id: refId,
			sender_id: "HALLA",
			recipients,
			telco: "GLO",
			message,
		});

		if (!sms.ok) {
			return c.json(
				{
					success: false as const,
					error: "bulksms_error",
					details: sms.error,
				},
				502,
			);
		}

		return c.json(
			{
				message: "Notification received",
				body: sms && sms.body,
			},
			200,
		);
	},
	jsonZodErrorFormatter,
);

export default notificationsRoute;
