import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { trackWebengageEvent } from "@/lib/webengage";
import { isWebengageBrowserApiEvent } from "@/utils/webengage-event";
import type { CloudflareBindings } from "../types";

const webengageEventsRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const TrackEventBodySchema = z
	.object({
		eventName: z.string().min(1),
		eventData: z.record(z.string(), z.unknown()).optional(),
	})
	.openapi("WebengageTrackEventBody");

webengageEventsRoute.openapi(
	createRoute({
		method: "post",
		path: "/events",
		tags: ["WebEngage"],
		summary: "Forward a browser match event to the WebEngage Events API",
		request: {
			body: {
				content: {
					"application/json": {
						schema: TrackEventBodySchema,
					},
				},
			},
		},
		responses: {
			202: {
				description: "Event accepted for delivery",
			},
			400: {
				description: "Event name is not allowed",
			},
			401: {
				description: "Unauthorized",
			},
		},
	}),
	async (c) => {
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

		const body = c.req.valid("json");
		if (!isWebengageBrowserApiEvent(body.eventName)) {
			return c.json(
				{
					success: false as const,
					error: "Event is not allowed",
					details: null,
				},
				400,
			);
		}

		const eventData =
			body.eventData && typeof body.eventData === "object"
				? (body.eventData as Record<string, unknown>)
				: undefined;

		trackWebengageEvent(
			c.env,
			{
				userId: user.id,
				eventName: body.eventName,
				eventData,
			},
			c.executionCtx,
		);

		return c.body(null, 202);
	},
);

export default webengageEventsRoute;