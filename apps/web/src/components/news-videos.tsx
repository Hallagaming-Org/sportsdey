import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNewsVideos } from "@/hooks/use-news-videos";
import { CATEGORY_CHANNEL_IDS } from "@/lib/video-channels";
import { VideoCard } from "./basketball-section/VideoCard";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoModal } from "./basketball-section/VideoModal";

export function VideosTab({ category }: { category: string }) {
	const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
	const channelId = CATEGORY_CHANNEL_IDS[category];
	const query =
		category === "all"
			? "football basketball tennis boxing match highlights live matches news"
			: category === "politics" || category === "entertainment"
				? `${category} news around the world especially Nigeria`
				: `${category} match highlights live matches news`;
	const {
		data,
		isLoading,
		isFetching,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isError,
	} = useNewsVideos(query, channelId);

	const observerTarget = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
					fetchNextPage();
				}
			},
			{ threshold: 1.0 },
		);

		if (observerTarget.current) {
			observer.observe(observerTarget.current);
		}

		return () => observer.disconnect();
	}, [fetchNextPage, hasNextPage, isFetchingNextPage]);

	if (isLoading || (isFetching && !isFetchingNextPage)) {
		return (
			<div className="rounded-2xl bg-white dark:bg-card">
				<div className="border-gray-200 border-b px-4 py-2 dark:border-[#5A5F63]">
					<h2 className="font-bold text-xl dark:text-white">Videos</h2>
				</div>
				<div className="grid gap-6 px-4 py-4 md:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<div
							key={`video-skel-${i}`}
							className="flex flex-col space-y-2"
						>
							<div className="relative w-full overflow-hidden rounded-lg pb-[56.25%]">
								<Skeleton className="absolute top-0 left-0 h-full w-full rounded-lg" />
							</div>
							<Skeleton className="h-4 w-3/4 mt-2" />
							<Skeleton className="h-4 w-1/2" />
						</div>
					))}
				</div>
			</div>
		);
	}

	if (isError) {
		return (
			<div className="flex h-96 items-center justify-center text-red-500">
				Failed to load news videos.
			</div>
		);
	}

	return (
		<div className="rounded-2xl bg-white dark:bg-card">
			<div className="border-gray-200 border-b px-4 py-2 dark:border-[#5A5F63]">
				<h2 className="font-bold text-xl dark:text-white">Videos</h2>
			</div>
			<div className="grid gap-6 px-4 py-4 md:grid-cols-2 lg:grid-cols-3">
				{data?.pages.map((page, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
					<div key={i} className="contents">
						{page.videos.map((video) => (
							<VideoCard
								key={video.videoId}
								videoId={video.videoId}
								title={video.title}
								publishedAt={video.publishedAt}
								onPlay={setSelectedVideoId}
							/>
						))}
						<VideoModal
							videoId={selectedVideoId}
							onClose={() => setSelectedVideoId(null)}
						/>
					</div>
				))}
			</div>

			<div ref={observerTarget} className="mt-8 flex justify-center py-4">
				{isFetchingNextPage && (
					<Loader2 className="h-6 w-6 animate-spin text-primary dark:text-white" />
				)}
			</div>
		</div>
	);
}
