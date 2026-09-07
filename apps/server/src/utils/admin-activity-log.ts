import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { admin, adminActivityLog, adminSession } from "@/db/schema/admin";
import type { CloudflareBindings } from "../types";

export type AdminActivityTargetUser = {
	id: string;
	name: string | null;
	email: string | null;
	username: string | null;
};

export type AdminActivityDetails = {
	transactionType?: "credit" | "debit";
	amount?: number;
	currency?: "NGN";
	reason?: string;
	transactionId?: string;
	balanceAfter?: number;
};

type AdminActivityContext = {
	targetUser?: AdminActivityTargetUser;
	details?: AdminActivityDetails;
};

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
	context: AdminActivityContext = {},
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
			targetUserId: context.targetUser?.id,
			targetUserName: context.targetUser?.name,
			targetUserEmail: context.targetUser?.email,
			targetUserUsername: context.targetUser?.username,
			details: context.details ? JSON.stringify(context.details) : null,
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
	manualCredit: "Manually credited user wallet",
	manualDebit: "Manually debited user wallet",
} as const;

export async function recordActivityForSession(
	env: CloudflareBindings,
	adminId: string,
	action: string,
	context: AdminActivityContext = {},
): Promise<void> {
	const actor = await getAdminActivityActor(env, adminId);
	if (!actor) {
		console.error("Admin actor not found for activity log", {
			adminId,
			action,
		});
		return;
	}
	await recordAdminActivity(env, actor, action, context);
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
				targetUserId: adminActivityLog.targetUserId,
				targetUserName: adminActivityLog.targetUserName,
				targetUserEmail: adminActivityLog.targetUserEmail,
				targetUserUsername: adminActivityLog.targetUserUsername,
				details: adminActivityLog.details,
				username: admin.mobileNumber,
				avatar: admin.image,
				createdAt: adminActivityLog.createdAt,
			})
			.from(adminActivityLog)
			.leftJoin(admin, eq(adminActivityLog.adminId, admin.id))
			.orderBy(desc(adminActivityLog.createdAt))
			.limit(limit)
			.offset(offset),
		 db.select({ count: sql<number>`COUNT(*)` }).from(adminActivityLog),
	]);

	const adminIds = [...new Set(rows.map((row) => row.adminId))];
	const onlineAdminIds = new Set(
		adminIds.length === 0
			? []
			: (
					await db
						.select({ adminId: adminSession.adminId })
						.from(adminSession)
						.where(
							and(
								inArray(adminSession.adminId, adminIds),
								gt(adminSession.expiresAt, new Date()),
							),
						)
				).map((session) => session.adminId),
	);

	return {
		rows: rows.map((row) => {
			let details: AdminActivityDetails | null = null;
			if (row.details) {
				try {
					const parsed = JSON.parse(row.details) as AdminActivityDetails;
					if (parsed && typeof parsed === "object") details = parsed;
				} catch {
				}
			}

			return {
				...row,
				details,
				userId: row.adminId,
				fullName: row.adminName,
				emailAddress: row.adminEmail,
				role: row.adminRole,
				status: onlineAdminIds.has(row.adminId) ? "online" : "offline",
				targetUser: row.targetUserId
					? {
							id: row.targetUserId,
							name: row.targetUserName,
							email: row.targetUserEmail,
							username: row.targetUserUsername,
						}
					: null,
			};
		}),
		total: Number(countResult[0]?.count ?? 0),
	};
}
