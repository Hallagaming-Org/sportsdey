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

	c.header("Set-Cookie", setSessionCookie(token, c.env.NODE_ENV), { append: true });

	return c.json({
		success: true,
		data: {
			admin: {
				id: adminUser.id,
				email: adminUser.email,
				name: adminUser.name,
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
			role: adminUser.role,
			createdAt: adminUser.createdAt?.toISOString() || "",
		},
	});
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

export default adminRoute;
export { adminRoute };
