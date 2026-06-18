import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import { requirePermission } from "@/middleware/admin-permissions";
import { ErrorResponseSchema, successResponseSchema } from "@/schemas";
import { parseQueryDateRange } from "@/utils";
import { getSanityClient, getSanityServerClient, urlFor } from "../lib/sanity";
import type { CloudflareBindings } from "../types";

const cmsRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const CmsContentQuerySchema = z
	.object({
		search: z
			.string()
			.optional()
			.openapi({ description: "Search by title or author name" }),
		type: z
			.enum(["all", "news", "videos", "ads"])
			.optional()
			.default("all")
			.openapi({ description: "Filter by content type" }),
		sortBy: z
			.enum(["title"])
			.optional()
			.openapi({ description: "Sort by field" }),
		page: z.coerce
			.number()
			.optional()
			.default(1)
			.openapi({ description: "Page number" }),
		fromDate: z.string().optional().openapi({
			description:
				"Filter content published on or after this date (ISO format: YYYY-MM-DD)",
			example: "2025-01-01",
		}),
		toDate: z.string().optional().openapi({
			description:
				"Filter content published on or before this date (ISO format: YYYY-MM-DD)",
			example: "2025-01-31",
		}),
	})
	.openapi("CmsContentQuery");

const CreateCmsContentSchema = z.object({
	title: z.string().min(1).openapi({ description: "Content title" }),
	message: z.string().min(1).openapi({ description: "Content body message" }),
	contentType: z
		.enum(["news", "videos", "ads"])
		.openapi({ description: "Content type" }),
	bannerImage: z
		.string()
		.nullable()
		.optional()
		.openapi({ description: "Banner image as base64" }),
	authorName: z.string().min(1).openapi({ description: "Author full name" }),
});

const UpdateCmsContentSchema = CreateCmsContentSchema.partial().openapi(
	"UpdateCmsContent",
);

const CmsContentResponseSchema = z.object({
	_id: z.string(),
	title: z.string(),
	image: z.string().nullable(),
	author: z.object({
		name: z.string(),
		image: z.string().nullable(),
	}),
	type: z.enum(["news", "videos", "ads"]),
	dateUploaded: z.string(),
	status: z.enum(["pending", "verified"]),
});

const CmsAuthorOptionSchema = z.object({
	_id: z.string(),
	name: z.string(),
});

const CmsContentDetailResponseSchema = z.object({
	_id: z.string(),
	title: z.string(),
	slug: z.string().nullable(),
	message: z.string(),
	image: z.string().nullable(),
	author: z.object({
		_id: z.string().nullable(),
		name: z.string(),
		image: z.string().nullable(),
	}),
	type: z.enum(["news", "videos", "ads"]),
	publishedAt: z.string(),
	status: z.enum(["pending", "verified"]),
});

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\w\s-]/g, "")
		.replace(/[\s_-]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function isDraft(id: string): boolean {
	return id.startsWith("drafts.");
}

function formatDate(dateString: string): string {
	const date = new Date(dateString);
	const months = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];
	const month = months[date.getMonth()];
	const day = date.getDate();
	const year = date.getFullYear();
	return `${month} ${day}, ${year}`;
}

type SanityContent = {
	_id: string;
	title: string;
	publishedAt: string;
	category: string;
	image?: string | null;
	author: { _id: string; name: string; image?: unknown };
};

type SanityAuthor = {
	_id: string;
	name: string;
};

type SanityContentDetail = {
	_id: string;
	title: string;
	slug?: { current?: string };
	body?: Array<{ children?: Array<{ text?: string }> }>;
	category?: string;
	publishedAt: string;
	image?: unknown;
	author?: { _id?: string; name?: string; image?: unknown };
};

cmsRoute.openapi(
	createRoute({
		method: "get",
		path: "/authors",
		summary: "List available CMS authors",
		description:
			"Fetch all available authors that can be assigned to CMS content. Requires admin authentication.",
		security: [{ BearerAuth: [] }],
		responses: {
			200: {
				content: {
					"application/json": {
						schema: successResponseSchema(CmsAuthorOptionSchema.array()),
					},
				},
				description: "Successfully retrieved authors",
			},
			401: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Unauthorized",
			},
			403: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Forbidden - admin only",
			},
			500: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Internal server error",
			},
		},
		tags: ["CMS"],
	}),
	async (c) => {
		try {
			const token = getSessionToken(c.req.raw.headers);
			const session = await validateAdminSession(c.env, token || "");

			if (
				!session ||
				(session.role !== "admin" && session.role !== "super_admin")
			) {
				return c.json(
					{
						success: false as const,
						error: "Forbidden - admin only",
						details: null,
					},
					403,
				);
			}

			if (
				session.role !== "super_admin" &&
				!requirePermission(session, "post_upload_content")
			) {
				return c.json(
					{
						success: false as const,
						error: "Forbidden - post_upload_content permission required",
					},
					403,
				);
			}

			const client = getSanityClient(c.env);
			const authors = await client.fetch<Array<SanityAuthor>>(
				`*[_type == "author"] | order(name asc) {
					_id,
					name
				}`,
			);

			const uniqueAuthors = Array.from(
				new Map(
					authors
						.filter((author) => author.name?.trim())
						.map((author) => [author.name.trim().toLowerCase(), author]),
				).values(),
			);

			return c.json(
				{
					success: true as const,
					data: uniqueAuthors,
				},
				200,
			);
		} catch (error) {
			console.error("Error fetching CMS authors:", error);
			return c.json(
				{
					success: false as const,
					error: "Internal server error",
					details: [
						{
							field: "server",
							message: "An unexpected error occurred while fetching authors",
							code: "internal_error",
						},
					],
				},
				500,
			);
		}
	},
);

cmsRoute.openapi(
	createRoute({
		method: "get",
		path: "/content",
		summary: "List CMS content",
		description:
			"List published CMS content with optional search, filtering, sorting and pagination. Returns only verified (published) content.",
		request: {
			query: CmsContentQuerySchema,
		},
		responses: {
			200: {
				content: {
					"application/json": {
						schema: successResponseSchema(CmsContentResponseSchema.array()),
					},
				},
				description: "Successfully retrieved content",
			},
			400: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Bad request",
			},
		},
		tags: ["CMS"],
	}),
	async (c) => {
		try {
			const { search, type, sortBy, page, fromDate, toDate } =
				c.req.valid("query");
			const client = getSanityClient(c.env);

			const pageSize = 10;
			const start = (page - 1) * pageSize;
			const end = start + pageSize;

			let filterConditions = '_type == "news" && !(_id in path("drafts.**"))';
			const params: Record<string, unknown> = {};

			if (search && search.trim()) {
				filterConditions +=
					" && (title match $search || author->name match $search)";
				params.search = `*${search.trim()}*`;
			}

			if (type && type !== "all") {
				if (type === "news") {
					filterConditions += ' && (category != "videos" && category != "ads")';
				} else {
					filterConditions += " && category == $type";
					params.type = type;
				}
			}

			const { fromDate: fromBoundary, toDate: toBoundary } =
				parseQueryDateRange({
					fromDate,
					toDate,
				}) as { fromDate?: number; toDate?: number };

			const sortOrder = sortBy === "title" ? "title asc" : "publishedAt desc";

			const finalQuery = `*[${filterConditions}] | order(${sortOrder}) {
				_id,
				title,
				publishedAt,
				category,
				"image": image.asset->url,
				"author": author->{_id, name, image}
			}`;

			const allContent = await client.fetch<Array<SanityContent>>(
				finalQuery,
				params,
			);

			const filteredContent = allContent.filter((item) => {
				const publishedAt = new Date(item.publishedAt);
				if (Number.isNaN(publishedAt.getTime())) return false;
				const publishedMs = publishedAt.getTime();
				if (fromBoundary && publishedMs < fromBoundary) return false;
				if (toBoundary && publishedMs > toBoundary) return false;
				return true;
			});
			const paginatedContent = filteredContent.slice(start, end);

			const transformedContent = paginatedContent.map((item: SanityContent) => {
				const category = item.category;
				const type =
					category === "videos" || category === "ads" ? category : "news";
				return {
					_id: item._id,
					title: item.title,
					image: item.image || null,
					author: {
						name: item.author?.name || "",
						image: item.author?.image
							? urlFor(c.env, item.author.image).width(200).url()
							: null,
					},
					type,
					dateUploaded: formatDate(item.publishedAt),
					status: "verified" as const,
				};
			});

			const total = filteredContent.length;
			const totalPages = Math.ceil(total / pageSize);

			return c.json(
				{
					success: true as const,
					data: {
						content: transformedContent,
						total,
						page,
						limit: pageSize,
						totalPages,
					},
				},
				200,
			);
		} catch (error) {
			console.error("Error fetching CMS content:", error);
			return c.json(
				{
					success: false as const,
					error: "Internal server error",
					details: [
						{
							field: "server",
							message: "An unexpected error occurred while fetching content",
							code: "internal_error",
						},
					],
				},
				500,
			);
		}
	},
);

cmsRoute.openapi(
	createRoute({
		method: "get",
		path: "/content/all",
		summary: "List all CMS content",
		description:
			"List all CMS content including drafts. Requires admin authentication.",
		security: [{ BearerAuth: [] }],
		request: {
			query: CmsContentQuerySchema,
		},
		responses: {
			200: {
				content: {
					"application/json": {
						schema: successResponseSchema(CmsContentResponseSchema.array()),
					},
				},
				description: "Successfully retrieved content",
			},
			401: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Unauthorized",
			},
			403: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Forbidden - admin only",
			},
		},
		tags: ["CMS"],
	}),
	async (c) => {
		try {
			const token = getSessionToken(c.req.raw.headers);
			const session = await validateAdminSession(c.env, token || "");

			if (
				!session ||
				(session.role !== "admin" && session.role !== "super_admin")
			) {
				return c.json(
					{
						success: false as const,
						error: "Forbidden - admin only",
						details: null,
					},
					403,
				);
			}

			if (
				session.role !== "super_admin" &&
				!requirePermission(session, "post_upload_content")
			) {
				return c.json(
					{
						success: false as const,
						error: "Forbidden - post_upload_content permission required",
					},
					403,
				);
			}

			const { search, type, sortBy, page, fromDate, toDate } =
				c.req.valid("query");
			const { fromDate: fromBoundary, toDate: toBoundary } =
				parseQueryDateRange({
					fromDate,
					toDate,
				}) as { fromDate?: number; toDate?: number };
			const client = getSanityClient(c.env);

			const pageSize = 10;
			const start = (page - 1) * pageSize;
			const end = start + pageSize;
			const sortOrder = sortBy === "title" ? "title asc" : "publishedAt desc";

			let filterConditions = '_type == "news"';
			const params: Record<string, unknown> = {};

			if (search && search.trim()) {
				filterConditions +=
					" && (title match $search || author->name match $search)";
				params.search = `*${search.trim()}*`;
			}

			if (type && type !== "all") {
				if (type === "news") {
					filterConditions += ' && (category != "videos" && category != "ads")';
				} else {
					filterConditions += " && category == $type";
					params.type = type;
				}
			}

			const query = `*[${filterConditions}] | order(${sortOrder}) {
				_id,
				title,
				publishedAt,
				category,
				image,
				"author": author->{_id, name, image}
			}`;

			const allContent = await client.fetch<Array<SanityContent>>(
				query,
				params,
			);

			const filteredContent = allContent.filter((item) => {
				const publishedAt = new Date(item.publishedAt);
				if (Number.isNaN(publishedAt.getTime())) return false;
				const publishedMs = publishedAt.getTime();
				if (fromBoundary && publishedMs < fromBoundary) return false;
				if (toBoundary && publishedMs > toBoundary) return false;
				return true;
			});
			const paginatedContent = filteredContent.slice(start, end);

			const transformedContent = paginatedContent.map((item: SanityContent) => {
				const category = item.category;
				const type =
					category === "videos" || category === "ads" ? category : "news";
				return {
					_id: item._id,
					title: item.title,
					image: item.image || null,
					author: {
						name: item.author?.name || "",
						image: item.author?.image
							? urlFor(c.env, item.author.image).width(200).url()
							: null,
					},
					type,
					dateUploaded: formatDate(item.publishedAt),
					status: isDraft(item._id)
						? ("pending" as const)
						: ("verified" as const),
				};
			});

			const total = filteredContent.length;
			const totalPages = Math.ceil(total / pageSize);

			return c.json(
				{
					success: true as const,
					data: {
						content: transformedContent,
						total,
						page,
						limit: pageSize,
						totalPages,
					},
				},
				200,
			);
		} catch (error) {
			console.error("Error fetching all CMS content:", error);
			return c.json(
				{
					success: false as const,
					error: "Internal server error",
					details: [
						{
							field: "server",
							message: "An unexpected error occurred while fetching content",
							code: "internal_error",
						},
					],
				},
				500,
			);
		}
	},
);

cmsRoute.openapi(
	createRoute({
		method: "get",
		path: "/content/{id}",
		summary: "Get CMS content by ID",
		description: "Fetch CMS content details by Sanity content ID.",
		request: {
			params: z.object({
				id: z.string().openapi({ description: "Sanity content ID" }),
			}),
		},
		responses: {
			200: {
				content: {
					"application/json": {
						schema: successResponseSchema(CmsContentDetailResponseSchema),
					},
				},
				description: "Successfully retrieved content",
			},
			404: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Content not found",
			},
		},
		tags: ["CMS"],
	}),
	async (c) => {
		try {
			const { id } = c.req.valid("param");
			const client = getSanityClient(c.env);

			const content = await client.fetch<SanityContentDetail | null>(
				`*[_type == "news" && _id == $id][0]{
					_id,
					title,
					slug,
					body,
					category,
					publishedAt,
					image,
					"author": author->{_id, name, image}
				}`,
				{ id },
			);

			if (!content) {
				return c.json(
					{
						success: false as const,
						error: "Content not found",
						details: [
							{
								field: "id",
								message: "No CMS content found for the provided ID",
								code: "not_found",
							},
						],
					},
					404,
				);
			}

			const message =
				content.body
					?.flatMap((block) => block.children ?? [])
					.map((child) => child.text?.trim() ?? "")
					.filter(Boolean)
					.join("\n") ?? "";

			const category = content.category;
			const type =
				category === "videos" || category === "ads" ? category : "news";

			return c.json(
				{
					success: true as const,
					data: {
						_id: content._id,
						title: content.title,
						slug: content.slug?.current ?? null,
						message,
						image: content.image ? urlFor(c.env, content.image).url() : null,
						author: {
							_id: content.author?._id ?? null,
							name: content.author?.name ?? "",
							image: content.author?.image
								? urlFor(c.env, content.author.image).width(200).url()
								: null,
						},
						type,
						publishedAt: content.publishedAt,
						status: isDraft(content._id)
							? ("pending" as const)
							: ("verified" as const),
					},
				},
				200,
			);
		} catch (error) {
			console.error("Error fetching CMS content by ID:", error);
			return c.json(
				{
					success: false as const,
					error: "Internal server error",
					details: [
						{
							field: "server",
							message: "An unexpected error occurred while fetching content",
							code: "internal_error",
						},
					],
				},
				500,
			);
		}
	},
);

cmsRoute.openapi(
	createRoute({
		method: "post",
		path: "/content",
		summary: "Create CMS content",
		description: "Create new CMS content. Requires admin authentication.",
		security: [{ BearerAuth: [] }],
		request: {
			body: {
				content: {
					"application/json": {
						schema: CreateCmsContentSchema,
					},
				},
			},
		},
		responses: {
			200: {
				content: {
					"application/json": {
						schema: successResponseSchema(
							z.object({
								_id: z.string(),
								title: z.string(),
								status: z.enum(["pending", "verified"]),
							}),
						),
					},
				},
				description: "Successfully created content",
			},
			400: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Bad request",
			},
			401: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Unauthorized",
			},
			403: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Forbidden - admin only",
			},
		},
		tags: ["CMS"],
	}),
	async (c) => {
		try {
			const token = getSessionToken(c.req.raw.headers);
			const session = await validateAdminSession(c.env, token || "");

			if (
				!session ||
				(session.role !== "admin" && session.role !== "super_admin")
			) {
				return c.json(
					{
						success: false as const,
						error: "Forbidden - admin only",
						details: null,
					},
					403,
				);
			}

			if (
				session.role !== "super_admin" &&
				!requirePermission(session, "post_upload_content")
			) {
				return c.json(
					{
						success: false as const,
						error: "Forbidden - post_upload_content permission required",
					},
					403,
				);
			}

			const { title, message, contentType, bannerImage, authorName } =
				c.req.valid("json");

			const client = getSanityServerClient(c.env);

			const authorQuery = `*[_type == "author" && (name == $authorName || slug.current == $slugifiedName)][0]{
				_id,
				name
			}`;

			const author = await client.fetch<{ _id: string; name: string }>(
				authorQuery,
				{
					authorName,
					slugifiedName: slugify(authorName),
				},
			);

			if (!author) {
				const errorResponse = {
					success: false as const,
					error: "Author not found",
					details: [
						{
							field: "authorName",
							message: "Author with the provided name does not exist",
							code: "not_found",
						},
					],
				};
				return c.json(errorResponse, 400);
			}

			let imageAsset:
				| {
						_type: "image";
						asset: { _type: "reference"; _ref: string };
				  }
				| undefined;
			if (bannerImage) {
				try {
					const base64Data = bannerImage.replace(
						/^data:image\/\w+;base64,/,
						"",
					);
					const buffer = Buffer.from(base64Data, "base64");
					const asset = await client.assets.upload("image", buffer, {
						filename: `${slugify(title)}.jpg`,
					});
					imageAsset = {
						_type: "image",
						asset: {
							_type: "reference",
							_ref: asset._id,
						},
					};
				} catch (imageError) {
					console.error("Error uploading image:", imageError);
				}
			}

			const doc: {
				_id?: string;
				_type: string;
				title: string;
				slug: { _type: string; current: string };
				body: Array<{
					_type: string;
					children: Array<{ _type: string; text: string }>;
				}>;
				category: string;
				author: { _type: string; _ref: string };
				publishedAt: string;
				image?: {
					_type: "image";
					asset: { _type: "reference"; _ref: string };
				};
			} = {
				_type: "news",
				title,
				slug: {
					_type: "slug",
					current: slugify(title),
				},
				body: [
					{
						_type: "block",
						children: [
							{
								_type: "span",
								text: message,
							},
						],
					},
				],
				category: contentType,
				author: {
					_type: "reference",
					_ref: author._id,
				},
				publishedAt: new Date().toISOString(),
			};

			if (imageAsset) {
				doc.image = imageAsset;
			}

			const createdDoc = await client.create(doc);

			return c.json(
				{
					success: true as const,
					data: {
						_id: createdDoc._id,
						title: createdDoc.title as string,
						status: "pending",
					},
				},
				200,
			);
		} catch (error) {
			console.error("Error creating CMS content:", error);
			return c.json(
				{
					success: false as const,
					error: "Internal server error",
					details: [
						{
							field: "server",
							message: "An unexpected error occurred while creating content",
							code: "internal_error",
						},
					],
				},
				500,
			);
		}
	},
);

cmsRoute.openapi(
	createRoute({
		method: "put",
		path: "/content/{id}",
		summary: "Update CMS content",
		description:
			"Update an existing CMS content item by Sanity ID. Requires admin authentication. Send any subset of the create fields to patch only those values.",
		security: [{ BearerAuth: [] }],
		request: {
			params: z.object({
				id: z.string().openapi({ description: "Sanity content ID" }),
			}),
			body: {
				content: {
					"application/json": {
						schema: UpdateCmsContentSchema,
					},
				},
			},
		},
		responses: {
			200: {
				content: {
					"application/json": {
						schema: successResponseSchema(
							z.object({
								_id: z.string(),
								title: z.string(),
								status: z.enum(["pending", "verified"]),
							}),
						),
					},
				},
				description: "Successfully updated content",
			},
			400: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Bad request",
			},
			401: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Unauthorized",
			},
			403: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Forbidden - admin only",
			},
			404: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Content not found",
			},
		},
		tags: ["CMS"],
	}),
	async (c) => {
		try {
			const token = getSessionToken(c.req.raw.headers);
			const session = await validateAdminSession(c.env, token || "");

			if (
				!session ||
				(session.role !== "admin" && session.role !== "super_admin")
			) {
				return c.json(
					{
						success: false as const,
						error: "Forbidden - admin only",
						details: null,
					},
					403,
				);
			}

			if (
				session.role !== "super_admin" &&
				!requirePermission(session, "post_upload_content")
			) {
				return c.json(
					{
						success: false as const,
						error: "Forbidden - post_upload_content permission required",
					},
					403,
				);
			}

			const { id } = c.req.valid("param");
			const body = c.req.valid("json");

			if (!id || !id.trim()) {
				return c.json(
					{
						success: false as const,
						error: "Bad request",
						details: [
							{
								field: "id",
								message: "Content ID is required",
								code: "invalid_param",
							},
						],
					},
					400,
				);
			}

			const hasUpdate =
				body.title !== undefined ||
				body.message !== undefined ||
				body.contentType !== undefined ||
				body.bannerImage !== undefined ||
				body.authorName !== undefined;

			if (!hasUpdate) {
				return c.json(
					{
						success: false as const,
						error: "Bad request",
						details: [
							{
								field: "body",
								message:
									"Provide at least one field to update the CMS content",
								code: "invalid_body",
							},
						],
					},
					400,
				);
			}

			const client = getSanityServerClient(c.env);
			const existingDoc = await client.fetch<{
				_id: string;
				title: string;
				category?: string;
				publishedAt: string;
				image?: unknown;
				author?: { _id?: string; name?: string };
			} | null>(
				`*[_type == "news" && _id == $id][0]{
					_id,
					title,
					category,
					publishedAt,
					image,
					"author": author->{_id, name}
				}`,
				{ id },
			);

			if (!existingDoc) {
				return c.json(
					{
						success: false as const,
						error: "Content not found",
						details: [
							{
								field: "id",
								message: "No content found with the provided ID",
								code: "not_found",
							},
						],
					},
					404,
				);
			}

			const patch: Record<string, unknown> = {};
			const unsetFields: string[] = [];

			if (body.title !== undefined) {
				patch.title = body.title;
				patch.slug = {
					_type: "slug",
					current: slugify(body.title),
				};
			}

			if (body.message !== undefined) {
				patch.body = [
					{
						_type: "block",
						children: [
							{
								_type: "span",
								text: body.message,
							},
						],
					},
				];
			}

			if (body.contentType !== undefined) {
				patch.category = body.contentType;
			}

			if (body.authorName !== undefined) {
				const author = await client.fetch<{ _id: string; name: string } | null>(
					`*[_type == "author" && (name == $authorName || slug.current == $slugifiedName)][0]{
						_id,
						name
					}`,
					{
						authorName: body.authorName,
						slugifiedName: slugify(body.authorName),
					},
				);

				if (!author) {
					return c.json(
						{
							success: false as const,
							error: "Author not found",
							details: [
								{
									field: "authorName",
									message: "Author with the provided name does not exist",
									code: "not_found",
								},
							],
						},
						400,
					);
				}

				patch.author = {
					_type: "reference",
					_ref: author._id,
				};
			}

			if (body.bannerImage !== undefined) {
				if (body.bannerImage === null) {
					unsetFields.push("image");
				} else {
					try {
						const base64Data = body.bannerImage.replace(
							/^data:image\/\w+;base64,/,
							"",
						);
						const buffer = Buffer.from(base64Data, "base64");
						const asset = await client.assets.upload("image", buffer, {
							filename: `${slugify(body.title ?? existingDoc.title)}.jpg`,
						});
						patch.image = {
							_type: "image",
							asset: {
								_type: "reference",
								_ref: asset._id,
							},
						};
					} catch (imageError) {
						console.error("Error uploading image:", imageError);
					}
				}
			}

			if (Object.keys(patch).length === 0 && unsetFields.length === 0) {
				return c.json(
					{
						success: false as const,
						error: "Bad request",
						details: [
							{
								field: "body",
								message:
									"Unable to apply the requested update. Try changing at least one field.",
								code: "invalid_body",
							},
						],
					},
					400,
				);
			}

			const patchRequest = client.patch(id);
			if (Object.keys(patch).length > 0) {
				patchRequest.set(patch);
			}
			if (unsetFields.length > 0) {
				patchRequest.unset(unsetFields);
			}

			await patchRequest.commit();

			return c.json(
				{
					success: true as const,
					data: {
						_id: id,
						title: (body.title ?? existingDoc.title) as string,
						status: isDraft(id) ? ("pending" as const) : ("verified" as const),
					},
				},
				200,
			);
		} catch (error) {
			console.error("Error updating CMS content:", error);
			return c.json(
				{
					success: false as const,
					error: "Internal server error",
					details: [
						{
							field: "server",
							message: "An unexpected error occurred while updating content",
							code: "internal_error",
						},
					],
				},
				500,
			);
		}
	},
);

cmsRoute.openapi(
	createRoute({
		method: "delete",
		path: "/content/{id}",
		summary: "Delete CMS content",
		description: "Delete CMS content by ID. Requires admin authentication.",
		security: [{ BearerAuth: [] }],
		request: {
			params: z.object({
				id: z.string().openapi({ description: "Content ID to delete" }),
			}),
		},
		responses: {
			200: {
				content: {
					"application/json": {
						schema: successResponseSchema(z.object({ deletedId: z.string() })),
					},
				},
				description: "Successfully deleted content",
			},
			400: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Bad request - invalid ID",
			},
			401: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Unauthorized",
			},
			403: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Forbidden - admin only",
			},
			404: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Content not found",
			},
		},
		tags: ["CMS"],
	}),
	async (c) => {
		try {
			const token = getSessionToken(c.req.raw.headers);
			const session = await validateAdminSession(c.env, token || "");

			if (
				!session ||
				(session.role !== "admin" && session.role !== "super_admin")
			) {
				return c.json(
					{
						success: false as const,
						error: "Forbidden - admin only",
						details: null,
					},
					403,
				);
			}

			if (
				session.role !== "super_admin" &&
				!requirePermission(session, "post_upload_content")
			) {
				return c.json(
					{
						success: false as const,
						error: "Forbidden - post_upload_content permission required",
					},
					403,
				);
			}

			const { id } = c.req.valid("param");

			if (!id || !id.trim()) {
				return c.json(
					{
						success: false as const,
						error: "Bad request",
						details: [
							{
								field: "id",
								message: "Content ID is required",
								code: "invalid_param",
							},
						],
					},
					400,
				);
			}

			const client = getSanityServerClient(c.env);

			const existingDoc = await client.fetch<{ _id: string }>(
				`*[_type == "news" && _id == $id][0]{_id}`,
				{ id },
			);

			if (!existingDoc) {
				return c.json(
					{
						success: false as const,
						error: "Content not found",
						details: [
							{
								field: "id",
								message: "No content found with the provided ID",
								code: "not_found",
							},
						],
					},
					404,
				);
			}

			await client.delete(id);

			return c.json(
				{
					success: true as const,
					data: { deletedId: id },
				},
				200,
			);
		} catch (error) {
			console.error("Error deleting CMS content:", error);
			return c.json(
				{
					success: false as const,
					error: "Internal server error",
					details: [
						{
							field: "server",
							message: "An unexpected error occurred while deleting content",
							code: "internal_error",
						},
					],
				},
				500,
			);
		}
	},
);

export default cmsRoute;
