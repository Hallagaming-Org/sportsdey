import { PortableText } from "@portabletext/react";
import { Link } from "@tanstack/react-router";
import { motion, type Variants } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useNewsData } from "@/hooks/use-news-data";
import { ImageWithSkeleton } from "@/components/ImageWithSkeleton";
import type { NewsListItem } from "@/lib/news-server";
import { formatRelativeTime } from "@/lib/utils";
import { ShareButton } from "./ShareButton";

export const NewsPage = ({ category }: { category: string }) => {
	const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
		useNewsData(category);

	const loadMoreRef = useRef<HTMLDivElement>(null);

	// Intersection Observer for infinite scroll
	useEffect(() => {
		if (!loadMoreRef.current) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
					fetchNextPage();
				}
			},
			{ threshold: 0.1, rootMargin: "100px" },
		);

		observer.observe(loadMoreRef.current);

		return () => observer.disconnect();
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	// Flatten all pages into a single array
	const allNews = data?.pages.flat() || [];

	const containerVariants: Variants = {
		hidden: { opacity: 0 },
		show: {
			opacity: 1,
			transition: { staggerChildren: 0.15 },
		},
	};

	const itemVariants: Variants = {
		hidden: { opacity: 0, y: 20 },
		show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 150, damping: 18 } },
	};

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center space-y-2 py-8">
				<Loader2 className="animate-spin" width={24} height={24} />
				<p className="text-gray-500 text-sm">Loading news...</p>
			</div>
		);
	}

	return (
		<div className="rounded-lg bg-white dark:bg-card/60">
			{allNews.length === 0 ? (
				<p className="py-4 text-center text-gray-500 dark:text-white">
					No news found
				</p>
			) : (
				<p className="border-gray-200 border-b px-4 py-2 font-semibold text-base dark:border-[#5A5F63]">
					Latest News
				</p>
			)}
			<motion.div 
				variants={containerVariants}
				initial="hidden"
				animate="show"
				className="grid grid-cols-1 gap-4 px-4 py-2 md:grid-cols-2 lg:grid-cols-3"
			>
				{allNews.map((news: NewsListItem) => (
					<motion.div key={news._id} variants={itemVariants} className="flex h-full">
						<Link
							to="/news/$slug"
							params={{ slug: news.slug?.current ?? "" }}
							className="flex w-full cursor-pointer flex-col space-y-2 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-0 dark:bg-card"
						>
						<div className="relative w-full overflow-hidden rounded-lg pb-[56.25%]">
							{news.image ? (
								<ImageWithSkeleton
									src={news.image.card}
									alt={`${news.title}'s poster`}
									wrapperClassName="absolute inset-0"
									className="absolute top-0 left-0 h-full w-full object-cover object-center"
								/>
							) : (
								<div className="absolute top-0 left-0 h-full w-full bg-gray-100" />
							)}
						</div>
						<p className="mb-2 line-clamp-2 font-bold text-sm">{news.title}</p>
						<div className="line-clamp-3 text-gray-600 text-sm dark:text-gray-400">
							<PortableText value={news.body as any} />
						</div>
						<div className="mt-auto flex items-center justify-between">
							<p className="text-[10px] text-gray-400">
								{formatRelativeTime(news.publishedAt)}
							</p>
							<ShareButton
								url={`${window.location.origin}/news/${news.slug?.current}`}
								title={news.title}
								className="h-8 w-8"
							/>
						</div>
						</Link>
					</motion.div>
				))}
			</motion.div>

			{/* Load more trigger */}
			<div ref={loadMoreRef} className="py-4">
				{isFetchingNextPage && (
					<div className="flex flex-col items-center justify-center space-y-2">
						<Loader2 className="animate-spin" width={24} height={24} />
						<p className="text-gray-500 text-sm">Loading more...</p>
					</div>
				)}
				{!hasNextPage && allNews.length > 0 && (
					<p className="py-4 text-center text-gray-400 text-sm">
						No more news to load
					</p>
				)}
			</div>
		</div>
	);
};
