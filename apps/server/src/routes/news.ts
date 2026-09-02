import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
	ErrorResponseSchema,
	successResponseSchema,
	VideoResponseSchema,
} from "@/schemas";
import { fetchWithTimeout, isTimeoutError } from "@/utils/fetch-with-timeout";
import { jsonZodErrorFormatter } from "@/utils/zod";
import { newsVideosQuery } from "@/validators";

function getKvNamespace(env: any): any {
	return env.sportsdey_ns || env.staging_kv || null;
}

const newsRoute = new OpenAPIHono<{ Bindings: Cloudflare.Env }>();

newsRoute.openapi(
	createRoute({
		method: "get",
		path: "/videos",
		summary: "Get YouTube videos for a news query",
		description:
			"Retrieves YouTube videos related to a specific news query, ordered by date. Supports pagination via pageToken. If there is only nextPageToken that means that's the first set of videos. If there is only prevPageToken that means that's the last set of videos. If both nextPageToken and prevPageToken are present then there are more videos available. You can pass any of the two to the pageToken query so for pagination.",
		request: {
			query: newsVideosQuery,
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
		tags: ["News"],
	}),
	async (c) => {
		const { query, pageToken, channelId } = c.req.valid("query");
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

		const cacheKey = `news_videos_${query}_${pageToken || "first"}_${channelId || "all"}`;
		let cachedData: { data: unknown; expiresAt: number } | null = null;
		if (getKvNamespace(c.env)) {
			cachedData = (await getKvNamespace(c.env)?.get(cacheKey, "json")) as {
				data: unknown;
				expiresAt: number;
			} | null;
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

		let apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&order=date&key=${apiKey}&maxResults=10`;
		if (pageToken) {
			apiUrl += `&pageToken=${pageToken}`;
		}
		if (channelId) {
			apiUrl += `&channelId=${channelId}`;
		}

		const response: Response = await fetchWithTimeout(apiUrl, {}, 10000);

		if (!response.ok) {
			if (cachedData?.data) {
				console.warn(
					"Serving stale news videos from KV after YouTube API failure",
					response.status,
				);
				return c.json(
					{
						success: true as const,
						data: cachedData.data,
					},
					200,
				);
			}
			console.warn(
				"YouTube API unavailable and no cached videos; returning empty list",
				response.status,
			);
			return c.json(
				{
					success: true as const,
					data: {
						videos: [],
					},
				},
				200,
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

		if (getKvNamespace(c.env)) {
			await getKvNamespace(c.env)?.put(
				cacheKey,
				JSON.stringify({
					data: transformedData,
					expiresAt: Date.now() + 10 * 60 * 1000, // Cache for 10 minutes
				}),
			);
		}

		return c.json(
			{
				success: true as const,
				data: transformedData,
			},
			200,
		);
	},
	jsonZodErrorFormatter,
);

export default newsRoute;
