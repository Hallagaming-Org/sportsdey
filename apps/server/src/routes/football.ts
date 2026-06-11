import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
	ErrorResponseSchema,
	successResponseSchema,
	VideoResponseSchema,
} from "@/schemas";
import {
	FullStandingsSchema,
	MatchStatsSchema,
	TournamentScheduleSchema,
	TransformedMatchInfoSchema,
	TransformedResponseSchema,
} from "@/schemas/football";
import { fetchWithTimeout, isTimeoutError } from "@/utils/fetch-with-timeout";
import {
	type ApiSportsH2HResponse,
	type ApiSportsTopScorersResponse,
	transformFullStandings,
	transformH2H,
	transformMatch,
	transformMatchStats,
	transformSchedule,
	transformStandings,
	transformTopScorers,
} from "@/utils/football";
import { jsonZodErrorFormatter } from "@/utils/zod";
import { footballVideosQuery } from "@/validators";

function getKvNamespace(env: any): any {
	return env.sportsdey_ns || env.staging_kv || null;
}

const footballRoute = new OpenAPIHono<{ Bindings: Cloudflare.Env }>();

// footballRoute.openapi(
// 	createRoute({
// 		method: "get",
// 		path: "/{status}",
// 		request: {
// 			params: z.object({
// 				status: z.string().openapi({
// 					description: "Matches status either all, scheduled and live",
// 					example: "all",
// 				}),
// 			}),
// 			query: z.object({
// 				lang: z
// 					.string()
// 					.optional()
// 					.openapi({ description: "Language code", example: "en" }),
// 				date: z.string().openapi({
// 					description: "Schedule date (DD-MM-YYYY)",
// 					example: "15/09/2024",
// 				}),
// 			}),
// 		},
// 		responses: {
// 			200: {
// 				description: "Transformed football schedule",
// 				content: {
// 					"application/json": {
// 						schema: successResponseSchema(TransformedResponseSchema),
// 					},
// 				},
// 			},
// 			500: {
// 				content: {
// 					"application/json": {
// 						schema: ErrorResponseSchema,
// 					},
// 				},
// 				description: "Internal server error",
// 			},
// 			502: {
// 				content: {
// 					"application/json": {
// 						schema: ErrorResponseSchema,
// 					},
// 				},
// 				description: "Bad gateway - external API error",
// 			},
// 		},
// 		tags: ["Football"],
// 		summary: "Get football schedule for a given date",
// 	}),
// 	async (c) => {
// 		const { status } = c.req.valid("param");
// 		const { date } = c.req.valid("query");
// 		const statscoreToken = c.env.STATSCORE_TOKEN;

// 		if (!statscoreToken) {
// 			return c.json(
// 				{
// 					success: false as const,
// 					error: "Configuration error",
// 					details: [
// 						{
// 							field: "STATSCORE_TOKEN",
// 							message: "Statscore API token is missing",
// 							code: "missing_api_key",
// 						},
// 					],
// 				},
// 				500,
// 			);
// 		}

// 		const cacheKey = `football_schedule_${date}_${status}`;

// 		const [day, month, year] = date.split("/");
// 		const dateFrom = `${year}-${month}-${day} 00:00:00`;
// 		const dateTo = `${year}-${month}-${day} 23:59:59`;

// 		const url = `https://api.statscore.com/v2/events?token=${statscoreToken}&sport_id=5&date_from=${encodeURIComponent(
// 			dateFrom,
// 		)}&date_to=${encodeURIComponent(dateTo)}`;

// 		let cachedData = null;
// 		try {
// 			cachedData = (await c.env.sportsdey_ns.get(cacheKey, "json")) as {
// 				data: any;
// 				expiresAt: number;
// 			} | null;
// 		} catch (e) {
// 			cachedData = null;
// 		}

// 		if (cachedData && Date.now() <= cachedData.expiresAt) {
// 			return c.json(
// 				{
// 					success: true as const,
// 					data: cachedData.data,
// 				},
// 				200,
// 			);
// 		}

// 		try {
// 			let upstream: Response;
// 			try {
// 				upstream = await fetchWithTimeout(
// 					url,
// 					{
// 						headers: {
// 							Accept: "application/json",
// 						},
// 					},
// 					10000,
// 				);
// 			} catch (err) {
// 				if (isTimeoutError(err)) {
// 					return c.json(
// 						{
// 							success: false as const,
// 							error: "Gateway timeout",
// 							details: [
// 								{
// 									field: "statscore_api",
// 									message: "Statscore API request timed out",
// 									code: "timeout_error",
// 								},
// 							],
// 						},
// 						502,
// 					);
// 				}
// 				throw err;
// 			}

// 			if (!upstream.ok) {
// 				console.log(await upstream.json());
// 				return c.json(
// 					{
// 						success: false as const,
// 						error: "External API error",
// 						details: [
// 							{
// 								field: "statscore_api",
// 								message: `Statscore API returned status ${upstream.status}`,
// 								code: "external_api_error",
// 							},
// 						],
// 					},
// 					502,
// 				);
// 			}

// 			const data = (await upstream.json()) as any;

// 			const transformedData = transformSchedule(data);

// 			await c.env.sportsdey_ns.put(
// 				cacheKey,
// 				JSON.stringify({
// 					data: transformedData,
// 					expiresAt: Date.now() + 30 * 1000,
// 				}),
// 			);

// 			return c.json(
// 				{
// 					success: true as const,
// 					data: transformedData,
// 				},
// 				200,
// 			);
// 		} catch (err) {
// 			return c.json(
// 				{
// 					success: false as const,
// 					error: "Internal server error",
// 					details: [
// 						{
// 							field: "server",
// 							message:
// 								"An unexpected error occurred while processing your request",
// 							code: "internal_error",
// 						},
// 					],
// 				},
// 				500,
// 			);
// 		}
// 	},
// );

// footballRoute.openapi(
// 	createRoute({
// 		method: "get",
// 		path: "/tournament/{tournamentId}",
// 		request: {
// 			params: z.object({
// 				tournamentId: z.string().openapi({
// 					description: "Tournament ID",
// 					example: "2",
// 				}),
// 			}),
// 			query: z.object({
// 				date: z.string().openapi({
// 					description: "Schedule date (DD-MM-YYYY)",
// 					example: "15/09/2024",
// 				}),
// 			}),
// 		},
// 		responses: {
// 			200: {
// 				description: "Filtered tournament schedule",
// 				content: {
// 					"application/json": {
// 						schema: successResponseSchema(TournamentScheduleSchema),
// 					},
// 				},
// 			},
// 			500: {
// 				content: {
// 					"application/json": {
// 						schema: ErrorResponseSchema,
// 					},
// 				},
// 				description: "Internal server error",
// 			},
// 			502: {
// 				content: {
// 					"application/json": {
// 						schema: ErrorResponseSchema,
// 					},
// 				},
// 				description: "Bad gateway - external API error",
// 			},
// 		},
// 		tags: ["Football"],
// 		summary: "Get football schedule for a given date filtered by tournament ID",
// 	}),
// 	async (c) => {
// 		const { tournamentId } = c.req.valid("param");
// 		const { date } = c.req.valid("query");
// 		const statscoreToken = c.env.STATSCORE_TOKEN;

// 		if (!statscoreToken) {
// 			return c.json(
// 				{
// 					success: false as const,
// 					error: "Configuration error",
// 					details: [
// 						{
// 							field: "STATSCORE_TOKEN",
// 							message: "Statscore API token is missing",
// 							code: "missing_api_key",
// 						},
// 					],
// 				},
// 				500,
// 			);
// 		}

// 		const cacheKey = `football_tournament_schedule_${tournamentId}_${date}`;

// 		const [day, month, year] = date.split("/");
// 		const dateFrom = `${year}-${month}-${day} 00:00:00`;
// 		const dateTo = `${year}-${month}-${day} 23:59:59`;

// 		const url = `https://api.statscore.com/v2/events?token=${statscoreToken}&sport_id=5&date_from=${encodeURIComponent(
// 			dateFrom,
// 		)}&date_to=${encodeURIComponent(dateTo)}&events_details=yes&hasCompetitionsOrder=true`;

// 		let cachedData = null;
// 		try {
// 			cachedData = (await c.env.sportsdey_ns.get(cacheKey, "json")) as {
// 				data: any;
// 				expiresAt: number;
// 			} | null;
// 		} catch (e) {
// 			cachedData = null;
// 		}

// 		if (cachedData && Date.now() <= cachedData.expiresAt) {
// 			return c.json(
// 				{
// 					success: true as const,
// 					data: cachedData.data,
// 				},
// 				200,
// 			);
// 		}

// 		try {
// 			let upstream: Response;
// 			try {
// 				upstream = await fetchWithTimeout(
// 					url,
// 					{
// 						headers: {
// 							Accept: "application/json",
// 						},
// 					},
// 					10000,
// 				);
// 			} catch (err) {
// 				if (isTimeoutError(err)) {
// 					return c.json(
// 						{
// 							success: false as const,
// 							error: "Gateway timeout",
// 							details: [
// 								{
// 									field: "statscore_api",
// 									message: "Statscore API request timed out",
// 									code: "timeout_error",
// 								},
// 							],
// 						},
// 						502,
// 					);
// 				}
// 				throw err;
// 			}

// 			if (!upstream.ok) {
// 				return c.json(
// 					{
// 						success: false as const,
// 						error: "External API error",
// 						details: [
// 							{
// 								field: "statscore_api",
// 								message: `Statscore API returned status ${upstream.status}`,
// 								code: "external_api_error",
// 							},
// 						],
// 					},
// 					502,
// 				);
// 			}

// 			const rawData = (await upstream.json()) as any;

// 			const transformedData = transformTournamentSchedule(
// 				rawData,
// 				tournamentId,
// 			);

// 			await c.env.sportsdey_ns.put(
// 				cacheKey,
// 				JSON.stringify({
// 					data: transformedData,
// 					expiresAt: Date.now() + 30 * 1000,
// 				}),
// 			);

// 			return c.json(
// 				{
// 					success: true as const,
// 					data: transformedData,
// 				},
// 				200,
// 			);
// 		} catch (err) {
// 			return c.json(
// 				{
// 					success: false as const,
// 					error: "Internal server error",
// 					details: [
// 						{
// 							field: "server",
// 							message:
// 								"An unexpected error occurred while processing your request",
// 							code: "internal_error",
// 						},
// 					],
// 				},
// 				500,
// 			);
// 		}
// 	},
// );
//
//
footballRoute.openapi(
	createRoute({
		method: "get",
		path: "/{status}",
		request: {
			params: z
				.object({
					status: z.string().openapi({
						description: "Matches status either all, scheduled and live",
						example: "all",
					}),
				})
				.openapi("ScheduleParams"),
			query: z
				.object({
					lang: z
						.string()
						.optional()
						.openapi({ description: "Language code", example: "en" }),
					date: z.string().openapi({
						description: "Schedule date (DD-MM-YYYY)",
						example: "15/09/2024",
					}),
				})
				.openapi("ScheduleQuery"),
		},
		responses: {
			200: {
				description: "Transformed football schedule",
				content: {
					"application/json": {
						schema: successResponseSchema(TransformedResponseSchema),
					},
				},
			},
			500: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Internal server error",
			},
			502: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Bad gateway - external API error",
			},
		},
		tags: ["Football"],
		summary: "Get football schedule for a given date",
	}),
	async (c) => {
		const { status } = c.req.valid("param");
		const { date } = c.req.valid("query");
		const apiKey = c.env.API_SPORTS_KEY;

		if (!apiKey) {
			return c.json(
				{
					success: false as const,
					error: "Configuration error",
					details: [
						{
							field: "API_SPORTS_KEY",
							message: "API-Sports key is missing",
							code: "missing_api_key",
						},
					],
				},
				500,
			);
		}

		const apiSportsBase = "https://v3.football.api-sports.io";

		const [day, month, year] = date.split("/");
		const apiSportsDate = `${year}-${month}-${day}`;

		let url = `${apiSportsBase}/fixtures?date=${apiSportsDate}`;

		if (status === "scheduled") {
			url += "&status=NS";
		} else if (status === "live") {
			url += "&status=IN";
		}

		const cacheKey = `football_schedule_${date}_${status}`;

		let cachedData = null;
		if (getKvNamespace(c.env)) {
			try {
				cachedData = (await getKvNamespace(c.env)?.get(cacheKey, "json")) as {
					data: any;
					expiresAt: number;
				} | null;
			} catch (e) {
				cachedData = null;
			}
		}

		if (cachedData && Date.now() <= cachedData.expiresAt) {
			return c.json(
				{
					success: true as const,
					data: cachedData.data,
				},
				200,
			);
		}

		try {
			let upstream: Response;
			try {
				upstream = await fetchWithTimeout(
					url,
					{
						headers: {
							"x-rapidapi-host": "v3.football.api-sports.io",
							"x-rapidapi-key": apiKey,
							Accept: "application/json",
						},
					},
					10000,
				);
			} catch (err) {
				if (isTimeoutError(err)) {
					return c.json(
						{
							success: false as const,
							error: "Gateway timeout",
							details: [
								{
									field: "api_sports",
									message: "API-Sports request timed out",
									code: "timeout_error",
								},
							],
						},
						502,
					);
				}
				throw err;
			}

			if (!upstream.ok) {
				return c.json(
					{
						success: false as const,
						error: "External API error",
						details: [
							{
								field: "api_sports",
								message: `API-Sports returned status ${upstream.status}`,
								code: "external_api_error",
							},
						],
					},
					502,
				);
			}

			const response = (await upstream.json()) as any;

			if (!upstream.ok) {
				return c.json(
					{
						success: false as const,
						error: "API-Sports error",
						details: [
							{
								field: "api_sports",
								message: `Status ${upstream.status}: ${JSON.stringify(response)}`,
								code: "api_error",
							},
						],
					},
					502,
				);
			}

			const data = response.response || [];
			console.log(response);

			const transformedData = transformSchedule(data);

			if (getKvNamespace(c.env)) {
				try {
					await getKvNamespace(c.env)?.put(
						cacheKey,
						JSON.stringify({
							data: transformedData,
							expiresAt: Date.now() + 30 * 1000,
						}),
					);
				} catch (cacheErr) {
					console.warn("Cache write failed:", cacheErr);
				}
			}

			return c.json(
				{
					success: true as const,
					data: transformedData,
				},
				200,
			);
		} catch (err) {
			console.error("Schedule error:", err);
			return c.json(
				{
					success: false as const,
					error: "Internal server error",
					details: [
						{
							field: "server",
							message:
								"An unexpected error occurred while processing your request",
							code: "internal_error",
						},
					],
				},
				500,
			);
		}
	},
);

footballRoute.openapi(
	createRoute({
		method: "get",
		path: "/tournament/{tournamentId}",
		request: {
			params: z
				.object({
					tournamentId: z.string().openapi({
						description: "Tournament ID",
						example: "2",
					}),
				})
				.openapi("TournamentParams"),
			query: z
				.object({
					date: z.string().openapi({
						description: "Schedule date (DD-MM-YYYY)",
						example: "15/09/2024",
					}),
				})
				.openapi("TournamentQuery"),
		},
		responses: {
			200: {
				description: "Filtered tournament schedule",
				content: {
					"application/json": {
						schema: successResponseSchema(TournamentScheduleSchema),
					},
				},
			},
			500: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Internal server error",
			},
			502: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Bad gateway - external API error",
			},
		},
		tags: ["Football"],
		summary: "Get football schedule for a given date filtered by tournament ID",
	}),
	async (c) => {
		const { tournamentId } = c.req.valid("param");
		const { date } = c.req.valid("query");
		const apiKey = c.env.API_SPORTS_KEY;

		if (!apiKey) {
			return c.json(
				{
					success: false as const,
					error: "Configuration error",
					details: [
						{
							field: "API_SPORTS_KEY",
							message: "API-Sports key is missing",
							code: "missing_api_key",
						},
					],
				},
				500,
			);
		}

		const apiSportsBase = "https://v3.football.api-sports.io";
		const [day, month, year] = date.split("/");
		const apiSportsDate = `${year}-${month}-${day}`;

		const url = `${apiSportsBase}/fixtures?date=${apiSportsDate}`;

		const cacheKey = `football_tournament_schedule_${tournamentId}_${date}`;

		let cachedData = null;
		try {
			cachedData = (await getKvNamespace(c.env)?.get(cacheKey, "json")) as {
				data: any;
				expiresAt: number;
			} | null;
		} catch (e) {
			cachedData = null;
		}

		if (cachedData && Date.now() <= cachedData.expiresAt) {
			return c.json(
				{
					success: true as const,
					data: cachedData.data,
				},
				200,
			);
		}

		try {
			let upstream: Response;
			try {
				upstream = await fetchWithTimeout(
					url,
					{
						headers: {
							"x-rapidapi-host": "v3.football.api-sports.io",
							"x-rapidapi-key": apiKey,
							Accept: "application/json",
						},
					},
					10000,
				);
			} catch (err) {
				if (isTimeoutError(err)) {
					return c.json(
						{
							success: false as const,
							error: "Gateway timeout",
							details: [
								{
									field: "api_sports",
									message: "API-Sports request timed out",
									code: "timeout_error",
								},
							],
						},
						502,
					);
				}
				throw err;
			}

			if (!upstream.ok) {
				return c.json(
					{
						success: false as const,
						error: "External API error",
						details: [
							{
								field: "api_sports",
								message: `API-Sports returned status ${upstream.status}`,
								code: "external_api_error",
							},
						],
					},
					502,
				);
			}

			const response = (await upstream.json()) as any;
			const allData = response.response || [];

			const filteredData = allData.filter(
				(match: any) => match.league?.id?.toString() === tournamentId,
			);

			if (filteredData.length === 0) {
				return c.json(
					{
						success: true as const,
						data: {
							matches: [],
							total_matches: 0,
							competition: {
								id: Number(tournamentId),
								name: "Unknown Competition",
								country: {
									name: "",
									flag: null,
								},
							},
						},
					},
					200,
				);
			}

			const transformedData = transformSchedule(filteredData);

			const competition = {
				id: Number(tournamentId),
				name: filteredData[0]?.league?.name || "Unknown Competition",
				imageUrl: filteredData[0]?.league?.logo ?? null,
				country: {
					name: filteredData[0]?.league.country || "",
					flag: filteredData[0]?.league?.flag ?? null,
				},
			};

			const result = {
				matches: transformedData.competitions.flatMap((c) => c.matches),
				total_matches: transformedData.total_matches,
				competition,
			};

			await getKvNamespace(c.env)?.put(
				cacheKey,
				JSON.stringify({
					data: result,
					expiresAt: Date.now() + 30 * 1000,
				}),
			);

			return c.json(
				{
					success: true as const,
					data: result,
				},
				200,
			);
		} catch (err) {
			console.error("Tournament schedule error:", err);
			return c.json(
				{
					success: false as const,
					error: "Internal server error",
					details: [
						{
							field: "server",
							message:
								"An unexpected error occurred while processing your request",
							code: "internal_error",
						},
					],
				},
				500,
			);
		}
	},
);

footballRoute.openapi(
	createRoute({
		method: "get",
		path: "/match/{id}",
		request: {
			params: z
				.object({
					id: z.string().openapi({
						description: "Match ID",
						example: "1953516",
					}),
				})
				.openapi("MatchParams"),
			query: z
				.object({
					lang: z
						.string()
						.optional()
						.openapi({ description: "Language code", example: "en" }),
				})
				.openapi("MatchQuery"),
		},
		responses: {
			200: {
				description: "Match info",
				content: {
					"application/json": {
						schema: successResponseSchema(TransformedMatchInfoSchema),
					},
				},
			},
			400: {
				description: "Bad request - invalid parameters or upstream error",
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
			},
			404: {
				description: "Match not found",
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
			},
			500: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Internal server error",
			},
			502: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Bad gateway - external API error",
			},
		},
		tags: ["Football"],
		summary: "Get football match info by ID",
	}),
	async (c) => {
		const { id } = c.req.valid("param");
		const apiKey = c.env.API_SPORTS_KEY;

		if (!apiKey) {
			return c.json(
				{
					success: false as const,
					error: "Configuration error",
					details: [
						{
							field: "API_SPORTS_KEY",
							message: "API-Sports key is missing",
							code: "missing_api_key",
						},
					],
				},
				500,
			);
		}

		const apiSportsBase = "https://v3.football.api-sports.io";
		const fixtureUrl = `${apiSportsBase}/fixtures?id=${id}`;

		const cacheKey = `match_${id}`;

		let cachedData = null;
		try {
			cachedData = (await getKvNamespace(c.env)?.get(cacheKey, "json")) as {
				data: any;
				expiresAt: number;
			} | null;
		} catch (e) {
			cachedData = null;
		}

		if (cachedData && Date.now() <= cachedData.expiresAt) {
			return c.json(
				{
					success: true as const,
					data: cachedData.data,
				},
				200,
			);
		}

		try {
			let fixtureRes: Response;
			try {
				fixtureRes = await fetchWithTimeout(
					fixtureUrl,
					{
						headers: {
							"x-rapidapi-host": "v3.football.api-sports.io",
							"x-rapidapi-key": apiKey,
							Accept: "application/json",
						},
					},
					10000,
				);
			} catch (err) {
				if (isTimeoutError(err)) {
					return c.json(
						{
							success: false as const,
							error: "Gateway timeout",
							details: [
								{
									field: "api_sports",
									message: "API-Sports request timed out",
									code: "timeout_error",
								},
							],
						},
						502,
					);
				}
				throw err;
			}

			if (!fixtureRes.ok) {
				return c.json(
					{
						success: false as const,
						error: "External API error",
						details: [
							{
								field: "api_sports",
								message: `API-Sports returned status ${fixtureRes.status}`,
								code: "external_api_error",
							},
						],
					},
					502,
				);
			}

			const fixtureData = (await fixtureRes.json()) as any;

			if (!fixtureData.response || fixtureData.response.length === 0) {
				return c.json(
					{
						success: false as const,
						error: "Not Found",
						details: [
							{
								field: "match_id",
								message: "Match not found",
								code: "not_found",
							},
						],
					},
					404,
				);
			}

			const match = fixtureData.response[0];
			const leagueId = match.league.id;
			const season = match.league.season;
			const homeTeamId = match.teams.home.id.toString();
			const awayTeamId = match.teams.away.id.toString();
			const teamIds = [homeTeamId, awayTeamId];

			const standingsCacheKey = `standing_${leagueId}_${season}`;
			const [standingsRes, topScorersRes, h2hRes, cachedStandings] =
				await Promise.all([
					fetchWithTimeout(
						`${apiSportsBase}/standings?league=${leagueId}&season=${season}`,
						{
							headers: {
								"x-rapidapi-host": "v3.football.api-sports.io",
								"x-rapidapi-key": apiKey,
								Accept: "application/json",
							},
						},
						10000,
					),
					fetchWithTimeout(
						`${apiSportsBase}/players/topscorers?league=${leagueId}&season=${season}`,
						{
							headers: {
								"x-rapidapi-host": "v3.football.api-sports.io",
								"x-rapidapi-key": apiKey,
								Accept: "application/json",
							},
						},
						10000,
					),
					fetchWithTimeout(
						`${apiSportsBase}/fixtures/headtohead?h2h=${homeTeamId}-${awayTeamId}`,
						{
							headers: {
								"x-rapidapi-host": "v3.football.api-sports.io",
								"x-rapidapi-key": apiKey,
								Accept: "application/json",
							},
						},
						10000,
					),
					getKvNamespace(c.env)?.get(standingsCacheKey, "json") as Promise<{
						data: any;
						expiresAt: number;
					} | null>,
				]);

			let standingsData = null;
			if (cachedStandings && Date.now() <= cachedStandings.expiresAt) {
				standingsData = cachedStandings.data;
			} else if (standingsRes.ok) {
				standingsData = await standingsRes.json();
				await getKvNamespace(c.env)?.put(
					standingsCacheKey,
					JSON.stringify({
						data: standingsData,
						expiresAt: Date.now() + 12 * 60 * 60 * 1000,
					}),
				);
			}

			const transformedStandings = transformStandings(
				standingsData || {},
				teamIds,
			);

			let topScorersData = null;
			if (topScorersRes.ok) {
				topScorersData =
					(await topScorersRes.json()) as ApiSportsTopScorersResponse;
			}
			const transformedTopScorers = transformTopScorers(topScorersData);

			let h2hData = null;
			if (h2hRes.ok) {
				h2hData = (await h2hRes.json()) as ApiSportsH2HResponse;
			}
			const transformedH2H = transformH2H(h2hData, homeTeamId, awayTeamId);

			const transformedData = transformMatch(
				fixtureData,
				transformedStandings,
				transformedTopScorers,
				transformedH2H,
			);

			const isFinished =
				transformedData.status.shortname === "FT" ||
				transformedData.status.name === "Full Time" ||
				transformedData.status.name === "Ended";

			await getKvNamespace(c.env)?.put(
				`match_${id}`,
				JSON.stringify({
					data: transformedData,
					expiresAt: isFinished
						? Date.now() + 2 * 60 * 1000
						: Date.now() + 5000,
				}),
			);

			return c.json(
				{
					success: true as const,
					data: transformedData,
				},
				200,
			);
		} catch (err) {
			console.error("Match error:", err);
			return c.json(
				{
					success: false as const,
					error: "Internal server error",
					details: [
						{
							field: "server",
							message:
								"An unexpected error occurred while processing your request",
							code: "internal_error",
						},
					],
				},
				500,
			);
		}
	},
	jsonZodErrorFormatter,
);

footballRoute.openapi(
	createRoute({
		method: "get",
		path: "/match/{id}/stats",
		request: {
			params: z
				.object({
					id: z.string().openapi({
						description: "Match ID",
						example: "1985541",
					}),
				})
				.openapi("StatsParams"),
		},
		responses: {
			200: {
				description: "Match statistics",
				content: {
					"application/json": {
						schema: successResponseSchema(MatchStatsSchema),
					},
				},
			},
			404: {
				description: "Match not found or stats unavailable",
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
			},
			500: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Internal server error",
			},
			502: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Bad gateway - external API error",
			},
		},
		tags: ["Football"],
		summary: "Get football match statistics by ID",
	}),
	async (c) => {
		const { id } = c.req.valid("param");
		const apiKey = c.env.API_SPORTS_KEY;

		if (!apiKey) {
			return c.json(
				{
					success: false as const,
					error: "Configuration error",
					details: [
						{
							field: "API_SPORTS_KEY",
							message: "API-Sports key is missing",
							code: "missing_api_key",
						},
					],
				},
				500,
			);
		}

		const apiSportsBase = "https://v3.football.api-sports.io";
		const url = `${apiSportsBase}/fixtures/statistics?fixture=${id}`;

		const cacheKey = `match_stats_${id}`;
		let cachedData = null;
		try {
			cachedData = (await getKvNamespace(c.env)?.get(cacheKey, "json")) as {
				data: any;
				expiresAt: number;
			} | null;
		} catch (e) {
			cachedData = null;
		}

		if (cachedData && Date.now() <= cachedData.expiresAt) {
			return c.json(
				{
					success: true as const,
					data: cachedData.data,
				},
				200,
			);
		}

		try {
			let response: Response;
			try {
				response = await fetchWithTimeout(
					url,
					{
						headers: {
							"x-rapidapi-host": "v3.football.api-sports.io",
							"x-rapidapi-key": apiKey,
							Accept: "application/json",
						},
					},
					10000,
				);
			} catch (err) {
				if (isTimeoutError(err)) {
					return c.json(
						{
							success: false as const,
							error: "Gateway timeout",
							details: [
								{
									field: "api_sports",
									message: "API-Sports request timed out",
									code: "timeout_error",
								},
							],
						},
						502,
					);
				}
				throw err;
			}

			if (!response.ok) {
				return c.json(
					{
						success: false as const,
						error: "External API error",
						details: [
							{
								field: "api_sports",
								message: `API-Sports returned status ${response.status}`,
								code: "external_api_error",
							},
						],
					},
					502,
				);
			}

			const data = (await response.json()) as any;
			console.log("statsData", data);

			if (!data.response || data.response.length === 0) {
				return c.json(
					{
						success: false as const,
						error: "Not Found",
						details: [
							{
								field: "matchId",
								message: "Statistics not available for this match",
								code: "not_found",
							},
						],
					},
					404,
				);
			}

			const transformedData = transformMatchStats(data);

			await getKvNamespace(c.env)?.put(
				cacheKey,
				JSON.stringify({
					data: transformedData,
					expiresAt: Date.now() + 60 * 1000, // Cache for 1 minute
				}),
			);

			return c.json(
				{
					success: true as const,
					data: transformedData,
				},
				200,
			);
		} catch (err) {
			console.error("Match stats error:", err);
			return c.json(
				{
					success: false as const,
					error: "Internal server error",
					details: [
						{
							field: "server",
							message: "An unexpected error occurred",
							code: "internal_error",
						},
					],
				},
				500,
			);
		}
	},
);

footballRoute.openapi(
	createRoute({
		method: "get",
		path: "/standings/{tournamentId}",
		request: {
			params: z
				.object({
					tournamentId: z.string().openapi({
						description: "Tournament ID",
						example: "2",
					}),
				})
				.openapi("StandingsParams"),
		},
		responses: {
			200: {
				description: "Tournament standings",
				content: {
					"application/json": {
						schema: successResponseSchema(FullStandingsSchema),
					},
				},
			},
			500: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Internal server error",
			},
			502: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Bad gateway - external API error",
			},
		},
		tags: ["Football"],
		summary: "Get football tournament standings by tournament ID",
	}),
	async (c) => {
		const { tournamentId } = c.req.valid("param");
		const apiKey = c.env.API_SPORTS_KEY;

		if (!apiKey) {
			return c.json(
				{
					success: false as const,
					error: "Configuration error",
					details: [
						{
							field: "API_SPORTS_KEY",
							message: "API-Sports key is missing",
							code: "missing_api_key",
						},
					],
				},
				500,
			);
		}

		const apiSportsBase = "https://v3.football.api-sports.io";
		const currentYear = new Date().getFullYear();
		const currentMonth = new Date().getMonth();
		const season = currentMonth >= 8 ? currentYear : currentYear - 1;
		const url = `${apiSportsBase}/standings?league=${tournamentId}&season=${season}`;

		const cacheKey = `tournament_standings_${tournamentId}`;
		let cachedData = null;
		try {
			cachedData = (await getKvNamespace(c.env)?.get(cacheKey, "json")) as {
				data: any;
				expiresAt: number;
			} | null;
		} catch (e) {
			cachedData = null;
		}

		if (cachedData && Date.now() <= cachedData.expiresAt) {
			return c.json(
				{
					success: true as const,
					data: cachedData.data,
				},
				200,
			);
		}

		try {
			let response: Response;
			try {
				response = await fetchWithTimeout(
					url,
					{
						headers: {
							"x-rapidapi-host": "v3.football.api-sports.io",
							"x-rapidapi-key": apiKey,
							Accept: "application/json",
						},
					},
					10000,
				);
			} catch (err) {
				if (isTimeoutError(err)) {
					return c.json(
						{
							success: false as const,
							error: "Gateway timeout",
							details: [
								{
									field: "api_sports",
									message: "API-Sports request timed out",
									code: "timeout_error",
								},
							],
						},
						502,
					);
				}
				throw err;
			}

			if (!response.ok) {
				return c.json(
					{
						success: false as const,
						error: "External API error",
						details: [
							{
								field: "api_sports",
								message: `API-Sports returned status ${response.status}`,
								code: "external_api_error",
							},
						],
					},
					502,
				);
			}

			const data = (await response.json()) as any;
			const transformedData = transformFullStandings(data);

			await getKvNamespace(c.env)?.put(
				cacheKey,
				JSON.stringify({
					data: transformedData,
					expiresAt: Date.now() + 12 * 60 * 60 * 1000,
				}),
			);

			return c.json(
				{
					success: true as const,
					data: transformedData,
				},
				200,
			);
		} catch (err) {
			console.error("Standings error:", err);
			return c.json(
				{
					success: false as const,
					error: "Internal server error",
					details: [
						{
							field: "server",
							message: "An unexpected error occurred",
							code: "internal_error",
						},
					],
				},
				500,
			);
		}
	},
);

footballRoute.openapi(
	createRoute({
		method: "get",
		path: "/videos",
		summary: "Get YouTube videos for a football match",
		description:
			"Retrieves YouTube videos related to a specific football match query, ordered by date. If there is only nextPageToken that means that's the first set of videos. If there is only prevPageToken that means that's the last set of videos. If both nextPageToken and prevPageToken are present then there are more videos available. You can pass any of the two to the pageToken query so for pagination",
		request: {
			query: footballVideosQuery,
		},
		responses: {
			200: {
				content: {
					"application/json": {
						schema: successResponseSchema(VideoResponseSchema),
					},
				},
				description: "Successfully retrieved videos",
			},
			400: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Bad request",
			},
			500: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Internal server error",
			},
			502: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "External API error",
			},
		},
		tags: ["Football"],
	}),
	async (c) => {
		try {
			const { query, pageToken } = c.req.valid("query");
			const apiKey = c.env?.YOUTUBE_API_KEY;

			if (!apiKey) {
				return c.json(
					{
						success: false as const,
						error: "Configuration error",
						details: [
							{
								field: "YOUTUBE_API_KEY",
								message: "YouTube API key is missing",
								code: "missing_api_key",
							},
						],
					},
					500,
				);
			}

			const cacheKey = `football_videos_${query}_${pageToken || "first"}`;
			let cachedData = null;
			try {
				cachedData = (await getKvNamespace(c.env)?.get(cacheKey, "json")) as {
					data: any;
					expiresAt: number;
				} | null;
			} catch (e) {
				cachedData = null;
			}

			if (cachedData && Date.now() <= cachedData.expiresAt) {
				return c.json(
					{
						success: true as const,
						data: cachedData.data,
					},
					200,
				);
			}

			let apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
				query,
			)}&type=video&order=date&key=${apiKey}&maxResults=10`;
			if (pageToken) {
				apiUrl += `&pageToken=${pageToken}`;
			}

			let response: Response;
			try {
				response = await fetchWithTimeout(apiUrl, {}, 10000);
			} catch (err) {
				if (isTimeoutError(err)) {
					return c.json(
						{
							success: false as const,
							error: "Gateway timeout",
							details: [
								{
									field: "youtube_api",
									message: "YouTube API request timed out",
									code: "timeout_error",
								},
							],
						},
						502,
					);
				}
				throw err;
			}

			if (!response.ok) {
				return c.json(
					{
						success: false as const,
						error: "External API error",
						details: [
							{
								field: "youtube_api",
								message: `YouTube API returned status ${response.status}`,
								code: "external_api_error",
							},
						],
					},
					502,
				);
			}

			const data: any = await response.json();
			const transformedData = {
				nextPageToken: data.nextPageToken,
				prevPageToken: data.prevPageToken,
				videos: data.items.map((item: any) => ({
					videoId: item.id.videoId,
					publishedAt: item.snippet.publishedAt,
					title: item.snippet.title,
				})),
			};

			await getKvNamespace(c.env)?.put(
				cacheKey,
				JSON.stringify({
					data: transformedData,
					expiresAt: Date.now() + 10 * 60 * 1000, // Cache for 10 minutes
				}),
			);

			return c.json(
				{
					success: true as const,
					data: transformedData,
				},
				200,
			);
		} catch (error) {
			return c.json(
				{
					success: false as const,
					error: "Internal server error",
					details: [
						{
							field: "server",
							message:
								"An unexpected error occurred while processing your request",
							code: "internal_error",
						},
					],
				},
				500,
			);
		}
	},
	jsonZodErrorFormatter,
);

export default footballRoute;
