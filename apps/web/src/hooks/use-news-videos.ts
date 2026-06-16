import { useInfiniteQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { NewsResponse } from "@/types/news";

export function useNewsVideos(query: string, channelId?: string) {
	return useInfiniteQuery({
		queryKey: ["news-videos", query, channelId],
		queryFn: ({ pageParam }) => {
			let endpoint = `news/videos?query=${encodeURIComponent(query)}`;
			if (pageParam) endpoint += `&pageToken=${pageParam}`;
			if (channelId) endpoint += `&channelId=${channelId}`;
			return apiRequest<NewsResponse>(endpoint);
		},
		initialPageParam: "",
		getNextPageParam: (lastPage) => lastPage.nextPageToken,
	});
}
