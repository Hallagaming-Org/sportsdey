import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
	WebEngageSmsAcceptedSchema,
	WebEngageSmsRejectedSchema,
	WebEngageSmsRequestSchema,
} from "@/schemas/webengage-sms";
import {
	normalizeSmsPhoneNumber,
	sendBulkSmsWithAfricaTalking,
} from "@/utils/africastalking";
import { getSmsKv, storeWebengageSmsMapping } from "@/utils/webengage-dlr";
import { verifyWebengageSmsSecret } from "@/utils/webengage-sms-auth";
import type { CloudflareBindings } from "../types";

const webengageSmsRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>({
	defaultHook: (result, c) => {
		if (result.success) return;
		return c.json(
			{
				status: "sms_rejected" as const,
				statusCode: 9988,
				message: "Invalid request payload",
			},
			400,
		);
	},
});

const MAX_BODY_LENGTH = 1600;

/** Auth runs before Zod so missing Authorization returns 401, not 400. */
webengageSmsRoute.use("*", async (c, next) => {
	if (c.req.method !== "POST") {
		await next();
		return;
	}

	if (!c.env.WEBENGAGE_API_SECRET?.trim()) {
		console.error(
			"WebEngage SMS webhook: WEBENGAGE_API_SECRET is not configured",
		);
		return c.json(
			{
				status: "sms_rejected" as const,
				statusCode: 2011,
				message: "Webhook secret is not configured",
			},
			401,
		);
	}

	const ok = verifyWebengageSmsSecret({
		expectedSecret: c.env.WEBENGAGE_API_SECRET,
		authorizationHeader: c.req.header("Authorization"),
		xWebEngageSecretHeader: c.req.header("X-WebEngage-Secret"),
	});

	if (!ok) {
		return c.json(
			{
				status: "sms_rejected" as const,
				statusCode: 2011,
				message: "Authentication failure",
			},
			401,
		);
	}

	await next();
});

const sendSmsRoute = createRoute({
	method: "post",
	path: "/sms",
	tags: ["WebEngage"],
	summary: "WebEngage SSP SMS webhook",
	description:
		"Receives WebEngage SMS campaign/journey payloads and forwards them via Africa's Talking Bulk SMS. Auth: Authorization Bearer WEBENGAGE_API_SECRET (or X-WebEngage-Secret).",
	request: {
		body: {
			required: true,
			content: {
				"application/json": { schema: WebEngageSmsRequestSchema },
			},
		},
	},
	responses: {
		200: {
			description: "Accepted or provider soft-reject (WebEngage SSP contract)",
			content: {
				"application/json": {
					schema: WebEngageSmsAcceptedSchema.or(WebEngageSmsRejectedSchema),
				},
			},
		},
		400: {
			description: "Invalid payload",
			content: {
				"application/json": { schema: WebEngageSmsRejectedSchema },
			},
		},
		401: {
			description: "Authentication failure",
			content: {
				"application/json": { schema: WebEngageSmsRejectedSchema },
			},
		},
		413: {
			description: "Message too long",
			content: {
				"application/json": { schema: WebEngageSmsRejectedSchema },
			},
		},
	},
});

webengageSmsRoute.openapi(sendSmsRoute, async (c) => {
	const body = c.req.valid("json");
	const version = body.version?.trim();
	if (version !== "1.0" && version !== "2.0") {
		return c.json(
			{
				status: "sms_rejected" as const,
				statusCode: 2010,
				message: "Version not supported",
				supportedVersion: "1.0",
			},
			400,
		);
	}

	const message = body.smsData.body?.trim() ?? "";
	if (!message) {
		return c.json(
			{
				status: "sms_rejected" as const,
				statusCode: 2002,
				message: "Empty message body",
			},
			400,
		);
	}
	if (message.length > MAX_BODY_LENGTH) {
		return c.json(
			{
				status: "sms_rejected" as const,
				statusCode: 2007,
				message: "Maximum length of the message body has been exceeded",
			},
			413,
		);
	}

	const phone = normalizeSmsPhoneNumber(body.smsData.toNumber);
	if (!phone) {
		return c.json(
			{
				status: "sms_rejected" as const,
				statusCode: 2003,
				message: "Invalid mobile number",
			},
			400,
		);
	}

	if (!c.env.AFRICASTALKING_API_KEY || !c.env.AFRICASTALKING_USERNAME) {
		console.error("WebEngage SMS webhook: Africa's Talking is not configured");
		return c.json(
			{
				status: "sms_rejected" as const,
				statusCode: 9988,
				message: "SMS provider is not configured",
			},
			200,
		);
	}

	const senderId =
		body.smsData.fromNumber?.trim() ||
		c.env.AFRICASTALKING_SENDER_ID?.trim() ||
		undefined;

	const result = await sendBulkSmsWithAfricaTalking({
		apiKey: c.env.AFRICASTALKING_API_KEY,
		username: c.env.AFRICASTALKING_USERNAME,
		senderId,
		phoneNumbers: [phone],
		message,
	});

	if (!result.ok) {
		console.error("WebEngage SMS → Africa's Talking failed:", {
			messageId: body.metadata?.messageId,
			status: result.status,
			error: result.error,
		});
		return c.json(
			{
				status: "sms_rejected" as const,
				statusCode: 9988,
				message: result.error || "SMS provider rejected the message",
			},
			200,
		);
	}

	// Persist {AT messageId -> WebEngage messageId} so the AT delivery-report
	// callback can be relayed to WebEngage as a DSN. Stored before responding
	// so a fast DLR cannot outrun the mapping. Failure to store must never
	// fail the send itself.
	const atMessageId = result.recipients[0]?.messageId;
	const weMessageId = body.metadata?.messageId;
	if (atMessageId && weMessageId) {
		const kv = getSmsKv(c.env);
		if (kv) {
			try {
				await storeWebengageSmsMapping(kv, atMessageId, {
					weMessageId,
					toNumber: body.smsData.toNumber,
					version,
				});
			} catch (error) {
				console.error("WebEngage SMS: failed to store DLR mapping", {
					atMessageId,
					weMessageId,
					error,
				});
			}
		} else {
			console.warn(
				"WebEngage SMS: no KV binding; delivery reports cannot be relayed",
			);
		}
	}

	return c.json({ status: "sms_accepted" as const }, 200);
});

export default webengageSmsRoute;
