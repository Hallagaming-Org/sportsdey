import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Play } from "lucide-react";
import { useState } from "react";
import BannerCarousel from "@/components/BannerCarousel";
import { VideoModal } from "@/components/basketball-section/VideoModal";
import { ImageWithSkeleton } from "@/components/ImageWithSkeleton";
import PopularAndCasinoSection from "@/components/PopularAndCasinoSection";
import { Skeleton } from "@/components/ui/skeleton";
import { useNewsData } from "@/hooks/use-news-data";
import { useNewsVideos } from "@/hooks/use-news-videos";
import type { BannerData } from "@/lib/banners-server";
import type { NewsListItem } from "@/lib/news-server";
import { formatRelativeTime } from "@/lib/utils";
import { CATEGORY_CHANNEL_IDS } from "@/lib/video-channels";

interface SportLandingPageProps {
	sport: "football" | "basketball" | "tennis" | "boxing" | "ufc";
	banners?: BannerData[];
}

export default function SportLandingPage({
	sport,
	banners = [],
}: SportLandingPageProps) {
	const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

	// Map sport to Sanity news category filter
	const newsCategory = sport === "ufc" ? "mma/ufc" : sport;

	// Map sport to video query string
	const videoQuery = sport === "ufc" ? "ufc mma" : sport;
	const channelId = CATEGORY_CHANNEL_IDS[sport];

	// Load news
	const { data: newsData, isLoading: isNewsLoading } =
		useNewsData(newsCategory);
	const allNews = newsData?.pages.flat() || [];
	const displayNews = allNews.slice(0, 4);

	// Load video highlights
	const { data: videoData, isLoading: isVideosLoading } = useNewsVideos(
		`${videoQuery} match highlights, live matches, news`,
		channelId,
	);
	const allVideos = videoData?.pages.flatMap((page) => page.videos) || [];
	const displayVideos = allVideos.slice(0, 4);

	// Tag styling helper
	const getTagStyle = (category: string) => {
		const cat = category?.toLowerCase() || "";
		if (
			cat.includes("premier") ||
			cat.includes("league") ||
			cat.includes("football")
		) {
			return "bg-green-600 text-white";
		}
		if (cat.includes("transfer")) {
			return "bg-blue-600 text-white";
		}
		if (cat.includes("serie")) {
			return "bg-sky-500 text-white";
		}
		if (cat.includes("champions")) {
			return "bg-amber-600 text-white";
		}
		return "bg-accent text-white";
	};

	// Parse scores from highlight titles
	const parseScore = (title: string) => {
		const scoreMatch = title.match(/(\d+)\s*[-–]\s*(\d+)/);
		return scoreMatch ? `${scoreMatch[1]}-${scoreMatch[2]}` : null;
	};

	return (
		<div className="w-full space-y-8 pb-12 transition-all">
			{banners.length > 0 && <BannerCarousel banners={banners} />}

			{/* Popular Matches & Hot Casino */}
			<PopularAndCasinoSection />

			{/* Trending News Section */}
			<div className="space-y-4 px-4 sm:px-6">
				<div className="flex items-center justify-between">
					<h2 className="font-bold text-gray-800 text-xl md:text-2xl dark:text-white">
						Trending News
					</h2>
					<Link
						to="/news"
						search={{ sports: sport, tab: "news" }}
						className="flex items-center gap-1 font-bold text-accent text-sm hover:underline"
					>
						View all &gt;
					</Link>
				</div>

				{isNewsLoading ? (
					<div className="custom-scrollbar grid auto-cols-[minmax(200px,55%)] grid-flow-col gap-3 overflow-hidden pr-1 pb-2 lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:pr-0 lg:pb-0">
						{Array.from({ length: 4 }).map((_, i) => (
							<div
								key={`news-skel-${i}`}
								className="flex min-w-[55%] snap-start flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm lg:w-auto lg:min-w-0 lg:snap-none dark:border-0 dark:bg-card"
							>
								<Skeleton className="h-36 w-full rounded-none sm:aspect-video" />
								<div className="flex flex-1 flex-col space-y-3 p-4">
									<Skeleton className="h-4 w-full" />
									<Skeleton className="h-4 w-3/4" />
									<Skeleton className="mt-auto h-3 w-1/2" />
								</div>
							</div>
						))}
					</div>
				) : displayNews.length === 0 ? (
					<div className="rounded-2xl border border-gray-100 bg-white py-12 text-center text-gray-500 shadow-sm dark:border-0 dark:bg-card">
						No news stories available for this sport.
					</div>
				) : (
					<div className="custom-scrollbar grid snap-x snap-mandatory auto-cols-[minmax(200px,55%)] grid-flow-col gap-3 overflow-x-auto pr-1 pb-2 lg:snap-none lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:pr-0 lg:pb-0">
						{displayNews.map((news: NewsListItem) => {
							const tag = news.category || sport;
							return (
								<Link
									to="/news/$slug"
									params={{ slug: news.slug?.current ?? "" }}
									key={news._id}
									className="group flex min-w-[65%] cursor-pointer snap-start flex-col space-y-2 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md lg:w-auto lg:min-w-0 lg:snap-none dark:border-0 dark:bg-card"
								>
									<div className="relative w-full overflow-hidden rounded-lg pb-[56.25%]">
										{news.image ? (
											<ImageWithSkeleton
												src={news.image.card}
												alt={`${news.title}'s poster`}
												wrapperClassName="absolute inset-0"
												className="absolute top-0 left-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
											/>
										) : (
											<div className="absolute top-0 left-0 h-full w-full bg-gray-100 dark:bg-gray-800" />
										)}
										<span
											className={`absolute bottom-3 left-3 z-10 rounded px-2 py-0.5 font-extrabold text-[9px] uppercase tracking-wider ${getTagStyle(tag)}`}
										>
											{tag}
										</span>
									</div>
									<div className="flex flex-1 flex-col space-y-2 pt-2">
										<p className="mb-2 line-clamp-2 font-bold text-gray-800 text-sm leading-snug transition-colors group-hover:text-accent dark:text-white">
											{news.title}
										</p>
										<p className="mt-auto text-[11px] text-gray-400 dark:text-gray-500">
											{formatRelativeTime(news.publishedAt)}
										</p>
									</div>
								</Link>
							);
						})}
					</div>
				)}
			</div>

			{/* Match Highlights Section */}
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="font-bold text-gray-800 text-xl md:text-2xl dark:text-white">
						Match Highlights
					</h2>
					<Link
						to="/news"
						search={{ sports: sport, tab: "videos" }}
						className="flex items-center gap-1 font-bold text-accent text-sm hover:underline"
					>
						View all &gt;
					</Link>
				</div>

				{isVideosLoading ? (
					<div className="no-scrollbar grid auto-cols-[minmax(200px,55%)] grid-flow-col gap-3 overflow-hidden pr-1 pb-2 lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:pr-0 lg:pb-0">
						{Array.from({ length: 4 }).map((_, i) => (
							<div
								key={`video-skel-${i}`}
								className="flex min-w-[55%] snap-start flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm lg:w-auto lg:min-w-0 lg:snap-none dark:border-0 dark:bg-card"
							>
								<Skeleton className="h-36 w-full rounded-none sm:aspect-video" />
								<div className="space-y-2 p-3">
									<Skeleton className="h-4 w-full" />
									<Skeleton className="h-4 w-2/3" />
								</div>
							</div>
						))}
					</div>
				) : displayVideos.length === 0 ? (
					<div className="rounded-2xl border border-gray-100 bg-white py-12 text-center text-gray-500 shadow-sm dark:border-0 dark:bg-card">
						No match highlights available for this sport.
					</div>
				) : (
					<div className="no-scrollbar grid snap-x snap-mandatory auto-cols-[minmax(200px,55%)] grid-flow-col gap-3 overflow-x-auto pr-1 pb-2 lg:snap-none lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:pr-0 lg:pb-0">
						{displayVideos.map((video) => {
							const score = parseScore(video.title);
							const timeAgo = formatDistanceToNow(new Date(video.publishedAt), {
								addSuffix: true,
							});
							return (
								<div
									key={video.videoId}
									onClick={() => setSelectedVideoId(video.videoId)}
									className="group flex min-w-[55%] snap-start flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md lg:w-auto lg:min-w-0 lg:snap-none dark:border-0 dark:bg-card"
								>
									<div className="relative h-36 w-full overflow-hidden bg-gray-900 sm:aspect-video">
										<img
											src={`https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`}
											alt={video.title}
											className="h-full w-full object-cover opacity-85 transition-all duration-300 group-hover:scale-105 group-hover:opacity-100"
										/>
										<div className="absolute inset-0 flex items-center justify-center">
											<div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-transform duration-300 group-hover:scale-110">
												<Play className="ml-0.5 h-5 w-5 fill-current text-white" />
											</div>
										</div>
										{score && (
											<span className="absolute top-3 right-3 rounded bg-red-600 px-2 py-0.5 font-extrabold text-[10px] text-white shadow">
												{score}
											</span>
										)}
									</div>
									<div className="flex flex-1 flex-col space-y-2 p-3 md:p-4">
										<h3 className="line-clamp-2 font-extrabold text-gray-800 text-sm leading-snug transition-colors group-hover:text-accent dark:text-white">
											{video.title}
										</h3>
										<p className="mt-auto text-[11px] text-gray-400 dark:text-gray-500">
											{timeAgo}
										</p>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Video Modal */}
			<VideoModal
				videoId={selectedVideoId}
				onClose={() => setSelectedVideoId(null)}
			/>
		</div>
	);
}
