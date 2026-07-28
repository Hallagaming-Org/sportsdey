import type { z } from "@hono/zod-openapi";
import type {
	GameSummarySchema,
	ScheduleData,
	StandingsSchema,
} from "@/schemas/basketball";

export interface ApiSportsBasketballGame {
	id: number;
	date: string;
	timestamp: number;
	timezone: string;
	status: {
		long: string;
		short: string;
		elapsed: number | null;
	};
	periods: {
		current: number | null;
		total: number | null;
		type: string;
	};
	league: {
		id: number;
		name: string;
		type: string;
		season: number;
		seasonDisplay: string;
		logo?: string;
	};
	country: {
		name: string;
		flag: string;
	};
	teams: {
		home: {
			id: number;
			name: string;
			nickname: string;
			code: string;
			logo: string;
		};
		away: {
			id: number;
			name: string;
			nickname: string;
			code: string;
			logo: string;
		};
	};
	scores: {
		home: number | null;
		away: number | null;
		winner: boolean | null;
		periods: {
			quarter1: number | null;
			quarter2: number | null;
			quarter3: number | null;
			quarter4: number | null;
		} | null;
	};
}

function mapBasketballStatus(
	statusShortName?: string,
):
	| "scheduled"
	| "closed"
	| "inprogress"
	| "halftime"
	| "postponed"
	| "cancelled" {
	switch (statusShortName) {
		case "FT":
		case "END":
			return "closed";
		case "SCH":
		case "NS":
			return "scheduled";
		// case "1Q":
		// case "2Q":
		// case "3Q":
		// case "4Q":
		// case "Q1":
		// case "Q2":
		// case "Q3":
		// case "Q4":
		// 	return "live";
		case "HT":
			return "halftime";
		case "PPD":
			return "postponed";
		case "C":
			return "cancelled";
		default:
			return "scheduled";
	}
}

export const transformSchedule = (
	data: ApiSportsBasketballGame[],
): z.infer<typeof ScheduleData> => {
	if (!data || data.length === 0) {
		return { competitions: [] };
	}

	const groupedGames = data.reduce(
		(acc, game) => {
			if (!game) return acc;

			const tournamentName = game.league?.name || "Unknown Tournament";
			const tournamentId = game.league?.id ?? "unknown";

			if (!acc[tournamentId]) {
				acc[tournamentId] = {
					id: String(tournamentId),
					name: tournamentName,
					imageUrl: game.league?.logo ?? null,
					country: {
						name: game.country.name ?? "",
						flag: game.country.flag ?? null,
					},
					games: [],
				};
			}

			acc[tournamentId].games.push({
				id: String(game.id || ""),
				status: mapBasketballStatus(game.status?.short),
				scheduledTime: game.date || "",
				home: {
					name: game.teams?.home?.name || "Unknown",
					alias: game.teams?.home?.code || "",
					points: game.scores?.home ?? null,
					imageUrl: game.teams?.home?.logo ?? null,
				},
				away: {
					name: game.teams?.away?.name || "Unknown",
					alias: game.teams?.away?.code || "",
					points: game.scores?.away ?? null,
					imageUrl: game.teams?.away?.logo ?? null,
				},
				...(game.status?.elapsed ? { clock: `${game.status.elapsed}:00` } : {}),
			});

			return acc;
		},
		{} as Record<string, any>,
	);

	const competitions = Object.values(groupedGames) as Array<{
		id: string;
		name: string;
		games: any[];
	}>;
	competitions.sort((a, b) => {
		const aIsNba = a.name.toUpperCase().includes("NBA");
		const bIsNba = b.name.toUpperCase().includes("NBA");
		if (aIsNba && !bIsNba) return -1;
		if (!aIsNba && bIsNba) return 1;
		return 0;
	});

	return {
		competitions,
	};
};

export const transformGameSummaryApiSports = (
	summary: any,
	teamStats: any,
	players: any,
): z.infer<typeof GameSummarySchema> => {
	const game = summary?.response?.[0];
	const homeTeamId = game?.teams?.home?.id;
	const awayTeamId = game?.teams?.away?.id;
	const homeTeamName = game?.teams?.home?.name;
	const awayTeamName = game?.teams?.away?.name;
	const homeTeamLogo = game?.teams?.home?.logo;
	const awayTeamLogo = game?.teams?.away?.logo;
	const tournamentLogo = game?.league?.logo;

	const homeTeamStats = teamStats?.response?.find(
		(t: any) => t.team?.id === homeTeamId,
	);
	const awayTeamStats = teamStats?.response?.find(
		(t: any) => t.team?.id === awayTeamId,
	);

	const summaryScores = {
		home: summary?.response?.[0]?.scores?.home ?? {},
		away: summary?.response?.[0]?.scores?.away ?? {},
	};

	const allPlayers = players?.response || [];

	const homePlayers = allPlayers.filter((p: any) => p.team?.id === homeTeamId);
	const awayPlayers = allPlayers.filter((p: any) => p.team?.id === awayTeamId);

	const parseMinutes = (timeStr?: string): number => {
		if (!timeStr) return 0;
		const parts = timeStr.split(":").map(Number);
		if (parts.length < 2) return 0;
		const [min, sec] = parts;
		if (min === undefined || sec === undefined) return 0;
		return min + sec / 60;
	};

	const transformPlayer = (p: any) => ({
		full_name: p.player?.name || "Unknown",
		pls_min: parseMinutes(p.minutes),
		imageUrl: p.player?.photo ?? null,
		statistics: {
			minutes: p.minutes || "00:00",
			field_goals_made: p.field_goals?.total || 0,
			field_goals_att: p.field_goals?.attempts || 0,
			field_goals_pct: p.field_goals?.percentage ?? 0,
			three_points_made: p.threepoint_goals?.total || 0,
			three_points_att: p.threepoint_goals?.attempts || 0,
			three_points_pct: p.threepoint_goals?.percentage ?? 0,
			free_throws_made: p.freethrows_goals?.total || 0,
			free_throws_att: p.freethrows_goals?.attempts || 0,
			free_throws_pct: p.freethrows_goals?.percentage ?? 0,
			rebounds: p.rebounds?.total || 0,
			offensive_rebounds: 0,
			defensive_rebounds: 0,
			assists: p.assists || 0,
			steals: 0,
			blocks: 0,
			turnovers: 0,
			personal_fouls: 0,
		},
	});

	const transformTeam = (
		isHome: boolean,
		teamStatsData: any,
		teamPlayers: any[],
	) => {
		const starters = teamPlayers
			.filter((p) => p.type === "starters")
			.map(transformPlayer);

		const bench = teamPlayers
			.filter((p) => p.type === "bench")
			.map(transformPlayer);

		const teamName = isHome ? homeTeamName : awayTeamName;
		const scoreFromSummary = isHome ? summaryScores.home : summaryScores.away;
		const getQuarter = (key: string) =>
			scoreFromSummary?.[key] ??
			scoreFromSummary?.[key.replace("_", "")] ??
			scoreFromSummary?.[key.toLowerCase()];

		const teamPoints =
			teamStatsData?.points ??
			scoreFromSummary?.total ??
			scoreFromSummary?.points ??
			0;

		return {
			name: teamName || "Unknown",
			points: teamPoints,
			imageUrl: isHome ? (homeTeamLogo ?? null) : (awayTeamLogo ?? null),
			score: {
				quarter1: teamStatsData?.scores?.q1 ?? getQuarter("quarter_1") ?? 0,
				quarter2: teamStatsData?.scores?.q2 ?? getQuarter("quarter_2") ?? 0,
				quarter3: teamStatsData?.scores?.q3 ?? getQuarter("quarter_3") ?? 0,
				quarter4: teamStatsData?.scores?.q4 ?? getQuarter("quarter_4") ?? 0,
				...(scoreFromSummary?.over_time != null && {
					over_time: scoreFromSummary.over_time,
				}),
				...(scoreFromSummary?.total != null && {
					total: scoreFromSummary.total,
				}),
			},
			starters,
			bench,
		};
	};

	const mapStatus = (short: string): string => {
		if (short === "FT" || short === "END" || short === "AET" || short === "AOT")
			return "closed";
		if (short === "NS" || short === "SCH") return "scheduled";
		if (
			short === "Q1" ||
			short === "Q2" ||
			short === "Q3" ||
			short === "Q4" ||
			short === "1Q" ||
			short === "2Q" ||
			short === "3Q" ||
			short === "4Q"
		)
			return "inprogress";
		if (short === "HT") return "halftime";
		if (short === "PPD") return "postponed";
		if (short === "C") return "cancelled";
		return "scheduled";
	};

	return {
		id: String(game?.id || ""),
		status: mapStatus(game?.status?.short || ""),
		tournament: {
			id: game?.league?.id || 0,
			name: game?.league?.name || "Unknown",
			imageUrl: tournamentLogo ?? null,
		},
		date: game?.date || "",
		venue: game?.venue || "Unknown Venue",
		clock: game?.status?.elapsed ? `${game.status.elapsed}:00` : "",
		home: transformTeam(true, homeTeamStats, homePlayers),
		away: transformTeam(false, awayTeamStats, awayPlayers),
	};
};

export const transformApiSportsStandings = (
	data: any,
): z.infer<typeof StandingsSchema> => {
	const standingsData = data?.response || [];
	const teamMap = new Map<string, any>();

	standingsData.forEach((conference: any) => {
		if (Array.isArray(conference)) {
			conference.forEach((team: any) => {
				const teamId = String(team.team?.id);
				if (!teamMap.has(teamId)) {
					teamMap.set(teamId, {
						id: teamId,
						name: team.team?.name || "Unknown",
						imageUrl: team.team?.logo ?? null,
						wins: team.games?.win?.total || 0,
						losses: team.games?.lose?.total || 0,
						played: team.games?.played || 0,
						streak: 0,
						gb: 0,
						diff: (team.points?.for || 0) - (team.points?.against || 0),
						win_pct:
							Number.parseFloat(team.games?.win?.percentage || "0") * 100,
					});
				}
			});
		}
	});

	const allTeams = Array.from(teamMap.values());
	allTeams.sort((a, b) => b.win_pct - a.win_pct);

	return {
		data: allTeams,
	};
};

export const transformGameTeamStats = (
	gameData: {
		response?: Array<{
			id: number;
			teams: {
				home: { id: number; name: string };
				away: { id: number; name: string };
			};
		}>;
	},
	teamData: {
		response?: Array<{
			game: { id: number };
			team: { id: number; name?: string };
			field_goals: { total: number; attempts: number; percentage: number };
			threepoint_goals: { total: number; attempts: number; percentage: number };
			freethrows_goals: { total: number; attempts: number; percentage: number };
			rebounds: { total: number; offence: number; defense: number };
			assists: number;
			steals: number;
			blocks: number;
			turnovers: number;
			personal_fouls: number;
		}>;
	},
	playersData: {
		response?: Array<{
			game: { id: number };
			team: { id: number; name?: string };
			player: { id: number; name: string };
			type: "starters" | "bench";
			minutes: string;
			field_goals: {
				total: number;
				attempts: number;
				percentage: number | null;
			};
			threepoint_goals: {
				total: number;
				attempts: number;
				percentage: number | null;
			};
			freethrows_goals: {
				total: number;
				attempts: number;
				percentage: number | null;
			};
			rebounds: { total: number };
			assists: number;
			points: number;
		}>;
	},
) => {
	const game = gameData.response?.[0];
	const homeTeamName = game?.teams?.home?.name;
	const awayTeamName = game?.teams?.away?.name;

	const teams = teamData.response || [];
	const players = playersData.response || [];

	const parseMinutes = (timeStr?: string): number => {
		if (!timeStr) return 0;
		const parts = timeStr.split(":").map(Number);
		if (parts.length < 2) return 0;
		const [min, sec] = parts;
		if (min === undefined || sec === undefined) return 0;
		return min + sec / 60;
	};

	const transformPlayer = (p: (typeof players)[0]) => ({
		full_name: p.player?.name || "Unknown",
		pls_min: parseMinutes(p.minutes),
		statistics: {
			minutes: p.minutes || "00:00",
			field_goals_made: p.field_goals?.total || 0,
			field_goals_att: p.field_goals?.attempts || 0,
			field_goals_pct: p.field_goals?.percentage ?? 0,
			three_points_made: p.threepoint_goals?.total || 0,
			three_points_att: p.threepoint_goals?.attempts || 0,
			three_points_pct: p.threepoint_goals?.percentage ?? 0,
			free_throws_made: p.freethrows_goals?.total || 0,
			free_throws_att: p.freethrows_goals?.attempts || 0,
			free_throws_pct: p.freethrows_goals?.percentage ?? 0,
			rebounds: p.rebounds?.total || 0,
			offensive_rebounds: 0,
			defensive_rebounds: 0,
			assists: p.assists || 0,
			steals: 0,
			blocks: 0,
			turnovers: 0,
			personal_fouls: 0,
		},
	});

	const transformTeamStats = (
		isHome: boolean,
		teamStats: (typeof teams)[0] | undefined,
		teamPlayers: typeof players,
	) => {
		const starters = teamPlayers
			.filter((p) => p.type === "starters")
			.map(transformPlayer);

		const bench = teamPlayers
			.filter((p) => p.type === "bench")
			.map(transformPlayer);

		const teamName = isHome ? homeTeamName : awayTeamName;

		if (!teamStats) {
			return {
				name: teamName || "Unknown",
				field_goals_made: 0,
				field_goals_att: 0,
				field_goals_pct: 0,
				three_points_made: 0,
				three_points_att: 0,
				three_points_pct: 0,
				free_throws_made: 0,
				free_throws_att: 0,
				free_throws_pct: 0,
				rebounds: 0,
				offensive_rebounds: 0,
				defensive_rebounds: 0,
				assists: 0,
				steals: 0,
				blocks: 0,
				turnovers: 0,
				personal_fouls: 0,
				starters,
				bench,
			};
		}

		return {
			name: teamName || teamStats.team?.name || "Unknown",
			field_goals_made: teamStats.field_goals?.total || 0,
			field_goals_att: teamStats.field_goals?.attempts || 0,
			field_goals_pct: teamStats.field_goals?.percentage || 0,
			three_points_made: teamStats.threepoint_goals?.total || 0,
			three_points_att: teamStats.threepoint_goals?.attempts || 0,
			three_points_pct: teamStats.threepoint_goals?.percentage || 0,
			free_throws_made: teamStats.freethrows_goals?.total || 0,
			free_throws_att: teamStats.freethrows_goals?.attempts || 0,
			free_throws_pct: teamStats.freethrows_goals?.percentage || 0,
			rebounds: teamStats.rebounds?.total || 0,
			offensive_rebounds: teamStats.rebounds?.offence || 0,
			defensive_rebounds: teamStats.rebounds?.defense || 0,
			assists: teamStats.assists || 0,
			steals: teamStats.steals || 0,
			blocks: teamStats.blocks || 0,
			turnovers: teamStats.turnovers || 0,
			personal_fouls: teamStats.personal_fouls || 0,
			starters,
			bench,
		};
	};

	const homeTeam = teams[0];
	const awayTeam = teams[1];
	const homeIdFromTeamStats = homeTeam?.team?.id;
	const awayIdFromTeamStats = awayTeam?.team?.id;

	const homePlayers = players.filter((p) => p.team?.id === homeIdFromTeamStats);
	const awayPlayers = players.filter((p) => p.team?.id === awayIdFromTeamStats);

	return {
		home: transformTeamStats(true, homeTeam, homePlayers),
		away: transformTeamStats(false, awayTeam, awayPlayers),
	};
};
