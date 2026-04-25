import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("email_verified", { mode: "boolean" })
		.default(false)
		.notNull(),
	image: text("image"),
	country: text("country"),
	mobileNumber: text("mobile_number"),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
	verificationStatus: text("verification_status")
		.default("not_verified")
		.notNull(),
	suspended: integer("suspended", { mode: "boolean" })
		.default(false)
		.notNull(),
});

export const session = sqliteTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		token: text("token").notNull().unique(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [index("session_userId_idx").on(table.userId)],
);

export const account = sqliteTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: integer("access_token_expires_at", {
			mode: "timestamp_ms",
		}),
		refreshTokenExpiresAt: integer("refresh_token_expires_at", {
			mode: "timestamp_ms",
		}),
		scope: text("scope"),
		password: text("password"),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = sqliteTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
	wallets: many(wallet),
	walletTransactions: many(walletTransaction),
	gameWallets: many(gameWallet),
	gameWalletTransactions: many(gameWalletTransaction),
	gameLaunchTokens: many(gameLaunchTokens),
	gameSessions: many(gameSessions),
	gameTransactions: many(gameTransactions),
	utilityTransactions: many(utilityTransaction),
	withdrawalAccounts: many(withdrawalAccount),
	userFiles: many(userFile),
	slotitegrationSessions: many(slotitegrationSessions),
	slotitegrationTransactions: many(slotitegrationTransactions),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id],
	}),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id],
	}),
}));

export const wallet = sqliteTable("wallet", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" })
		.unique(),
	balance: integer("balance").notNull().default(0),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

export const walletTransaction = sqliteTable(
	"wallet_transaction",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		amount: integer("amount").notNull(),
		type: text("type").notNull(),
		reference: text("reference").notNull().unique(),
		status: text("status").notNull(),
		paymentMethod: text("payment_method")
			.notNull()
			.default("card"),
		balance: integer("balance").notNull().default(0),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [
		index("wallet_transaction_userId_idx").on(table.userId),
		index("wallet_transaction_status_idx").on(table.status),
	],
);

export const walletRelations = relations(wallet, ({ one, many }) => ({
	user: one(user, {
		fields: [wallet.userId],
		references: [user.id],
	}),
	// Link via userId because wallet_transaction stores user_id (no wallet_id column)
	transactions: many(walletTransaction, { relationName: "walletTransactions" }),
}));

export const walletTransactionRelations = relations(
	walletTransaction,
	({ one }) => ({
		user: one(user, {
			fields: [walletTransaction.userId],
			references: [user.id],
		}),
		wallet: one(wallet, {
			fields: [walletTransaction.userId],
			references: [wallet.userId],
			relationName: "walletTransactions",
		}),
	}),
);

export const gameWallet = sqliteTable("game_wallet", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" })
		.unique(),
	balance: integer("balance").notNull().default(0),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

export const gameWalletTransaction = sqliteTable("game_wallet_transaction", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	amount: integer("amount").notNull(),
	type: text("type").notNull(),
	reference: text("reference").notNull().unique(),
	status: text("status").notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
});

export const gameWalletRelations = relations(gameWallet, ({ one, many }) => ({
	user: one(user, {
		fields: [gameWallet.userId],
		references: [user.id],
	}),
	transactions: many(gameWalletTransaction),
}));

export const gameWalletTransactionRelations = relations(
	gameWalletTransaction,
	({ one }) => ({
		user: one(user, {
			fields: [gameWalletTransaction.userId],
			references: [user.id],
		}),
		gameWallet: one(gameWallet, {
			fields: [gameWalletTransaction.userId],
			references: [gameWallet.userId],
		}),
	}),
);

export const utilityTransaction = sqliteTable("utility_transaction", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	amount: integer("amount").notNull(),
	serviceCategory: text("service_category").notNull(),
	billerCode: text("biller_code").notNull(),
	billerName: text("biller_name").notNull(),
	customerId: text("customer_id").notNull(),
	customerName: text("customer_name"),
	productCode: text("product_code").notNull(),
	productName: text("product_name").notNull(),
	monnifyTransactionReference: text("monnify_transaction_reference").unique(),
	vendReference: text("vend_reference").notNull().unique(),
	validationReference: text("validation_reference"),
	status: text("status").notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
});

export const utilityTransactionRelations = relations(
	utilityTransaction,
	({ one }) => ({
		user: one(user, {
			fields: [utilityTransaction.userId],
			references: [user.id],
		}),
	}),
);

export const withdrawalAccount = sqliteTable("withdrawal_account", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	bankCode: text("bank_code").notNull(),
	bankName: text("bank_name").notNull(),
	accountNumber: text("account_number").notNull(),
	accountName: text("account_name").notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

export const withdrawalAccountRelations = relations(
	withdrawalAccount,
	({ one }) => ({
		user: one(user, {
			fields: [withdrawalAccount.userId],
			references: [user.id],
		}),
	}),
);

export const gameLaunchTokens = sqliteTable("game_launch_tokens", {
	token: text("token").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	game: text("game").notNull(),
	used: integer("used", { mode: "boolean" }).default(false).notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
});

export const gameSessions = sqliteTable("game_sessions", {
	sessionToken: text("session_token").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	game: text("game").notNull(),
	status: text("status").notNull().default("active"),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

export const gameTransactions = sqliteTable("game_transactions", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	providerTxId: text("provider_tx_id").notNull().unique(),
	type: text("type").notNull(),
	amount: integer("amount").notNull(),
	sessionToken: text("session_token").notNull(),
	game: text("game").notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
});

export const thundrSessions = sqliteTable("thundr_sessions", {
	sessionId: text("session_id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	gameId: text("game_id").notNull(),
	status: text("status").default("active").notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

export const gameLaunchTokensRelations = relations(
	gameLaunchTokens,
	({ one }) => ({
		user: one(user, {
			fields: [gameLaunchTokens.userId],
			references: [user.id],
		}),
	}),
);

export const gameSessionsRelations = relations(gameSessions, ({ one }) => ({
	user: one(user, {
		fields: [gameSessions.userId],
		references: [user.id],
	}),
}));

export const gameTransactionsRelations = relations(
	gameTransactions,
	({ one }) => ({
		user: one(user, {
			fields: [gameTransactions.userId],
			references: [user.id],
		}),
	}),
);

export const thundrSessionsRelations = relations(thundrSessions, ({ one }) => ({
	user: one(user, {
		fields: [thundrSessions.userId],
		references: [user.id],
	}),
}));

export const thundrTransactions = sqliteTable("thundr_transactions", {
	id: text("id").primaryKey(),
	transactionId: text("transaction_id").notNull().unique(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	type: text("type").notNull(),
	amount: integer("amount").notNull(),
	roundId: text("round_id").notNull(),
	gameId: text("game_id").notNull(),
	sessionId: text("session_id").notNull(),
	originalTransactionId: text("original_transaction_id"),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
});

export const thundrTransactionsRelations = relations(
	thundrTransactions,
	({ one }) => ({
		user: one(user, {
			fields: [thundrTransactions.userId],
			references: [user.id],
		}),
	}),
);

export const pocketsTransactions = sqliteTable("pockets_transactions", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	type: text("type").notNull(),
	amount: integer("amount").notNull(),
	currency: text("currency").notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
});

export const pocketsTransactionsRelations = relations(
	pocketsTransactions,
	({ one }) => ({
		user: one(user, {
			fields: [pocketsTransactions.userId],
			references: [user.id],
		}),
	}),
);

export const slotitegrationSessions = sqliteTable(
	"slotitegration_sessions",
	{
		sessionId: text("session_id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		currency: text("currency").notNull().default("NGN"),
		status: text("status").default("active").notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("slotitegration_session_userId_idx").on(table.userId)],
);

export const slotitegrationSessionsRelations = relations(
	slotitegrationSessions,
	({ one }) => ({
		user: one(user, {
			fields: [slotitegrationSessions.userId],
			references: [user.id],
		}),
	}),
);

export const slotitegrationTransactions = sqliteTable(
	"slotitegration_transactions",
	{
		id: text("id").primaryKey(),
		transactionId: text("transaction_id").notNull().unique(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		type: text("type").notNull(),
		amount: integer("amount").notNull(),
		currency: text("currency").notNull(),
		roundId: text("round_id"),
		gameId: text("game_id"),
		sessionId: text("session_id").notNull(),
		originalTransactionId: text("original_transaction_id"),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [
		index("slotitegration_tx_userId_idx").on(table.userId),
		index("slotitegration_tx_transactionId_idx").on(table.transactionId),
	],
);

export const slotitegrationTransactionsRelations = relations(
	slotitegrationTransactions,
	({ one }) => ({
		user: one(user, {
			fields: [slotitegrationTransactions.userId],
			references: [user.id],
		}),
	}),
);

export const filePurpose = {
	PROFILE_PIC: "profile_pic",
	VERIFICATION_DOCUMENT: "verification_document",
	ID_CARD_FRONT: "id_card_front",
	ID_CARD_BACK: "id_card_back",
	PROOF_OF_ADDRESS: "proof_of_address",
	OTHER: "other",
} as const;

export type FilePurpose = (typeof filePurpose)[keyof typeof filePurpose];

export const userFile = sqliteTable("user_file", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	fileName: text("file_name").notNull(),
	originalName: text("original_name").notNull(),
	purpose: text("purpose").notNull(),
	r2Key: text("r2_key").notNull(),
	url: text("url").notNull(),
	mimeType: text("mime_type").notNull(),
	size: integer("size").notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
});

export const userFileRelations = relations(userFile, ({ one }) => ({
	user: one(user, {
		fields: [userFile.userId],
		references: [user.id],
	}),
}));

export const game = sqliteTable("game", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	code: text("code").notNull().unique(),
	imageUrl: text("image_url"),
	enabled: integer("enabled", { mode: "boolean" }).default(true).notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

export * from "./schema/admin";
import { admin } from "./schema/admin";
