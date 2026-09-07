import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import { ErrorResponseSchema, successResponseSchema } from "@/schemas";
import { listAdminActivity } from "@/utils/admin-activity-log";
import type { CloudflareBindings } from "../types";

const adminActivityRoute = new OpenAPIHono<{
	Bindings: CloudflareBindings;
}>();

const ActivityLogSchema = z.object({
	id: z.string(),
	adminId: z.string(),
	adminName: z.string(),
	adminEmail: z.string(),
	adminRole: z.string(),
	userId: z.string(),
	fullName: z.string(),
	emailAddress: z.string(),
	role: z.string(),
	username: z.string().nullable(),
	avatar: z.string().nullable(),
	status: z.enum(["online", "offline"]),
	action: z.string(),
	targetUserId: z.string().nullable(),
	targetUserName: z.string().nullable(),
	targetUserEmail: z.string().nullable(),
	targetUserUsername: z.string().nullable(),
	targetUser: z
		.object({
			id: z.string(),
			name: z.string().nullable(),
			email: z.string().nullable(),
			username: z.string().nullable(),
		})
		.nullable(),
	details: z
		.object({
			transactionType: z.enum(["credit", "debit"]).optional(),
			amount: z.number().optional(),
			currency: z.literal("NGN").optional(),
			reason: z.string().optional(),
			transactionId: z.string().optional(),
			balanceAfter: z.number().optional(),
		})
		.nullable(),
	createdAt: z.string(),
});

const getAdminActivityRoute = createRoute({
	method: "get",
	path: "/activity",
	tags: ["Admin - Activity"],
	summary: "List admin activity logs",
	security: [{ BearerAuth: [] }],
	request: {
		query: z.object({
			page: z.coerce.number().int().min(1).default(1),
			limit: z.coerce.number().int().min(1).max(100).default(10),
		}),
	},
	responses: {
		200: {
			description: "Admin activity logs retrieved",
			content: {
				"application/json": {
					schema: successResponseSchema(
						z.object({
							activities: z.array(ActivityLogSchema),
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
		403: {
			description: "Forbidden",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

adminActivityRoute.openapi(getAdminActivityRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) return c.json({ success: false, error: "Unauthorized" }, 401);

	const session = await validateAdminSession(c.env, token);
	if (
		!session ||
		(session.role !== "admin" && session.role !== "super_admin")
	) {
		return c.json({ success: false, error: "Forbidden - admin only" }, 403);
	}

	const { page, limit } = c.req.valid("query");
	const { rows, total } = await listAdminActivity(c.env, page, limit);
	const activities = rows.map((row) => ({
		...row,
		createdAt: row.createdAt.toISOString(),
	}));

	return c.json({
		success: true,
		data: {
			activities,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.max(1, Math.ceil(total / limit)),
			},
		},
	});
});

export default adminActivityRoute;
