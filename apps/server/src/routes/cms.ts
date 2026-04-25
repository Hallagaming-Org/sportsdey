import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import { ErrorResponseSchema, successResponseSchema } from "@/schemas";
import { getSanityClient, getSanityServerClient, urlFor } from "../lib/sanity";
import type { CloudflareBindings } from "../types";

const cmsRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const CmsContentQuerySchema = z.object({
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
});

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

cmsRoute.openapi(
	createRoute({
		method: "get",
		path: "/authors",
		summary: "List available CMS authors",
		description:
			"Fetch all available authors that can be assigned to CMS content. Requires admin authentication.",
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
			const { search, type, sortBy, page } = c.req.valid("query");
			const client = getSanityClient(c.env);

			const pageSize = 10;
			const start = (page - 1) * pageSize;
			const end = start + pageSize;

			let filterConditions = '_type == "news" && !(_id in path("drafts.**"))';
			const params: Record<string, unknown> = {
				start,
				end,
			};

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

			const sortOrder = sortBy === "title" ? "title asc" : "publishedAt desc";

			const query = `*[_type == "news" && !(_id in path("drafts.**"))] | order(${sortOrder}) [$start...$end] {
				_id,
				title,
				publishedAt,
				category,
				"image": image.asset->url,
				"author": author->{_id, name, image}
			}`;

			const filteredQuery = `*[_type == "news" && !(_id in path("drafts.**")) ${search ? "&& (title match $search || author->name match $search)" : ""} ${type && type !== "all" ? (type === "news" ? '&& (category != "videos" && category != "ads")' : "&& category == $type") : ""}] | order(${sortOrder}) [$start...$end] {
				_id,
				title,
				publishedAt,
				category,
				"image": image.asset->url,
				"author": author->{_id, name, image}
			}`;

			let finalQuery = query;
			if (search || (type && type !== "all")) {
				finalQuery = filteredQuery;
			} else {
				finalQuery = `*[_type == "news" && !(_id in path("drafts.**"))] | order(${sortOrder}) [$start...$end] {
					_id,
					title,
					publishedAt,
					category,
					"image": image.asset->url,
					"author": author->{_id, name, image}
				}`;
			}

			const content = await client.fetch<Array<SanityContent>>(
				finalQuery,
				params,
			);

			const transformedContent = content.map((item: SanityContent) => {
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

			const totalParams: Record<string, unknown> = {};
			let totalFilter = '_type == "news" && !(_id in path("drafts.**"))';
			if (search && search.trim()) {
				totalFilter +=
					" && (title match $search || author->name match $search)";
				totalParams.search = `*${search.trim()}*`;
			}
			if (type && type !== "all") {
				totalFilter += " && category == $type";
				totalParams.type = type;
			}
			const totalQuery = `count(*[${totalFilter}])`;
			const total = await client.fetch<number>(totalQuery, totalParams);
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

			const { search, type, sortBy, page } = c.req.valid("query");
			const client = getSanityClient(c.env);

			const pageSize = 10;
			const start = (page - 1) * pageSize;
			const end = start + pageSize;
			const sortOrder = sortBy === "title" ? "title asc" : "publishedAt desc";

			let filterConditions = '_type == "news"';
			const params: Record<string, unknown> = {
				start,
				end,
			};

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

			const query = `*[${filterConditions}] | order(${sortOrder}) [$start...$end] {
				_id,
				title,
				publishedAt,
				category,
				image,
				"author": author->{_id, name, image}
			}`;

			const content = await client.fetch<Array<SanityContent>>(query, params);

			const transformedContent = content.map((item: SanityContent) => {
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

			let totalFilter = '_type == "news"';
			const totalParams: Record<string, unknown> = {};
			if (search && search.trim()) {
				totalFilter +=
					" && (title match $search || author->name match $search)";
				totalParams.search = `*${search.trim()}*`;
			}
			if (type && type !== "all") {
				if (type === "news") {
					totalFilter += ' && (category != "videos" && category != "ads")';
				} else {
					totalFilter += " && category == $type";
					totalParams.type = type;
				}
			}
			const totalQuery = `count(*[${totalFilter}])`;
			const total = await client.fetch<number>(totalQuery, totalParams);
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
		method: "post",
		path: "/content",
		summary: "Create CMS content",
		description: "Create new CMS content. Requires admin authentication.",
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

export default cmsRoute;
