import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "../schema";

export const adminRoles = ["super_admin", "admin", "csr-admin"] as const;
export type AdminRole = (typeof adminRoles)[number];

export const admin = sqliteTable("admin", {
	id: text("id").primaryKey(),
	email: text("email").notNull().unique(),
	passwordHash: text("password_hash").notNull(),
	name: text("name").notNull(),
	mobileNumber: text("mobile_number"),
	image: text("image"),
	role: text("role", { enum: adminRoles }).notNull().default("admin"),
	permissions: text("permissions"),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

export const adminSession = sqliteTable(
	"admin_session",
	{
		id: text("id").primaryKey(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		token: text("token").notNull().unique(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		lastActiveAt: integer("last_active_at", { mode: "timestamp_ms" }),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		deviceName: text("device_name"),
		browser: text("browser"),
		adminId: text("admin_id")
			.notNull()
			.references(() => admin.id, { onDelete: "cascade" }),
	},
	(table) => [index("admin_session_adminId_idx").on(table.adminId)],
);

export const adminRelations = relations(admin, ({ many }) => ({
	sessions: many(adminSession),
	logNotes: many(adminLogNote),
	activityLogs: many(adminActivityLog),
}));

export const adminSessionRelations = relations(adminSession, ({ one }) => ({
	admin: one(admin, {
		fields: [adminSession.adminId],
		references: [admin.id],
	}),
}));

export const adminNotification = sqliteTable("admin_notification", {
	id: text("id").primaryKey(),
	adminId: text("admin_id")
		.notNull()
		.references(() => admin.id, { onDelete: "cascade" }),
	title: text("title").notNull(),
	message: text("message").notNull(),
	type: text("type").notNull(),
	referenceId: text("reference_id"),
	isRead: integer("is_read", { mode: "boolean" }).default(false).notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
});

export const adminNotificationRelations = relations(
	adminNotification,
	({ one }) => ({
		admin: one(admin, {
			fields: [adminNotification.adminId],
			references: [admin.id],
		}),
	}),
);

export const adminLogNote = sqliteTable("admin_log_note", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	adminId: text("admin_id")
		.notNull()
		.references(() => admin.id, { onDelete: "cascade" }),
	adminName: text("admin_name").notNull(),
	adminRole: text("admin_role").notNull(),
	note: text("note").notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
});

export const adminLogNoteRelations = relations(adminLogNote, ({ one }) => ({
	user: one(user, {
		fields: [adminLogNote.userId],
		references: [user.id],
	}),
	admin: one(admin, {
		fields: [adminLogNote.adminId],
		references: [admin.id],
	}),
}));

export const adminActivityLog = sqliteTable(
	"admin_activity_log",
	{
		id: text("id").primaryKey(),
		adminId: text("admin_id")
			.notNull()
			.references(() => admin.id, { onDelete: "cascade" }),
		adminName: text("admin_name").notNull(),
		adminEmail: text("admin_email").notNull(),
		adminRole: text("admin_role").notNull(),
		action: text("action").notNull(),
		targetUserId: text("target_user_id"),
		targetUserName: text("target_user_name"),
		targetUserEmail: text("target_user_email"),
		targetUserUsername: text("target_user_username"),
		details: text("details"),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [
		index("admin_activity_log_createdAt_idx").on(table.createdAt),
		index("admin_activity_log_adminId_idx").on(table.adminId),
		index("admin_activity_log_targetUserId_idx").on(table.targetUserId),
	],
);

export const adminActivityLogRelations = relations(
	adminActivityLog,
	({ one }) => ({
		admin: one(admin, {
			fields: [adminActivityLog.adminId],
			references: [admin.id],
		}),
	}),
);
