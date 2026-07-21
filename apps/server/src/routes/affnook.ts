import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
	AffnookSyncErrorSchema,
	AffnookSyncRequestSchema,
	AffnookSyncSuccessSchema,
} from "@/schemas/affnook";
import {
	createAffnookCustomer,
	isAffnookConfigured,
	recordAffnookCustomerLogin,
} from "@/services/affnook";
import { extractAffnookMessage } from "@/services/affnook/client";
import { parseUserAgentMeta } from "@/utils/affnook";
import type { CloudflareBindings } from "../types";

function affnookResultMessage(
	result: { data?: unknown; error?: string; message?: string },
	fallback: string,
) {
	if (result.message?.trim()) return result.message;
	if (result.error?.trim()) return result.error;
	return extractAffnookMessage(result.data, fallback);
}

const affnookRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const syncRoute = createRoute({
	method: "post",
	path: "/sync",
	tags: ["Affnook"],
	summary: "Sync registration or login events to Affnook",
	request: {
		body: {
			content: {
				"application/json": {
					schema: AffnookSyncRequestSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Sync accepted",
			content: {
				"application/json": {
					schema: AffnookSyncSuccessSchema,
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: AffnookSyncErrorSchema,
				},
			},
		},
		400: {
			description: "Bad request",
			content: {
				"application/json": {
					schema: AffnookSyncErrorSchema,
				},
			},
		},
		502: {
			description: "Affnook upstream error",
			content: {
				"application/json": {
					schema: AffnookSyncErrorSchema,
				},
			},
		},
		503: {
			description: "Affnook not configured",
			content: {
				"application/json": {
					schema: AffnookSyncErrorSchema,
				},
			},
		},
	},
});

affnookRoute.openapi(syncRoute, async (c) => {
	const user = c.get("user");
	if (!user?.id) {
		return c.json(
			{ success: false as const, error: "Unauthorized" },
			401,
		);
	}

	if (!isAffnookConfigured(c.env)) {
		return c.json(
			{
				success: false as const,
				error: "Affnook is not configured. Set AFFNOOK_API_KEY.",
			},
			503,
		);
	}

	const parsed = AffnookSyncRequestSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json(
			{
				success: false as const,
				error: "Invalid request body",
				details: parsed.error.flatten(),
			},
			400,
		);
	}

	const { event, trackingToken, promocode, country, city } = parsed.data;
	const userAgent = c.req.header("user-agent") || undefined;
	const ip =
		c.req.header("cf-connecting-ip") ||
		c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
		undefined;
	const { browser, os } = parseUserAgentMeta(userAgent);

	if (event === "registration") {
		const result = await createAffnookCustomer(c.env, {
			customerId: user.id,
			customerName: user.name || user.email || user.id,
			email: user.email,
			trackingToken,
			promocode,
			country: country || "NG",
			currency: "NGN",
			ip,
			city,
		});

		if (!result.ok) {
			console.error("Affnook registration sync failed:", result.status, result.error);
			return c.json(
				{
					success: false as const,
					error: affnookResultMessage(
						result,
						"Failed to sync registration to Affnook",
					),
					details: result.data ?? null,
				},
				502,
			);
		}

		return c.json(
			{
				success: true as const,
				data: {
					event,
					synced: true,
					message: affnookResultMessage(
						result,
						"Registration synced to Affnook",
					),
				},
			},
			200,
		);
	}

	const loginResult = await recordAffnookCustomerLogin(c.env, {
		customerId: user.id,
		browser,
		os,
		ip,
		country,
		city,
		userAgent,
	});

	if (!loginResult.ok) {
		console.error("Affnook login sync failed:", loginResult.status, loginResult.error);
		return c.json(
			{
				success: false as const,
				error: affnookResultMessage(
					loginResult,
					"Failed to sync login to Affnook",
				),
				details: loginResult.data ?? null,
			},
			502,
		);
	}

	return c.json(
		{
			success: true as const,
			data: {
				event,
				synced: true,
				message: affnookResultMessage(loginResult, "Login synced to Affnook"),
			},
		},
		200,
	);
});

export default affnookRoute;
