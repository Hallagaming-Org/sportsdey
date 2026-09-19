/**
 * Admin: on-demand wallet ↔ ledger reconciliation.
 *
 * GET /admin/reconciliation/wallets — recompute expected balances from ledger
 * sums for recently-active users (or specific userIds) and report drift.
 * Read-only; never mutates balances. The hourly cron runs the same check and
 * logs `wallet_reconciliation_drift` events.
 */
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import { requirePermission } from "@/middleware/admin-permissions";
import { ErrorResponseSchema, successResponseSchema } from "@/schemas";
import { runWalletReconciliation } from "@/services/wallet-reconciliation";
import type { CloudflareBindings } from "../types";

type AdminRouteContext = { Bindings: CloudflareBindings };

const adminReconciliationRoute = new OpenAPIHono<AdminRouteContext>();

const ReconciliationQuerySchema = z.object({
	userIds: z
		.string()
		.optional()
		.openapi({ description: "Comma-separated user ids to check directly" }),
	sinceHours: z
		.string()
		.regex(/^\d+$/)
		.optional()
		.openapi({ description: "Activity window in hours (default 26)" }),
	maxUsers: z
		.string()
		.regex(/^\d+$/)
		.optional()
		.openapi({ description: "Max wallets to check (default 100, cap 500)" }),
});

const WalletDriftSchema = z.object({
	userId: z.string(),
	balanceKobo: z.number(),
	expectedKobo: z.number(),
	driftKobo: z.number(),
	walletLedgerKobo: z.number(),
	swipeLedgerKobo: z.number(),
	unknownTypeCount: z.number(),
});

const ReconciliationReportSchema = z.object({
	checkedUsers: z.number(),
	driftedUsers: z.array(WalletDriftSchema),
	sinceIso: z.string(),
});

const reconcileWalletsRoute = createRoute({
	method: "get",
	path: "/reconciliation/wallets",
	tags: ["Admin - Reconciliation"],
	summary: "Compare wallet balances against signed ledger sums",
	description:
		"Recomputes each wallet's expected balance from wallet_transaction (+ Swipe Games ledger) and reports drift. Read-only.",
	security: [{ BearerAuth: [] }],
	request: { query: ReconciliationQuerySchema },
	responses: {
		200: {
			description: "Reconciliation report",
			content: {
				"application/json": {
					schema: successResponseSchema(ReconciliationReportSchema),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		403: {
			description: "Forbidden",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

adminReconciliationRoute.openapi(reconcileWalletsRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json(
			{ success: false as const, error: "Unauthorized", details: null },
			401,
		);
	}

	const session = await validateAdminSession(c.env, token);
	if (
		!session ||
		(session.role !== "admin" && session.role !== "super_admin")
	) {
		return c.json(
			{ success: false as const, error: "Forbidden - admin only", details: null },
			403,
		);
	}

	if (session.role !== "super_admin" && !requirePermission(session, "general")) {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - general permission required",
				details: null,
			},
			403,
		);
	}

	const query = c.req.valid("query");
	const sinceHours = query.sinceHours
		? Number.parseInt(query.sinceHours, 10)
		: undefined;
	const maxUsers = query.maxUsers
		? Math.min(Number.parseInt(query.maxUsers, 10), 500)
		: undefined;
	const report = await runWalletReconciliation(c.env, {
		userIds: query.userIds
			? query.userIds
					.split(",")
					.map((id) => id.trim())
					.filter(Boolean)
			: undefined,
		sinceMs: sinceHours ? sinceHours * 60 * 60 * 1000 : undefined,
		maxUsers,
	});

	return c.json(
		{
			success: true as const,
			message: "Wallet reconciliation completed",
			data: report,
		},
		200,
	);
});

export default adminReconciliationRoute;
