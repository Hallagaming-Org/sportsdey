import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useNewsData } from "@/hooks/use-news-data";
import { useNewsVideos } from "@/hooks/use-news-videos";
import BannerCarousel from "@/components/BannerCarousel";
import AppDownloadBanner from "@/components/app-download-banner";
import { VideoModal } from "@/components/basketball-section/VideoModal";
import { ImageWithSkeleton } from "@/components/ImageWithSkeleton";
import PopularAndCasinoSection from "@/components/PopularAndCasinoSection";
import { formatRelativeTime } from "@/lib/utils";
import { Play, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { BannerData } from "@/lib/banners-server";
import type { NewsListItem } from "@/lib/news-server";

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

	// Load news
	const { data: newsData, isLoading: isNewsLoading } =
		useNewsData(newsCategory);
	const allNews = newsData?.pages.flat() || [];
	const displayNews = allNews.slice(0, 4);

	// Load video highlights
	const { data: videoData, isLoading: isVideosLoading } =
		useNewsVideos(videoQuery);
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
		<div className="w-full space-y-8 pb-12 transition-all px-4 sm:px-6">
			{/* Hero Banners */}
			{banners.length > 0 && (
				<div className="w-full overflow-hidden rounded-xl shadow-md h-36 sm:h-44 md:h-64">
					<BannerCarousel banners={banners} />
				</div>
			)}

			{/* Popular Matches & Hot Casino */}
			<PopularAndCasinoSection />

			{/* Trending News Section */}
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">
						Trending News
					</h2>
					<Link
						to="/news"
						search={{ sports: sport, tab: "news" }}
						className="text-sm font-bold text-accent hover:underline flex items-center gap-1"
					>
						View all &gt;
					</Link>
				</div>

				{isNewsLoading ? (
					<div className="flex justify-center items-center h-48">
						<Loader2 className="animate-spin text-accent h-8 w-8" />
					</div>
				) : displayNews.length === 0 ? (
					<div className="text-center py-12 bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-0 shadow-sm text-gray-500">
						No news stories available for this sport.
					</div>
				) : (
					<div className="custom-scrollbar grid grid-flow-col auto-cols-[minmax(200px,55%)] gap-3 overflow-x-auto pb-2 pr-1 snap-x snap-mandatory lg:grid-flow-row lg:grid-cols-4 lg:auto-cols-auto lg:overflow-visible lg:pb-0 lg:pr-0 lg:snap-none lg:gap-6">
						{displayNews.map((news: NewsListItem) => {
							const tag = news.category || sport;
							return (
								<Link
									to="/news/$slug"
									params={{ slug: news.slug?.current }}
									key={news._id}
									className="group flex snap-start min-w-[55%] flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-0 dark:bg-card lg:w-auto lg:min-w-0 lg:snap-none"
								>
									<div className="relative h-36 w-full overflow-hidden bg-gray-100 dark:bg-gray-800 sm:aspect-video">
										{news.image ? (
											<ImageWithSkeleton
												src={news.image.thumb}
												alt={news.title}
												wrapperClassName="absolute inset-0"
												className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
											/>
										) : (
											<div className="h-full w-full bg-gray-200 dark:bg-gray-700" />
										)}
										<span
											className={`absolute bottom-3 left-3 px-2 py-0.5 rounded font-extrabold text-[9px] uppercase tracking-wider ${getTagStyle(tag)}`}
										>
											{tag}
										</span>
									</div>
									<div className="p-3 md:p-4 flex flex-col flex-1 space-y-2">
										<h3 className="font-extrabold text-sm text-gray-800 dark:text-white line-clamp-2 leading-snug group-hover:text-accent transition-colors">
											{news.title}
										</h3>
										<p className="text-[11px] text-gray-400 dark:text-gray-500 mt-auto">
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
					<h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">
						Match Highlights
					</h2>
					<Link
						to="/news"
						search={{ sports: sport, tab: "videos" }}
						className="text-sm font-bold text-accent hover:underline flex items-center gap-1"
					>
						View all &gt;
					</Link>
				</div>

				{isVideosLoading ? (
					<div className="flex justify-center items-center h-48">
						<Loader2 className="animate-spin text-accent h-8 w-8" />
					</div>
				) : displayVideos.length === 0 ? (
					<div className="text-center py-12 bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-0 shadow-sm text-gray-500">
						No match highlights available for this sport.
					</div>
				) : (
					<div className="no-scrollbar grid grid-flow-col auto-cols-[minmax(200px,55%)] gap-3 overflow-x-auto pb-2 pr-1 snap-x snap-mandatory lg:grid-flow-row lg:grid-cols-4 lg:auto-cols-auto lg:overflow-visible lg:pb-0 lg:pr-0 lg:snap-none lg:gap-6">
						{displayVideos.map((video) => {
							const score = parseScore(video.title);
							const timeAgo = formatDistanceToNow(new Date(video.publishedAt), {
								addSuffix: true,
							});
							return (
								<div
									key={video.videoId}
									onClick={() => setSelectedVideoId(video.videoId)}
									className="group flex snap-start min-w-[55%] flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-0 dark:bg-card lg:w-auto lg:min-w-0 lg:snap-none"
								>
									<div className="relative h-36 w-full overflow-hidden bg-gray-900 sm:aspect-video">
										<img
											src={`https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`}
											alt={video.title}
											className="h-full w-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
										/>
										<div className="absolute inset-0 flex items-center justify-center">
											<div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-transform duration-300 group-hover:scale-110">
												<Play className="ml-0.5 h-5 w-5 fill-current text-white" />
											</div>
										</div>
										{score && (
											<span className="absolute top-3 right-3 bg-red-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded shadow">
												{score}
											</span>
										)}
									</div>
									<div className="p-3 md:p-4 flex flex-col flex-1 space-y-2">
										<h3 className="font-extrabold text-sm text-gray-800 dark:text-white line-clamp-2 leading-snug group-hover:text-accent transition-colors">
											{video.title}
										</h3>
										<p className="text-[11px] text-gray-400 dark:text-gray-500 mt-auto">
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
