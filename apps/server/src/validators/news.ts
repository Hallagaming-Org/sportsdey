import { z } from "@hono/zod-openapi";

export const newsVideosQuery = z.object({
	query: z.string().openapi({
		param: { name: "query", in: "query" },
		description: "The search query for the videos",
		example: "Premier League highlights",
	}),
	pageToken: z
		.string()
		.optional()
		.openapi({
			param: { name: "pageToken", in: "query" },
			description: "The token for the next or previous page of results",
			example: "CAUQAA",
		}),
}).openapi("NewsVideosQuery");
