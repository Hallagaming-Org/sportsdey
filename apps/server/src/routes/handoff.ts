import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { ErrorResponseSchema, successResponseSchema } from "@/schemas";
import {
	buildHandoffPayload,
	computeHashedClientId,
	computeSsoExchangeToken,
	safeCompare,
	generateHandoffCode,
	getHandoffKvNamespace,
	HANDOFF_TTL_SECONDS,
	handoffKey,
	isValidHandoffCodeFormat,
	parseHandoffPayload,
} from "@/utils/handoff";
import { jsonZodErrorFormatter } from "@/utils/zod";
import type { CloudflareBindings } from "../types";

const handoffRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

/**
 * Single generic failure for every exchange rejection: a caller must not be
 * able to tell a bad code from a bad token from an unknown user.
 */
const EXCHANGE_REJECTED = "Invalid or expired handoff credentials";

function toIsoTimestamp(value: Date | string | number): string {
	if (value instanceof Date) return value.toISOString();
	return String(value);
}

/* -------------------------------------------------------------------------- */
/* POST /handoff/code — authenticated, issues a short-lived code               */
/* -------------------------------------------------------------------------- */

const HandoffCodeSchema = z.object({
	code: z.string().openapi({
		description: "Opaque single-use handoff code (64 hex chars / 32 bytes)",
	}),
	expiresIn: z.number().openapi({
		description: "Seconds until the code is discarded by KV",
	}),
	hashedClientId: z.string().openapi({
		description:
			"sha256(PREDICTION_SPORTSDEY_CLIENT_ID), hex. Identifies the client " +
			"without exposing the raw id. Never the exchange token.",
	}),
});

const createHandoffCodeRoute = createRoute({
	method: "post",
	path: "/code",
	tags: ["Handoff"],
	summary: "Issue a short-lived handoff code for the authenticated player",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Handoff code issued",
			content: {
				"application/json": {
					schema: successResponseSchema(HandoffCodeSchema),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		503: {
			description: "KV namespace not bound",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

handoffRoute.openapi(createHandoffCodeRoute, async (c) => {
	const user = c.get("user");
	if (!user?.id) {
		return c.json(
			{ success: false as const, error: "Unauthorized", details: null },
			401,
		);
	}

	const kv = getHandoffKvNamespace(c.env);
	if (!kv) {
		return c.json(
			{
				success: false as const,
				error: "Handoff storage is not configured",
				details: null,
			},
			503,
		);
	}

	const clientId = c.env.PREDICTION_SPORTSDEY_CLIENT_ID;
	if (!clientId) {
		console.error("[handoff] PREDICTION_SPORTSDEY_CLIENT_ID is not set");
		return c.json(
			{
				success: false as const,
				error: "Handoff storage is not configured",
				details: null,
			},
			503,
		);
	}

	const code = generateHandoffCode();
	await kv.put(handoffKey(code), JSON.stringify(buildHandoffPayload(user.id)), {
		expirationTtl: HANDOFF_TTL_SECONDS,
	});

	return c.json(
		{
			success: true as const,
			data: {
				code,
				expiresIn: HANDOFF_TTL_SECONDS,
				// Hash of the id only — the secret is never mixed in here.
				hashedClientId: computeHashedClientId(clientId),
			},
		},
		200,
	);
});

/* -------------------------------------------------------------------------- */
/* POST /public/handoff/exchange — PUBLIC, server-to-server (Halla backend)    */
/* -------------------------------------------------------------------------- */

/** Mounted separately under /public so the path itself marks it unauthenticated. */
const handoffPublicRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const ExchangeRequestSchema = z
	.object({
		code: z.string().min(1).openapi({ description: "Opaque handoff code" }),
		sso_exchange_token: z
			.string()
			.min(1)
			.openapi({ description: "sha256(clientId + clientSecret), hex" }),
	})
	.openapi("HandoffExchangeRequest");

const ExchangeUserSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		email: z.string(),
		emailVerified: z.boolean(),
		image: z.string().nullable(),
		country: z.string().nullable(),
		mobileNumber: z.string().nullable(),
		dob: z.string().nullable().optional(),
		suspended: z.boolean(),
		createdAt: z.string(),
		updatedAt: z.string(),
		verificationStatus: z.string().optional(),
		canEditProfile: z.boolean().optional(),
	})
	.openapi("HandoffExchangeUser");

const exchangeHandoffRoute = createRoute({
	method: "post",
	path: "/exchange",
	tags: ["Handoff Public"],
	summary: "Exchange a handoff code for the associated user profile",
	description:
		"Public server-to-server endpoint. Authorization comes from the opaque " +
		"code plus sso_exchange_token — never from a user session.",
	request: {
		body: {
			content: { "application/json": { schema: ExchangeRequestSchema } },
		},
	},
	responses: {
		200: {
			description: "Handoff code exchanged",
			content: {
				"application/json": {
					schema: successResponseSchema(z.object({ user: ExchangeUserSchema })),
				},
			},
		},
		400: {
			description: "Malformed request body",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		401: {
			description: "Invalid or expired credentials",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		500: {
			description: "Unexpected server error",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

handoffPublicRoute.openapi(
	exchangeHandoffRoute,
	async (c) => {
		// No session is read here by design — this endpoint is called machine-to-machine.
		const { code, sso_exchange_token: presentedToken } = c.req.valid("json");

		const clientId = c.env.PREDICTION_SPORTSDEY_CLIENT_ID;
		const clientSecret = c.env.PREDICTION_SPORTSDEY_CLIENT_SECRET;
		if (!clientId || !clientSecret) {
			// Misconfiguration, not a caller error — do not hint at credentials.
			console.error("[handoff] Prediction SSO client credentials are not set");
			return c.json(
				{
					success: false as const,
					error: "Handoff exchange is not configured",
					details: null,
				},
				500,
			);
		}

		// Shape check before touching KV, so junk never becomes a lookup.
		if (!isValidHandoffCodeFormat(code)) {
			return c.json(
				{ success: false as const, error: EXCHANGE_REJECTED, details: null },
				401,
			);
		}

		const kv = getHandoffKvNamespace(c.env);
		if (!kv) {
			console.error("[handoff] KV namespace is not bound");
			return c.json(
				{
					success: false as const,
					error: "Handoff exchange is not configured",
					details: null,
				},
				500,
			);
		}

		try {
			// 1. Validate the opaque code. An expired record is already gone from KV.
			const payload = parseHandoffPayload(await kv.get(handoffKey(code)));
	
			if (!payload) {
				return c.json(
					{ success: false as const, error: EXCHANGE_REJECTED, details: null },
					401,
				);
			}

			// 2. Only then verify the shared-secret token, in constant time.
			const expectedToken = computeSsoExchangeToken(clientId, clientSecret);

			if (!safeCompare(expectedToken, presentedToken)) {
				// Code is deliberately left in KV — a wrong token must not burn it.
				return c.json(
					{ success: false as const, error: EXCHANGE_REJECTED, details: null },
					401,
				);
			}

			// 3. Resolve the user the code was minted for.
			const db = drizzle(c.env.DB, { schema });
			const [existingUser] = await db
				.select()
				.from(schema.user)
				.where(eq(schema.user.id, payload.userId))
				.limit(1);

			if (!existingUser) {
				return c.json(
					{ success: false as const, error: EXCHANGE_REJECTED, details: null },
					401,
				);
			}

			// 4. Consume the code — success makes it single-use.
			await kv.delete(handoffKey(code));

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
		} catch (error) {
			// Never echo the code or the token into logs.
			console.error(
				"[handoff] Exchange failed:",
				error instanceof Error ? error.message : "unknown error",
			);
			return c.json(
				{
					success: false as const,
					error: "Internal server error",
					details: null,
				},
				500,
			);
		}
	},
	jsonZodErrorFormatter,
);

export { handoffPublicRoute };
export default handoffRoute;
