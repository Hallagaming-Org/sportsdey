import { PortableText } from "@portabletext/react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import BannerCarousel from "@/components/BannerCarousel";
import { ImageWithSkeleton } from "@/components/ImageWithSkeleton";
import type { BannerData } from "@/lib/banners-server";
import { getBanners } from "@/lib/banners-server";
import type { Comment, NewsDetail } from "@/lib/news-server";
import {
	addCommentToNews,
	getCommentsForNews,
	getNewsBySlug,
} from "@/lib/news-server";
import { formatRelativeTime } from "@/lib/utils";
import { ShareButton } from "@/components/ShareButton";
import { useSession } from "@/lib/auth/client";

type NewsItem = NewsDetail;
type NewsComment = Comment;

function getDescription(body: any): string {
	if (!Array.isArray(body)) return "Read the latest news on SportsDey";
	const block = body.find((b: any) => b._type === "block" && b.children);
	if (block?.children) {
		const text = block.children.map((c: any) => c.text).join(" ");
		return text.slice(0, 160) + (text.length > 160 ? "..." : "");
	}
	return "Read the latest news on SportsDey";
}

export const Route = createFileRoute("/news/$slug")({
	loader: async ({ params }) => {
		const [news, banners] = await Promise.all([
			getNewsBySlug(params.slug),
			getBanners(),
		]);
		const comments = news?._id ? await getCommentsForNews(news._id) : [];
		return { news, banners, comments };
	},
	head: ({ loaderData }) => {
		const siteUrl = import.meta.env.VITE_PUBLIC_URL || "http://localhost:3001";
		const data = loaderData?.news as NewsItem | null;
		const title = data?.title || "News | SportsDey";
		const description = getDescription(data?.body);
		const image = data?.image?.og ?? `${siteUrl}/news/${data?.slug?.current}/og`;

		return {
			meta: [
				{
					title,
				},
				{
					name: "description",
					content: description,
				},
				{
					property: "og:title",
					content: title,
				},
				{
					property: "og:description",
					content: description,
				},
				{
					property: "og:image",
					content: image,
				},
				{
					property: "og:type",
					content: "article",
				},
				{
					property: "og:url",
					content: `${siteUrl}/news/${data?.slug?.current}`,
				},
				{
					name: "twitter:card",
					content: "summary_large_image",
				},
				{
					name: "twitter:title",
					content: title,
				},
				{
					name: "twitter:description",
					content: description,
				},
				{
					name: "twitter:image",
					content: image,
				},
			],
		};
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { news, banners, comments: initialComments } = Route.useLoaderData() as {
		news: NewsItem | null;
		banners: BannerData[];
		comments: NewsComment[];
	};
	const navigate = useNavigate();
	const { data: session } = useSession();
	const newsId = news?._id ?? "";
	const [comments, setComments] = useState<NewsComment[]>(initialComments || []);
	const [commentText, setCommentText] = useState("");
	const [commentError, setCommentError] = useState("");
	const commentMutation = useMutation({
		mutationFn: async (message: string) =>
			addCommentToNews({ newsId, message }),
		onSuccess: (newComment) => {
			setComments((prev) => [newComment, ...prev]);
			setCommentText("");
			setCommentError("");
		},
		onError: (err: unknown) => {
			setCommentError(
				err instanceof Error ? err.message : "Unable to add comment right now.",
			);
		},
	});
	useEffect(() => {
		// console.log(news);
	}, []);
	if (!news)
		return <div className="p-8 text-center uppercase">News not found</div>;

	return (
		<div className="flex flex-col gap-6 px-4 pb-12 lg:container lg:mx-auto">
			{banners.length > 0 && (
				<div className="w-full">
					<div className="w-full overflow-hidden rounded-xl">
						<BannerCarousel banners={banners} />
					</div>
				</div>
			)}

			<div className="mx-auto w-full max-w-5xl rounded-xl bg-white p-4 sm:p-6 shadow-sm dark:bg-card dark:border dark:border-white/5">
				<Link
					to="/news"
					className="mb-6 inline-flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
				>
					<ArrowLeft size={26} />
				</Link>
				<div className="relative w-full overflow-hidden rounded-lg pb-[65%]">
					{news.image ? (
						<ImageWithSkeleton
							src={news.image.hero}
							alt={news.title}
							wrapperClassName="absolute inset-0"
							className="absolute top-0 left-0 h-full w-full object-cover"
						/>
					) : (
						<div className="absolute top-0 left-0 h-full w-full bg-gray-100" />
					)}
				</div>
				<h1 className="mb-4 font-bold text-3xl">{news.title}</h1>
				<div className="flex items-center justify-between mb-8">
					<p className="text-gray-400 text-sm">
						{formatRelativeTime(news.publishedAt)}
					</p>
					<ShareButton
						url={window.location.href}
						title={news.title}
						className="bg-gray-50 hover:bg-gray-100"
					/>
				</div>
				{news.author && (
					<Link
						to="/authors/$slug"
						params={{ slug: news.author.slug?.current ?? "" }}
						className="mb-6 flex max-w-fit items-center gap-3 rounded-lg p-3 transition-colors hover:bg-gray-100 dark:bg-card/60 hover:dark:bg-[#5A5F63]"
					>
						<div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full">
							{news.author.image ? (
								<ImageWithSkeleton
									src={news.author.image.thumb}
									alt={news.author.name}
									wrapperClassName="h-10 w-10"
									className="h-full w-full object-contain"
								/>
							) : (
								<div className="h-full w-full bg-gray-200" />
							)}
						</div>
						<span className="font-medium text-gray-900 dark:text-white">
							{news.author.name}
						</span>
					</Link>
				)}
				<div className="prose prose-sm sm:prose-base lg:prose-lg max-w-none">
					<PortableText
						value={news?.body || []}
						components={{
							block: {
								normal: ({ children }: any) => {
									const text = children.join("").trim();
									if (!text) return <div className="h-4" />;
									return <p className="mb-4 leading-relaxed">{children}</p>;
								},
							},
							marks: {
								link: ({ value, children }: any) => (
									<a
										href={value?.href}
										target="_blank"
										rel="noopener noreferrer"
										className="text-blue-600 underline"
									>
										{children}
									</a>
								),
							},
						}}
					/>
				</div>
				<section className="mt-10 space-y-4 rounded-xl border border-gray-200 p-4 dark:border-white/10">
					<div className="flex items-center justify-between">
						<h2 className="font-semibold text-lg text-gray-900 dark:text-white">
							Comments
						</h2>
						<span className="text-sm text-gray-500">
							{comments.length} {comments.length === 1 ? "comment" : "comments"}
						</span>
					</div>

					<form
						className="space-y-3"
						onSubmit={(event) => {
							event.preventDefault();
							if (!session?.user) {
								navigate({ to: "/auth/sign-in" });
								return;
							}
							if (!newsId) {
								setCommentError("Unable to find this news article.");
								return;
							}
							const trimmed = commentText.trim();
							if (!trimmed) {
								setCommentError("Please write a comment before submitting.");
								return;
							}
							commentMutation.mutate(trimmed);
						}}
					>
						{session?.user ? (
							<div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200">
								<div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
									{(session.user.name || session.user.email || "U")
										.slice(0, 2)
										.toUpperCase()}
								</div>
								<div>
									<p className="font-medium leading-none">
										{session.user.name || "SportsDey user"}
									</p>
									<p className="text-xs text-gray-500">{session.user.email}</p>
								</div>
							</div>
						) : (
							<div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
								<span>You need to be signed in to comment.</span>
								<button
									type="button"
									onClick={() => navigate({ to: "/auth/sign-in" })}
									className="text-primary underline"
								>
									Sign in
								</button>
							</div>
						)}

						<label className="flex flex-col gap-2">
							<span className="text-sm font-medium text-gray-800 dark:text-white">
								Add your comment
							</span>
							<textarea
								className="min-h-[120px] w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm outline-none transition focus:border-primary dark:border-white/10 dark:bg-[#1e1f23] dark:text-white"
								placeholder={
									session?.user
										? "Share your thoughts..."
										: "Sign in to leave a comment."
								}
								value={commentText}
								onChange={(event) => setCommentText(event.target.value)}
								disabled={!session?.user || commentMutation.isPending}
							/>
						</label>
						{commentError && (
							<p className="text-sm text-red-500">{commentError}</p>
						)}
						<div className="flex justify-end">
							<button
								type="submit"
								disabled={!session?.user || commentMutation.isPending}
								className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition enabled:hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{commentMutation.isPending ? "Posting..." : "Post comment"}
							</button>
						</div>
					</form>

					<div className="divide-y divide-gray-200 dark:divide-white/10">
						{comments.length === 0 ? (
							<p className="py-4 text-sm text-gray-600 dark:text-gray-300">
								No comments yet. Be the first to share your thoughts.
							</p>
						) : (
							comments.map((comment) => (
								<div key={comment._id} className="space-y-1 py-4">
									<div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
										<div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
											{comment.name.slice(0, 2).toUpperCase()}
										</div>
										<div>
											<p className="font-medium leading-none">{comment.name}</p>
											<p className="text-xs text-gray-500">
												{formatRelativeTime(comment.createdAt)}
											</p>
										</div>
									</div>
									<p className="text-sm leading-relaxed text-gray-800 dark:text-gray-100">
										{comment.message}
									</p>
								</div>
							))
						)}
					</div>
				</section>
			</div>
		</div>
	);
}
