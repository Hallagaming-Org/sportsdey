import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq, gte, inArray, like, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
	clearSessionCookie,
	createAdmin,
	createAdminSession,
	deleteAdmin,
	deleteAdminSession,
	deleteAdminSessionById,
	deleteAllAdminSessions,
	getAdminByEmail,
	getAdminById,
	getAdminSessions,
	getSessionToken,
	hashPassword,
	listAdmins,
	setSessionCookie,
	updateAdminById,
	updateAdminPermissions,
	validateAdminSession,
	verifyPassword,
} from "@/auth/admin";
import * as schema from "@/db/schema";
import { requirePermission } from "@/middleware/admin-permissions";
import { adminPermissions, permissionLabels } from "@/permissions";
import { ErrorResponseSchema, successResponseSchema } from "@/schemas";
import { parseQueryDateRange, toWAT } from "@/utils";
import type { CloudflareBindings } from "../types";

type AdminRouteContext = { Bindings: CloudflareBindings };

const adminRoute = new OpenAPIHono<AdminRouteContext>();

const ErrorSchema = z.object({
	success: z.literal(false),
	error: z.string(),
});

const ErrorSchemaWithDetails = z.object({
	success: z.literal(false),
	error: z.string(),
	details: z
		.array(
			z.object({
				field: z.string(),
				message: z.string(),
				code: z.string(),
			}),
		)
		.nullable()
		.optional(),
});

function safeParsePermissions(permissions: string | null): string[] {
	if (!permissions) return [];
	const parsed = JSON.parse(permissions);
	return Array.isArray(parsed) ? parsed : [];
}

const SignInSchema = z.object({
	email: z.string().email().openapi({
		description: "Admin email address",
		example: "admin@sportsdey.com",
	}),
	password: z
		.string()
		.min(1)
		.openapi({ description: "Admin password", example: "password123" }),
});

const AdminResponseSchema = z.object({
	id: z.string().openapi({ description: "Admin ID" }),
	email: z.string().email().openapi({ description: "Admin email" }),
	name: z.string().openapi({ description: "Admin name" }),
	mobileNumber: z
		.string()
		.nullable()
		.openapi({ description: "Admin mobile number" }),
	image: z
		.string()
		.nullable()
		.openapi({ description: "Admin profile image URL" }),
	role: z
		.enum(["super_admin", "admin", "csr-admin"])
		.openapi({ description: "Admin role" }),
	permissions: z
		.array(z.string())
		.openapi({ description: "Admin permissions" }),
	createdAt: z.string().openapi({ description: "Account creation timestamp" }),
});

const AdminSignInResponseSchema = z.object({
	admin: AdminResponseSchema,
	token: z.string().openapi({
		description: "Admin session token for bearer auth",
		example: "sess_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz",
	}),
});

const AdminMeResponseSchema = z.object({
	admin: AdminResponseSchema,
	token: z.string().openapi({
		description: "Current admin session token",
		example: "sess_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz",
	}),
});

const UpdateMeSchema = z.object({
	name: z.string().min(1).optional().openapi({ description: "Admin name" }),
	email: z.string().email().optional().openapi({ description: "Admin email" }),
	mobileNumber: z
		.string()
		.regex(/^(0|\+234)[789][01]\d{8}$/, "Invalid Nigerian phone number format")
		.nullable()
		.optional()
		.openapi({ description: "Mobile number in Nigerian format" }),
});

const ChangePasswordSchema = z.object({
	newPassword: z
		.string()
		.min(6)
		.openapi({ description: "New password (min 6 characters)" }),
	confirmPassword: z
		.string()
		.min(6)
		.openapi({ description: "Confirm new password" }),
});

const CreateAdminSchema = z.object({
	email: z.string().email().openapi({
		description: "Admin email address",
		example: "newadmin@sportsdey.com",
	}),
	password: z.string().min(6).openapi({
		description: "Password (min 6 characters)",
		example: "password123",
	}),
	name: z
		.string()
		.min(1)
		.openapi({ description: "Admin name", example: "John Doe" }),
	role: z
		.enum(["super_admin", "admin", "csr-admin"])
		.openapi({ description: "Admin role" }),
});

const ResetAdminPasswordSchema = z.object({
	email: z.string().email().openapi({
		description: "Admin email address",
		example: "admin@sportsdey.com",
	}),
	name: z
		.string()
		.min(1)
		.optional()
		.openapi({ description: "Admin full name (optional)", example: "John Doe" }),
	role: z
		.enum(["super_admin", "admin", "csr-admin"])
		.openapi({ description: "Admin role" }),
	password: z.string().min(6).openapi({
		description: "New password (min 6 characters)",
		example: "newpassword123",
	}),
});

/** Safety cap for unpaginated list responses (Workers memory / response size). */
const MAX_UNPAGINATED_ROWS = 10_000;

const GetWalletTransactionsQuerySchema = z.object({
	search: z
		.string()
		.optional()
		.openapi({ description: "Search by transaction reference" }),
	type: z
		.enum(["deposits", "withdrawals", "payments"])
		.optional()
		.openapi({ description: "Filter by transaction type" }),
	status: z
		.enum(["success", "pending", "failed", "refund"])
		.optional()
		.openapi({ description: "Filter by transaction status" }),
	fromDate: z
		.string()
		.optional()
		.openapi({ description: "Filter start date (YYYY-MM-DD)" }),
	toDate: z
		.string()
		.optional()
		.openapi({ description: "Filter end date (YYYY-MM-DD)" }),
	page: z.string().optional().openapi({ description: "Page number (default 1)" }),
	limit: z
		.string()
		.optional()
		.openapi({ description: "Items per page (default 10, max 100)" }),
});

const TransactionResponseSchema = z.object({
	transaction_id: z.string().openapi({ description: "Transaction ID" }),
	date_time: z
		.object({
			date: z.string().openapi({ description: "Date" }),
			time: z.string().openapi({ description: "Time" }),
		})
		.openapi({ description: "Date and time of transaction" }),
	type: z
		.enum(["deposit", "withdrawal", "payment"])
		.openapi({ description: "Transaction type" }),
	payment_method: z.string().openapi({ description: "Payment method used" }),
	amount: z.number().openapi({ description: "Transaction amount in Naira" }),
	balance_after: z
		.number()
		.openapi({ description: "Wallet balance after transaction" }),
	status: z.string().openapi({ description: "Transaction status" }),
	metadata: z.any().nullable(),
});

const signInRoute = createRoute({
	method: "post",
	path: "/auth/sign-in",
	tags: ["Admin - Authentication"],
	summary: "Admin sign in",
	description: "Authenticate an admin user and create a session",
	request: {
		body: {
			content: {
				"application/json": {
					schema: SignInSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Sign in successful",
			content: {
				"application/json": {
					schema: successResponseSchema(AdminSignInResponseSchema),
				},
			},
		},
		401: {
			description: "Invalid credentials",
			content: {
				"application/json": {
					schema: ErrorResponseSchema,
				},
			},
		},
	},
});

const signOutRoute = createRoute({
	method: "post",
	path: "/auth/sign-out",
	tags: ["Admin - Authentication"],
	summary: "Admin sign out",
	description: "Sign out the current admin session",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Sign out successful",
			content: {
				"application/json": {
					schema: successResponseSchema(
						z
							.object({
								message: z.string().openapi({ description: "Message" }),
							})
							.openapi("MessageResponse"),
					),
				},
			},
		},
	},
});

const getMeRoute = createRoute({
	method: "get",
	path: "/me",
	tags: ["Admin - Profile"],
	summary: "Get current admin",
	description: "Retrieve the authenticated admin's profile details",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Admin profile retrieved successfully",
			content: {
				"application/json": {
					schema: successResponseSchema(AdminMeResponseSchema),
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
	},
});

const updateMeRoute = createRoute({
	method: "patch",
	path: "/me",
	tags: ["Admin - Profile"],
	summary: "Update current admin profile",
	description: "Update the authenticated admin's profile information",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: UpdateMeSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Profile updated successfully",
			content: {
				"application/json": {
					schema: successResponseSchema(AdminResponseSchema),
				},
			},
		},
		400: {
			description: "Invalid request or email already in use",
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
	},
});

const ProfilePictureResponseSchema = z.object({
	image: z
		.string()
		.nullable()
		.openapi({ description: "Updated profile image URL" }),
});

const updateProfilePictureRoute = createRoute({
	method: "patch",
	path: "/me/profile-picture",
	tags: ["Admin - Profile"],
	summary: "Update admin profile picture",
	description: "Upload and update the admin's profile picture",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"multipart/form-data": {
					schema: z.object({
						file: z.string().openapi({
							type: "string",
							format: "binary",
							description: "Profile image file (max 5MB)",
						}),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: "Profile picture updated successfully",
			content: {
				"application/json": {
					schema: successResponseSchema(ProfilePictureResponseSchema),
				},
			},
		},
		400: {
			description: "Invalid file or file too large",
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
	},
});

const createAdminRoute = createRoute({
	method: "post",
	path: "/admins",
	tags: ["Admin - Management"],
	summary: "Create new admin",
	description: "Create a new admin user. Super admin access required.",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: CreateAdminSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Admin created successfully",
			content: {
				"application/json": {
					schema: successResponseSchema(
						z.object({
							id: z.string(),
							email: z.string(),
							name: z.string(),
							role: z.enum(["super_admin", "admin"]),
							createdAt: z.string(),
						}),
					),
				},
			},
		},
		400: {
			description: "Invalid request or email already in use",
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
			description: "Forbidden - super_admin only",
			content: {
				"application/json": {
					schema: ErrorResponseSchema,
				},
			},
		},
	},
});

const deleteAdminRoute = createRoute({
	method: "delete",
	path: "/admins/{id}",
	tags: ["Admin - Management"],
	summary: "Delete admin",
	description:
		"Delete an admin user by ID. Super admin access required. Cannot delete yourself.",
	security: [{ BearerAuth: [] }],
	request: {
		params: z
			.object({
				id: z.string().openapi({ description: "Admin ID to delete" }),
			})
			.openapi("DeleteAdminParams"),
	},
	responses: {
		200: {
			description: "Admin deleted successfully",
			content: {
				"application/json": {
					schema: successResponseSchema(
						z
							.object({
								message: z.string().openapi({ description: "Message" }),
							})
							.openapi("MessageResponse"),
					),
				},
			},
		},
		400: {
			description: "Cannot delete yourself",
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
			description: "Forbidden - super_admin only",
			content: {
				"application/json": {
					schema: ErrorResponseSchema,
				},
			},
		},
	},
});

const resetAdminPasswordRoute = createRoute({
	method: "post",
	path: "/admins/reset-password",
	tags: ["Admin - Management"],
	summary: "Reset admin password",
	description:
		"Reset an admin's password by email. Requires super_admin role or reset_password permission.",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: ResetAdminPasswordSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Admin password reset successfully",
			content: {
				"application/json": {
					schema: successResponseSchema(
						z.object({
							id: z.string(),
							email: z.string(),
							name: z.string(),
							role: z.enum(["super_admin", "admin", "csr-admin"]),
						}),
					),
				},
			},
		},
		400: {
			description: "Invalid request body",
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
			description: "Forbidden - reset_password permission required",
			content: {
				"application/json": {
					schema: ErrorResponseSchema,
				},
			},
		},
		404: {
			description: "Admin not found with the given email",
			content: {
				"application/json": {
					schema: ErrorResponseSchema,
				},
			},
		},
	},
});

const getWalletTransactionsRoute = createRoute({
	method: "get",
	path: "/wallet-transactions",
	tags: ["Admin - Wallet"],
	summary: "Get wallet transactions",
	description:
		"Paginated wallet transactions. Use GET /admin/wallet-transactions/all for the full unpaginated set.",
	security: [{ BearerAuth: [] }],
	request: {
		query: GetWalletTransactionsQuerySchema,
	},
	responses: {
		200: {
			description: "Transactions retrieved successfully",
			content: {
				"application/json": {
					schema: successResponseSchema(
						z.object({
							transactions: z.array(TransactionResponseSchema),
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
			description: "Unauthorized - admin not authenticated",
			content: {
				"application/json": {
					schema: ErrorResponseSchema,
				},
			},
		},
		403: {
			description: "Forbidden - admin or super_admin only",
			content: {
				"application/json": {
					schema: ErrorResponseSchema,
				},
			},
		},
	},
});

const changePasswordRoute = createRoute({
	method: "patch",
	path: "/auth/change-password",
	tags: ["Admin - Authentication"],
	summary: "Change admin password",
	description: "Change the authenticated admin's password",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: ChangePasswordSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Password changed successfully",
			content: {
				"application/json": {
					schema: successResponseSchema(
						z
							.object({
								message: z.string().openapi({ description: "Message" }),
							})
							.openapi("MessageResponse"),
					),
				},
			},
		},
		400: {
			description: "Passwords do not match or invalid request",
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
	},
});

const DeviceSchema = z.object({
	id: z.string().openapi({ description: "Session/Device ID" }),
	deviceName: z
		.string()
		.openapi({ description: "Device name (browser and OS)" }),
	ipAddress: z.string().nullable().openapi({ description: "IP address" }),
	browser: z.string().openapi({ description: "Browser name" }),
	lastActiveAt: z.string().openapi({ description: "Last active timestamp" }),
	createdAt: z.string().openapi({ description: "Session created timestamp" }),
	isCurrentDevice: z
		.boolean()
		.openapi({ description: "Is this the current device" }),
});

const DevicesResponseSchema = z.object({
	devices: z.array(DeviceSchema).openapi({ description: "List of devices" }),
});

const getDevicesRoute = createRoute({
	method: "get",
	path: "/auth/devices",
	tags: ["Admin - Authentication"],
	summary: "Get all devices",
	description: "Retrieve all devices/sessions logged in by the current admin",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Devices retrieved successfully",
			content: {
				"application/json": {
					schema: successResponseSchema(DevicesResponseSchema),
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
	},
});

const deleteDeviceRoute = createRoute({
	method: "delete",
	path: "/auth/devices/{sessionId}",
	tags: ["Admin - Authentication"],
	summary: "Log out a device",
	description: "Log out a specific device/session",
	security: [{ BearerAuth: [] }],
	request: {
		params: z.object({
			sessionId: z.string().openapi({ description: "Session ID to log out" }),
		}),
	},
	responses: {
		200: {
			description: "Device logged out successfully",
			content: {
				"application/json": {
					schema: successResponseSchema(
						z
							.object({
								message: z.string().openapi({ description: "Message" }),
							})
							.openapi("MessageResponse"),
					),
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
		404: {
			description: "Session not found",
			content: {
				"application/json": {
					schema: ErrorResponseSchema,
				},
			},
		},
	},
});

function formatDateTime(date: Date) {
	const watDate = new Date(date.getTime() + 60 * 60 * 1000);
	const months = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];
	const month = months[watDate.getMonth()];
	const day = watDate.getDate();
	const year = watDate.getFullYear();

	const hours = watDate.getHours();
	const minutes = watDate.getMinutes();
	const ampm = hours >= 12 ? "pm" : "am";
	const displayHours = hours % 12 || 12;
	const displayMinutes = minutes.toString().padStart(2, "0");

	return {
		date: `${month} ${day}, ${year}`,
		time: `${displayHours}:${displayMinutes} ${ampm}`,
	};
}

adminRoute.openapi(signInRoute, async (c) => {
	const body = await c.req.json();
	const result = SignInSchema.safeParse(body);
	if (!result.success) {
		return c.json(
			{ success: false, error: "Invalid request body", details: null },
			400,
		);
	}

	const { email, password } = result.data;
	const adminUser = await getAdminByEmail(c.env, email);

	if (!adminUser) {
		return c.json(
			{ success: false, error: "Invalid credentials", details: null },
			401,
		);
	}

	const valid = await verifyPassword(adminUser.passwordHash, password);
	if (!valid) {
		return c.json(
			{ success: false, error: "Invalid credentials", details: null },
			401,
		);
	}

	const token = await createAdminSession(
		c.env,
		adminUser.id,
		c.req.header("cf-connecting-ip") || undefined,
		c.req.header("user-agent") || undefined,
	);

	c.header("Set-Cookie", setSessionCookie(token, c.env.NODE_ENV), {
		append: true,
	});

	return c.json({
		success: true,
		data: {
			admin: {
				id: adminUser.id,
				email: adminUser.email,
				name: adminUser.name,
				mobileNumber: adminUser.mobileNumber,
				image: adminUser.image,
				role: adminUser.role,
				permissions: safeParsePermissions(adminUser.permissions),
				createdAt: toWAT(adminUser.createdAt) || "",
			},
			token,
		},
	});
});

adminRoute.openapi(signOutRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (token) {
		await deleteAdminSession(c.env, token);
	}
	c.header("Set-Cookie", clearSessionCookie(), { append: true });
	return c.json({
		success: true,
		data: { message: "Signed out successfully" },
	});
});

adminRoute.openapi(changePasswordRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const body = await c.req.json();
	const result = ChangePasswordSchema.safeParse(body);
	if (!result.success) {
		return c.json({ success: false, error: "Invalid request body" }, 400);
	}

	const { newPassword, confirmPassword } = result.data;

	if (newPassword !== confirmPassword) {
		return c.json({ success: false, error: "Passwords do not match" }, 400);
	}

	const passwordHash = await hashPassword(newPassword);
	await updateAdminById(c.env, session.adminId, { passwordHash });

	return c.json({
		success: true,
		data: { message: "Password changed successfully" },
	});
});

adminRoute.openapi(getDevicesRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const sessions = await getAdminSessions(c.env, session.adminId);

	const devices = sessions.map((s) => {
		return {
			id: s.id,
			deviceName: s.deviceName || "Unknown Device",
			ipAddress: s.ipAddress,
			browser: s.browser || "Unknown",
			lastActiveAt: toWAT(s.lastActiveAt) || "",
			createdAt: toWAT(s.createdAt) || "",
			isCurrentDevice: s.token === token,
		};
	});

	return c.json({
		success: true,
		data: { devices },
	});
});

adminRoute.openapi(deleteDeviceRoute, async (c) => {
	const { sessionId } = c.req.valid("param");
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const deleted = await deleteAdminSessionById(
		c.env,
		sessionId,
		session.adminId,
	);
	if (!deleted) {
		return c.json({ success: false, error: "Session not found" }, 404);
	}

	return c.json({
		success: true,
		data: { message: "Device logged out successfully" },
	});
});

adminRoute.openapi(getMeRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const adminUser = await getAdminById(c.env, session.adminId);
	if (!adminUser) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	return c.json({
		success: true,
		data: {
			admin: {
				id: adminUser.id,
				email: adminUser.email,
				name: adminUser.name,
				mobileNumber: adminUser.mobileNumber,
				image: adminUser.image,
				role: adminUser.role,
				permissions: safeParsePermissions(adminUser.permissions),
				createdAt: toWAT(adminUser.createdAt) || "",
			},
			token,
		},
	});
});

adminRoute.openapi(updateMeRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const body = await c.req.json();
	const result = UpdateMeSchema.safeParse(body);
	if (!result.success) {
		const error = result.error;
		const issues = error.issues || [];
		const message = issues[0]?.message || "Invalid request body";
		return c.json(
			{
				success: false,
				error: message,
			},
			400,
		);
	}

	const { name, email, mobileNumber } = result.data;

	console.log("PATCH /me - updating admin:", {
		adminId: session.adminId,
		name,
		email,
		mobileNumber,
	});

	if (email) {
		const existing = await getAdminByEmail(c.env, email);
		if (existing && existing.id !== session.adminId) {
			return c.json({ success: false, error: "Email already in use" }, 400);
		}
	}

	const updatedAdmin = await updateAdminById(c.env, session.adminId, {
		name,
		email,
		mobileNumber,
	});

	console.log("PATCH /me - updatedAdmin:", updatedAdmin);

	if (!updatedAdmin) {
		return c.json({ success: false, error: "Failed to update profile" }, 500);
	}

	return c.json({
		success: true,
		data: {
			id: updatedAdmin.id,
			email: updatedAdmin.email,
			name: updatedAdmin.name,
			mobileNumber: updatedAdmin.mobileNumber,
			image: updatedAdmin.image,
			role: updatedAdmin.role,
			createdAt: toWAT(updatedAdmin.createdAt) || "",
		},
	});
});

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
	"image/svg+xml",
];

adminRoute.openapi(updateProfilePictureRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const formData = await c.req.parseBody();
	const file = formData.file as File | undefined;

	if (!file) {
		return c.json({ success: false, error: "No file provided" }, 400);
	}

	if (!file.type.startsWith("image/")) {
		return c.json(
			{ success: false, error: "Only image files are allowed" },
			400,
		);
	}

	if (file.size > MAX_FILE_SIZE) {
		return c.json(
			{ success: false, error: "File size must be less than 5MB" },
			400,
		);
	}

	const bucket =
		c.env.NODE_ENV === "production"
			? c.env.PRODUCTION_BUCKET
			: c.env.STAGING_BUCKET;

	if (!bucket) {
		return c.json({ success: false, error: "Storage not configured" }, 500);
	}

	const id = crypto.randomUUID();
	const ext = file.name.split(".").pop() || "jpg";
	const r2Key = `admin-profiles/${session.adminId}/${id}.${ext}`;
	const arrayBuffer = await file.arrayBuffer();

	await bucket.put(r2Key, arrayBuffer, {
		httpMetadata: {
			contentType: file.type || "image/jpeg",
		},
		customMetadata: {
			originalName: file.name,
			adminId: session.adminId,
		},
	});

	const baseUrl =
		c.env.NODE_ENV === "production"
			? "https://bucket.sportsdey.com"
			: "https://pub-2ef563970bc84434915fff03aa5f0dbf.r2.dev";

	const imageUrl = `${baseUrl}/${r2Key}`;

	const updatedAdmin = await updateAdminById(c.env, session.adminId, {
		image: imageUrl,
	});

	if (!updatedAdmin) {
		return c.json(
			{ success: false, error: "Failed to update profile picture" },
			500,
		);
	}

	return c.json({
		success: true,
		data: {
			image: updatedAdmin.image,
		},
	});
});

const listAdminsRoute = createRoute({
	method: "get",
	path: "/admins",
	tags: ["Admin - Management"],
	summary: "List all admins",
	description: "Retrieve all admins. Super admin access required.",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Admins retrieved successfully",
			content: {
				"application/json": {
					schema: successResponseSchema(z.array(AdminResponseSchema)),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorSchema } },
		},
		403: {
			description: "Forbidden - super_admin only",
			content: { "application/json": { schema: ErrorSchema } },
		},
	},
});

adminRoute.openapi(listAdminsRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session || session.role !== "super_admin") {
		return c.json(
			{ success: false, error: "Forbidden - super_admin only" },
			403,
		);
	}

	const admins = await listAdmins(c.env);

	return c.json({
		success: true,
		data: admins.map((admin) => ({
			id: admin.id,
			email: admin.email,
			name: admin.name,
			mobileNumber: admin.mobileNumber,
			image: admin.image,
			role: admin.role,
			permissions: safeParsePermissions(admin.permissions),
			createdAt: toWAT(admin.createdAt) || "",
		})),
	});
});

adminRoute.openapi(createAdminRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session || session.role !== "super_admin") {
		return c.json(
			{ success: false, error: "Forbidden - super_admin only" },
			403,
		);
	}

	const body = await c.req.json();
	const result = CreateAdminSchema.safeParse(body);
	if (!result.success) {
		return c.json({ success: false, error: "Invalid request body" }, 400);
	}

	const { email, password, name, role } = result.data;

	const existing = await getAdminByEmail(c.env, email);
	if (existing) {
		return c.json({ success: false, error: "Email already in use" }, 400);
	}

	const adminResult = await createAdmin(c.env, { email, password, name, role });

	const admin = await getAdminById(c.env, adminResult.id);

	return c.json({
		success: true,
		data: {
			id: admin?.id,
			email: admin?.email,
			name: admin?.name,
			role: admin?.role,
			createdAt: toWAT(admin?.createdAt) || toWAT(new Date()),
		},
	});
});

adminRoute.openapi(deleteAdminRoute, async (c) => {
	const { id } = c.req.valid("param");
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session || session.role !== "super_admin") {
		return c.json(
			{ success: false, error: "Forbidden - super_admin only" },
			403,
		);
	}

	if (session.adminId === id) {
		return c.json({ success: false, error: "Cannot delete yourself" }, 400);
	}

	await deleteAdmin(c.env, id);

	return c.json({
		success: true,
		data: { message: "Admin deleted successfully" },
	});
});

const forceLogoutAdminRoute = createRoute({
	method: "delete",
	path: "/admins/{id}/sessions",
	tags: ["Admin - Management"],
	summary: "Force logout an admin",
	description:
		"Delete all active sessions for an admin. Super admin access required.",
	security: [{ BearerAuth: [] }],
	request: {
		params: z.object({ id: z.string().openapi({ description: "Admin ID" }) }),
	},
	responses: {
		200: {
			description: "Sessions deleted successfully",
			content: {
				"application/json": {
					schema: successResponseSchema(
						z.object({
							sessionsRevoked: z.number().openapi({ example: 3 }),
						}),
					),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorSchema } },
		},
		403: {
			description: "Forbidden - super_admin only",
			content: { "application/json": { schema: ErrorSchema } },
		},
		404: {
			description: "Admin not found",
			content: { "application/json": { schema: ErrorSchema } },
		},
	},
});

adminRoute.openapi(forceLogoutAdminRoute, async (c) => {
	const { id } = c.req.valid("param");
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session || session.role !== "super_admin") {
		return c.json(
			{ success: false, error: "Forbidden - super_admin only" },
			403,
		);
	}

	const admin = await getAdminById(c.env, id);
	if (!admin) {
		return c.json({ success: false, error: "Admin not found" }, 404);
	}

	const deleted = await deleteAllAdminSessions(c.env, id);

	return c.json({
		success: true,
		data: { sessionsRevoked: deleted },
	});
});

const handleGetWalletTransactions = async (
	c: Parameters<Parameters<typeof adminRoute.openapi>[1]>[0],
) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (
		!session ||
		(session.role !== "admin" && session.role !== "super_admin")
	) {
		return c.json({ success: false, error: "Forbidden - admin only" }, 403);
	}

	if (
		session.role !== "super_admin" &&
		!requirePermission(session, "transaction_read")
	) {
		return c.json(
			{
				success: false,
				error: "Forbidden - transaction read permission required",
			},
			403,
		);
	}

	const query = GetWalletTransactionsQuerySchema.safeParse({
		search: c.req.query("search"),
		type: c.req.query("type"),
		status: c.req.query("status"),
		fromDate: c.req.query("fromDate"),
		toDate: c.req.query("toDate"),
		page: c.req.query("page"),
		limit: c.req.query("limit"),
	});

	if (!query.success) {
		return c.json({ success: false, error: "Invalid query parameters" }, 400);
	}

	const { search, type, status, fromDate, toDate } = query.data;

	const { fromDate: fromDateBoundary, toDate: toDateBoundary } =
		parseQueryDateRange({
			fromDate,
			toDate,
		});

	const db = drizzle(c.env.DB, { schema });

	const conditions = [];
	if (search) {
		conditions.push(like(schema.walletTransaction.reference, `%${search}%`));
	}

	if (type === "deposits") {
		conditions.push(eq(schema.walletTransaction.type, "credit"));
	} else if (type === "withdrawals") {
		conditions.push(
			and(
				eq(schema.walletTransaction.type, "debit"),
				inArray(schema.walletTransaction.paymentMethod, ["paystack", "manual"]),
			),
		);
	} else if (type === "payments") {
		conditions.push(
			and(
				eq(schema.walletTransaction.type, "debit"),
				eq(schema.walletTransaction.paymentMethod, "bill_payment"),
			),
		);
	}

	if (status === "success") {
		conditions.push(
			inArray(schema.walletTransaction.status, ["success", "completed"]),
		);
	} else if (status === "pending") {
		conditions.push(
			inArray(schema.walletTransaction.status, ["pending", "processing"]),
		);
	} else if (status === "failed") {
		conditions.push(eq(schema.walletTransaction.status, "failed"));
	} else if (status === "refund") {
		conditions.push(
			inArray(schema.walletTransaction.status, ["refund", "refunded"]),
		);
	}

	// Move date filtering out of DB layer; we'll apply from/to filtering
	// in-memory after fetching matching transactions.

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// fetch all matching transactions (without date constraints) and apply
	// date filtering in-memory
	const transactions = await db
		.select({
			id: schema.walletTransaction.id,
			userId: schema.walletTransaction.userId,
			amount: schema.walletTransaction.amount,
			type: schema.walletTransaction.type,
			reference: schema.walletTransaction.reference,
			status: schema.walletTransaction.status,
			paymentMethod: schema.walletTransaction.paymentMethod,
			recipientWalletId: schema.walletTransaction.recipientWalletId,
			recipientName: schema.walletTransaction.recipientName,
			balance: schema.walletTransaction.balance,
			metadata: schema.walletTransaction.metadata,
			createdAt: schema.walletTransaction.createdAt,
			userEmail: schema.user.email,
		})
		.from(schema.walletTransaction)
		.leftJoin(schema.user, eq(schema.walletTransaction.userId, schema.user.id))
		.where(whereClause)
		.orderBy(desc(schema.walletTransaction.createdAt));

	const excludedPaymentMethods = [
		"slotegrator games",
		"lucky games",
		"lagos rush",
		"halla",
		"thndr games",
		"sportsbook",
	];

	const filtered = transactions.filter((tx) => {
		if (excludedPaymentMethods.includes(tx.paymentMethod)) return false;
		if (!fromDateBoundary && !toDateBoundary) return true;
		const ts = new Date(tx.createdAt).getTime();
		if (fromDateBoundary && ts < fromDateBoundary.getTime()) return false;
		if (toDateBoundary && ts > toDateBoundary.getTime()) return false;
		return true;
	});

	const unpaginated =
		c.req.path.endsWith("/wallet-transactions/all") ||
		c.req.path.endsWith("/wallet-transactions/all/");
	const total = filtered.length;
	const page = Math.max(
		1,
		Number.parseInt(c.req.query("page") || "1", 10) || 1,
	);
	const parsedLimit = Number.parseInt(c.req.query("limit") || "10", 10);
	const limit = unpaginated
		? Math.min(MAX_UNPAGINATED_ROWS, total)
		: Math.min(100, Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 10));
	const pageRows = unpaginated
		? filtered.slice(0, MAX_UNPAGINATED_ROWS)
		: filtered.slice((page - 1) * limit, page * limit);
	const totalPages = unpaginated
		? 1
		: Math.max(1, Math.ceil(total / limit) || 1);

	const formattedTransactions = pageRows.map((tx) => {
		let txType: "deposit" | "withdrawal" | "payment";
		if (tx.type === "credit") {
			txType = "deposit";
		} else if (tx.type === "debit") {
			txType = "withdrawal";
		} else {
			txType = "payment";
		}

		return {
			transaction_id: tx.id,
			user_id: tx.userId,
			user_email: tx.userEmail ?? "Unknown",
			date_time: formatDateTime(new Date(tx.createdAt)),
			type: txType,
			payment_method: tx.paymentMethod,
			amount: tx.amount / 100,
			balance_after: tx.balance / 100,
			status: tx.status,
			metadata: JSON.parse(tx.metadata || "{}"),
		};
	});

	return c.json({
		success: true,
		data: {
			transactions: formattedTransactions,
			pagination: {
				page: unpaginated ? 1 : page,
				limit: unpaginated ? formattedTransactions.length : limit,
				total,
				totalPages,
			},
		},
	});
};

const getWalletTransactionsAllRoute = createRoute({
	method: "get",
	path: "/wallet-transactions/all",
	tags: ["Admin - Wallet"],
	summary: "Get every wallet transaction (unpaginated)",
	description:
		"New endpoint: full transaction list in one response (capped at 10,000). Does not change GET /admin/wallet-transactions, which stays paginated.",
	security: [{ BearerAuth: [] }],
	request: {
		query: GetWalletTransactionsQuerySchema.omit({ page: true, limit: true }),
	},
	responses: getWalletTransactionsRoute.responses,
});

adminRoute.openapi(getWalletTransactionsRoute, handleGetWalletTransactions);
adminRoute.openapi(getWalletTransactionsAllRoute, handleGetWalletTransactions);

const GetAdminByIdParamsSchema = z.object({
	id: z.string().openapi({ description: "Admin ID" }),
});

const UpdateAdminPermissionsSchema = z.object({
	permissions: z.array(z.enum(adminPermissions)).openapi({
		description: "List of permissions to assign",
	}),
});

const listAdminPermissionsRoute = createRoute({
	method: "get",
	path: "/permissions",
	tags: ["Admin - Management"],
	summary: "List all available permissions",
	description: "Get a list of all permissions that can be assigned to admins.",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Permissions list retrieved",
			content: {
				"application/json": {
					schema: successResponseSchema(
						z.object({
							permissions: z.array(
								z.object({
									key: z.string(),
									label: z.string(),
								}),
							),
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

const getAdminPermissionsRoute = createRoute({
	method: "get",
	path: "/admins/{id}/permissions",
	tags: ["Admin - Management"],
	summary: "Get admin permissions",
	description:
		"Retrieve an admin's permissions with available permission labels. Super admin access required. Admins can only view their own permissions.",
	security: [{ BearerAuth: [] }],
	request: {
		params: GetAdminByIdParamsSchema,
	},
	responses: {
		200: {
			description: "Permissions retrieved",
			content: {
				"application/json": {
					schema: successResponseSchema(
						z.object({
							id: z.string(),
							permissions: z.array(z.string()),
							availablePermissions: z.array(
								z.object({
									key: z.string(),
									label: z.string(),
								}),
							),
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
		404: {
			description: "Admin not found",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

const getAdminByIdRoute = createRoute({
	method: "get",
	path: "/admins/{id}",
	tags: ["Admin - Management"],
	summary: "Get admin by ID",
	description:
		"Retrieve an admin's profile including permissions. Super admin access required.",
	security: [{ BearerAuth: [] }],
	request: {
		params: GetAdminByIdParamsSchema,
	},
	responses: {
		200: {
			description: "Admin retrieved successfully",
			content: {
				"application/json": {
					schema: successResponseSchema(AdminResponseSchema),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorSchema } },
		},
		403: {
			description: "Forbidden - super_admin only",
			content: { "application/json": { schema: ErrorSchema } },
		},
		404: {
			description: "Admin not found",
			content: { "application/json": { schema: ErrorSchema } },
		},
	},
});

const updateAdminPermissionsRoute = createRoute({
	method: "patch",
	path: "/admins/{id}/permissions",
	tags: ["Admin - Management"],
	summary: "Update admin permissions",
	description:
		"Update an admin's permissions. Super admin access required. Only super admins can update permissions.",
	security: [{ BearerAuth: [] }],
	request: {
		params: GetAdminByIdParamsSchema,
		body: {
			content: {
				"application/json": { schema: UpdateAdminPermissionsSchema },
			},
		},
	},
	responses: {
		200: {
			description: "Permissions updated successfully",
			content: {
				"application/json": {
					schema: successResponseSchema(
						z.object({
							id: z.string(),
							permissions: z.array(z.string()),
						}),
					),
				},
			},
		},
		400: {
			description: "Invalid request",
			content: { "application/json": { schema: ErrorSchema } },
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorSchema } },
		},
		403: {
			description: "Forbidden - super_admin only",
			content: { "application/json": { schema: ErrorSchema } },
		},
		404: {
			description: "Admin not found",
			content: { "application/json": { schema: ErrorSchema } },
		},
	},
});

adminRoute.openapi(getAdminByIdRoute, async (c) => {
	const { id } = c.req.valid("param");
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session || session.role !== "super_admin") {
		return c.json(
			{ success: false, error: "Forbidden - super_admin only" },
			403,
		);
	}

	const admin = await getAdminById(c.env, id);
	if (!admin) {
		return c.json({ success: false, error: "Admin not found" }, 404);
	}

	return c.json({
		success: true,
		data: {
			id: admin.id,
			email: admin.email,
			name: admin.name,
			mobileNumber: admin.mobileNumber,
			image: admin.image,
			role: admin.role,
			permissions: safeParsePermissions(admin.permissions),
			createdAt: toWAT(admin.createdAt) || "",
		},
	});
});

adminRoute.openapi(listAdminPermissionsRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const permissions = Object.entries(permissionLabels).map(([key, label]) => ({
		key,
		label,
	}));

	return c.json({
		success: true,
		data: { permissions },
	});
});

adminRoute.openapi(getAdminPermissionsRoute, async (c) => {
	const { id } = c.req.valid("param");
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	if (session.role !== "super_admin" && session.adminId !== id) {
		return c.json({ success: false, error: "Forbidden" }, 403);
	}

	const admin = await getAdminById(c.env, id);
	if (!admin) {
		return c.json({ success: false, error: "Admin not found" }, 404);
	}

	return c.json({
		success: true,
		data: {
			id: admin.id,
			permissions: safeParsePermissions(admin.permissions),
			// availablePermissions: Object.entries(permissionLabels).map(
			// 	([key, label]) => ({ key, label }),
			// ),
		},
	});
});

adminRoute.openapi(updateAdminPermissionsRoute, async (c) => {
	const { id } = c.req.valid("param");
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session || session.role !== "super_admin") {
		return c.json(
			{ success: false, error: "Forbidden - super_admin only" },
			403,
		);
	}

	const body = await c.req.json();
	const result = UpdateAdminPermissionsSchema.safeParse(body);
	if (!result.success) {
		return c.json({ success: false, error: "Invalid request body" }, 400);
	}

	const admin = await getAdminById(c.env, id);
	if (!admin) {
		return c.json({ success: false, error: "Admin not found" }, 404);
	}

	await updateAdminPermissions(c.env, id, result.data.permissions);

	return c.json({
		success: true,
		data: {
			id,
			permissions: result.data.permissions,
		},
	});
});

adminRoute.openapi(resetAdminPasswordRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session || !requirePermission(session, "reset_password")) {
		return c.json(
			{ success: false, error: "Forbidden - reset_password permission required" },
			403,
		);
	}

	const body = await c.req.json();
	const result = ResetAdminPasswordSchema.safeParse(body);
	if (!result.success) {
		return c.json({ success: false, error: "Invalid request body" }, 400);
	}

	const { email, name, role, password } = result.data;

	const existing = await getAdminByEmail(c.env, email);
	if (!existing) {
		return c.json(
			{ success: false, error: "Admin not found with this email" },
			404,
		);
	}

	if (name !== undefined && existing.name !== name) {
		return c.json(
			{ success: false, error: "Admin name does not match" },
			400,
		);
	}

	if (existing.role !== role) {
		return c.json(
			{ success: false, error: "Admin role does not match" },
			400,
		);
	}

	const passwordHash = await hashPassword(password);

	const updated = await updateAdminById(c.env, existing.id, {
		passwordHash,
	});

	if (!updated) {
		return c.json(
			{ success: false, error: "Failed to update admin" },
			500,
		);
	}

	return c.json({
		success: true,
		data: {
			id: updated.id,
			email: updated.email,
			name: updated.name,
			role: updated.role,
		},
	});
});

export default adminRoute;
export { adminRoute };
