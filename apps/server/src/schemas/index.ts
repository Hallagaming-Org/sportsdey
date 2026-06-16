import { z } from "@hono/zod-openapi";

export * from "./basketball";
export * from "./casino";
export * from "./casino-provider";
export * from "./football";
export * from "./monnify";
export * from "./notifications";
export * from "./sportsbook";
export * from "./tennis";
export * from "./wallet";

export const successResponseSchema = <T extends z.ZodType>(data: T) =>
	z
		.object({
			success: z.literal(true),
			data: data,
		})
		.openapi("SuccessResponse");

export const ErrorDetailSchema = z
	.object({
		field: z
			.string()
			.openapi({ description: "Field name that failed validation" }),
		message: z.string().openapi({ description: "Error message" }),
		code: z.string().openapi({ description: "Error code" }),
	})
	.openapi("ErrorDetail");

export const ErrorResponseSchema = z
	.object({
		success: z.literal(false),
		error: z.string().openapi({ description: "Error message" }),
		details: z
			.array(ErrorDetailSchema)
			.nullable()
			.openapi({ description: "Validation error details" }),
	})
	.openapi("ErrorResponse");

export const VideoSchema = z
	.object({
		videoId: z.string().openapi({ description: "YouTube video ID" }),
		publishedAt: z.string().openapi({ description: "Publish date" }),
		title: z.string().openapi({ description: "Video title" }),
	})
	.openapi("Video");

export const VideoResponseSchema = z
	.object({
		nextPageToken: z
			.string()
			.optional()
			.openapi({ description: "Next page token" }),
		prevPageToken: z
			.string()
			.optional()
			.openapi({ description: "Previous page token" }),
		videos: z.array(VideoSchema).openapi({ description: "List of videos" }),
	})
	.openapi("VideoResponse");
