import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { ImageSizes } from "@/lib/news-server";
import { getNewsByAuthor, getNewsByAuthorTotal } from "@/lib/news-server";

export interface AuthorNewsItem {
	_id: string;
	title: string;
	publishedAt: string;
	image: ImageSizes | null;
	slug: { current: string } | null;
	body: unknown;
	sport?: string;
}

const ITEMS_PER_PAGE = 9;

export function useAuthorNews(authorId: string) {
	const { data: totalData } = useQuery({
		queryKey: ["author-news-total", authorId],
		queryFn: () => getNewsByAuthorTotal(authorId),
		enabled: !!authorId,
	});

	const total = totalData || 0;

	const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
		useInfiniteQuery<AuthorNewsItem[]>({
			queryKey: ["author-news", authorId],
			queryFn: ({ pageParam = 0 }) =>
				getNewsByAuthor({
					authorId,
					limit: ITEMS_PER_PAGE,
					offset: pageParam as number,
				}),
			initialPageParam: 0,
			getNextPageParam: (lastPage, allPages) => {
				const loaded = allPages.flatMap((p) => p).length;
				return loaded < total ? loaded : undefined;
			},
			enabled: !!authorId && total > 0,
		});

	return {
		news: data?.pages.flatMap((page) => page) || [],
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading,
		total,
	};
}
