import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { ErrorResponseSchema } from "@/schemas";
import { verifyHellodutySecret } from "@/utils/helloduty-auth";
import {
	findContactByPhone,
	saveAlternativePhone,
	type HellodutyContact,
} from "@/utils/helloduty-contacts";
import { normalizeNigerianPhone } from "@/utils/nigerian-phone";
import type { CloudflareBindings } from "../types";

const hellodutyRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

hellodutyRoute.use("*", async (c, next) => {
	if (c.req.method !== "POST") {
		await next();
		return;
	}

	const envSecret = c.env.HELLODUTY_API_SECRET;
	if (!envSecret?.trim()) {
		return c.json(
			{
				success: false as const,
				error: "Authentication failure: HELLODUTY_API_SECRET is not set on this Worker",
				details: null,
			},
			401,
		);
	}

	const ok = verifyHellodutySecret({
		expectedSecret: envSecret,
		authorizationHeader: c.req.header("Authorization"),
		xHellodutySecretHeader: c.req.header("X-HelloDuty-Secret"),
	});
	if (!ok) {
		return c.json(
			{
				success: false as const,
				error:
					"Authorization failure: X-HelloDuty-Secret / Authorization Bearer did not match HELLODUTY_API_SECRET",
				details: null,
			},
			403,
		);
	}

	await next();
});

const ContactSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		email: z.string(),
		phone: z.string().nullable(),
		alternativePhones: z.array(z.string()),
		verificationStatus: z.string(),
		suspended: z.boolean(),
	})
	.openapi("HellodutyContact");

const LookupRequestSchema = z
	.object({
		phone: z.string().optional(),
		phoneNumber: z.string().optional(),
		msisdn: z.string().optional(),
	})
	.openapi("HellodutyLookupRequest");

const AlternativeRequestSchema = z
	.object({
		contactId: z.string().optional(),
		phone: z.string().optional(),
		alternativePhone: z.string().optional(),
		alternativeNumber: z.string().optional(),
	})
	.openapi("HellodutyAlternativeRequest");

function lookupPhoneFromBody(body: {
	phone?: string;
	phoneNumber?: string;
	msisdn?: string;
}): string | null {
	const raw = body.phone ?? body.phoneNumber ?? body.msisdn;
	const trimmed = typeof raw === "string" ? raw.trim() : "";
	return trimmed || null;
}

function jsonError(
	c: Parameters<Parameters<typeof hellodutyRoute.openapi>[1]>[0],
	status: 400 | 401 | 403 | 404 | 409 | 503,
	error: string,
) {
	return c.json({ success: false as const, error, details: null }, status);
}

function jsonContact(
	c: Parameters<Parameters<typeof hellodutyRoute.openapi>[1]>[0],
	contact: HellodutyContact,
) {
	return c.json({ success: true as const, data: { found: true as const, contact } });
}

const lookupRoute = createRoute({
	method: "post",
	path: "/contacts/lookup",
	tags: ["HelloDuty"],
	summary: "Look up a SportsDey contact by phone",
	description:
		"HelloDuty CRM lookup. Returns a contact only if the phone is already on a SportsDey user (primary or alternative). Never creates users. Auth: Authorization Bearer HELLODUTY_API_SECRET (or X-HelloDuty-Secret).",
	request: {
		body: {
			required: true,
			content: { "application/json": { schema: LookupRequestSchema } },
		},
	},
	responses: {
		200: {
			description: "Contact found",
			content: {
				"application/json": {
					schema: z.object({
						success: z.literal(true),
						data: z.object({
							found: z.literal(true),
							contact: ContactSchema,
						}),
					}),
				},
			},
		},
		400: {
			description: "Invalid phone",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		401: {
			description: "Secret not bound",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		403: {
			description: "Secret mismatch",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		404: {
			description: "Phone is not a SportsDey user",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

const alternativeRoute = createRoute({
	method: "post",
	path: "/contacts/alternative-number",
	tags: ["HelloDuty"],
	summary: "Save an alternative phone on an existing contact",
	description:
		"HelloDuty writes a second number onto a contact that already exists in SportsDey. Does not create users. Auth: Authorization Bearer HELLODUTY_API_SECRET (or X-HelloDuty-Secret).",
	request: {
		body: {
			required: true,
			content: { "application/json": { schema: AlternativeRequestSchema } },
		},
	},
	responses: {
		200: {
			description: "Alternative number saved",
			content: {
				"application/json": {
					schema: z.object({
						success: z.literal(true),
						data: z.object({
							found: z.literal(true),
							contact: ContactSchema,
						}),
					}),
				},
			},
		},
		400: {
			description: "Invalid request",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		401: {
			description: "Secret not bound",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		403: {
			description: "Secret mismatch",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		404: {
			description: "Contact not found",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		409: {
			description: "Phone belongs to another user",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		503: {
			description: "Alternative-number table not migrated yet",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

hellodutyRoute.openapi(lookupRoute, async (c) => {
	const body = c.req.valid("json");
	const rawPhone = lookupPhoneFromBody(body);
	if (!rawPhone) {
		return jsonError(c, 400, "phone is required");
	}
	if (!normalizeNigerianPhone(rawPhone)) {
		return jsonError(c, 400, "Invalid phone number");
	}

	const db = drizzle(c.env.DB, { schema });
	const contact = await findContactByPhone(db, rawPhone);
	if (!contact) {
		return jsonError(c, 404, "Contact not found");
	}
	return jsonContact(c, contact);
});

hellodutyRoute.openapi(alternativeRoute, async (c) => {
	const body = c.req.valid("json");
	const alternativePhone = (
		body.alternativePhone ??
		body.alternativeNumber ??
		""
	).trim();
	const contactId = body.contactId?.trim() || undefined;
	const existingPhone = body.phone?.trim() || undefined;

	if (!alternativePhone) {
		return jsonError(c, 400, "alternativePhone is required");
	}
	if (!contactId && !existingPhone) {
		return jsonError(c, 400, "contactId or phone is required");
	}

	const db = drizzle(c.env.DB, { schema });
	const result = await saveAlternativePhone(db, {
		contactId,
		existingPhone,
		alternativePhone,
	});

	if (result.ok) return jsonContact(c, result.contact);

	if (result.error === "invalid_phone") {
		return jsonError(c, 400, "Invalid phone number");
	}
	if (result.error === "contact_not_found") {
		return jsonError(c, 404, "Contact not found");
	}
	if (result.error === "phone_taken") {
		return jsonError(c, 409, "Phone number belongs to another contact");
	}
	return jsonError(
		c,
		503,
		"Alternative numbers are unavailable until the user_phone_number migration is applied",
	);
});

export default hellodutyRoute;
