import { useInfiniteQuery } from "@tanstack/react-query";
import { getNews } from "@/lib/news-server";

const LIMIT = 12;

export function useNewsData(category: string) {
	return useInfiniteQuery({
		queryKey: ["news", category],
		queryFn: async ({ pageParam = 0 }) => {
			const result = await getNews({
				category,
				offset: pageParam,
				limit: LIMIT,
			});
			return result || [];
		},
		getNextPageParam: (lastPage, allPages) => {
			if (!lastPage || lastPage.length < LIMIT) {
				return undefined;
			}
			return allPages.length * LIMIT;
		},
		initialPageParam: 0,
	});
}
