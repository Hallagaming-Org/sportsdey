import crypto from "node:crypto";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, asc, desc, eq, gt, gte, lte, notInArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { Context } from "hono";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import { creditWallet, debitWallet } from "@/db/atomic-wallet";
import * as schema from "@/db/schema";
import { requirePermission } from "@/middleware/admin-permissions";
import { parseQueryDateRange, toWAT } from "@/utils";
import {
	adminActivityActions,
	recordActivityForSession,
} from "@/utils/admin-activity-log";
import { parseDobInput } from "@/utils/dob";
import {
	isDefaultPhoneUserName,
	isPhonePlaceholderEmail,
} from "@/utils/phone-user";
import { syncWebengageUserProfile } from "@/utils/webengage-user-profile";
import type { CloudflareBindings } from "../types";

const PROFILE_CHANGE_CONTACT_EMAIL = "support@sportsdey.com";
const PROFILE_EDIT_LOCKED_MESSAGE = `You've already updated your profile. Contact admin at ${PROFILE_CHANGE_CONTACT_EMAIL} if you need any further changes.`;

function isOnboardingProfile(user: { name: string; email: string }): boolean {
	return (
		isPhonePlaceholderEmail(user.email) || isDefaultPhoneUserName(user.name)
	);
}

function toIsoTimestamp(value: Date | string | number): string {
	if (value instanceof Date) return value.toISOString();
	return String(value);
}

const EXCLUDED_OVERVIEW_PAYMENT_METHODS = [
	"sportsbook",
	"thndr games",
	"lagos rush",
	"halla",
	"lucky games",
	"hashcodex",
	"slotegrator games",
];

type WalletActivityRow = {
	type: string;
	amount: number;
	paymentMethod: string;
	metadata: string | null;
};

function parseWalletActivityMetadata(
	metadata: string | null,
): Record<string, unknown> {
	if (!metadata) return {};
	try {
		const parsed = JSON.parse(metadata);
		return parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: {};
	} catch {
		return {};
	}
}

function readableWalletActivityPurpose(row: WalletActivityRow): string {
	const metadata = parseWalletActivityMetadata(row.metadata);
	const paymentMethod = row.paymentMethod.toLowerCase();
	const action = typeof metadata.action === "string" ? metadata.action : "";
	const game = typeof metadata.game === "string" ? metadata.game : "Casino";
	const direction = row.type === "debit" ? "debit" : "credit";

	if (paymentMethod === "manual") {
		const reason =
			typeof metadata.reason === "string" ? metadata.reason.trim() : "";
		return reason
			? `Manual ${direction}: ${reason}`
			: `Manual wallet ${direction}`;
	}

	if (paymentMethod === "sportsbook") {
		const sportsbookActions: Record<string, string> = {
			bet_accepted: "Sportsbook bet placed",
			bet_declined: "Sportsbook bet refunded",
			settled:
				metadata.settleType === "win"
					? "Sportsbook winnings"
					: "Sportsbook bet refunded",
			unsettled: "Sportsbook settlement reversed",
			cash_out_accepted: "Sportsbook cash-out",
			cash_out_declined: "Sportsbook cash-out reversed",
		};
		return sportsbookActions[action] ?? `Sportsbook wallet ${direction}`;
	}

	if (paymentMethod === "wallet_transfer") {
		if (metadata.transferType === "to_game_wallet")
			return "Transfer to game wallet";
		if (metadata.transferType === "incoming") return "Wallet transfer received";
		return "Wallet transfer sent";
	}

	if (paymentMethod === "bill_payment") {
		const biller =
			typeof metadata.billerName === "string" ? metadata.billerName : "";
		const product =
			typeof metadata.productName === "string" ? metadata.productName : "";
		return [biller, product].filter(Boolean).join(" - ") || "Bill payment";
	}

	if (
		[
			"lucky games",
			"thndr games",
			"lagos rush",
			"halla",
			"slotegrator games",
			"hashcodex",
			"scorpio",
		].includes(paymentMethod)
	) {
		const actionLabel: Record<string, string> = {
			bet: "bet placed",
			win: "winnings",
			refund: "refund",
			rollback: "rollback",
			cancel: "bet cancelled",
			reset: "balance reset",
			settlement: "settlement",
		};
		const provider = game === "Casino" ? paymentMethod : game;
		return `${provider} ${actionLabel[action] ?? `wallet ${direction}`}`;
	}

	if (
		["opay", "kuda", "palmpay", "paystack", "card", "bank_transfer"].includes(
			paymentMethod,
		)
	) {
		return direction === "credit"
			? `${row.paymentMethod} wallet deposit`
			: `${row.paymentMethod} wallet withdrawal`;
	}

	if (paymentMethod.startsWith("bonus")) return "Bonus wallet adjustment";
	return `${row.paymentMethod || "Wallet"} ${direction}`;
}

const userRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const emptyToUndefined = (value: unknown) => {
	if (value === "" || value === null || value === undefined) return undefined;
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	if (typeof value !== "string") return undefined;
	return value;
};

const UpdateUserSchema = z
	.object({
		name: z.string().min(1).openapi({
			description: "User's full name",
			example: "John Doe",
		}),
		email: z.preprocess(emptyToUndefined, z.string().optional()).openapi({
			description: "User's email address",
			example: "john@example.com",
		}),
		image: z.preprocess(emptyToUndefined, z.string().optional()).openapi({
			description: "Profile image URL",
			example: "https://cdn.example.com/avatar.jpg",
		}),
		country: z.preprocess(emptyToUndefined, z.string().optional()).openapi({
			description: "User's country",
			example: "Nigeria",
		}),
		mobileNumber: z
			.preprocess(emptyToUndefined, z.string().optional())
			.openapi({
				description:
					"User's mobile number. Omit or leave empty to keep the existing number.",
				example: "08012345678",
			}),
		dob: z.preprocess(emptyToUndefined, z.string().optional()).openapi({
			description: "Date of birth (YYYY-MM-DD or DD/MM/YYYY)",
			example: "1998-04-12",
		}),
		accountEdit: z.boolean().optional().openapi({
			description:
				"True when the save comes from the player Account page. Only those saves use the one-edit limit.",
		}),
	})
	.openapi("UpdateUser");

const RecentSessionSchema = z
	.object({
		ipAddresses: z
			.array(z.string())
			.openapi({ description: "IP addresses from the last 3 active sessions" }),
		devices: z.array(z.string()).openapi({
			description: "Device/browser info from the last 3 active sessions",
		}),
	})
	.openapi("RecentSession");

const SelfUserResponseSchema = z
	.object({
		id: z.string().openapi({ description: "User ID" }),
		name: z.string().openapi({ description: "User's name" }),
		email: z.string().openapi({ description: "User's email" }),
		emailVerified: z
			.boolean()
			.openapi({ description: "Email verification status" }),
		image: z
			.string()
			.nullable()
			.openapi({ description: "User's profile image URL" }),
		country: z.string().nullable().openapi({ description: "User's country" }),
		mobileNumber: z
			.string()
			.nullable()
			.openapi({ description: "User's mobile number" }),
		dob: z
			.string()
			.nullable()
			.optional()
			.openapi({ description: "Date of birth (YYYY-MM-DD)" }),
		suspended: z.boolean().openapi({ description: "Suspension status" }),
		createdAt: z.string().openapi({ description: "Creation timestamp" }),
		updatedAt: z.string().openapi({ description: "Last update timestamp" }),
		verificationStatus: z
			.string()
			.optional()
			.openapi({ description: "Verification status" }),
		canEditProfile: z.boolean().optional().openapi({
			description:
				"Whether the player may still make their one self-serve profile edit",
		}),
	})
	.openapi("SelfUserResponse");

const UpdateUserErrorSchema = z
	.object({
		success: z.literal(false).openapi({ description: "Success status" }),
		error: z.string().openapi({ description: "Error message" }),
		details: z.null().openapi({ description: "Error details" }),
	})
	.openapi("UpdateUserError");

const UpdateUserResponseSchema = z
	.object({
		success: z.literal(true).openapi({ description: "Success status" }),
		data: SelfUserResponseSchema.openapi({ description: "User data" }),
	})
	.openapi("UpdateUserResponse");

const AdminErrorSchema = z
	.object({
		success: z.literal(false),
		error: z.string(),
	})
	.openapi("AdminError");

const GetAllUsersQuerySchema = z
	.object({
		sort: z
			.enum(["asc", "desc"])
			.optional()
			.openapi({ description: "Sort order", example: "asc" }),
		status: z
			.enum([
				"all",
				"verified",
				"not_verified",
				"pending_verification",
				"rejected",
			])
			.optional()
			.openapi({
				description: "Filter by verification status",
				example: "all",
			}),
		tab: z
			.enum(["all", "recent", "pending"])
			.optional()
			.openapi({ description: "Filter by tab", example: "all" }),
		search: z.string().optional().openapi({
			description: "Search users by name, email, or ID",
			example: "john",
		}),
		fromDate: z.string().optional().openapi({
			description:
				"Filter users registered on or after this date (ISO format: YYYY-MM-DD)",
			example: "2025-01-01",
		}),
		toDate: z.string().optional().openapi({
			description:
				"Filter users registered on or before this date (ISO format: YYYY-MM-DD)",
			example: "2025-01-31",
		}),
		page: z.string().optional(),
		limit: z.string().optional(),
	})
	.openapi("GetAllUsersQuery");

const UserListItemSchema = z
	.object({
		id: z.string().openapi({ description: "User ID" }),
		name: z.string().openapi({ description: "User's name" }),
		email: z.string().openapi({ description: "User's email" }),
		wallet: z.number().openapi({ description: "Wallet balance" }),
		status: z.string().openapi({ description: "Verification status" }),
		suspended: z.boolean().openapi({ description: "Suspension status" }),
		registeredDate: z.string().openapi({ description: "Registration date" }),
		registeredIpAddress: z
			.string()
			.nullable()
			.openapi({ description: "Latest IP address from active session" }),
	})
	.openapi("UserListItem");

const GetAllUsersResponseSchema = z
	.object({
		success: z.literal(true).openapi({ description: "Success status" }),
		data: z
			.object({
				users: z.array(UserListItemSchema).openapi({ description: "Users" }),
				total: z.number().openapi({ description: "Total number of users" }),
				page: z.number().openapi({ description: "Current page" }),
				limit: z.number().openapi({ description: "Items in this response" }),
				totalPages: z
					.number()
					.openapi({ description: "Total number of pages" }),
			})
			.openapi({ description: "Response data" }),
	})
	.openapi("GetAllUsersResponse");

const getUserRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["User"],
	summary: "Get current user",
	description: "Retrieve the authenticated user's profile details",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "User retrieved successfully",
			content: {
				"application/json": {
					schema: UpdateUserResponseSchema,
				},
			},
		},
		401: {
			description: "Unauthorized - user not authenticated",
			content: {
				"application/json": {
					schema: UpdateUserErrorSchema,
				},
			},
		},
		404: {
			description: "User not found",
			content: {
				"application/json": {
					schema: UpdateUserErrorSchema,
				},
			},
		},
	},
});

const updateUserRoute = createRoute({
	method: "patch",
	path: "/",
	tags: ["User"],
	summary: "Update user profile",
	description: "Update the authenticated user's profile information",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: UpdateUserSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "User updated successfully",
			content: {
				"application/json": {
					schema: UpdateUserResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid request",
			content: {
				"application/json": {
					schema: UpdateUserErrorSchema,
				},
			},
		},
		401: {
			description: "Unauthorized - user not authenticated",
			content: {
				"application/json": {
					schema: UpdateUserErrorSchema,
				},
			},
		},
		404: {
			description: "User not found",
			content: {
				"application/json": {
					schema: UpdateUserErrorSchema,
				},
			},
		},
		403: {
			description: "Profile edit already used",
			content: {
				"application/json": {
					schema: UpdateUserErrorSchema,
				},
			},
		},
	},
});

userRoute.openapi(getUserRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
				details: null,
			},
			401,
		);
	}

	const db = drizzle(c.env.DB, { schema });

	const [existingUser] = await db
		.select()
		.from(schema.user)
		.where(eq(schema.user.id, user.id))
		.limit(1);

	if (!existingUser) {
		return c.json(
			{
				success: false as const,
				error: "User not found",
				details: null,
			},
			404,
		);
	}

	return c.json(
		{
			success: true as const,
			data: {
				id: existingUser.id,
				name: existingUser.name,
				email: existingUser.email,
				emailVerified: existingUser.emailVerified,
				image: existingUser.image,
				country: existingUser.country,
				mobileNumber: existingUser.mobileNumber,
				dob: existingUser.dob ?? null,
				suspended: existingUser.suspended,
				createdAt: toIsoTimestamp(existingUser.createdAt),
				updatedAt: toIsoTimestamp(existingUser.updatedAt),
				verificationStatus: existingUser.verificationStatus,
				canEditProfile: existingUser.profileSelfEditedAt == null,
			},
		},
		200,
	);
});

userRoute.openapi(updateUserRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
				details: null,
			},
			401,
		);
	}

	const { name, email, image, country, mobileNumber, dob, accountEdit } =
		c.req.valid("json");
	const parsedDob = parseDobInput(dob);
	if (!parsedDob.ok) {
		return c.json(
			{
				success: false as const,
				error: parsedDob.error,
				details: null,
			},
			400,
		);
	}
	const db = drizzle(c.env.DB, { schema });

	const [existingUser] = await db
		.select()
		.from(schema.user)
		.where(eq(schema.user.id, user.id))
		.limit(1);

	if (!existingUser) {
		return c.json(
			{
				success: false as const,
				error: "User not found",
				details: null,
			},
			404,
		);
	}

	const rawEmail = email?.trim().toLowerCase();
	const nextEmail =
		rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)
			? rawEmail
			: undefined;
	const nextCountry =
		country !== undefined
			? country.trim()
				? country.trim()
				: null
			: undefined;
	const nextMobile =
		mobileNumber !== undefined && mobileNumber.trim() !== ""
			? mobileNumber.trim()
			: undefined;
	const nextDob = parsedDob.value === undefined ? undefined : parsedDob.value;
	const identityChanged =
		name.trim() !== existingUser.name.trim() ||
		Boolean(nextEmail && nextEmail !== existingUser.email.toLowerCase()) ||
		(nextCountry !== undefined &&
			nextCountry !== (existingUser.country ?? null)) ||
		(nextMobile !== undefined &&
			nextMobile !== (existingUser.mobileNumber ?? null)) ||
		(nextDob !== undefined && nextDob !== (existingUser.dob ?? null));
	const countsTowardOneEdit =
		accountEdit === true && !isOnboardingProfile(existingUser);

	if (
		identityChanged &&
		existingUser.profileSelfEditedAt &&
		countsTowardOneEdit
	) {
		return c.json(
			{
				success: false as const,
				error: PROFILE_EDIT_LOCKED_MESSAGE,
				details: null,
			},
			403,
		);
	}

	const updates: {
		name: string;
		country?: string | null;
		mobileNumber?: string | null;
		dob?: string | null;
		email?: string;
		emailVerified?: boolean;
		image?: string | null;
		profileSelfEditedAt?: Date;
	} = {
		name,
	};

	// Partial update: never wipe country/mobile when the client omits them.
	if (nextCountry !== undefined) {
		updates.country = nextCountry;
	}
	if (nextMobile !== undefined) {
		updates.mobileNumber = nextMobile;
	}
	if (nextDob !== undefined) {
		updates.dob = nextDob;
	}
	if (image !== undefined) {
		updates.image = image.trim() ? image.trim() : null;
	}

	if (
		identityChanged &&
		!existingUser.profileSelfEditedAt &&
		countsTowardOneEdit
	) {
		updates.profileSelfEditedAt = new Date();
	}

	if (nextEmail && nextEmail !== existingUser.email.toLowerCase()) {
		const [emailTaken] = await db
			.select({ id: schema.user.id })
			.from(schema.user)
			.where(eq(schema.user.email, nextEmail))
			.limit(1);

		if (emailTaken && emailTaken.id !== existingUser.id) {
			return c.json(
				{
					success: false as const,
					error: "Email already in use",
					details: null,
				},
				400,
			);
		}

		updates.email = nextEmail;
		updates.emailVerified = false;
	}

	const [updatedUser] = await db
		.update(schema.user)
		.set(updates)
		.where(eq(schema.user.id, user.id))
		.returning();

	if (!updatedUser) {
		return c.json(
			{
				success: false as const,
				error: "User not found",
				details: null,
			},
			404,
		);
	}

	await syncWebengageUserProfile(c.env, updatedUser.id, c.executionCtx);

	return c.json(
		{
			success: true as const,
			data: {
				id: updatedUser.id,
				name: updatedUser.name,
				email: updatedUser.email,
				emailVerified: updatedUser.emailVerified,
				image: updatedUser.image,
				country: updatedUser.country,
				mobileNumber: updatedUser.mobileNumber,
				dob: updatedUser.dob ?? null,
				suspended: updatedUser.suspended,
				createdAt: toIsoTimestamp(updatedUser.createdAt),
				updatedAt: toIsoTimestamp(updatedUser.updatedAt),
				canEditProfile: updatedUser.profileSelfEditedAt == null,
			},
		},
		200,
	);
});

const getAllUsersRoute = createRoute({
	method: "get",
	path: "/all",
	tags: ["User"],
	summary: "Get all users (admin only)",
	description:
		"Paginated user list for the admin back office. Use GET /user/list-all for the full unpaginated set.",
	security: [{ BearerAuth: [] }],
	request: {
		query: GetAllUsersQuerySchema,
	},
	responses: {
		200: {
			description: "Users retrieved successfully",
			content: {
				"application/json": {
					schema: GetAllUsersResponseSchema,
				},
			},
		},
		401: {
			description: "Unauthorized - admin not authenticated",
			content: {
				"application/json": {
					schema: z.object({
						success: z.literal(false),
						error: z.string(),
					}),
				},
			},
		},
		403: {
			description: "Forbidden - admin only",
			content: {
				"application/json": {
					schema: z.object({
						success: z.literal(false),
						error: z.string(),
					}),
				},
			},
		},
	},
});

async function requireUserListAdmin(
	c: Parameters<Parameters<typeof userRoute.openapi>[1]>[0],
) {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
				details: null,
			},
			401,
		);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session) {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - admin only",
				details: null,
			},
			403,
		);
	}

	if (session.role !== "super_admin" && session.role !== "admin") {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - super admin or admin only",
			},
			403,
		);
	}

	if (
		session.role !== "super_admin" &&
		!requirePermission(session, "view_player_details")
	) {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - view_player_details permission required",
			},
			403,
		);
	}

	return null;
}

async function loadFilteredAdminUsers(
	c: Parameters<Parameters<typeof userRoute.openapi>[1]>[0],
) {
	const db = drizzle(c.env.DB, { schema });

	const sort = c.req.query("sort") === "desc" ? "desc" : "asc";
	const tab = c.req.query("tab") as "all" | "recent" | "pending" | undefined;
	const status = c.req.query("status") as
		| "all"
		| "verified"
		| "not_verified"
		| "pending_verification"
		| "rejected"
		| undefined;
	const search = c.req.query("search")?.trim() || undefined;
	const { fromDate, toDate } = parseQueryDateRange({
		fromDate: c.req.query("fromDate"),
		toDate: c.req.query("toDate"),
	});

	let baseQuery = db
		.select({
			id: schema.user.id,
			name: schema.user.name,
			email: schema.user.email,
			wallet: schema.wallet.balance,
			status: schema.user.verificationStatus,
			suspended: schema.user.suspended,
			registeredDate: schema.user.createdAt,
			registeredIpAddress: schema.user.lastLoginIp,
		})
		.from(schema.user)
		.leftJoin(schema.wallet, eq(schema.wallet.userId, schema.user.id));

	if (status && status !== "all") {
		const statusCondition = and(eq(schema.user.verificationStatus, status));
		baseQuery = baseQuery.where(statusCondition) as typeof baseQuery;
	}

	if (tab === "pending") {
		const pendingCondition = and(
			eq(schema.user.verificationStatus, "pending_verification"),
		);
		baseQuery = baseQuery.where(pendingCondition) as typeof baseQuery;
	}

	// NOTE: Move date filtering out of DB layer. We'll apply from/to filtering
	// in-memory after fetching results so admin endpoints control date
	// filtering at the application layer.

	const orderByClause =
		tab === "recent" || sort === "desc"
			? desc(schema.user.createdAt)
			: asc(schema.user.createdAt);

	// fetch all matching rows (without date constraints) and apply date
	// filtering and sorting in-memory
	const rawUsers = await baseQuery.orderBy(orderByClause);

	const users = rawUsers.map((u) => ({
		id: u.id,
		name: u.name,
		email: u.email,
		wallet: (u.wallet ?? 0) / 100,
		status: u.status,
		suspended: u.suspended,
		registeredDate: toIsoTimestamp(u.registeredDate),
		registeredIpAddress: u.registeredIpAddress ?? null,
	}));

	// apply search and date filters in memory
	const filtered = users.filter((u) => {
		if (search) {
			const q = search.toLowerCase();
			if (
				!u.name.toLowerCase().includes(q) &&
				!u.email.toLowerCase().includes(q) &&
				!u.id.toLowerCase().includes(q)
			) {
				return false;
			}
		}
		if (!fromDate && !toDate) return true;
		const ts = new Date(u.registeredDate).getTime();
		if (fromDate && ts < fromDate.getTime()) return false;
		if (toDate && ts > toDate.getTime()) return false;
		return true;
	});

	return filtered;
}

userRoute.openapi(getAllUsersRoute, async (c) => {
	const denied = await requireUserListAdmin(c);
	if (denied) return denied;

	const filtered = await loadFilteredAdminUsers(c);
	const total = filtered.length;
	const page = Math.max(
		1,
		Number.parseInt(c.req.query("page") || "1", 10) || 1,
	);
	const parsedLimit = Number.parseInt(c.req.query("limit") || "10", 10);
	const limit = Math.min(
		100,
		Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 10),
	);
	const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
	const paged = filtered.slice((page - 1) * limit, page * limit);

	return c.json(
		{
			success: true as const,
			data: {
				users: paged,
				total,
				page,
				limit,
				totalPages,
			},
		},
		200,
	);
});

const getAllUsersUnpaginatedRoute = createRoute({
	method: "get",
	path: "/list-all",
	tags: ["User"],
	summary: "Get every user (admin only, unpaginated)",
	description:
		"New endpoint: full user list in one response. Does not change GET /user/all, which stays paginated.",
	security: [{ BearerAuth: [] }],
	request: {
		query: GetAllUsersQuerySchema,
	},
	responses: {
		200: {
			description: "Users retrieved successfully",
			content: {
				"application/json": {
					schema: GetAllUsersResponseSchema,
				},
			},
		},
		401: {
			description: "Unauthorized - admin not authenticated",
			content: {
				"application/json": {
					schema: z.object({
						success: z.literal(false),
						error: z.string(),
					}),
				},
			},
		},
		403: {
			description: "Forbidden - admin only",
			content: {
				"application/json": {
					schema: z.object({
						success: z.literal(false),
						error: z.string(),
					}),
				},
			},
		},
	},
});

userRoute.openapi(getAllUsersUnpaginatedRoute, async (c) => {
	const denied = await requireUserListAdmin(c);
	if (denied) return denied;

	const filtered = await loadFilteredAdminUsers(c);
	const total = filtered.length;

	return c.json(
		{
			success: true as const,
			data: {
				users: filtered,
				total,
				page: 1,
				limit: total,
				totalPages: 1,
			},
		},
		200,
	);
});

const CreateUserSchema = z
	.object({
		name: z.string().min(1).openapi({
			description: "User's full name",
			example: "John Doe",
		}),
		email: z.string().email().openapi({
			description: "User's email address",
			example: "john@example.com",
		}),
		country: z.string().optional().openapi({
			description: "User's country",
			example: "Nigeria",
		}),
		mobileNumber: z.string().optional().openapi({
			description: "User's mobile number",
			example: "+2348012345678",
		}),
	})
	.openapi("CreateUser");

const CreateUserResponseSchema = z
	.object({
		success: z.literal(true).openapi({ description: "Success status" }),
		data: z
			.object({
				id: z.string().openapi({ description: "User ID" }),
				name: z.string().openapi({ description: "User name" }),
				email: z.string().openapi({ description: "User email" }),
				emailVerified: z.boolean().openapi({ description: "Email verified" }),
				verificationStatus: z
					.string()
					.openapi({ description: "Verification status" }),
				createdAt: z.number().openapi({ description: "Created at" }),
			})
			.openapi({ description: "Response data" }),
	})
	.openapi("CreateUserResponse");

userRoute.openapi(
	createRoute({
		method: "post",
		path: "/",
		tags: ["User"],
		summary: "Create user (admin only)",
		description: "Create a new user (admin only)",
		security: [{ BearerAuth: [] }],
		request: {
			body: {
				content: {
					"application/json": {
						schema: CreateUserSchema,
					},
				},
			},
		},
		responses: {
			201: {
				description: "User created successfully",
				content: {
					"application/json": {
						schema: CreateUserResponseSchema,
					},
				},
			},
			400: {
				description: "Invalid request",
				content: {
					"application/json": {
						schema: z.object({
							success: z.literal(false),
							error: z.string(),
						}),
					},
				},
			},
			401: {
				description: "Unauthorized - admin not authenticated",
				content: {
					"application/json": {
						schema: z.object({
							success: z.literal(false),
							error: z.string(),
						}),
					},
				},
			},
			403: {
				description: "Forbidden - admin only",
				content: {
					"application/json": {
						schema: z.object({
							success: z.literal(false),
							error: z.string(),
						}),
					},
				},
			},
		},
	}),
	async (c) => {
		const token = getSessionToken(c.req.raw.headers);
		if (!token) {
			return c.json({ success: false as const, error: "Unauthorized" }, 401);
		}

		const session = await validateAdminSession(c.env, token);
		if (!session) {
			return c.json(
				{ success: false as const, error: "Forbidden - admin only" },
				403,
			);
		}

		const { name, email, country, mobileNumber } = c.req.valid("json");
		const db = drizzle(c.env.DB, { schema });

		const existingUser = await db
			.select()
			.from(schema.user)
			.where(eq(schema.user.email, email))
			.limit(1);

		if (existingUser.length > 0) {
			return c.json(
				{ success: false as const, error: "Email already exists" },
				400,
			);
		}

		const [newUser] = await db
			.insert(schema.user)
			.values({
				id: `user_${crypto.randomUUID()}`,
				name,
				email,
				emailVerified: false,
				verificationStatus: "not_verified",
				country: country ?? null,
				mobileNumber: mobileNumber ?? null,
			})
			.returning();

		if (!newUser) {
			return c.json(
				{ success: false as const, error: "Failed to create user" },
				400,
			);
		}

		await recordActivityForSession(
			c.env,
			session.adminId,
			adminActivityActions.createUser,
		);

		await syncWebengageUserProfile(c.env, newUser.id, c.executionCtx);

		return c.json(
			{
				success: true as const,
				data: {
					id: newUser.id,
					name: newUser.name,
					email: newUser.email,
					emailVerified: newUser.emailVerified,
					verificationStatus: newUser.verificationStatus,
					createdAt:
						newUser.createdAt instanceof Date
							? newUser.createdAt.getTime()
							: Number(newUser.createdAt),
				},
			},
			201,
		);
	},
);

const UserProfileResponseSchema = z
	.object({
		id: z.string().openapi({ description: "User ID" }),
		name: z.string().openapi({ description: "User's name" }),
		email: z.string().openapi({ description: "User's email" }),
		image: z
			.string()
			.nullable()
			.openapi({ description: "User's profile image URL" }),
		mobileNumber: z
			.string()
			.nullable()
			.openapi({ description: "User's mobile number" }),
		country: z.string().nullable().openapi({ description: "User's country" }),
		dob: z
			.string()
			.nullable()
			.openapi({ description: "Date of birth (YYYY-MM-DD)" }),
		verificationStatus: z
			.string()
			.openapi({ description: "Verification status" }),
		suspended: z.boolean().openapi({ description: "Suspension status" }),
		createdAt: z.string().openapi({ description: "Registration date" }),
		wallet: z
			.object({
				balance: z.number().openapi({ description: "Wallet balance" }),
			})
			.openapi({ description: "User's wallet" }),
		lastTopUp: z
			.string()
			.nullable()
			.openapi({ description: "Last top-up date" }),
		recentSessions: RecentSessionSchema.openapi({
			description: "Last 3 active sessions with device and IP info",
		}),
	})
	.openapi("UserProfile");

const GetUserProfileResponseSchema = z
	.object({
		success: z.literal(true).openapi({ description: "Success status" }),
		data: UserProfileResponseSchema.openapi({
			description: "User profile data",
		}),
	})
	.openapi("GetUserProfileResponse");

const getUserProfileRoute = createRoute({
	method: "get",
	path: "/{userId}/profile",
	tags: ["User"],
	summary: "Get user profile (admin only)",
	description: "Retrieve detailed user profile for admin panel",
	security: [{ BearerAuth: [] }],
	request: {
		params: z.object({
			userId: z.string().openapi({ description: "User ID" }),
		}),
	},
	responses: {
		200: {
			description: "User profile retrieved successfully",
			content: {
				"application/json": {
					schema: GetUserProfileResponseSchema,
				},
			},
		},
		401: {
			description: "Unauthorized - admin not authenticated",
			content: {
				"application/json": {
					schema: z.object({
						success: z.literal(false),
						error: z.string(),
					}),
				},
			},
		},
		403: {
			description: "Forbidden - admin only",
			content: {
				"application/json": {
					schema: z.object({
						success: z.literal(false),
						error: z.string(),
					}),
				},
			},
		},
		404: {
			description: "User not found",
			content: {
				"application/json": {
					schema: z.object({
						success: z.literal(false),
						error: z.string(),
					}),
				},
			},
		},
		400: {
			description: "Invalid request",
			content: {
				"application/json": {
					schema: z.object({
						success: z.literal(false),
						error: z.string(),
					}),
				},
			},
		},
	},
});

userRoute.openapi(getUserProfileRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false as const, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session) {
		return c.json(
			{ success: false as const, error: "Forbidden - admin only" },
			403,
		);
	}

	if (session.role !== "super_admin" && session.role !== "admin") {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - super admin or admin only",
			},
			403,
		);
	}

	if (
		session.role !== "super_admin" &&
		!requirePermission(session, "view_player_details")
	) {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - view_player_details permission required",
			},
			403,
		);
	}

	const userId = c.req.param("userId");
	if (!userId) {
		return c.json(
			{ success: false as const, error: "User ID is required" },
			400,
		);
	}

	const db = drizzle(c.env.DB, { schema });

	const [existingUser] = await db
		.select({
			id: schema.user.id,
			name: schema.user.name,
			email: schema.user.email,
			image: schema.user.image,
			mobileNumber: schema.user.mobileNumber,
			country: schema.user.country,
			dob: schema.user.dob,
			verificationStatus: schema.user.verificationStatus,
			suspended: schema.user.suspended,
			createdAt: schema.user.createdAt,
		})
		.from(schema.user)
		.where(eq(schema.user.id, userId))
		.limit(1);

	if (!existingUser) {
		return c.json({ success: false as const, error: "User not found" }, 404);
	}

	const [wallet] = await db
		.select({
			balance: schema.wallet.balance,
		})
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, userId))
		.limit(1);

	const [lastTopUpTransaction] = await db
		.select({
			createdAt: schema.walletTransaction.createdAt,
		})
		.from(schema.walletTransaction)
		.where(
			and(
				eq(schema.walletTransaction.userId, userId),
				eq(schema.walletTransaction.type, "credit"),
				eq(schema.walletTransaction.status, "success"),
			),
		)
		.orderBy(desc(schema.walletTransaction.createdAt))
		.limit(1);

	const recentSessionsRows = await db
		.select({
			ipAddress: schema.session.ipAddress,
			device: schema.session.userAgent,
		})
		.from(schema.session)
		.where(
			and(
				eq(schema.session.userId, userId),
				gt(schema.session.expiresAt, new Date()),
			),
		)
		.orderBy(desc(schema.session.createdAt))
		.limit(3);

	const recentSessions = {
		ipAddresses: recentSessionsRows
			.map((s) => s.ipAddress)
			.filter(Boolean) as string[],
		devices: recentSessionsRows
			.map((s) => s.device)
			.filter(Boolean) as string[],
	};

	return c.json(
		{
			success: true as const,
			data: {
				id: existingUser.id,
				name: existingUser.name,
				email: existingUser.email,
				image: existingUser.image,
				mobileNumber: existingUser.mobileNumber,
				country: existingUser.country,
				dob: existingUser.dob ?? null,
				verificationStatus: existingUser.verificationStatus,
				suspended: existingUser.suspended,
				createdAt: toWAT(existingUser.createdAt),
				wallet: {
					balance: (wallet?.balance ?? 0) / 100,
				},
				lastTopUp: toWAT(lastTopUpTransaction?.createdAt) ?? null,
				recentSessions,
			},
		},
		200,
	);
});

/** Admin back office echoes the GET profile object (nulls + extra keys). */
const AdminUpdateUserSchema = z
	.object({
		name: z.preprocess(emptyToUndefined, z.string().optional()),
		fullName: z.preprocess(emptyToUndefined, z.string().optional()),
		email: z.preprocess(emptyToUndefined, z.string().optional()),
		image: z.preprocess(emptyToUndefined, z.string().optional()),
		country: z.preprocess(emptyToUndefined, z.string().optional()),
		mobileNumber: z.preprocess(emptyToUndefined, z.string().optional()),
		phone: z.preprocess(emptyToUndefined, z.string().optional()),
		mobile: z.preprocess(emptyToUndefined, z.string().optional()),
		dob: z.preprocess(emptyToUndefined, z.string().optional()),
		dateOfBirth: z.preprocess(emptyToUndefined, z.string().optional()),
	})
	.passthrough();

type AdminUpdateUserBody = z.infer<typeof AdminUpdateUserSchema>;
type AdminUpdateUserContext = Context<
	{ Bindings: CloudflareBindings },
	string,
	{
		in: { json: AdminUpdateUserBody };
		out: { json: AdminUpdateUserBody };
	}
>;

const adminUpdateUserResponses = {
	200: {
		description: "User profile updated successfully",
		content: {
			"application/json": {
				schema: UpdateUserResponseSchema,
			},
		},
	},
	400: {
		description: "Invalid request",
		content: {
			"application/json": {
				schema: UpdateUserErrorSchema,
			},
		},
	},
	401: {
		description: "Unauthorized - admin not authenticated",
		content: {
			"application/json": {
				schema: AdminErrorSchema,
			},
		},
	},
	403: {
		description: "Forbidden - admin only",
		content: {
			"application/json": {
				schema: AdminErrorSchema,
			},
		},
	},
	404: {
		description: "User not found",
		content: {
			"application/json": {
				schema: AdminErrorSchema,
			},
		},
	},
} as const;

const updateUserByIdRoute = createRoute({
	method: "patch",
	path: "/{userId}",
	tags: ["User"],
	summary: "Update user profile by id (admin only)",
	description:
		"Admin update for a player profile. Same fields as PATCH /user/{userId}/profile. This is the path the back office calls.",
	security: [{ BearerAuth: [] }],
	request: {
		params: z.object({
			userId: z.string().openapi({ description: "User ID" }),
		}),
		body: {
			content: {
				"application/json": {
					schema: AdminUpdateUserSchema,
				},
			},
		},
	},
	responses: adminUpdateUserResponses,
});

const updateUserProfileRoute = createRoute({
	method: "patch",
	path: "/{userId}/profile",
	tags: ["User"],
	summary: "Update user profile (admin only)",
	description:
		"Update any player's profile fields (name, email, country, mobile number, image). Writes the same user row the player Account page reads, so existing and new accounts both reflect the change immediately.",
	security: [{ BearerAuth: [] }],
	request: {
		params: z.object({
			userId: z.string().openapi({ description: "User ID" }),
		}),
		body: {
			content: {
				"application/json": {
					schema: AdminUpdateUserSchema,
				},
			},
		},
	},
	responses: adminUpdateUserResponses,
});

async function handleAdminUpdateUserProfile(c: AdminUpdateUserContext) {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
				details: null,
			},
			401,
		);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session) {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - admin only",
				details: null,
			},
			403,
		);
	}

	if (session.role !== "super_admin" && session.role !== "admin") {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - super admin or admin only",
				details: null,
			},
			403,
		);
	}

	if (
		session.role !== "super_admin" &&
		!requirePermission(session, "view_player_details")
	) {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - view_player_details permission required",
				details: null,
			},
			403,
		);
	}

	const userId = c.req.param("userId");
	if (!userId) {
		return c.json(
			{
				success: false as const,
				error: "User ID is required",
				details: null,
			},
			400,
		);
	}

	const body = c.req.valid("json");
	const name = body.name ?? body.fullName;
	const email = body.email;
	const image = body.image;
	const country = body.country;
	const mobileNumber = body.mobileNumber ?? body.phone ?? body.mobile;
	const parsedDob = parseDobInput(body.dob ?? body.dateOfBirth);
	if (!parsedDob.ok) {
		return c.json(
			{
				success: false as const,
				error: parsedDob.error,
				details: null,
			},
			400,
		);
	}
	const db = drizzle(c.env.DB, { schema });

	const [existingUser] = await db
		.select()
		.from(schema.user)
		.where(eq(schema.user.id, userId))
		.limit(1);

	if (!existingUser) {
		return c.json(
			{
				success: false as const,
				error: "User not found",
				details: null,
			},
			404,
		);
	}

	const rawEmail = email?.trim().toLowerCase();
	const nextEmail =
		rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)
			? rawEmail
			: undefined;
	const updates: {
		name?: string;
		country?: string | null;
		mobileNumber?: string | null;
		dob?: string | null;
		email?: string;
		emailVerified?: boolean;
		image?: string | null;
	} = {};

	if (name !== undefined) {
		updates.name = name;
	}

	if (country !== undefined) {
		updates.country = country.trim() ? country.trim() : null;
	}
	if (mobileNumber !== undefined && mobileNumber.trim() !== "") {
		updates.mobileNumber = mobileNumber.trim();
	}
	if (image !== undefined) {
		updates.image = image.trim() ? image.trim() : null;
	}
	if (parsedDob.value !== undefined) {
		updates.dob = parsedDob.value;
	}

	if (nextEmail && nextEmail !== existingUser.email.toLowerCase()) {
		const [emailTaken] = await db
			.select({ id: schema.user.id })
			.from(schema.user)
			.where(eq(schema.user.email, nextEmail))
			.limit(1);

		if (emailTaken && emailTaken.id !== existingUser.id) {
			return c.json(
				{
					success: false as const,
					error: "Email already in use",
					details: null,
				},
				400,
			);
		}

		updates.email = nextEmail;
		updates.emailVerified = false;
	}

	const updatedUser =
		Object.keys(updates).length === 0
			? existingUser
			: (
					await db
						.update(schema.user)
						.set(updates)
						.where(eq(schema.user.id, userId))
						.returning()
				)[0];

	if (!updatedUser) {
		return c.json(
			{
				success: false as const,
				error: "User not found",
				details: null,
			},
			404,
		);
	}

	if (Object.keys(updates).length > 0) {
		await recordActivityForSession(
			c.env,
			session.adminId,
			adminActivityActions.updateUser,
		);
	}

	await syncWebengageUserProfile(c.env, updatedUser.id, c.executionCtx);

	return c.json(
		{
			success: true as const,
			data: {
				id: updatedUser.id,
				name: updatedUser.name,
				email: updatedUser.email,
				emailVerified: updatedUser.emailVerified,
				image: updatedUser.image,
				country: updatedUser.country,
				mobileNumber: updatedUser.mobileNumber,
				dob: updatedUser.dob ?? null,
				suspended: updatedUser.suspended,
				createdAt: toIsoTimestamp(updatedUser.createdAt),
				updatedAt: toIsoTimestamp(updatedUser.updatedAt),
				canEditProfile: updatedUser.profileSelfEditedAt == null,
			},
		},
		200,
	);
}

userRoute.openapi(updateUserByIdRoute, handleAdminUpdateUserProfile);
userRoute.openapi(updateUserProfileRoute, handleAdminUpdateUserProfile);

const ToggleSuspendedResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		id: z.string(),
		suspended: z.boolean(),
	}),
});

userRoute.openapi(
	createRoute({
		method: "patch",
		path: "/{userId}/suspended",
		tags: ["User"],
		summary: "Toggle user suspension",
		description: "Toggle a user's suspended state (admin only)",
		security: [{ BearerAuth: [] }],
		request: {
			params: z.object({
				userId: z.string(),
			}),
		},
		responses: {
			200: {
				description: "User suspension toggled successfully",
				content: {
					"application/json": {
						schema: ToggleSuspendedResponseSchema,
					},
				},
			},
			400: {
				description: "Invalid request",
				content: {
					"application/json": {
						schema: z.object({
							success: z.literal(false),
							error: z.string(),
						}),
					},
				},
			},
			401: {
				description: "Unauthorized - admin not authenticated",
				content: {
					"application/json": {
						schema: z.object({
							success: z.literal(false),
							error: z.string(),
						}),
					},
				},
			},
			403: {
				description: "Forbidden - super admin or admin only",
				content: {
					"application/json": {
						schema: z.object({
							success: z.literal(false),
							error: z.string(),
						}),
					},
				},
			},
			404: {
				description: "User not found",
				content: {
					"application/json": {
						schema: z.object({
							success: z.literal(false),
							error: z.string(),
						}),
					},
				},
			},
		},
	}),
	async (c) => {
		const token = getSessionToken(c.req.raw.headers);
		if (!token) {
			return c.json({ success: false as const, error: "Unauthorized" }, 401);
		}

		const session = await validateAdminSession(c.env, token);
		if (!session) {
			return c.json(
				{ success: false as const, error: "Forbidden - admin only" },
				403,
			);
		}

		if (session.role !== "super_admin" && session.role !== "admin") {
			return c.json(
				{
					success: false as const,
					error: "Forbidden - super admin or admin only",
				},
				403,
			);
		}

		if (
			session.role !== "super_admin" &&
			!requirePermission(session, "deactivate_account")
		) {
			return c.json(
				{
					success: false as const,
					error: "Forbidden - deactivate_account permission required",
				},
				403,
			);
		}

		const userId = c.req.param("userId");
		if (!userId) {
			return c.json(
				{ success: false as const, error: "User ID is required" },
				400,
			);
		}

		const db = drizzle(c.env.DB, { schema });

		const [existingUser] = await db
			.select()
			.from(schema.user)
			.where(eq(schema.user.id, userId))
			.limit(1);

		if (!existingUser) {
			return c.json({ success: false as const, error: "User not found" }, 404);
		}

		const newSuspendedState = !existingUser.suspended;

		const [updatedUser] = await db
			.update(schema.user)
			.set({ suspended: newSuspendedState })
			.where(eq(schema.user.id, userId))
			.returning();

		if (!updatedUser) {
			return c.json({ success: false as const, error: "User not found" }, 404);
		}

		await recordActivityForSession(
			c.env,
			session.adminId,
			updatedUser.suspended
				? adminActivityActions.suspendUser
				: adminActivityActions.reactivateUser,
		);

		return c.json(
			{
				success: true as const,
				data: {
					id: updatedUser.id,
					suspended: updatedUser.suspended,
				},
			},
			200,
		);
	},
);

const WalletOverviewResponseSchema = z
	.object({
		success: z.literal(true),
		data: z.object({
			currentBalance: z.number(),
			totalDeposits: z.number(),
			totalWithdrawals: z.number(),
			netPosition: z.number(),
		}),
	})
	.openapi("WalletOverviewResponse");

const getWalletOverviewRoute = createRoute({
	method: "get",
	path: "/{userId}/wallet/overview",
	tags: ["User"],
	summary: "Get user wallet overview (admin only)",
	security: [{ BearerAuth: [] }],
	request: {
		params: z.object({
			userId: z.string(),
		}),
		query: z.object({
			fromDate: z.string().optional(),
			toDate: z.string().optional(),
		}),
	},
	responses: {
		200: {
			description: "Wallet overview retrieved successfully",
			content: { "application/json": { schema: WalletOverviewResponseSchema } },
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: AdminErrorSchema } },
		},
		403: {
			description: "Forbidden",
			content: { "application/json": { schema: AdminErrorSchema } },
		},
	},
});

userRoute.openapi(getWalletOverviewRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token)
		return c.json({ success: false as const, error: "Unauthorized" }, 401);

	const session = await validateAdminSession(c.env, token);
	if (!session)
		return c.json(
			{ success: false as const, error: "Forbidden - admin only" },
			403,
		);
	if (session.role !== "super_admin" && session.role !== "admin") {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - super admin or admin only",
			},
			403,
		);
	}
	if (
		session.role !== "super_admin" &&
		!requirePermission(session, "view_player_details")
	) {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - view_player_details permission required",
			},
			403,
		);
	}

	const userId = c.req.param("userId");
	const { fromDate: fd, toDate: td } = c.req.valid("query");
	const { fromDate, toDate } = parseQueryDateRange({
		fromDate: fd,
		toDate: td,
	});

	const db = drizzle(c.env.DB, { schema });

	const [walletRow] = await db
		.select({ balance: schema.wallet.balance })
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, userId))
		.limit(1);

	const currentBalance = (walletRow?.balance ?? 0) / 100;

	const depositFilters = [
		eq(schema.walletTransaction.userId, userId),
		eq(schema.walletTransaction.type, "credit"),
		eq(schema.walletTransaction.status, "success"),
		notInArray(
			schema.walletTransaction.paymentMethod,
			EXCLUDED_OVERVIEW_PAYMENT_METHODS,
		),
	];
	if (fromDate)
		depositFilters.push(gte(schema.walletTransaction.createdAt, fromDate));
	if (toDate)
		depositFilters.push(lte(schema.walletTransaction.createdAt, toDate));

	const [depositResult] = await db
		.select({
			total: sql<number>`COALESCE(SUM(${schema.walletTransaction.amount}), 0)`,
		})
		.from(schema.walletTransaction)
		.where(and(...depositFilters));

	const totalDeposits = (depositResult?.total ?? 0) / 100;

	const withdrawalFilters = [
		eq(schema.walletTransaction.userId, userId),
		eq(schema.walletTransaction.type, "debit"),
		eq(schema.walletTransaction.status, "success"),
		notInArray(
			schema.walletTransaction.paymentMethod,
			EXCLUDED_OVERVIEW_PAYMENT_METHODS,
		),
	];
	if (fromDate)
		withdrawalFilters.push(gte(schema.walletTransaction.createdAt, fromDate));
	if (toDate)
		withdrawalFilters.push(lte(schema.walletTransaction.createdAt, toDate));

	const [withdrawalResult] = await db
		.select({
			total: sql<number>`COALESCE(SUM(${schema.walletTransaction.amount}), 0)`,
		})
		.from(schema.walletTransaction)
		.where(and(...withdrawalFilters));

	const totalWithdrawals = (withdrawalResult?.total ?? 0) / 100;
	const netPosition = totalDeposits - totalWithdrawals;

	return c.json(
		{
			success: true as const,
			data: { currentBalance, totalDeposits, totalWithdrawals, netPosition },
		},
		200,
	);
});

// ─── Wallet Transactions ───────────────────────────────────────────────────────

const WalletTransactionItemSchema = z.object({
	id: z.string(),
	type: z.string(),
	direction: z.enum(["credit", "debit"]),
	amount: z.number(),
	walletEffect: z.number(),
	balanceAfter: z.number().nullable(),
	purpose: z.string(),
	paymentMethod: z.string(),
	referenceId: z.string(),
	dateTime: z.string(),
	status: z.string(),
});

const WalletTransactionsResponseSchema = z
	.object({
		success: z.literal(true),
		data: z.object({
			transactions: z.array(WalletTransactionItemSchema),
			totalPages: z.number(),
			total: z.number(),
		}),
	})
	.openapi("WalletTransactionsResponse");

const getWalletTransactionsRoute = createRoute({
	method: "get",
	path: "/{userId}/wallet/transactions",
	tags: ["User"],
	summary: "Get user wallet transactions (admin only)",
	security: [{ BearerAuth: [] }],
	request: {
		params: z.object({
			userId: z.string(),
		}),
		query: z.object({
			page: z.string().optional(),
			limit: z.string().optional(),
			fromDate: z.string().optional(),
			toDate: z.string().optional(),
		}),
	},
	responses: {
		200: {
			description: "Wallet transactions retrieved successfully",
			content: {
				"application/json": { schema: WalletTransactionsResponseSchema },
			},
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: AdminErrorSchema } },
		},
		403: {
			description: "Forbidden",
			content: { "application/json": { schema: AdminErrorSchema } },
		},
	},
});

userRoute.openapi(getWalletTransactionsRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token)
		return c.json({ success: false as const, error: "Unauthorized" }, 401);

	const session = await validateAdminSession(c.env, token);
	if (!session)
		return c.json(
			{ success: false as const, error: "Forbidden - admin only" },
			403,
		);
	if (session.role !== "super_admin" && session.role !== "admin") {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - super admin or admin only",
			},
			403,
		);
	}
	if (
		session.role !== "super_admin" &&
		!requirePermission(session, "view_player_details")
	) {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - view_player_details permission required",
			},
			403,
		);
	}

	const userId = c.req.param("userId");
	const query = c.req.valid("query");
	const page = Math.max(1, Number.parseInt(query.page || "1", 10));
	const limit = Math.min(
		100,
		Math.max(1, Number.parseInt(query.limit || "10", 10)),
	);
	const offset = (page - 1) * limit;
	const { fromDate, toDate } = parseQueryDateRange({
		fromDate: query.fromDate,
		toDate: query.toDate,
	});

	const db = drizzle(c.env.DB, { schema });

	const filters = [eq(schema.walletTransaction.userId, userId)];
	if (fromDate) filters.push(gte(schema.walletTransaction.createdAt, fromDate));
	if (toDate) filters.push(lte(schema.walletTransaction.createdAt, toDate));

	const [countRow] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(schema.walletTransaction)
		.where(and(...filters));

	const total = Number(countRow?.count ?? 0);
	const totalPages = Math.ceil(total / limit);

	const rows = await db
		.select({
			id: schema.walletTransaction.id,
			amount: schema.walletTransaction.amount,
			type: schema.walletTransaction.type,
			reference: schema.walletTransaction.reference,
			status: schema.walletTransaction.status,
			paymentMethod: schema.walletTransaction.paymentMethod,
			balance: schema.walletTransaction.balance,
			metadata: schema.walletTransaction.metadata,
			createdAt: schema.walletTransaction.createdAt,
		})
		.from(schema.walletTransaction)
		.where(and(...filters))
		.orderBy(desc(schema.walletTransaction.createdAt))
		.limit(limit)
		.offset(offset);

	const transactions = rows.map((row) => {
		const direction = row.type === "debit" ? "debit" : "credit";
		const amount = Math.abs(row.amount) / 100;
		const type =
			row.paymentMethod === "manual"
				? `manual_${direction}`
				: direction === "credit"
					? "deposit"
					: "withdrawal";
		return {
			id: row.id,
			type,
			direction,
			amount,
			walletEffect: direction === "debit" ? -amount : amount,
			balanceAfter: row.balance === null ? null : row.balance / 100,
			purpose: readableWalletActivityPurpose(row),
			paymentMethod: row.paymentMethod,
			referenceId: row.reference ?? "",
			dateTime: toWAT(row.createdAt),
			status: row.status,
		};
	});

	return c.json(
		{
			success: true as const,
			data: { transactions, totalPages, total },
		},
		200,
	);
});

const ManualTransactionSchema = z
	.object({
		type: z.enum(["credit", "debit"]),
		amount: z.number().positive(),
		reason: z.string().min(1),
		/** Client-generated key; retries with the same key must not double-credit. */
		idempotencyKey: z.string().min(8).max(128).optional(),
	})
	.openapi("ManualTransaction");

const ManualTransactionResponseSchema = z
	.object({
		success: z.literal(true),
		data: z.object({
			transactionId: z.string(),
			newBalance: z.number(),
		}),
	})
	.openapi("ManualTransactionResponse");

function isUniqueConstraintError(error: unknown): boolean {
	let current: unknown = error;
	for (let i = 0; i < 5 && current; i++) {
		const message =
			current instanceof Error ? current.message : String(current);
		if (
			message.includes("UNIQUE constraint failed") ||
			(message.includes("D1_ERROR") && message.toUpperCase().includes("UNIQUE"))
		) {
			return true;
		}
		current =
			current instanceof Error && "cause" in current
				? current.cause
				: undefined;
	}
	return false;
}

function manualReferenceFromKey(idempotencyKey: string | undefined): string {
	if (idempotencyKey) {
		return idempotencyKey.startsWith("manual_")
			? idempotencyKey
			: `manual_${idempotencyKey}`;
	}
	return `manual_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

const postManualTransactionRoute = createRoute({
	method: "post",
	path: "/{userId}/wallet/manual",
	tags: ["User"],
	summary: "Manual wallet credit/debit (admin only)",
	security: [{ BearerAuth: [] }],
	request: {
		params: z.object({
			userId: z.string(),
		}),
		body: {
			content: { "application/json": { schema: ManualTransactionSchema } },
		},
	},
	responses: {
		200: {
			description: "Manual transaction processed successfully",
			content: {
				"application/json": { schema: ManualTransactionResponseSchema },
			},
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: AdminErrorSchema } },
		},
		403: {
			description: "Forbidden",
			content: { "application/json": { schema: AdminErrorSchema } },
		},
		404: {
			description: "Not found",
			content: { "application/json": { schema: AdminErrorSchema } },
		},
		400: {
			description: "Invalid request",
			content: { "application/json": { schema: AdminErrorSchema } },
		},
		500: {
			description: "Server error before money moved",
			content: { "application/json": { schema: AdminErrorSchema } },
		},
	},
});

userRoute.openapi(postManualTransactionRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token)
		return c.json({ success: false as const, error: "Unauthorized" }, 401);

	const session = await validateAdminSession(c.env, token);
	if (!session)
		return c.json(
			{ success: false as const, error: "Forbidden - admin only" },
			403,
		);
	if (session.role !== "super_admin" && session.role !== "admin") {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - super admin or admin only",
			},
			403,
		);
	}
	if (
		session.role !== "super_admin" &&
		!requirePermission(session, "manual_credit_debit")
	) {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - view_player_details permission required",
			},
			403,
		);
	}

	const userId = c.req.param("userId");
	const body = c.req.valid("json");
	const db = drizzle(c.env.DB, { schema });
	const reference = manualReferenceFromKey(body.idempotencyKey);

	const [existingUser] = await db
		.select({
			id: schema.user.id,
			name: schema.user.name,
			email: schema.user.email,
			mobileNumber: schema.user.mobileNumber,
		})
		.from(schema.user)
		.where(eq(schema.user.id, userId))
		.limit(1);

	if (!existingUser) {
		return c.json({ success: false as const, error: "User not found" }, 404);
	}

	const [walletRow] = await db
		.select({ id: schema.wallet.id, balance: schema.wallet.balance })
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, userId))
		.limit(1);

	if (!walletRow) {
		return c.json({ success: false as const, error: "Wallet not found" }, 404);
	}

	const amountInKobo = Math.round(body.amount * 100);
	const oldBalanceKobo = walletRow.balance;

	const [existingByRef] = await db
		.select({
			id: schema.walletTransaction.id,
			balance: schema.walletTransaction.balance,
			status: schema.walletTransaction.status,
		})
		.from(schema.walletTransaction)
		.where(eq(schema.walletTransaction.reference, reference))
		.limit(1);

	if (existingByRef?.status === "success") {
		const [liveWallet] = await db
			.select({ balance: schema.wallet.balance })
			.from(schema.wallet)
			.where(eq(schema.wallet.userId, userId))
			.limit(1);
		return c.json(
			{
				success: true as const,
				data: {
					transactionId: existingByRef.id,
					newBalance:
						(liveWallet?.balance ?? existingByRef.balance ?? oldBalanceKobo) /
						100,
				},
			},
			200,
		);
	}

	const txnId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
	const provisionalBalance =
		body.type === "credit"
			? oldBalanceKobo + amountInKobo
			: oldBalanceKobo - amountInKobo;

	try {
		await db.insert(schema.walletTransaction).values({
			id: txnId,
			userId,
			amount: amountInKobo,
			type: body.type,
			reference,
			status: "pending",
			paymentMethod: "manual",
			balance: provisionalBalance,
			metadata: JSON.stringify({
				reason: body.reason,
				processedBy: session.adminId,
				description: `Manual ${body.type} - ${body.reason}`,
				idempotencyKey: body.idempotencyKey ?? null,
			}),
			createdAt: new Date(),
		});
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			const [raced] = await db
				.select({
					id: schema.walletTransaction.id,
					balance: schema.walletTransaction.balance,
					status: schema.walletTransaction.status,
				})
				.from(schema.walletTransaction)
				.where(eq(schema.walletTransaction.reference, reference))
				.limit(1);
			if (raced?.status === "success") {
				const [liveWallet] = await db
					.select({ balance: schema.wallet.balance })
					.from(schema.wallet)
					.where(eq(schema.wallet.userId, userId))
					.limit(1);
				return c.json(
					{
						success: true as const,
						data: {
							transactionId: raced.id,
							newBalance:
								(liveWallet?.balance ?? raced.balance ?? oldBalanceKobo) / 100,
						},
					},
					200,
				);
			}
			// Another request holds the claim and may not have settled yet.
			return c.json(
				{
					success: false as const,
					error: "Transaction already in progress. Try again shortly.",
				},
				500,
			);
		}
		throw error;
	}

	let updatedWallet: { balance: number } | undefined;
	try {
		updatedWallet =
			body.type === "credit"
				? await creditWallet(db, userId, amountInKobo)
				: await debitWallet(db, userId, amountInKobo);
		if (!updatedWallet) {
			await db
				.delete(schema.walletTransaction)
				.where(eq(schema.walletTransaction.id, txnId));
			return c.json(
				{
					success: false as const,
					error: "Insufficient balance or wallet update failed",
				},
				400,
			);
		}
	} catch (error) {
		try {
			await db
				.delete(schema.walletTransaction)
				.where(eq(schema.walletTransaction.id, txnId));
		} catch {
			// Keep the wallet error; the claim must not block a later retry.
		}
		throw error;
	}

	const committedBalance = updatedWallet.balance;
	await db
		.update(schema.walletTransaction)
		.set({
			status: "success",
			balance: committedBalance,
		})
		.where(eq(schema.walletTransaction.id, txnId));

	try {
		await recordActivityForSession(
			c.env,
			session.adminId,
			body.type === "credit"
				? adminActivityActions.manualCredit
				: adminActivityActions.manualDebit,
			{
				targetUser: {
					id: existingUser.id,
					name: existingUser.name,
					email: existingUser.email,
					username: existingUser.mobileNumber,
				},
				details: {
					transactionType: body.type,
					amount: body.amount,
					currency: "NGN",
					reason: body.reason,
					transactionId: txnId,
					balanceAfter: committedBalance / 100,
				},
			},
		);
	} catch (error) {
		console.error("Failed to record admin activity after manual wallet txn", {
			reference,
			txnId,
			error: error instanceof Error ? error.message : String(error),
		});
	}

	return c.json(
		{
			success: true as const,
			data: {
				transactionId: txnId,
				newBalance: committedBalance / 100,
			},
		},
		200,
	);
});

export default userRoute;
