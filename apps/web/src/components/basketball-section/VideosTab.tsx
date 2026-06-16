import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/api";
import { CATEGORY_CHANNEL_IDS } from "@/lib/video-channels";
import type { BasketballVideosData } from "@/types/api";
import { VideoCard } from "./VideoCard";
import { VideoModal } from "./VideoModal";

interface VideosTabProps {
	homeTeam: string;
	awayTeam: string;
}

import { Skeleton } from "@/components/ui/skeleton";

function VideoCardSkeleton() {
	return (
		<div className="space-y-3">
			<Skeleton className="aspect-video w-full rounded-xl bg-gray-800" />
			<div className="space-y-2">
				<Skeleton className="h-4 w-3/4 bg-gray-800" />
				<Skeleton className="h-3 w-1/4 bg-gray-800" />
			</div>
		</div>
	);
}

export function VideosTab({ homeTeam, awayTeam }: VideosTabProps) {
	const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
	const channelId = CATEGORY_CHANNEL_IDS.basketball;
	const searchQuery = `${homeTeam} Vs ${awayTeam}`;
	const channelParam = channelId ? `&channelId=${channelId}` : "";

	const { data: videosData, isLoading } = useQuery({
		queryKey: ["basketball", "videos", searchQuery, channelId],
		queryFn: () =>
			apiRequest<BasketballVideosData>(
				`basketball/videos?query=${encodeURIComponent(searchQuery)}${channelParam}`,
			),
		enabled: !!homeTeam && !!awayTeam,
	});

	if (isLoading) {
		return (
			<div className="space-y-4">
				<h3 className="font-bold text-primary text-xl">Game Highlights</h3>
				<div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<VideoCardSkeleton key={i} />
					))}
				</div>
			</div>
		);
	}

	const videos = videosData?.videos || [];

	if (videos.length === 0) {
		return (
			<div className="py-12 text-center text-gray-500">
				No highlights found for this match.
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<h3 className="font-bold text-primary text-xl">Game Highlights</h3>
			<div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
				{videos.map((video) => (
					<VideoCard
						key={video.videoId}
						videoId={video.videoId}
						title={video.title}
						publishedAt={video.publishedAt}
						onPlay={setSelectedVideoId}
					/>
				))}
			</div>

			<VideoModal
				videoId={selectedVideoId}
				onClose={() => setSelectedVideoId(null)}
			/>
		</div>
	);
}
