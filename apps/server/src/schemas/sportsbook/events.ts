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
	})
	.openapi("SportEventQuery");

export const SportEventItemSchema = z
	.object({
		id: z.string().openapi({ description: "Sport event id" }),
		title: z.string().openapi({ description: "Sport event title" }),
	})
	.openapi("SportEventItem");

export const SportEventsResponseSchema = z
	.object({
		success: z.literal(true),
		data: z.array(SportEventItemSchema),
	})
	.openapi("SportEventsResponse");
