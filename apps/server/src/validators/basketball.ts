import { z } from "@hono/zod-openapi";

export const basketballScheduleParam = z
	.object({})
	.openapi("BasketballScheduleParam");

export const basketballScheduleQuery = z
	.object({
		date: z
			.string()
			.regex(/^\d{2}\/\d{2}\/\d{4}$/, "Date must be in DD/MM/YYYY format")
			.openapi({
				param: { name: "date", in: "query" },
				description: "Date of the game in DD/MM/YYYY format",
				example: "15/11/2018",
			}),
		language: z
			.string()
			.regex(
				/^[a-z]{2}$/,
				"Language must be a 2-letter language code (e.g., 'en', 'es', 'fr')",
			)
			.optional()
			.default("en")
			.openapi({
				param: { name: "language", in: "query" },
				description:
					"Language you want the result to be in (e.g., 'en', 'es', 'fr'). Default is 'en'",
				example: "en",
			}),
	})
	.openapi("BasketballScheduleQuery");

export const gameIdParam = z
	.object({
		gameId: z
			.string()
			.min(1, "Game ID is required")
			.openapi({
				param: { name: "gameId", in: "path" },
				description: "Game ID",
			}),
	})
	.openapi("GameIdParam");

export const basketballStandingsParam = z
	.object({
		tournamentId: z.string().openapi({
			param: { name: "tournamentId", in: "path" },
			description: "ID of the tournament",
			example: "132",
		}),
	})
	.openapi("BasketballStandingsParam");

export const basketballStandingsQuery = z
	.object({})
	.openapi("BasketballStandingsQuery");

export const basketballVideosQuery = z.object({
	query: z.string().openapi({
		param: { name: "query", in: "query" },
		description: "The search query for the videos",
		example: "Lakers vs Warriors",
	}),
	pageToken: z
		.string()
		.optional()
		.openapi({
			param: { name: "pageToken", in: "query" },
			description: "The token for the next or previous page of results",
			example: "CAUQAA",
		}),
});
