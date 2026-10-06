import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
	quidaxRampEventName,
	verifyRampWebhookSignature,
} from "@/utils/quidax-ramp-webhook";
import type { CloudflareBindings } from "../types";

const quidaxRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const webhookRoute = createRoute({
	method: "post",
	path: "/webhook",
	tags: ["Quidax"],
	summary: "Quidax Ramp webhook",
	description:
		"Acknowledges Ramp buy/sell events. Crypto is paid on-chain to the Openfort address — this handler never credits the Naira wallet.",
	responses: {
		200: { description: "Acknowledged" },
		401: { description: "Invalid signature" },
		503: { description: "Quidax secret is not configured" },
	},
});

quidaxRoute.openapi(webhookRoute, async (c) => {
	const secret = (
		c.env as CloudflareBindings & { QUIDAX_SECRET_KEY?: string }
	).QUIDAX_SECRET_KEY;
	if (!secret?.trim()) {
		console.error("Quidax Ramp webhook: QUIDAX_SECRET_KEY is not configured");
		return c.json({ received: false }, 503);
	}

	const rawBody = await c.req.text();
	const signature =
		c.req.header("x-ramp-signature") ?? c.req.header("quidax-signature");
	if (!verifyRampWebhookSignature(rawBody, signature, secret)) {
		return c.json({ received: false }, 401);
	}

	let payload: unknown = null;
	try {
		payload = rawBody ? JSON.parse(rawBody) : null;
	} catch {
		payload = null;
	}

	console.log("Quidax Ramp webhook", {
		event: quidaxRampEventName(payload),
	});

	return c.json({ received: true }, 200);
});

export default quidaxRoute;
