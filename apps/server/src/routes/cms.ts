import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ErrorResponseSchema, successResponseSchema } from "@/schemas";
import { getSanityClient, getSanityServerClient } from "../lib/sanity";
import { toImageSizes } from "../lib/sanity-image";
import { toWAT } from "@/utils";
import type { CloudflareBindings } from "../types";

const cmsRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const ImageSizesSchema = z
	.object({
		url: z.string(),
		thumb: z.string(),
		card: z.string(),
		hero: z.string(),
		og: z.string(),
	})
	.nullable()
	.openapi("ImageSizes");

const AuthorRefSchema = z
	.object({
		_id: z.string(),
		name: z.string(),
		slug: z.object({ current: z.string() }).nullable().optional(),
		image: ImageSizesSchema,
		bio: z.any().optional(),
		facebook: z.string().optional(),
		x: z.string().optional(),
		linkedin: z.string().optional(),
	})
	.openapi("AuthorRef");

const NewsListItemSchema = z
	.object({
		_id: z.string(),
		title: z.string(),
		publishedAt: z.string(),
		category: z.string().optional(),
		image: ImageSizesSchema,
		slug: z.object({ current: z.string() }).nullable().optional(),
		author: AuthorRefSchema.nullable().optional(),
		body: z.any().nullable().optional(),
	})
	.openapi("NewsListItem");

const NewsDetailSchema = z
	.object({
		_id: z.string(),
		title: z.string(),
		publishedAt: z.string(),
		image: ImageSizesSchema,
		slug: z.object({ current: z.string() }).nullable().optional(),
		body: z.any().nullable().optional(),
		author: AuthorRefSchema.nullable().optional(),
	})
	.openapi("NewsDetail");

const AuthorDetailSchema = z
	.object({
		_id: z.string(),
		name: z.string(),
		slug: z.object({ current: z.string() }).nullable().optional(),
		image: ImageSizesSchema,
		bio: z.any().nullable().optional(),
		facebook: z.string().optional(),
		x: z.string().optional(),
		linkedin: z.string().optional(),
	})
	.openapi("AuthorDetail");

const AuthorNewsItemSchema = z
	.object({
		_id: z.string(),
		title: z.string(),
		publishedAt: z.string(),
		image: ImageSizesSchema,
		slug: z.object({ current: z.string() }).nullable().optional(),
		body: z.any().nullable().optional(),
		sport: z.string().optional(),
	})
	.openapi("AuthorNewsItem");

const CommentSchema = z
	.object({
		_id: z.string(),
		name: z.string(),
		message: z.string(),
		createdAt: z.string(),
	})
	.openapi("Comment");

const BannerSchema = z
	.object({
		_id: z.string(),
		imageUrl: z.string(),
		url: z.string(),
		alt: z.string().optional(),
	})
	.openapi("Banner");

type SanityAuthor = {
	_id: string;
	name: string;
	slug?: { current?: string };
	image?: unknown;
	bio?: unknown;
	facebook?: string;
	x?: string;
	linkedin?: string;
};

type SanityNews = {
	_id: string;
	title: string;
	publishedAt: string;
	category?: string;
	image?: unknown;
	slug?: { current?: string };
	body?: unknown;
	author?: SanityAuthor;
	sport?: string;
};

type SanityComment = {
	_id: string;
	name: string;
	message: string;
	createdAt: string;
};

const PromoListItemSchema = z
	.object({
		_id: z.string(),
		imageUrl: z.string(),
		title: z.string(),
		endDate: z.string(),
	})
	.openapi("PromoListItem");

const PromoDetailSchema = z
	.object({
		_id: z.string(),
		bannerImages: z
			.array(
				z.object({
					url: z.string(),
					alt: z.string().optional(),
				}),
			)
			.default([]),
		title: z.string(),
		endDate: z.string(),
		body: z.any().nullable().optional(),
		type: z.string(),
	})
	.openapi("PromoDetail");

type SanityBanner = {
	_id: string;
	image?: unknown;
	url?: string;
	alt?: string;
};

type SanityPromo = {
	_id: string;
	title: string;
	bannerImages?: {
		asset?: unknown;
		alt?: string;
	}[];
	endDate: string;
	body?: unknown;
	type: string;
};

function mapAuthor(env: CloudflareBindings, author: SanityAuthor) {
	return {
		_id: author._id,
		name: author.name,
		slug: author.slug?.current ? { current: author.slug.current } : null,
		image: toImageSizes(env, author.image),
		bio: author.bio ?? null,
		facebook: author.facebook,
		x: author.x,
		linkedin: author.linkedin,
	};
}

function mapNewsListItem(env: CloudflareBindings, n: SanityNews) {
	return {
		_id: n._id,
		title: n.title,
		publishedAt: n.publishedAt,
		category: n.category,
		image: toImageSizes(env, n.image),
		slug: n.slug?.current ? { current: n.slug.current } : null,
		author: n.author ? mapAuthor(env, n.author) : null,
		body: n.body ?? null,
	};
}

function mapNewsDetail(env: CloudflareBindings, n: SanityNews) {
	return {
		_id: n._id,
		title: n.title,
		publishedAt: n.publishedAt,
		image: toImageSizes(env, n.image),
		slug: n.slug?.current ? { current: n.slug.current } : null,
		body: n.body ?? null,
		author: n.author ? mapAuthor(env, n.author) : null,
	};
}

function mapAuthorNews(env: CloudflareBindings, n: SanityNews) {
	return {
		_id: n._id,
		title: n.title,
		publishedAt: n.publishedAt,
		image: toImageSizes(env, n.image),
		slug: n.slug?.current ? { current: n.slug.current } : null,
		body: n.body ?? null,
		sport: n.sport,
	};
}

cmsRoute.openapi(
	createRoute({
		method: "get",
		path: "/public/news",
		summary: "List CMS news",
		description: "List published CMS news with category filter and pagination.",
		request: {
			query: z.object({
				category: z.string().default("all"),
				offset: z.coerce.number().default(0),
				limit: z.coerce.number().default(12),
			}),
		},
		responses: {
			200: {
				content: {
					"application/json": {
						schema: successResponseSchema(NewsListItemSchema.array()),
					},
				},
				description: "Successfully retrieved news",
			},
		},
		tags: ["CMS Public"],
	}),
	async (c) => {
		const { category, offset, limit } = c.req.valid("query");
		const start = offset;
		const end = offset + limit;
		const client = getSanityClient(c.env);

		const baseFields = `{
			_id,
			title,
			publishedAt,
			category,
			image,
			slug,
			body,
			"author": author->{_id, name, slug, image}
		}`;

		const query =
			category === "all"
				? `*[_type == "news" && !(_id in path("drafts.**"))] | order(publishedAt desc)[$start...$end]${baseFields}`
				: `*[_type == "news" && category == $category && !(_id in path("drafts.**"))] | order(publishedAt desc)[$start...$end]${baseFields}`;

		const params: Record<string, unknown> = { start, end };
		if (category !== "all") params.category = category;

		const data = await client.fetch<SanityNews[]>(query, params);
		return c.json(
			{
				success: true as const,
				data: (data || []).map((n) => mapNewsListItem(c.env, n)),
			},
			200,
		);
	},
);

cmsRoute.openapi(
	createRoute({
		method: "get",
		path: "/public/news/by-id/{id}",
		summary: "Get news by ID",
		description: "Fetch a single news article by its Sanity ID.",
		request: {
			params: z.object({ id: z.string() }),
		},
		responses: {
			200: {
				content: {
					"application/json": {
						schema: successResponseSchema(NewsDetailSchema.nullable()),
					},
				},
				description: "Successfully retrieved news (or null)",
			},
		},
		tags: ["CMS Public"],
	}),
	async (c) => {
		const { id } = c.req.valid("param");
		const client = getSanityClient(c.env);
		const data = await client.fetch<SanityNews | null>(
			`*[_type == "news" && _id == $id && !(_id in path("drafts.**"))][0]{
				_id,
				title,
				publishedAt,
				image,
				slug,
				body,
				"author": author->{_id, name, slug, image}
			}`,
			{ id },
		);
		return c.json(
			{
				success: true as const,
				data: data ? mapNewsDetail(c.env, data) : null,
			},
			200,
		);
	},
);

cmsRoute.openapi(
	createRoute({
		method: "get",
		path: "/public/news/by-slug/{slug}",
		summary: "Get news by slug",
		description: "Fetch a single news article by its slug.",
		request: {
			params: z.object({ slug: z.string() }),
		},
		responses: {
			200: {
				content: {
					"application/json": {
						schema: successResponseSchema(NewsDetailSchema.nullable()),
					},
				},
				description: "Successfully retrieved news (or null)",
			},
		},
		tags: ["CMS Public"],
	}),
	async (c) => {
		const { slug } = c.req.valid("param");
		const client = getSanityClient(c.env);
		const data = await client.fetch<SanityNews | null>(
			`*[_type == "news" && slug.current == $slug && !(_id in path("drafts.**"))][0]{
				_id,
				title,
				publishedAt,
				image,
				slug,
				body,
				"author": author->{_id, name, slug, image}
			}`,
			{ slug },
		);
		return c.json(
			{
				success: true as const,
				data: data ? mapNewsDetail(c.env, data) : null,
			},
			200,
		);
	},
);

cmsRoute.openapi(
	createRoute({
		method: "get",
		path: "/public/authors/by-slug/{slug}",
		summary: "Get author by slug",
		description: "Fetch an author by their slug.",
		request: {
			params: z.object({ slug: z.string() }),
		},
		responses: {
			200: {
				content: {
					"application/json": {
						schema: successResponseSchema(AuthorDetailSchema.nullable()),
					},
				},
				description: "Successfully retrieved author (or null)",
			},
		},
		tags: ["CMS Public"],
	}),
	async (c) => {
		const { slug } = c.req.valid("param");
		const client = getSanityClient(c.env);
		const data = await client.fetch<SanityAuthor | null>(
			`*[_type == "author" && slug.current == $slug && !(_id in path("drafts.**"))][0]{
				_id,
				name,
				slug,
				image,
				bio,
				facebook,
				x,
				linkedin
			}`,
			{ slug },
		);
		return c.json(
			{ success: true as const, data: data ? mapAuthor(c.env, data) : null },
			200,
		);
	},
);

cmsRoute.openapi(
	createRoute({
		method: "get",
		path: "/public/authors/{id}/news",
		summary: "List news by author",
		description: "List news articles authored by the given author ID.",
		request: {
			params: z.object({ id: z.string() }),
			query: z.object({
				offset: z.coerce.number().default(0),
				limit: z.coerce.number().default(10),
			}),
		},
		responses: {
			200: {
				content: {
					"application/json": {
						schema: successResponseSchema(AuthorNewsItemSchema.array()),
					},
				},
				description: "Successfully retrieved news",
			},
		},
		tags: ["CMS Public"],
	}),
	async (c) => {
		const { id: authorId } = c.req.valid("param");
		const { offset, limit } = c.req.valid("query");
		const client = getSanityClient(c.env);
		const data = await client.fetch<SanityNews[]>(
			`*[_type == "news" && references($authorId) && !(_id in path("drafts.**"))] | order(publishedAt desc) [$offset...$end] {
				_id,
				title,
				publishedAt,
				image,
				slug,
				body,
				sport
			}`,
			{ authorId, offset, end: offset + limit },
		);
		return c.json(
			{
				success: true as const,
				data: (data || []).map((n) => mapAuthorNews(c.env, n)),
			},
			200,
		);
	},
);

cmsRoute.openapi(
	createRoute({
		method: "get",
		path: "/public/authors/{id}/news/total",
		summary: "Count news by author",
		description: "Count news articles authored by the given author ID.",
		request: {
			params: z.object({ id: z.string() }),
		},
		responses: {
			200: {
				content: {
					"application/json": {
						schema: successResponseSchema(z.number()),
					},
				},
				description: "Successfully retrieved total",
			},
		},
		tags: ["CMS Public"],
	}),
	async (c) => {
		const { id: authorId } = c.req.valid("param");
		const client = getSanityClient(c.env);
		const total = await client.fetch<number>(
			`count(*[_type == "news" && references($authorId) && !(_id in path("drafts.**"))])`,
			{ authorId },
		);
		return c.json({ success: true as const, data: total || 0 }, 200);
	},
);

cmsRoute.openapi(
	createRoute({
		method: "get",
		path: "/public/news/{id}/comments",
		summary: "List comments for a news article",
		description: "Fetch comments for the given news article ID.",
		request: {
			params: z.object({ id: z.string() }),
		},
		responses: {
			200: {
				content: {
					"application/json": {
						schema: successResponseSchema(CommentSchema.array()),
					},
				},
				description: "Successfully retrieved comments",
			},
		},
		tags: ["CMS Public"],
	}),
	async (c) => {
		const { id: newsId } = c.req.valid("param");
		const client = getSanityClient(c.env);
		const data = await client.fetch<SanityComment[]>(
			`*[_type == "comment" && news._ref == $newsId] | order(createdAt desc){
				_id,
				name,
				message,
				createdAt
			}`,
			{ newsId },
		);
		return c.json({ success: true as const, data: data || [] }, 200);
	},
);

cmsRoute.openapi(
	createRoute({
		method: "post",
		path: "/public/news/{id}/comments",
		summary: "Post a comment",
		description:
			"Create a new comment on a news article. Requires an authenticated session.",
		request: {
			params: z.object({ id: z.string() }),
			body: {
				content: {
					"application/json": {
						schema: z.object({
							message: z.string().min(1),
						}),
					},
				},
			},
		},
		responses: {
			200: {
				content: {
					"application/json": {
						schema: successResponseSchema(CommentSchema),
					},
				},
				description: "Successfully created comment",
			},
			401: {
				content: {
					"application/json": { schema: ErrorResponseSchema },
				},
				description: "Unauthorized - no active session",
			},
		},
		tags: ["CMS Public"],
	}),
	async (c) => {
		const user = c.get("user");
		if (!user?.id) {
			return c.json(
				{
					success: false as const,
					error: "Unauthorized",
					details: [
						{
							field: "session",
							message: "You must be signed in to comment",
							code: "unauthorized",
						},
					],
				},
				401,
			);
		}

		const { id: newsId } = c.req.valid("param");
		const { message } = c.req.valid("json");

		if (!c.env.SANITY_WRITE_TOKEN) {
			return c.json(
				{
					success: false as const,
					error: "Configuration error",
					details: [
						{
							field: "SANITY_WRITE_TOKEN",
							message: "Sanity write client is not configured",
							code: "missing_token",
						},
					],
				},
				500,
			);
		}

		const client = getSanityClient(c.env);
		const now = toWAT(new Date());
		const doc = await client.create({
			_type: "comment",
			name: user.name || user.email || "SportsDey user",
			email: user.email || undefined,
			userId: user.id,
			message: message.trim(),
			news: {
				_type: "reference",
				_ref: newsId,
			},
			createdAt: now,
		});

		return c.json(
			{
				success: true as const,
				data: {
					_id: doc._id,
					name: user.name || user.email || "SportsDey user",
					message: message.trim(),
					createdAt: now,
				},
			},
			200,
		);
	},
);

cmsRoute.openapi(
	createRoute({
		method: "get",
		path: "/public/banners",
		summary: "List banners",
		description: "Fetch active banner images with pre-built URLs.",
		responses: {
			200: {
				content: {
					"application/json": {
						schema: successResponseSchema(BannerSchema.array()),
					},
				},
				description: "Successfully retrieved banners",
			},
		},
		tags: ["CMS Public"],
	}),
	async (c) => {
		const client = getSanityClient(c.env);
		const data = await client.fetch<SanityBanner[]>(
			`*[_type == "banner" && !(_id in path("drafts.**"))] | order(_createdAt desc)[0...10] {
				_id,
				image,
				url,
				alt
			}`,
		);
		if (!data || !Array.isArray(data) || data.length === 0) {
			return c.json({ success: true as const, data: [] }, 200);
		}
		const banners = data
			.filter((b) => b && typeof b === "object" && "image" in b && b.image)
			.map((b) => ({
				_id: b._id,
				imageUrl: toImageSizes(c.env, b.image)?.hero ?? "",
				url: b.url ?? "",
				alt: b.alt,
			}));
		return c.json({ success: true as const, data: banners }, 200);
	},
);

function mapPromoListItem(env: CloudflareBindings, p: SanityPromo) {
	const img = p.bannerImages?.[0]?.asset
		? toImageSizes(env, p.bannerImages[0].asset)
		: null;
	return {
		_id: p._id,
		imageUrl: img?.hero ?? "",
		title: p.title,
		endDate: p.endDate,
	};
}

function mapPromoDetail(env: CloudflareBindings, p: SanityPromo) {
	return {
		_id: p._id,
		bannerImages: (p.bannerImages || [])
			.filter((bi) => bi?.asset)
			.map((bi) => {
				const sizes = toImageSizes(env, bi.asset);
				return {
					url: sizes?.hero ?? "",
					alt: bi.alt,
				};
			}),
		title: p.title,
		endDate: p.endDate,
		body: p.body ?? null,
		type: p.type,
	};
}

cmsRoute.openapi(
	createRoute({
		method: "get",
		path: "/public/promos",
		summary: "List promotions",
		description:
			"List published promotions with optional type filter (all, sportsdey-exclusive, casino, sport).",
		request: {
			query: z.object({
				type: z.string().default("all"),
				offset: z.coerce.number().default(0),
				limit: z.coerce.number().default(20),
			}),
		},
		responses: {
			200: {
				content: {
					"application/json": {
						schema: successResponseSchema(PromoListItemSchema.array()),
					},
				},
				description: "Successfully retrieved promotions",
			},
		},
		tags: ["CMS Public"],
	}),
	async (c) => {
		const { type, offset, limit } = c.req.valid("query");
		const client = getSanityClient(c.env);

		const baseFields = `{
			_id,
			title,
			bannerImages[]{asset, alt},
			endDate,
			type
		}`;

		const query =
			type === "all"
				? `*[_type == "promo" && !(_id in path("drafts.**"))] | order(endDate desc)[$offset...$end]${baseFields}`
				: `*[_type == "promo" && type == $type && !(_id in path("drafts.**"))] | order(endDate desc)[$offset...$end]${baseFields}`;

		const params: Record<string, unknown> = { offset, end: offset + limit };
		if (type !== "all") params.type = type;

		const data = await client.fetch<SanityPromo[]>(query, params);
		return c.json(
			{
				success: true as const,
				data: (data || []).map((p) => mapPromoListItem(c.env, p)),
			},
			200,
		);
	},
);

cmsRoute.openapi(
	createRoute({
		method: "get",
		path: "/public/promos/{id}",
		summary: "Get promotion by ID",
		description: "Fetch a single promotion by its Sanity ID.",
		request: {
			params: z.object({ id: z.string() }),
		},
		responses: {
			200: {
				content: {
					"application/json": {
						schema: successResponseSchema(PromoDetailSchema.nullable()),
					},
				},
				description: "Successfully retrieved promotion (or null)",
			},
		},
		tags: ["CMS Public"],
	}),
	async (c) => {
		const { id } = c.req.valid("param");
		const client = getSanityClient(c.env);
		const data = await client.fetch<SanityPromo | null>(
			`*[_type == "promo" && _id == $id && !(_id in path("drafts.**"))][0]{
				_id,
				title,
				bannerImages[]{asset, alt},
				endDate,
				body,
				type
			}`,
			{ id },
		);
		return c.json(
			{
				success: true as const,
				data: data ? mapPromoDetail(c.env, data) : null,
			},
			200,
		);
	},
);

export default cmsRoute;
