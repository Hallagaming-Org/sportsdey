import { z } from "@hono/zod-openapi";

export const tennisScheduleParam = z
	.object({
		date: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
			.openapi({
				param: { name: "date", in: "path" },
				description:
					"Date for which to fetch tennis schedule in YYYY-MM-DD format",
				example: "2025-11-20",
			}),
	})
	.openapi("TennisScheduleParam");

export const tennisScheduleQuery = z.object({
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
});

export const tennisGameIdParam = z.object({
	gameId: z
		.string()
		.min(1, "Game ID is required")
		.openapi({
			param: { name: "gameId", in: "path" },
			description: "The id for the tennis game you want to get info about.",
		}),
});

export const tennisTournamentParam = z.object({
	tournamentId: z
		.string()
		.min(1, "Tournament ID is required")
		.openapi({
			param: { name: "tournamentId", in: "path" },
			description: "The tournament ID to fetch schedule for.",
			example: "265",
		}),
});

export const tennisTournamentQuery = z.object({
	date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
		.optional()
		.openapi({
			param: { name: "date", in: "query" },
			description: "Date (YYYY-MM-DD)",
			example: "2024-01-15",
		}),
});

export const tennisVideosQuery = z.object({
	query: z.string().openapi({
		param: { name: "query", in: "query" },
		description: "The search query for the videos",
		example: "Alcaraz vs Djokovic",
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
