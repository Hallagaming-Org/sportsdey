import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const adminRoles = ["super_admin", "admin"] as const;
export type AdminRole = (typeof adminRoles)[number];

export const admin = sqliteTable("admin", {
	id: text("id").primaryKey(),
	email: text("email").notNull().unique(),
	passwordHash: text("password_hash").notNull(),
	name: text("name").notNull(),
	mobileNumber: text("mobile_number"),
	image: text("image"),
	role: text("role", { enum: adminRoles }).notNull().default("admin"),
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
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		adminId: text("admin_id")
			.notNull()
			.references(() => admin.id, { onDelete: "cascade" }),
	},
	(table) => [index("admin_session_adminId_idx").on(table.adminId)],
);

export const adminRelations = relations(admin, ({ many }) => ({
	sessions: many(adminSession),
}));

export const adminSessionRelations = relations(adminSession, ({ one }) => ({
	admin: one(admin, {
		fields: [adminSession.adminId],
		references: [admin.id],
	}),
}));
