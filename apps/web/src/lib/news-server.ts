import { apiRequest } from "./api";

export type ImageSizes = {
	url: string;
	thumb: string;
	card: string;
	hero: string;
	og: string;
};

export type NewsListItem = {
	_id: string;
	title: string;
	publishedAt: string;
	category?: string;
	image: ImageSizes | null;
	slug: { current: string } | null;
	author: AuthorRef | null;
	body: unknown;
};

export type AuthorRef = {
	_id: string;
	name: string;
	slug: { current: string } | null;
	image: ImageSizes | null;
	bio?: unknown;
	facebook?: string;
	x?: string;
	linkedin?: string;
};

export type NewsDetail = {
	_id: string;
	title: string;
	publishedAt: string;
	image: ImageSizes | null;
	slug: { current: string } | null;
	body: unknown;
	author: AuthorRef | null;
};

export type AuthorDetail = {
	_id: string;
	name: string;
	slug: { current: string } | null;
	image: ImageSizes | null;
	bio: unknown;
	facebook?: string;
	x?: string;
	linkedin?: string;
};

export type AuthorNewsItem = {
	_id: string;
	title: string;
	publishedAt: string;
	image: ImageSizes | null;
	slug: { current: string } | null;
	body: unknown;
	sport?: string;
};

export type Comment = {
	_id: string;
	name: string;
	message: string;
	createdAt: string;
};

export async function getNews(params: {
	category: string;
	offset?: number;
	limit?: number;
}): Promise<NewsListItem[]> {
	const query = new URLSearchParams({
		category: params.category,
		offset: String(params.offset ?? 0),
		limit: String(params.limit ?? 12),
	});
	return apiRequest<NewsListItem[]>(`cms/public/news?${query.toString()}`);
}

export async function getNewsById(id: string): Promise<NewsDetail | null> {
	return apiRequest<NewsDetail | null>(
		`cms/public/news/by-id/${encodeURIComponent(id)}`,
	);
}

export async function getNewsBySlug(slug: string): Promise<NewsDetail | null> {
	return apiRequest<NewsDetail | null>(
		`cms/public/news/by-slug/${encodeURIComponent(slug)}`,
	);
}

export async function getAuthorBySlug(
	slug: string,
): Promise<AuthorDetail | null> {
	return apiRequest<AuthorDetail | null>(
		`cms/public/authors/by-slug/${encodeURIComponent(slug)}`,
	);
}

export async function getNewsByAuthor(params: {
	authorId: string;
	offset?: number;
	limit?: number;
}): Promise<AuthorNewsItem[]> {
	const query = new URLSearchParams({
		offset: String(params.offset ?? 0),
		limit: String(params.limit ?? 10),
	});
	return apiRequest<AuthorNewsItem[]>(
		`cms/public/authors/${encodeURIComponent(params.authorId)}/news?${query.toString()}`,
	);
}

export async function getNewsByAuthorTotal(authorId: string): Promise<number> {
	return apiRequest<number>(
		`cms/public/authors/${encodeURIComponent(authorId)}/news/total`,
	);
}

export async function getCommentsForNews(newsId: string): Promise<Comment[]> {
	return apiRequest<Comment[]>(
		`cms/public/news/${encodeURIComponent(newsId)}/comments`,
	);
}

export async function addCommentToNews(params: {
	newsId: string;
	message: string;
}): Promise<Comment> {
	return apiRequest<Comment>(
		`cms/public/news/${encodeURIComponent(params.newsId)}/comments`,
		{
			method: "POST",
			credentials: "include",
			body: JSON.stringify({ message: params.message }),
		},
	);
}
