import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, desc, eq, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { z } from "zod";
import {
	clearSessionCookie,
	createAdmin,
	createAdminSession,
	deleteAdmin,
	deleteAdminSession,
	getAdminByEmail,
	getAdminById,
	getSessionToken,
	hashPassword,
	setSessionCookie,
	updateAdminById,
	validateAdminSession,
	verifyPassword,
} from "@/auth/admin";
import * as schema from "@/db/schema";
import { ErrorResponseSchema, successResponseSchema } from "@/schemas";
import type { CloudflareBindings } from "../types";

const adminRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

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
	role: z.enum(["super_admin", "admin"]).openapi({ description: "Admin role" }),
	createdAt: z.string().openapi({ description: "Account creation timestamp" }),
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
	role: z.enum(["super_admin", "admin"]).openapi({ description: "Admin role" }),
});

const GetWalletTransactionsQuerySchema = z.object({
	search: z
		.string()
		.optional()
		.openapi({ description: "Search by transaction reference" }),
	type: z
		.enum(["deposits", "withdrawals", "payments"])
		.optional()
		.openapi({ description: "Filter by transaction type" }),
	page: z.coerce
		.number()
		.int()
		.min(1)
		.default(1)
		.openapi({ description: "Page number" }),
	limit: z.coerce
		.number()
		.int()
		.min(1)
		.max(100)
		.default(20)
		.openapi({ description: "Items per page" }),
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
					schema: successResponseSchema(
						z.object({
							admin: AdminResponseSchema,
						}),
					),
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
					schema: successResponseSchema(z.object({ message: z.string() })),
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
					schema: successResponseSchema(AdminResponseSchema),
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
						file: z
							.instanceof(File)
							.openapi({ description: "Profile image file (max 5MB)" }),
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
		params: z.object({
			id: z.string().openapi({ description: "Admin ID to delete" }),
		}),
	},
	responses: {
		200: {
			description: "Admin deleted successfully",
			content: {
				"application/json": {
					schema: successResponseSchema(z.object({ message: z.string() })),
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

const getWalletTransactionsRoute = createRoute({
	method: "get",
	path: "/wallet-transactions",
	tags: ["Admin - Wallet"],
	summary: "Get wallet transactions",
	description:
		"Retrieve all wallet transactions with pagination and filtering. Admin or super admin access required.",
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
					schema: successResponseSchema(z.object({ message: z.string() })),
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

function formatDateTime(date: Date) {
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
	const month = months[date.getMonth()];
	const day = date.getDate();
	const year = date.getFullYear();

	const hours = date.getHours();
	const minutes = date.getMinutes();
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
		return c.json({ success: false, error: "Invalid request body" }, 400);
	}

	const { email, password } = result.data;
	const adminUser = await getAdminByEmail(c.env, email);

	if (!adminUser) {
		return c.json({ success: false, error: "Invalid credentials" }, 401);
	}

	const valid = await verifyPassword(adminUser.passwordHash, password);
	if (!valid) {
		return c.json({ success: false, error: "Invalid credentials" }, 401);
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
				createdAt: adminUser.createdAt?.toISOString() || "",
			},
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
			id: adminUser.id,
			email: adminUser.email,
			name: adminUser.name,
			mobileNumber: adminUser.mobileNumber,
			image: adminUser.image,
			role: adminUser.role,
			createdAt: adminUser.createdAt?.toISOString() || "",
		},
	});
});

adminRoute.openapi(updateMeRoute, async (c) => {
	try {
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
				createdAt: updatedAdmin.createdAt?.toISOString() || "",
			},
		});
	} catch (error) {
		console.error("Error in PATCH /me:", error);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
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
	try {
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
				? "https://sportsdey-prod.r2.cloudflarestorage.com"
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
	} catch (error) {
		console.error("Error in PATCH /me/profile-picture:", error);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
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

	return c.json({
		success: true,
		data: {
			id: adminResult.id,
			email,
			name,
			role,
			createdAt: new Date().toISOString(),
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

adminRoute.openapi(getWalletTransactionsRoute, async (c) => {
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

	const query = GetWalletTransactionsQuerySchema.safeParse({
		search: c.req.query("search"),
		type: c.req.query("type"),
		page: c.req.query("page"),
		limit: c.req.query("limit"),
	});

	if (!query.success) {
		return c.json({ success: false, error: "Invalid query parameters" }, 400);
	}

	const { search, type, page, limit } = query.data;
	const offset = (page - 1) * limit;

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
				eq(schema.walletTransaction.paymentMethod, "paystack"),
			),
		);
	} else if (type === "payments") {
		conditions.push(
			and(
				eq(schema.walletTransaction.type, "debit"),
				eq(schema.walletTransaction.paymentMethod, "wallet_transfer"),
			),
		);
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	const [transactions, totalResult] = await Promise.all([
		db
			.select()
			.from(schema.walletTransaction)
			.where(whereClause)
			.orderBy(desc(schema.walletTransaction.createdAt))
			.limit(limit)
			.offset(offset),
		db
			.select({ count: sql<number>`count(*)` })
			.from(schema.walletTransaction)
			.where(whereClause),
	]);

	const total = totalResult[0]?.count ?? 0;
	const totalPages = Math.ceil(total / limit);

	const formattedTransactions = transactions.map((tx) => {
		let txType: "deposit" | "withdrawal" | "payment";
		if (tx.type === "credit") {
			txType = "deposit";
		} else if (tx.paymentMethod === "paystack") {
			txType = "withdrawal";
		} else {
			txType = "payment";
		}

		return {
			transaction_id: tx.id,
			date_time: formatDateTime(new Date(tx.createdAt)),
			type: txType,
			payment_method: tx.paymentMethod,
			amount: tx.amount / 100,
			balance_after: tx.balance / 100,
			status: tx.status,
		};
	});

	return c.json({
		success: true,
		data: {
			transactions: formattedTransactions,
			pagination: {
				page,
				limit,
				total,
				totalPages,
			},
		},
	});
});

export default adminRoute;
export { adminRoute };
