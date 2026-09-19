import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { CloudflareBindings } from "../types";

const hashcodexRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

/**
 * SECURITY: this route is intentionally disabled.
 *
 * The previous implementation let ANY authenticated user credit their own
 * main wallet (`{ action: "credit", amount }`) with no provider signature,
 * no idempotency key, and an unconditional `amount * 100` conversion — an
 * open self-credit exploit (money printer) plus a 100x unit inflation bug.
 *
 * Sportsdey Crash wallet integration must be rebuilt as a server-to-server
 * callback before this route returns:
 * - HMAC (or equivalent) signature from the Hashcodex backend, never a user session
 * - a provider transaction id claimed via unique insert BEFORE any wallet mutation
 *   (see `settleWithClaim` in services/casino-settlement.ts)
 * - amounts normalized exactly once via `toKobo` in utils/casino-money.ts
 * - WIN credits require a prior matching BET debit
 *
 * Until that ships, Sportsdey Crash is offline for real money.
 * Bonus-engine bet-result reporting for Crash cannot be attached here while
 * the wallet path is disabled.
 */

const DepositSchema = z
	.object({
		action: z
			.enum(["credit", "debit"])
			.openapi({ description: "credit to add funds, debit to remove funds" }),
		amount: z.number().positive().openapi({ description: "Amount in kobo" }),
	})
	.openapi("HashcodexDepositSchema");

const DepositErrorSchema = z
	.object({
		success: z.literal(false).openapi({ description: "Error status" }),
		error: z.string().openapi({ description: "Error message" }),
		details: z.nullable(z.any()).openapi({ description: "Error details" }),
	})
	.openapi("HashcodexDepositErrorSchema");

const depositRoute = createRoute({
	method: "post",
	path: "/deposit",
	tags: ["Hashcodex"],
	summary: "Disabled — Sportsdey Crash wallet integration is offline",
	description:
		"Disabled pending a signed server-to-server rework. The previous user-session credit path was a self-credit vulnerability.",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: DepositSchema,
				},
			},
		},
	},
	responses: {
		503: {
			description: "Route disabled for security rework",
			content: {
				"application/json": {
					schema: DepositErrorSchema,
				},
			},
		},
	},
});

hashcodexRoute.openapi(depositRoute, async (c) => {
	console.warn(
		JSON.stringify({
			tag: "money_movement",
			provider: "hashcodex",
			action: "rejected_disabled_route",
			userId: c.get("user")?.id ?? null,
		}),
	);
	return c.json(
		{
			success: false as const,
			error:
				"Sportsdey Crash wallet transactions are temporarily disabled for maintenance.",
			details: null,
		},
		503,
	);
});

export default hashcodexRoute;
