import { z } from "@hono/zod-openapi";

export const TennisCompetitorSchema = z
	.object({
		id: z.string().openapi({ description: "Competitor ID" }),
		name: z.string().openapi({ description: "Competitor name" }),
		qualifier: z
			.enum(["home", "away"])
			.openapi({ description: "Home or away" }),
	})
	.openapi("TennisCompetitor");

export const TennisSetScoreSchema = z
	.object({
		set_number: z.number().openapi({ description: "Set number" }),
		games_won: z.number().openapi({ description: "Games won" }),
		tiebreak_score: z
			.number()
			.optional()
			.openapi({ description: "Tiebreak score" }),
	})
	.openapi("TennisSetScore");

export const TennisMatchSchema = z
	.object({
		id: z.string().openapi({ description: "Match ID" }),
		start_time: z.string().openapi({ description: "Start time" }),
		status: z.string().openapi({ description: "Match status" }),
		home: z
			.object({
				id: z.string().openapi({ description: "Home team ID" }),
				name: z.string().openapi({ description: "Home team name" }),
				set_scores: z
					.array(TennisSetScoreSchema)
					.openapi({ description: "Set scores" }),
			})
			.openapi("TennisHome"),
		away: z
			.object({
				id: z.string().openapi({ description: "Away team ID" }),
				name: z.string().openapi({ description: "Away team name" }),
				set_scores: z
					.array(TennisSetScoreSchema)
					.openapi({ description: "Set scores" }),
			})
			.openapi("TennisAway"),
		winner_id: z.string().optional().openapi({ description: "Winner ID" }),
	})
	.openapi("TennisMatch");

export const TennisCompetitionGroupSchema = z
	.object({
		competition: z
			.object({
				id: z.string().openapi({ description: "Competition ID" }),
				name: z.string().openapi({ description: "Competition name" }),
				type: z
					.string()
					.optional()
					.openapi({ description: "Competition type" }),
				gender: z
					.string()
					.optional()
					.openapi({ description: "Competition gender" }),
			})
			.openapi("TennisCompetition"),
		matches: z.array(TennisMatchSchema).openapi({ description: "Matches" }),
	})
	.openapi("TennisCompetitionGroup");

export const TennisScheduleData = z
	.object({
		date: z.string().openapi({ description: "Date" }),
		total_matches: z.number().openapi({ description: "Total matches" }),
		competitions: z
			.array(TennisCompetitionGroupSchema)
			.openapi({ description: "Competitions" }),
	})
	.openapi("TennisScheduleData");

export const TennisMatchInfoData = z
	.object({
		id: z.string().openapi({ description: "Match ID" }),
		start_time: z.string().openapi({ description: "Start time" }),
		status: z.string().openapi({ description: "Match status" }),
		home: z
			.object({
				id: z.string().openapi({ description: "Home team ID" }),
				name: z.string().openapi({ description: "Home team name" }),
				set_scores: z
					.array(TennisSetScoreSchema)
					.openapi({ description: "Set scores" }),
			})
			.openapi("TennisHomeInfo"),
		away: z
			.object({
				id: z.string().openapi({ description: "Away team ID" }),
				name: z.string().openapi({ description: "Away team name" }),
				set_scores: z
					.array(TennisSetScoreSchema)
					.openapi({ description: "Set scores" }),
			})
			.openapi("TennisAwayInfo"),
		winner_id: z.string().optional().openapi({ description: "Winner ID" }),
		competition: z
			.object({
				id: z.string().openapi({ description: "Competition ID" }),
				name: z.string().openapi({ description: "Competition name" }),
				type: z
					.string()
					.optional()
					.openapi({ description: "Competition type" }),
			})
			.openapi("TennisCompetitionInfo"),
	})
	.openapi("TennisMatchInfoData");
