import { z } from "@hono/zod-openapi";

export const TransformedMatchInfoSchema = z.object({
	competition: z.object({
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
	}).openapi({ description: "Competition" }),
	competitors: z.object({
		home: z.object({
			id: z.string().openapi({ description: "Home team ID" }),
			name: z.string().openapi({ description: "Home team name" }),
			shortName: z.string().openapi({ description: "Home team short name" }),
			score: z.number().openapi({ description: "Home team score" }),
			imageUrl: z.string().url().nullable().optional().openapi({ description: "Home team image" }),
		}).openapi({ description: "Home team" }),
		away: z.object({
			id: z.string().openapi({ description: "Away team ID" }),
			name: z.string().openapi({ description: "Away team name" }),
			shortName: z.string().openapi({ description: "Away team short name" }),
			score: z.number().openapi({ description: "Away team score" }),
			imageUrl: z.string().url().nullable().optional().openapi({ description: "Away team image" }),
		}).openapi({ description: "Away team" }),
	}).openapi({ description: "Competitors" }),
	match_info: z.object({
		date_time: z.string().openapi({ description: "Match date time" }),
		stadium: z.string().openapi({ description: "Stadium" }),
	}).openapi({ description: "Match info" }),
	clock: z.number().optional().openapi({ description: "Match clock" }),
	status: z.object({
		name: z.string().openapi({ description: "Status name" }),
		shortname: z.string().openapi({ description: "Status short name" }),
	}).openapi({ description: "Status" }),
	standings: z
		.array(
			z.object({
				id: z.string().openapi({ description: "Team ID" }),
				name: z.string().openapi({ description: "Team name" }),
				position: z.number().openapi({ description: "Position" }),
				points: z.number().openapi({ description: "Points" }),
				imageUrl: z.string().url().nullable().optional().openapi({ description: "Team image" }),
				played: z.number().openapi({ description: "Games played" }),
				won: z.number().openapi({ description: "Wins" }),
				drawn: z.number().openapi({ description: "Draws" }),
				lost: z.number().openapi({ description: "Losses" }),
				goals_for: z.number().openapi({ description: "Goals for" }),
				goals_against: z.number().openapi({ description: "Goals against" }),
				goal_diff: z.number().openapi({ description: "Goal difference" }),
			}),
		)
		.optional()
		.openapi({ description: "Standings" }),
	top_scorers: z
		.array(
			z.object({
				id: z.string().openapi({ description: "Player ID" }),
				name: z.string().openapi({ description: "Player name" }),
				imageUrl: z.string().url().nullable().optional().openapi({ description: "Player image" }),
				team: z.object({
					id: z.string().openapi({ description: "Team ID" }),
					name: z.string().openapi({ description: "Team name" }),
					abbreviation: z.string().openapi({ description: "Team abbreviation" }),
					imageUrl: z.string().url().nullable().optional().openapi({ description: "Team image" }),
				}).openapi({ description: "Team" }),
				gs: z.number().openapi({ description: "Goals scored" }),
			}),
		)
		.optional()
		.openapi({ description: "Top scorers" }),
	homeH2H: z
		.array(
			z.object({
				id: z.string().openapi({ description: "Match ID" }),
				date: z.string().openapi({ description: "Match date" }),
				result: z.enum(["W", "D", "L"]).openapi({ description: "Match result" }),
				homeScore: z.number().openapi({ description: "Home score" }),
				awayScore: z.number().openapi({ description: "Away score" }),
			}),
		)
		.optional()
		.openapi({ description: "Home H2H" }),
	awayH2H: z
		.array(
			z.object({
				id: z.string().openapi({ description: "Match ID" }),
				date: z.string().openapi({ description: "Match date" }),
				result: z.enum(["W", "D", "L"]).openapi({ description: "Match result" }),
				homeScore: z.number().openapi({ description: "Home score" }),
				awayScore: z.number().openapi({ description: "Away score" }),
			}),
		)
		.optional()
		.openapi({ description: "Away H2H" }),
}).openapi("TransformedMatchInfo");

export const TransformedResponseSchema = z.object({
	competitions: z.array(
		z.object({
			competition: z.object({
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
			}).openapi({ description: "Competition" }),
			matches: z.array(
				z.object({
					id: z.string().openapi({ description: "Match ID" }),
					competitors: z.object({
						home: z.object({
							id: z.string().openapi({ description: "Home team ID" }),
							name: z.string().openapi({ description: "Home team name" }),
							score: z.number().openapi({ description: "Home score" }),
							imageUrl: z.string().url().nullable().optional().openapi({ description: "Home team image" }),
						}).openapi({ description: "Home team" }),
						away: z.object({
							id: z.string().openapi({ description: "Away team ID" }),
							name: z.string().openapi({ description: "Away team name" }),
							score: z.number().openapi({ description: "Away score" }),
							imageUrl: z.string().url().nullable().optional().openapi({ description: "Away team image" }),
						}).openapi({ description: "Away team" }),
					}).openapi({ description: "Competitors" }),
					date: z.string().openapi({ description: "Match date" }),
					match_status: z.string().openapi({ description: "Match status" }),
					clock: z.number().optional().openapi({ description: "Match clock" }),
				}).openapi({ description: "Match" }),
			).openapi({ description: "Matches" }),
		}).openapi({ description: "Competition data" }),
	).openapi({ description: "Competitions" }),
	total_matches: z.number().openapi({ description: "Total matches" }),
}).openapi("TransformedResponse");

const TeamStatsSchema = z.object({
	ballPossession: z.number().openapi({ example: 65, description: "Ball possession %" }),
	shotsOnTarget: z.number().openapi({ example: 3, description: "Shots on target" }),
	shotsOffTarget: z.number().openapi({ example: 12, description: "Shots off target" }),
	fouls: z.number().openapi({ example: 17, description: "Fouls" }),
	corners: z.number().openapi({ example: 5, description: "Corners" }),
	offsides: z.number().openapi({ example: 1, description: "Offsides" }),
	saves: z.number().openapi({ example: 1, description: "Saves" }),
	yellowCards: z.number().openapi({ example: 3, description: "Yellow cards" }),
	secondYellowCards: z.number().openapi({ example: 0, description: "Second yellow cards" }),
	redCards: z.number().openapi({ example: 0, description: "Red cards" }),
}).openapi("TeamStats");

export const MatchStatsSchema = z.object({
	home: z.object({
		statistics: TeamStatsSchema.openapi({ description: "Home team statistics" }),
		name: z.string().openapi({ example: "Melbourne City", description: "Home team name" }),
		id: z.number().openapi({ example: 15272, description: "Home team ID" }),
		imageUrl: z.string().url().nullable().optional().openapi({ description: "Home team image" }),
	}).openapi({ description: "Home team" }),
	away: z.object({
		statistics: TeamStatsSchema.openapi({ description: "Away team statistics" }),
		name: z.string().openapi({ example: "Brisbane Roar", description: "Away team name" }),
		id: z.number().openapi({ example: 8722, description: "Away team ID" }),
		imageUrl: z.string().url().nullable().optional().openapi({ description: "Away team image" }),
	}).openapi({ description: "Away team" }),
	date: z.string().openapi({ example: "06/01/2026 08:00:00", description: "Match date" }),
	id: z.number().openapi({ example: 1985541, description: "Match ID" }),
}).openapi("MatchStats");

export const FullStandingsSchema = z.object({
	tournament: z.object({
		id: z.number().openapi({ example: 2, description: "Tournament ID" }),
		name: z.string().openapi({ example: "English Premier League", description: "Tournament name" }),
	}).openapi({ description: "Tournament" }),
	standings: z.array(
		z.object({
			name: z.string().openapi({ example: "Arsenal", description: "Team name" }),
			position: z.number().openapi({ example: 1, description: "Position" }),
			statistics: z.object({
				P: z.number().openapi({ example: 20, description: "Played" }),
				W: z.number().openapi({ example: 15, description: "Wins" }),
				D: z.number().openapi({ example: 3, description: "Draws" }),
				L: z.number().openapi({ example: 2, description: "Losses" }),
				GD: z.number().openapi({ example: 26, description: "Goal difference" }),
				PTS: z.number().openapi({ example: 48, description: "Points" }),
			}).openapi({ description: "Statistics" }),
			imageUrl: z.string().url().nullable().optional().openapi({ description: "Team image" }),
		}),
	).openapi({ description: "Standings" }),
}).openapi("FullStandings");

export const TournamentScheduleSchema = z.object({
	total_matches: z.number().openapi({ description: "Total matches" }),
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
	matches: z.array(
		z.object({
			id: z.string().openapi({ description: "Match ID" }),
			competitors: z.object({
				home: z.object({
					id: z.string().openapi({ description: "Home team ID" }),
					name: z.string().openapi({ description: "Home team name" }),
					score: z.number().openapi({ description: "Home score" }),
					imageUrl: z.string().url().nullable().optional().openapi({ description: "Home team image" }),
				}).openapi({ description: "Home team" }),
				away: z.object({
					id: z.string().openapi({ description: "Away team ID" }),
					name: z.string().openapi({ description: "Away team name" }),
					score: z.number().openapi({ description: "Away score" }),
					imageUrl: z.string().url().nullable().optional().openapi({ description: "Away team image" }),
				}).openapi({ description: "Away team" }),
			}).openapi({ description: "Competitors" }),
			start_time: z.string().openapi({ description: "Start time" }),
			match_status: z.string().openapi({ description: "Match status" }),
			clock: z.number().optional().openapi({ description: "Match clock" }),
		}).openapi({ description: "Match" }),
	).openapi({ description: "Matches" }),
}).openapi("TournamentSchedule");