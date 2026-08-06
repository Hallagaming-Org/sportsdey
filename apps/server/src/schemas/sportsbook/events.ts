import { z } from "@hono/zod-openapi";

export const SportEventQuerySchema = z
	.object({
		sportId: z
			.union([z.string().min(1), z.array(z.string().min(1)).min(1)])
			.openapi({
				description:
					"Data.Bet sport id (e.g. football, basketball, tennis). Repeat the param for multiple sports.",
				example: "football",
			}),
		status: z.enum(["live", "pre-game"]).openapi({
			description:
				"Match status to filter by: 'live' maps to LIVE, 'pre-game' maps to NOT_STARTED",
		}),
		offset: z.coerce
			.number()
			.int()
			.min(0)
			.default(0)
			.openapi({
				description: "Number of events to skip before the page",
				example: 0,
			}),
		limit: z.coerce
			.number()
			.int()
			.min(1)
			.max(500)
			.default(100)
			.openapi({
				description: "Events per page",
				example: 100,
			}),
	})
	.openapi("SportEventQuery");

export const SportEventItemSchema = z
	.object({
		id: z.string().openapi({ description: "Sport event id" }),
		title: z.string().openapi({ description: "Sport event title" }),
	})
	.openapi("SportEventItem");

export const SportEventPaginationSchema = z
	.object({
		offset: z.number().openapi({ description: "Current page offset" }),
		limit: z.number().openapi({ description: "Events per page" }),
		total: z
			.number()
			.openapi({
				description:
					"Best-effort total events matching the filters (loaded count when the upstream does not report a total)",
			}),
		hasMore: z
			.boolean()
			.openapi({ description: "Whether another page is available" }),
	})
	.openapi("SportEventPagination");

export const SportEventsResponseSchema = z
	.object({
		success: z.literal(true),
		data: z.object({
			events: z.array(SportEventItemSchema),
			pagination: SportEventPaginationSchema,
		}),
	})
	.openapi("SportEventsResponse");
