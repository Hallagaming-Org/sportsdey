import { desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { admin, adminActivityLog } from "@/db/schema/admin";
import type { CloudflareBindings } from "../types";

export async function getAdminActivityActor(
	env: CloudflareBindings,
	adminId: string,
) {
	const db = drizzle(env.DB, { schema });
	return db
		.select({
			id: admin.id,
			name: admin.name,
			email: admin.email,
			role: admin.role,
		})
		.from(admin)
		.where(eq(admin.id, adminId))
		.get();
}

export async function recordAdminActivity(
	env: CloudflareBindings,
	actor: {
		id: string;
		name: string;
		email: string;
		role: string;
	},
	action: string,
): Promise<void> {
	const db = drizzle(env.DB, { schema });
	const [result] = await db
		.insert(adminActivityLog)
		.values({
			id: crypto.randomUUID(),
			adminId: actor.id,
			adminName: actor.name,
			adminEmail: actor.email,
			adminRole: actor.role,
			action,
		})
		.returning({ id: adminActivityLog.id });

	if (!result?.id) {
		console.error("Failed to record admin activity", {
			adminId: actor.id,
			action,
		});
	}
}

export const adminActivityActions = {
	approveDocument: "Approved document",
	rejectDocument: "Rejected document",
	uploadContent: "Uploaded content",
	updateContent: "Updated content",
	deleteContent: "Deleted content",
	exportFile: "Exported file",
	createAdmin: "Created admin",
	deleteAdmin: "Deleted admin",
	updateAdmin: "Updated admin",
	changePassword: "Changed password",
	createLogNote: "Created log note",
	deleteLogNote: "Deleted log note",
	approveWithdrawal: "Approved withdrawal",
	rejectWithdrawal: "Rejected withdrawal",
	sendNotification: "Sent notification",
	markNotificationRead: "Marked notification as read",
	createPromotion: "Created promotion",
	updatePromotion: "Updated promotion",
	deletePromotion: "Deleted promotion",
	createUser: "Created user",
	updateUser: "Updated user",
	suspendUser: "Suspended user",
	reactivateUser: "Reactivated user",
	manualCredit: "Credited user wallet",
	manualDebit: "Debited user wallet",
} as const;

export async function recordActivityForSession(
	env: CloudflareBindings,
	adminId: string,
	action: string,
): Promise<void> {
	const actor = await getAdminActivityActor(env, adminId);
	if (!actor) {
		console.error("Admin actor not found for activity log", {
			adminId,
			action,
		});
		return;
	}
	await recordAdminActivity(env, actor, action);
}

export async function listAdminActivity(
	env: CloudflareBindings,
	page: number,
	limit: number,
) {
	const db = drizzle(env.DB, { schema });
	const offset = (page - 1) * limit;
	const [rows, countResult] = await Promise.all([
		db
			.select({
				id: adminActivityLog.id,
				adminId: adminActivityLog.adminId,
				adminName: adminActivityLog.adminName,
				adminEmail: adminActivityLog.adminEmail,
				adminRole: adminActivityLog.adminRole,
				action: adminActivityLog.action,
				createdAt: adminActivityLog.createdAt,
			})
			.from(adminActivityLog)
			.orderBy(desc(adminActivityLog.createdAt))
			.limit(limit)
			.offset(offset),
		db.select({ count: sql<number>`COUNT(*)` }).from(adminActivityLog),
	]);

	return {
		rows,
		total: Number(countResult[0]?.count ?? 0),
	};
}
