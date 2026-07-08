import { OpenAPIHono } from "@hono/zod-openapi";
import type { CloudflareBindings } from "../types";

const webengageRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

webengageRoute.post("/track-user", async (c) => {
	const { WEBENGAGE_API_KEY, WEBENGAGE_LICENSE_CODE, WEBENGAGE_HOST } = c.env;

	if (!WEBENGAGE_API_KEY || !WEBENGAGE_LICENSE_CODE || !WEBENGAGE_HOST) {
		console.error("WebEngage env vars not configured");
		return c.json({ success: false, error: "WebEngage not configured" }, 500);
	}

	const { userId, email, firstName, lastName } = await c.req.json();

	const promise = fetch(
		`${WEBENGAGE_HOST}/v1/accounts/${WEBENGAGE_LICENSE_CODE}/users`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${WEBENGAGE_API_KEY}`,
			},
			body: JSON.stringify({
				userId,
				email: email || "",
				firstName: firstName || "",
				lastName: lastName || "",
			}),
		},
	);

	const ctx = c.executionCtx;
	if (ctx && typeof ctx.waitUntil === "function") {
		ctx.waitUntil(promise.catch((e) => console.error("WebEngage error:", e)));
	} else {
		await promise.catch((e) => console.error("WebEngage error:", e));
	}

	return c.json({ success: true });
});

export default webengageRoute;
