import { z } from "@hono/zod-openapi";

export const ScheduledGameSchema = z.object({
	id: z.string().openapi({ description: "Game ID" }),
	status: z.enum([
		"scheduled",
		"created",
		"inprogress",
		"halftime",
		"complete",
		"closed",
		"cancelled",
		"delayed",
		"postponed",
		"time-tbd",
		"if-necessary",
		"unnecessary",
	]).openapi({ description: "Game status" }),
	scheduledTime: z.string().openapi({ description: "Scheduled time" }),
	home: z.object({
		name: z.string().openapi({ description: "Home team name" }),
		alias: z.string().openapi({ description: "Home team alias" }),
		points: z.number().nullable().openapi({ description: "Home team points" }),
		imageUrl: z.string().url().nullable().optional().openapi({ description: "Home team image" }),
	}).openapi({ description: "Home team" }),
	away: z.object({
		name: z.string().openapi({ description: "Away team name" }),
		alias: z.string().openapi({ description: "Away team alias" }),
		points: z.number().nullable().openapi({ description: "Away team points" }),
		imageUrl: z.string().url().nullable().optional().openapi({ description: "Away team image" }),
	}).openapi({ description: "Away team" }),
	clock: z.string().optional().openapi({ description: "Game clock" }),
}).openapi("ScheduledGame");

export const ScheduleData = z.object({
	competitions: z.array(
		z.object({
			id: z.string().openapi({ description: "Competition ID" }),
			name: z.string().openapi({ description: "Competition name" }),
			imageUrl: z.string().url().nullable().optional().openapi({ description: "Competition image" }),
			country: z
				.object({
					name: z.string().openapi({ description: "Country name" }),
					flag: z.string().url().nullable().optional().openapi({ description: "Country flag" }),
				})
				.optional()
				.openapi({ description: "Country" }),
			games: z.array(ScheduledGameSchema).openapi({ description: "Games" }),
		}),
	).openapi({ description: "Competitions" }),
}).openapi("ScheduleData");

export const PlayerStatisticsSchema = z.object({
	minutes: z.string().openapi({ description: "Minutes played" }),
	field_goals_made: z.number().openapi({ description: "Field goals made" }),
	field_goals_att: z.number().openapi({ description: "Field goals attempted" }),
	field_goals_pct: z.number().openapi({ description: "Field goals percentage" }),
	three_points_made: z.number().openapi({ description: "Three points made" }),
	three_points_att: z.number().openapi({ description: "Three points attempted" }),
	three_points_pct: z.number().openapi({ description: "Three points percentage" }),
	free_throws_made: z.number().openapi({ description: "Free throws made" }),
	free_throws_att: z.number().openapi({ description: "Free throws attempted" }),
	free_throws_pct: z.number().openapi({ description: "Free throws percentage" }),
	rebounds: z.number().openapi({ description: "Rebounds" }),
	offensive_rebounds: z.number().openapi({ description: "Offensive rebounds" }),
	defensive_rebounds: z.number().openapi({ description: "Defensive rebounds" }),
	assists: z.number().openapi({ description: "Assists" }),
	steals: z.number().openapi({ description: "Steals" }),
	blocks: z.number().openapi({ description: "Blocks" }),
	turnovers: z.number().openapi({ description: "Turnovers" }),
	personal_fouls: z.number().openapi({ description: "Personal fouls" }),
}).openapi("PlayerStatistics");

export const PlayerSchema = z.object({
	full_name: z.string().openapi({ description: "Player full name" }),
	pls_min: z.number().openapi({ description: "Player minutes" }),
	imageUrl: z.string().url().nullable().optional().openapi({ description: "Player image" }),
	statistics: PlayerStatisticsSchema.openapi({ description: "Player statistics" }),
}).openapi("Player");

export const TeamSchema = z.object({
	name: z.string().openapi({ description: "Team name" }),
	points: z.number().openapi({ description: "Team points" }),
	imageUrl: z.string().url().nullable().optional().openapi({ description: "Team image" }),
	starters: z.array(PlayerSchema).optional().openapi({ description: "Starters" }),
	bench: z.array(PlayerSchema).optional().openapi({ description: "Bench players" }),
	score: z.object({
		quarter1: z.number().optional().openapi({ description: "Quarter 1 score" }),
		quarter2: z.number().optional().openapi({ description: "Quarter 2 score" }),
		quarter3: z.number().optional().openapi({ description: "Quarter 3 score" }),
		quarter4: z.number().optional().openapi({ description: "Quarter 4 score" }),
		over_time: z.number().optional().openapi({ description: "Overtime score" }),
		total: z.number().optional().openapi({ description: "Total score" }),
	}).openapi({ description: "Team score" }),
}).openapi("Team");

export const GameSummarySchema = z.object({
	id: z.string().openapi({ description: "Game ID" }),
	status: z.string().openapi({ description: "Game status" }),
	date: z.string().openapi({ description: "Game date" }),
	clock: z.string().openapi({ description: "Game clock" }),
	venue: z.string().openapi({ description: "Venue" }),
	tournament: z.object({
		name: z.string().openapi({ description: "Tournament name" }),
		id: z.number().openapi({ description: "Tournament ID" }),
		imageUrl: z.string().url().nullable().optional().openapi({ description: "Tournament image" }),
	}).openapi({ description: "Tournament" }),
	home: TeamSchema.openapi({ description: "Home team" }),
	away: TeamSchema.openapi({ description: "Away team" }),
}).openapi("GameSummary");

export const StandingsSchema = z.object({
	data: z.array(
		z.object({
			id: z.string().openapi({ description: "Team ID" }),
			name: z.string().openapi({ description: "Team name" }),
			imageUrl: z.string().url().nullable().optional().openapi({ description: "Team image" }),
			wins: z.number().openapi({ description: "Wins" }),
			losses: z.number().openapi({ description: "Losses" }),
			played: z.number().openapi({ description: "Games played" }),
			streak: z.number().openapi({ description: "Streak" }),
			gb: z.number().openapi({ description: "Games behind" }),
			diff: z.number().openapi({ description: "Point differential" }),
			win_pct: z.number().openapi({ description: "Win percentage" }),
		}),
	).openapi({ description: "Standings data" }),
}).openapi("Standings");

export const TeamStatsSchema = z.object({
	name: z.string().openapi({ description: "Team name" }),
	field_goals_made: z.number().openapi({ description: "Field goals made" }),
	field_goals_att: z.number().openapi({ description: "Field goals attempted" }),
	field_goals_pct: z.number().openapi({ description: "Field goals percentage" }),
	three_points_made: z.number().openapi({ description: "Three points made" }),
	three_points_att: z.number().openapi({ description: "Three points attempted" }),
	three_points_pct: z.number().openapi({ description: "Three points percentage" }),
	free_throws_made: z.number().openapi({ description: "Free throws made" }),
	free_throws_att: z.number().openapi({ description: "Free throws attempted" }),
	free_throws_pct: z.number().openapi({ description: "Free throws percentage" }),
	rebounds: z.number().openapi({ description: "Rebounds" }),
	offensive_rebounds: z.number().openapi({ description: "Offensive rebounds" }),
	defensive_rebounds: z.number().openapi({ description: "Defensive rebounds" }),
	assists: z.number().openapi({ description: "Assists" }),
	steals: z.number().openapi({ description: "Steals" }),
	blocks: z.number().openapi({ description: "Blocks" }),
	turnovers: z.number().openapi({ description: "Turnovers" }),
	personal_fouls: z.number().openapi({ description: "Personal fouls" }),
	starters: z.array(PlayerSchema).openapi({ description: "Starters" }),
	bench: z.array(PlayerSchema).openapi({ description: "Bench players" }),
}).openapi("TeamStats");

export const GameTeamStatsSchema = z.object({
	home: TeamStatsSchema.openapi({ description: "Home team stats" }),
	away: TeamStatsSchema.openapi({ description: "Away team stats" }),
}).openapi("GameTeamStats");

export const BasketballTournamentScheduleSchema = z.object({
	games: z.array(ScheduledGameSchema).openapi({ description: "Games" }),
	total: z.number().openapi({ description: "Total games" }),
	competition: z.object({
		name: z.string().openapi({ description: "Competition name" }),
		id: z.number().openapi({ description: "Competition ID" }),
		imageUrl: z.string().url().nullable().optional().openapi({ description: "Competition image" }),
		country: z
			.object({
				name: z.string().openapi({ description: "Country name" }),
				flag: z.string().url().nullable().optional().openapi({ description: "Country flag" }),
			})
			.optional()
			.openapi({ description: "Country" }),
	}).openapi({ description: "Competition" }),
}).openapi("BasketballTournamentSchedule");
