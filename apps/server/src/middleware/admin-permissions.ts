import { hasPermission, parsePermissions } from "@/auth/admin";
import type { AdminPermission } from "@/permissions";

interface AdminSession {
	adminId: string;
	role: string;
	permissions: string | null;
}

export function requirePermission(
	session: AdminSession | null,
	permission: AdminPermission,
): boolean {
	if (!session) {
		return false;
	}
	if (session.role === "super_admin") {
		return true;
	}
	return hasPermission(session.permissions, permission);
}

export function requireAnyPermission(
	session: AdminSession | null,
	permissions: AdminPermission[],
): boolean {
	if (!session) {
		return false;
	}
	if (session.role === "super_admin") {
		return true;
	}
	const parsed = parsePermissions(session.permissions);
	return permissions.some((p) => parsed.includes(p));
}

export function requireAllPermissions(
	session: AdminSession | null,
	permissions: AdminPermission[],
): boolean {
	if (!session) {
		return false;
	}
	if (session.role === "super_admin") {
		return true;
	}
	const parsed = parsePermissions(session.permissions);
	return permissions.every((p) => parsed.includes(p));
}
