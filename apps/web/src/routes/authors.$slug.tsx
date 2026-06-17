import { PortableText } from "@portabletext/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import BannerCarousel from "@/components/BannerCarousel";
import { ImageWithSkeleton } from "@/components/ImageWithSkeleton";
import { type AuthorNewsItem, useAuthorNews } from "@/hooks/use-author-news";
import type { BannerData } from "@/lib/banners-server";
import { getBanners } from "@/lib/banners-server";
import type { AuthorDetail } from "@/lib/news-server";
import { getAuthorBySlug } from "@/lib/news-server";
import LinkedIn from "@/logos/linkedin.svg?react";
import X from "@/logos/x.svg?react";

type Author = AuthorDetail;

export const Route = createFileRoute("/authors/$slug")({
	loader: async ({ params }) => {
		const [author, banners] = await Promise.all([
			getAuthorBySlug(params.slug),
			getBanners(),
		]);
		return { author, banners };
	},
	head: ({ loaderData }) => {
		const authorName = (loaderData.author as Author | null)?.name;
		return {
			meta: [
				{
					title: authorName
						? `${authorName} | SportsDey`
						: "Author | SportsDey",
				},
			],
		};
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { author, banners } = Route.useLoaderData() as {
		author: Author | null;
		banners: BannerData[];
	};
	const authorId = author?._id;
	const { news, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
		useAuthorNews(authorId!);
	const observerTarget = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
					fetchNextPage();
				}
			},
			{ threshold: 0.5 },
		);

		if (observerTarget.current) {
			observer.observe(observerTarget.current);
		}

		return () => observer.disconnect();
	}, [fetchNextPage, hasNextPage, isFetchingNextPage]);

	if (!author) {
		return <div className="p-8 text-center uppercase">Author not found</div>;
	}

	return (
		<div className="mx-auto max-w-4xl space-y-8 p-4">
			{banners.length > 0 && (
				<div className="w-full overflow-hidden rounded-xl">
					<BannerCarousel banners={banners} />
				</div>
			)}
			<div className="w-full rounded-xl bg-white p-6 shadow-sm dark:bg-card">
				<div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start">
					<div className="h-40 w-40 shrink-0 overflow-hidden rounded-full">
						{author.image ? (
							<ImageWithSkeleton
								src={author.image.hero}
								alt={author.name}
								wrapperClassName="h-40 w-40 rounded-full"
								className="h-full w-full object-cover"
							/>
						) : (
							<div className="h-full w-full bg-gray-200" />
						)}
					</div>
					<div className="flex-1 text-center lg:text-left">
						<h1 className="mb-2 font-bold text-3xl">{author.name}</h1>
						{author.bio && (
							<div className="prose prose-sm max-w-none text-gray-600 dark:text-white">
								<PortableText value={author.bio} />
							</div>
						)}
						{(author.x || author.linkedin) && (
							<div className="mt-4 flex items-center justify-center gap-3 lg:justify-start">
								{author.x && (
									<a
										href={author.x}
										target="_blank"
										rel="noopener noreferrer"
										className="flex size-8 items-center justify-center rounded-full bg-white p-2 shadow-sm transition-shadow hover:shadow-md"
									>
										<X className="h-4 w-4" />
									</a>
								)}
								{author.linkedin && (
									<a
										href={author.linkedin}
										target="_blank"
										rel="noopener noreferrer"
										className="flex size-8 items-center justify-center rounded-full bg-white p-2 shadow-sm transition-shadow hover:shadow-md"
									>
										<LinkedIn className="h-4 w-4" />
									</a>
								)}
							</div>
						)}
					</div>
				</div>
			</div>

			<div>
				<h2 className="mb-4 font-semibold text-xl">
					Latest from {author.name}
				</h2>

				{isLoading ? (
					<div className="flex flex-col items-center justify-center space-y-2">
						<Loader2 className="animate-spin" width={24} height={24} />
						<p className="text-gray-500 text-sm">Loading news...</p>
					</div>
				) : news.length === 0 ? (
					<p className="py-4 text-center text-gray-500">No news found</p>
				) : (
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
						{news.map((item: AuthorNewsItem) => (
							<Link
								to="/news/$slug"
								params={{ slug: item.slug?.current }}
								key={item._id}
								className="flex flex-col rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:bg-card"
							>
								<div className="relative mb-3 w-full overflow-hidden rounded-lg pb-[100%]">
									{item.image ? (
										<ImageWithSkeleton
											src={item.image.card}
											alt={item.title}
											wrapperClassName="absolute inset-0"
											className="absolute top-0 left-0 h-full w-full object-cover"
										/>
									) : (
										<div className="absolute top-0 left-0 h-full w-full bg-gray-100" />
									)}
								</div>
								<p className="mb-2 line-clamp-2 font-bold text-sm dark:text-white">
									{item.title}
								</p>
								<p className="mt-auto text-[10px] text-gray-400">
									{new Date(item.publishedAt).toLocaleDateString()}
								</p>
							</Link>
						))}
					</div>
				)}

				<div
					ref={observerTarget}
					className="mt-4 flex h-8 items-center justify-center"
				>
					{isFetchingNextPage && (
						<Loader2 className="animate-spin" width={20} height={20} />
					)}
				</div>
			</div>
		</div>
	);
}
