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

type AdminActivitySessionContext = {
	id: string;
	ipAddress: string | null;
	device: string | null;
	browser: string | null;
};

function activityModule(action: string): string {
	const normalized = action.toLowerCase();
	if (normalized.includes("wallet")) return "Wallet";
	if (normalized.includes("document")) return "KYC & Documents";
	if (normalized.includes("withdrawal")) return "Withdrawals";
	if (normalized.includes("promotion")) return "Promotions";
	if (normalized.includes("content")) return "CMS";
	if (normalized.includes("notification")) return "Notifications";
	if (normalized.includes("user")) return "Users";
	return "Administration";
}

async function getLatestAdminActivitySession(
	env: CloudflareBindings,
	adminId: string,
): Promise<AdminActivitySessionContext | null> {
	const db = drizzle(env.DB, { schema });
	return db
		.select({
			id: adminSession.id,
			ipAddress: adminSession.ipAddress,
			device: adminSession.deviceName,
			browser: adminSession.browser,
		})
		.from(adminSession)
		.where(
			and(
				eq(adminSession.adminId, adminId),
				gt(adminSession.expiresAt, new Date()),
			),
		)
		.orderBy(desc(adminSession.lastActiveAt))
		.limit(1)
		.get();
}

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
	session: AdminActivitySessionContext | null = null,
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
			sessionId: session?.id,
			ipAddress: session?.ipAddress,
			device: session?.device,
			browser: session?.browser,
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
	const [actor, session] = await Promise.all([
		getAdminActivityActor(env, adminId),
		getLatestAdminActivitySession(env, adminId),
	]);
	if (!actor) {
		console.error("Admin actor not found for activity log", {
			adminId,
			action,
		});
		return;
	}
	await recordAdminActivity(env, actor, action, context, session);
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
				sessionId: adminActivityLog.sessionId,
				ipAddress: adminActivityLog.ipAddress,
				device: adminActivityLog.device,
				browser: adminActivityLog.browser,
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
				executionStatus: "completed" as const,
				module: activityModule(row.action),
				description: details?.reason ?? row.action,
				reference: details?.transactionId ?? null,
				location: null,
				timeZone: null,
				screenResolution: null,
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

export async function getAdminActivityById(
	env: CloudflareBindings,
	id: string,
) {
	const db = drizzle(env.DB, { schema });
	const row = await db
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
			sessionId: adminActivityLog.sessionId,
			ipAddress: adminActivityLog.ipAddress,
			device: adminActivityLog.device,
			browser: adminActivityLog.browser,
			username: admin.mobileNumber,
			avatar: admin.image,
			createdAt: adminActivityLog.createdAt,
		})
		.from(adminActivityLog)
		.leftJoin(admin, eq(adminActivityLog.adminId, admin.id))
		.where(eq(adminActivityLog.id, id))
		.get();
	if (!row) return null;

	let details: AdminActivityDetails | null = null;
	if (row.details) {
		try {
			const parsed = JSON.parse(row.details) as AdminActivityDetails;
			if (parsed && typeof parsed === "object") details = parsed;
		} catch {
		}
	}
	const activeSession = await db
		.select({ id: adminSession.id })
		.from(adminSession)
		.where(
			and(
				eq(adminSession.adminId, row.adminId),
				gt(adminSession.expiresAt, new Date()),
			),
		)
		.limit(1)
		.get();

	return {
		...row,
		details,
		userId: row.adminId,
		fullName: row.adminName,
		emailAddress: row.adminEmail,
		role: row.adminRole,
		status: activeSession ? ("online" as const) : ("offline" as const),
		executionStatus: "completed" as const,
		module: activityModule(row.action),
		description: details?.reason ?? row.action,
		reference: details?.transactionId ?? null,
		location: null,
		timeZone: null,
		screenResolution: null,
		targetUser: row.targetUserId
			? {
					id: row.targetUserId,
					name: row.targetUserName,
					email: row.targetUserEmail,
					username: row.targetUserUsername,
				}
			: null,
	};
}
