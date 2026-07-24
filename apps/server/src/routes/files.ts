import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { filePurpose } from "@/db/schema";
import { toWAT } from "@/utils";
import type { CloudflareBindings } from "../types";

const fileRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const PURPOSE_VALUES = Object.values(filePurpose) as [string, ...string[]];

const FileResponseSchema = z
	.object({
		id: z.string().openapi({ description: "File ID" }),
		userId: z.string().openapi({ description: "User ID" }),
		fileName: z.string().openapi({ description: "File name" }),
		originalName: z.string().openapi({ description: "Original file name" }),
		purpose: z.string().openapi({ description: "File purpose" }),
		url: z.string().openapi({ description: "Public URL to access the file" }),
		mimeType: z.string().openapi({ description: "MIME type" }),
		size: z.number().openapi({ description: "File size in bytes" }),
		createdAt: z.string().openapi({ description: "Creation timestamp" }),
	})
	.openapi("FileResponse");

const FileUploadBodySchema = z
	.object({
		file: z.instanceof(File).openapi({
			type: "string",
			format: "binary",
			description: "Binary file contents to upload",
		}),
		purpose: z.enum(PURPOSE_VALUES).openapi({
			description: "Purpose of the file (must match allowed purposes)",
		}),
		fileName: z.string().openapi({
			description: "User-friendly name to store alongside the file",
		}),
	})
	.openapi("FileUploadBody");

const FileIdParamSchema = z
	.object({
		id: z.string().openapi({ description: "File ID" }),
	})
	.openapi("FileIdParam");

const ErrorSchema = z
	.object({
		success: z.literal(false).openapi({ description: "Success status" }),
		error: z.string().openapi({ description: "Error message" }),
	})
	.openapi("Error");

const FileDetailResponseSchema = z
	.object({
		success: z.literal(true).openapi({ description: "Success status" }),
		data: FileResponseSchema.openapi({ description: "File data" }),
	})
	.openapi("FileDetailResponse");

const FilesListResponseSchema = z
	.object({
		success: z.literal(true).openapi({ description: "Success status" }),
		data: z.array(FileResponseSchema).openapi({ description: "Files" }),
	})
	.openapi("FilesListResponse");

const DeleteResponseSchema = z
	.object({
		success: z.literal(true).openapi({ description: "Success status" }),
		data: z
			.object({ message: z.string().openapi({ description: "Message" }) })
			.openapi({ description: "Response data" }),
	})
	.openapi("DeleteResponse");

const uploadRoute = createRoute({
	method: "post",
	path: "/upload",
	tags: ["Files"],
	summary: "Upload a file",
	description:
		"Upload a file to R2 storage and store metadata. Send as multipart/form-data with 'file', 'purpose', and 'fileName' fields.",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"multipart/form-data": {
					schema: FileUploadBodySchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "File uploaded successfully",
			content: {
				"application/json": {
					schema: FileDetailResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid request",
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
		},
		500: {
			description: "Server error",
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
		},
	},
});

const listFilesRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["Files"],
	summary: "List user files",
	description: "List all files uploaded by the authenticated user",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "Files retrieved successfully",
			content: {
				"application/json": {
					schema: FilesListResponseSchema,
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
		},
	},
});

const getFileRoute = createRoute({
	method: "get",
	path: "/{id}",
	tags: ["Files"],
	summary: "Get file details",
	description: "Get details of a specific file by ID",
	security: [{ BearerAuth: [] }],
	request: {
		params: FileIdParamSchema,
	},
	responses: {
		200: {
			description: "File details retrieved successfully",
			content: {
				"application/json": {
					schema: FileDetailResponseSchema,
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
		},
		404: {
			description: "File not found",
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
		},
	},
});

const deleteFileRoute = createRoute({
	method: "delete",
	path: "/{id}",
	tags: ["Files"],
	summary: "Delete a file",
	description: "Delete a file from R2 storage and database",
	security: [{ BearerAuth: [] }],
	request: {
		params: FileIdParamSchema,
	},
	responses: {
		200: {
			description: "File deleted successfully",
			content: {
				"application/json": {
					schema: DeleteResponseSchema,
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
		},
		404: {
			description: "File not found",
			content: {
				"application/json": {
					schema: ErrorSchema,
				},
			},
		},
	},
});

fileRoute.openapi(uploadRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const formData = await c.req.parseBody();
	const file = formData.file as File | undefined;

	if (!file) {
		return c.json({ success: false, error: "No file provided" }, 400);
	}

	const purpose = formData.purpose as string;
	const fileName = formData.fileName as string;

	if (!purpose || !PURPOSE_VALUES.includes(purpose)) {
		return c.json({ success: false, error: "Invalid or missing purpose" }, 400);
	}

	if (!fileName || typeof fileName !== "string") {
		return c.json({ success: false, error: "Missing fileName" }, 400);
	}

	const bucket =
		c.env.NODE_ENV === "production"
			? c.env.PRODUCTION_BUCKET
			: c.env.STAGING_BUCKET;

	if (!bucket) {
		return c.json({ success: false, error: "Storage not configured" }, 500);
	}

	const id = crypto.randomUUID();
	const ext = file.name.split(".").pop() || "";
	const r2Key = `${user.id}/${id}.${ext}`;
	const arrayBuffer = await file.arrayBuffer();
	const r2Object = await bucket.put(r2Key, arrayBuffer, {
		httpMetadata: {
			contentType: file.type || "application/octet-stream",
		},
		customMetadata: {
			originalName: file.name,
			userId: user.id,
			purpose,
		},
	});

	if (!r2Object) {
		return c.json({ success: false, error: "Failed to upload file" }, 500);
	}

	const baseUrl =
		c.env.NODE_ENV === "production"
			? "https://bucket.sportsdey.com"
			: "https://pub-2ef563970bc84434915fff03aa5f0dbf.r2.dev";

	const url = `${baseUrl}/${r2Key}`;

	const db = drizzle(c.env.DB, { schema });

	const [userFile] = await db
		.insert(schema.userFile)
		.values({
			id,
			userId: user.id,
			fileName,
			originalName: file.name,
			purpose,
			r2Key,
			url,
			mimeType: file.type || "application/octet-stream",
			size: file.size,
		})
		.returning();

	if (!userFile) {
		return c.json(
			{ success: false, error: "Failed to save file metadata" },
			500,
		);
	}

	return c.json(
		{
			success: true,
			data: {
				id: userFile.id,
				userId: userFile.userId,
				fileName: userFile.fileName,
				originalName: userFile.originalName,
				purpose: userFile.purpose,
				url: userFile.url,
				mimeType: userFile.mimeType,
				size: userFile.size,
				createdAt: toWAT(userFile.createdAt),
			},
		},
		200,
	);
});

fileRoute.openapi(listFilesRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const db = drizzle(c.env.DB, { schema });

	const files = await db
		.select()
		.from(schema.userFile)
		.where(eq(schema.userFile.userId, user.id))
		.orderBy(schema.userFile.createdAt);

	return c.json(
		{
			success: true,
			data: files.map((f) => ({
				id: f.id,
				userId: f.userId,
				fileName: f.fileName,
				originalName: f.originalName,
				purpose: f.purpose,
				url: f.url,
				mimeType: f.mimeType,
				size: f.size,
				createdAt: toWAT(f.createdAt),
			})),
		},
		200,
	);
});

fileRoute.openapi(getFileRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const { id } = c.req.valid("param");

	const db = drizzle(c.env.DB, { schema });

	const [file] = await db
		.select()
		.from(schema.userFile)
		.where(eq(schema.userFile.id, id))
		.limit(1);

	if (!file || file.userId !== user.id) {
		return c.json({ success: false, error: "File not found" }, 404);
	}

	return c.json(
		{
			success: true,
			data: {
				id: file.id,
				userId: file.userId,
				fileName: file.fileName,
				originalName: file.originalName,
				purpose: file.purpose,
				url: file.url,
				mimeType: file.mimeType,
				size: file.size,
				createdAt: toWAT(file.createdAt),
			},
		},
		200,
	);
});

fileRoute.openapi(deleteFileRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const { id } = c.req.valid("param");

	const db = drizzle(c.env.DB, { schema });

	const [file] = await db
		.select()
		.from(schema.userFile)
		.where(eq(schema.userFile.id, id))
		.limit(1);

	if (!file || file.userId !== user.id) {
		return c.json({ success: false, error: "File not found" }, 404);
	}

	const bucket =
		c.env.NODE_ENV === "production"
			? c.env.PRODUCTION_BUCKET
			: c.env.STAGING_BUCKET;

	if (bucket) {
		await bucket.delete(file.r2Key);
	}

	await db.delete(schema.userFile).where(eq(schema.userFile.id, id));

	return c.json(
		{
			success: true,
			data: { message: "File deleted successfully" },
		},
		200,
	);
});

export default fileRoute;
