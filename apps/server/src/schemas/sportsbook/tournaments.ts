import { z } from "@hono/zod-openapi";

export const TournamentSportSchema = z.enum([
	"football",
	"basketball",
	"tennis",
]);

export const TournamentQuerySchema = z
	.object({
		sport: z
			.union([TournamentSportSchema, z.array(TournamentSportSchema).min(1)])
			.openapi({
				description:
					"Sport id to fetch tournaments for. Repeat the param for multiple sports.",
				example: "football",
			}),
		name: z
			.string()
			.trim()
			.min(1)
			.max(100)
			.optional()
			.openapi({
				description: "Tournament name to search for",
				example: "Premier League",
			}),
		offset: z.coerce
			.number()
			.int()
			.min(0)
			.default(0)
			.openapi({
				description: "Number of tournaments to skip before the page",
				example: 0,
			}),
		limit: z.coerce
			.number()
			.int()
			.min(1)
			.max(500)
			.default(100)
			.openapi({
				description: "Tournaments per page",
				example: 100,
			}),
	})
	.openapi("TournamentQuery");

export const TournamentItemSchema = z
	.object({
		id: z.string().openapi({ description: "Tournament id" }),
		title: z.string().openapi({ description: "Tournament name" }),
	})
	.openapi("TournamentItem");

export const TournamentPaginationSchema = z
	.object({
		offset: z.number().openapi({ description: "Current page offset" }),
		limit: z.number().openapi({ description: "Tournaments per page" }),
		total: z
			.number()
			.openapi({
				description:
					"Best-effort total tournaments matching the filters (loaded count when the upstream does not report a total)",
			}),
		hasMore: z
			.boolean()
			.openapi({
				description: "Whether another page is available",
			}),
	})
	.openapi("TournamentPagination");

export const TournamentsResponseSchema = z
	.object({
		success: z.literal(true),
		data: z.object({
			tournaments: z.array(TournamentItemSchema),
			pagination: TournamentPaginationSchema,
		}),
	})
	.openapi("TournamentsResponse");
