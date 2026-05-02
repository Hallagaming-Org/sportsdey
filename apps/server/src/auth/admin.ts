import crypto from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { type AdminRole, admin, adminSession } from "@/db/schema/admin";
import type { CloudflareBindings } from "../../worker-configuration";

const getDb = (env: CloudflareBindings) => drizzle(env.DB, { schema });

const scryptConfig = {
	N: 16384,
	r: 16,
	p: 1,
	dkLen: 64,
	maxmem: 128 * 16384 * 16 * 2,
};

async function generateKey(
	password: string,
	salt: string,
): Promise<Uint8Array> {
	const { scryptAsync } = await import("@noble/hashes/scrypt");
	return await scryptAsync(password.normalize("NFKC"), salt, {
		N: scryptConfig.N,
		p: scryptConfig.p,
		r: scryptConfig.r,
		dkLen: scryptConfig.dkLen,
		maxmem: scryptConfig.maxmem,
	});
}

export async function hashPassword(password: string): Promise<string> {
	const { bytesToHex } = await import("@noble/hashes/utils");
	const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
	const key = await generateKey(password, salt);
	return `${salt}:${bytesToHex(key)}`;
}

export async function verifyPassword(
	hash: string,
	password: string,
): Promise<boolean> {
	const { hexToBytes } = await import("@noble/hashes/utils");
	const [salt, key] = hash.split(":");
	if (!salt || !key) {
		throw new Error("Invalid password hash");
	}
	const targetKey = await generateKey(password, salt);
	return crypto.timingSafeEqual(targetKey, hexToBytes(key));
}

export function generateSessionToken(): string {
	return crypto.randomBytes(64).toString("hex");
}

export async function createAdminSession(
	bindings: CloudflareBindings,
	adminId: string,
	ipAddress?: string,
	userAgent?: string,
): Promise<string> {
	const database = getDb(bindings);
	const token = generateSessionToken();
	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

	await database.insert(adminSession).values({
		id: crypto.randomUUID(),
		adminId,
		token,
		expiresAt,
		ipAddress,
		userAgent,
	});

	return token;
}

export async function validateAdminSession(
	bindings: CloudflareBindings,
	token: string,
): Promise<{ adminId: string; role: AdminRole } | null> {
	const database = getDb(bindings);
	const result = await database
		.select({
			adminId: adminSession.adminId,
			expiresAt: adminSession.expiresAt,
			role: admin.role,
		})
		.from(adminSession)
		.innerJoin(admin, eq(adminSession.adminId, admin.id))
		.where(
			and(
				eq(adminSession.token, token),
				gt(adminSession.expiresAt, new Date()),
			),
		)
		.get();

	if (!result) {
		return null;
	}

	return { adminId: result.adminId, role: result.role as AdminRole };
}

export async function deleteAdminSession(
	bindings: CloudflareBindings,
	token: string,
): Promise<void> {
	const database = getDb(bindings);
	await database.delete(adminSession).where(eq(adminSession.token, token));
}

export async function deleteAllAdminSessions(
	bindings: CloudflareBindings,
	adminId: string,
): Promise<void> {
	const database = getDb(bindings);
	await database.delete(adminSession).where(eq(adminSession.adminId, adminId));
}

export async function getAdminByEmail(
	bindings: CloudflareBindings,
	email: string,
): Promise<{
	id: string;
	email: string;
	passwordHash: string;
	name: string;
	mobileNumber: string | null;
	image: string | null;
	role: AdminRole;
	createdAt: Date;
} | null> {
	const database = getDb(bindings);
	const result = await database
		.select({
			id: admin.id,
			email: admin.email,
			passwordHash: admin.passwordHash,
			name: admin.name,
			mobileNumber: admin.mobileNumber,
			image: admin.image,
			role: admin.role,
			createdAt: admin.createdAt,
		})
		.from(admin)
		.where(eq(admin.email, email))
		.get();

	return result || null;
}

export async function getAdminById(
	bindings: CloudflareBindings,
	id: string,
): Promise<{
	id: string;
	email: string;
	name: string;
	mobileNumber: string | null;
	image: string | null;
	role: AdminRole;
	createdAt: Date;
} | null> {
	const database = getDb(bindings);
	const result = await database
		.select({
			id: admin.id,
			email: admin.email,
			name: admin.name,
			mobileNumber: admin.mobileNumber,
			image: admin.image,
			role: admin.role,
			createdAt: admin.createdAt,
		})
		.from(admin)
		.where(eq(admin.id, id))
		.get();

	return result || null;
}

export async function createAdmin(
	bindings: CloudflareBindings,
	data: {
		email: string;
		password: string;
		name: string;
		mobileNumber?: string | null;
		image?: string | null;
		role: AdminRole;
	},
): Promise<{ id: string }> {
	const database = getDb(bindings);
	const passwordHash = await hashPassword(data.password);

	const result = await database
		.insert(admin)
		.values({
			id: crypto.randomUUID(),
			email: data.email,
			passwordHash,
			name: data.name,
			mobileNumber: data.mobileNumber ?? null,
			image: data.image ?? null,
			role: data.role,
		})
		.returning({ id: admin.id })
		.get();

	return { id: result.id };
}

export async function deleteAdmin(
	bindings: CloudflareBindings,
	adminId: string,
): Promise<void> {
	const database = getDb(bindings);
	await database.delete(admin).where(eq(admin.id, adminId));
}

export async function updateAdminById(
	bindings: CloudflareBindings,
	id: string,
	data: {
		name?: string;
		email?: string;
		mobileNumber?: string | null;
		image?: string | null;
		passwordHash?: string;
	},
): Promise<{
	id: string;
	email: string;
	name: string;
	mobileNumber: string | null;
	image: string | null;
	role: AdminRole;
	createdAt: Date;
} | null> {
	const database = getDb(bindings);
	const updates: Record<string, unknown> = {};

	if (data.name !== undefined) {
		updates.name = data.name;
	}
	if (data.email !== undefined) {
		updates.email = data.email;
	}
	if (data.mobileNumber !== undefined) {
		updates.mobileNumber = data.mobileNumber;
	}
	if (data.image !== undefined) {
		updates.image = data.image;
	}
	if (data.passwordHash !== undefined) {
		updates.passwordHash = data.passwordHash;
	}

	console.log("updateAdminById:", { id, updates });

	if (Object.keys(updates).length === 0) {
		return getAdminById(bindings, id);
	}

	const result = await database
		.update(admin)
		.set(updates)
		.where(eq(admin.id, id))
		.returning({
			id: admin.id,
			email: admin.email,
			name: admin.name,
			mobileNumber: admin.mobileNumber,
			image: admin.image,
			role: admin.role,
			createdAt: admin.createdAt,
		})
		.get();

	console.log("updateAdminById result:", result);

	return result || null;
}

export async function listAdmins(bindings: CloudflareBindings): Promise<
	Array<{
		id: string;
		email: string;
		name: string;
		role: AdminRole;
		createdAt: Date;
	}>
> {
	const database = getDb(bindings);
	const result = await database
		.select({
			id: admin.id,
			email: admin.email,
			name: admin.name,
			role: admin.role,
			createdAt: admin.createdAt,
		})
		.from(admin)
		.orderBy(admin.createdAt);

	return result;
}

export const getSessionToken = (headers: Headers): string | undefined => {
	const authHeader = headers.get("authorization");
	if (authHeader?.startsWith("Bearer ")) {
		return authHeader.slice(7);
	}
	const cookie = headers.get("cookie");
	console.log("Cookie string:", cookie);
	if (cookie) {
		const match = cookie.match(/admin_session=([^;]+)/);
		console.log("Match:", match?.[1]);
		return match?.[1];
	}
	return undefined;
};

export const setSessionCookie = (
	token: string,
	env?: string,
): string => {
	const isProdOrStaging =
		!env || env === "staging" || env === "production";
	const secureFlag = isProdOrStaging ? "; Secure" : "";
	return `admin_session=${token}; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Max-Age=${7 * 24 * 60 * 60}`;
};

export const clearSessionCookie = (): string => {
	return "admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
};
