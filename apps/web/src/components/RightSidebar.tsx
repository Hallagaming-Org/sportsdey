import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ChevronRight, Loader2, Play } from "lucide-react";
import { useState } from "react";
import { VideoModal } from "@/components/basketball-section/VideoModal";
import { useCurrentSport } from "@/hooks/use-current-sport";
import { useNewsData } from "@/hooks/use-news-data";
import { useNewsVideos } from "@/hooks/use-news-videos";
import { ImageWithSkeleton } from "@/components/ImageWithSkeleton";
import { formatRelativeTime } from "@/lib/utils";
import { ShareButton } from "./ShareButton";

const RightSidebar = () => {
	const sport = useCurrentSport() || "football";
	const { data: newsData, isLoading: isNewsLoading } = useNewsData(sport);
	const { data: videoData, isLoading: isVideoLoading } = useNewsVideos(sport);
	const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
	const navigate = useNavigate();

	// Get first news item from infinite query pages
	const allNews = newsData?.pages.flat() || [];
	const latestNews = allNews.length > 0 ? allNews[0] : null;

	// Show up to 2 videos if available
	const activeVideos = videoData?.pages[0]?.videos?.slice(0, 2) || [];

	const handleShowMoreClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		navigate({ to: "/news", search: { category: sport } });
	};

	if (isNewsLoading && isVideoLoading) {
		return (
			<div className="flex items-center justify-center py-10">
				<Loader2 className="h-6 w-6 animate-spin text-gray-400" />
			</div>
		);
	}

	// If no news and no videos, return null (hide sidebar content)
	if (!latestNews && activeVideos.length === 0) {
		return null;
	}

	return (
		<div className="space-y-6 pb-24">
			{/* News Widget - Only show if news exists */}
			{latestNews && (
				<div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-card">
					<div className="flex items-center justify-between border-gray-100 border-b px-4 py-3 dark:border-[#5A5F63]">
						<div className="flex items-center gap-3">
							<h3 className="font-bold text-lg text-primary dark:text-white">
								News
							</h3>
							<ShareButton
								url={window.location.origin}
								title="Sportsdey - Live Scores & News"
								className="h-8 w-8"
							/>
						</div>
						<Link
							to="/news"
							search={{ category: sport }}
							className="flex items-center gap-1 font-semibold text-gray-400 text-xs hover:text-accent"
						>
							<ChevronRight className="h-5 w-5" />
						</Link>
					</div>

					<div
						className="p-4"
						onClick={() =>
							navigate({
								to: "/news/$slug",
								params: { slug: latestNews.slug.current },
							})
						}
					>
						<div className="group relative mb-3 aspect-video w-full cursor-pointer overflow-hidden rounded-xl">
							{latestNews.image && (
								<ImageWithSkeleton
									src={latestNews.image.hero}
									alt={latestNews.title}
									wrapperClassName="absolute inset-0"
									className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
								/>
							)}
						</div>
						<h4
							onClick={() =>
								navigate({
									to: "/news/$slug",
									params: { slug: latestNews.slug.current },
								})
							}
							className="mb-2 line-clamp-2 cursor-pointer font-bold text-primary text-sm transition-colors hover:text-accent dark:text-white"
						>
							{latestNews.title}
						</h4>
						<p className="mb-4 text-gray-400 text-xs">
							{formatRelativeTime(latestNews.publishedAt)}
						</p>

						<button
							onClick={() => navigate({ to: "/news" })}
							className="mt-2 w-full cursor-pointer py-2.5 text-end font-bold text-accent text-xs underline transition-colors"
						>
							View more
						</button>
					</div>
				</div>
			)}

			{/* Videos Widget - Only show if videos exist */}
			{activeVideos.length > 0 && (
				<div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-card">
					<div className="flex items-center justify-between border-gray-100 border-b px-4 py-3 dark:border-[#5A5F63]">
						<h3 className="font-bold text-lg text-primary dark:text-white">
							Videos
						</h3>
						<Link
							to="/news"
							search={{ category: sport }}
							className="flex items-center gap-1 font-semibold text-gray-400 text-xs hover:text-accent"
						>
							<ChevronRight className="h-5 w-5" />
						</Link>
					</div>
					<div className="space-y-4 p-4">
						{activeVideos.map((video) => (
							<div key={video.videoId} className="group cursor-pointer">
								<div
									className="relative mb-2 aspect-video w-full overflow-hidden rounded-xl bg-black/5"
									onClick={() => setSelectedVideoId(video.videoId)}
								>
									<img
										src={`https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`}
										alt={video.title}
										className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
									/>
									<div className="absolute inset-0 flex items-center justify-center">
										<div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-colors group-hover:bg-accent">
											<Play className="ml-0.5 h-4 w-4 fill-white text-white" />
										</div>
									</div>
								</div>
								<h5
									className="line-clamp-2 font-medium text-primary text-sm transition-colors group-hover:text-accent dark:text-white"
									onClick={() => setSelectedVideoId(video.videoId)}
								>
									{video.title}
								</h5>
								<p className="mt-1 text-[10px] text-gray-400">
									{formatRelativeTime(video.publishedAt)}
								</p>
							</div>
						))}

						<button
							onClick={() => navigate({ to: "/news" })}
							className="mt-2 w-full py-2.5 text-end font-bold text-accent text-xs underline transition-colors"
						>
							View more
						</button>
					</div>
				</div>
			)}

			<VideoModal
				videoId={selectedVideoId}
				onClose={() => setSelectedVideoId(null)}
			/>
		</div>
	);
};

export default RightSidebar;
