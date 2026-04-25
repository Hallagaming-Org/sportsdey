import { and, desc, eq, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
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
	setSessionCookie,
	updateAdminById,
	validateAdminSession,
	verifyPassword,
} from "@/auth/admin";
import * as schema from "@/db/schema";
import type { CloudflareBindings } from "../types";

const adminRoute = new Hono<{ Bindings: CloudflareBindings }>();

const SignInSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1),
});

adminRoute.post("/auth/sign-in", async (c) => {
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

adminRoute.post("/auth/sign-out", async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (token) {
		await deleteAdminSession(c.env, token);
	}
	c.header("Set-Cookie", clearSessionCookie(), { append: true });
	return c.json({ success: true });
});

adminRoute.get("/me", async (c) => {
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

const UpdateMeSchema = z.object({
	name: z.string().min(1).optional(),
	email: z.string().email().optional(),
	mobileNumber: z
		.string()
		.regex(/^(0|\+234)[789][01]\d{8}$/, "Invalid Nigerian phone number format")
		.nullable()
		.optional(),
});

adminRoute.patch("/me", async (c) => {
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

		console.log("PATCH /me - updating admin:", { adminId: session.adminId, name, email, mobileNumber });

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

const CreateAdminSchema = z.object({
	email: z.string().email(),
	password: z.string().min(6),
	name: z.string().min(1),
	role: z.enum(["super_admin", "admin"]),
});

adminRoute.post("/admins", async (c) => {
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

adminRoute.delete("/admins/:id", async (c) => {
	const { id } = c.req.param();
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

const GetWalletTransactionsQuerySchema = z.object({
	search: z.string().optional(),
	type: z.enum(["deposits", "withdrawals", "payments"]).optional(),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
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

adminRoute.get("/wallet-transactions", async (c) => {
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
