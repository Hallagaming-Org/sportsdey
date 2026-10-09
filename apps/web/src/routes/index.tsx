import { createFileRoute } from "@tanstack/react-router";
import { bannerImageUrl } from "@/components/BannerCarousel";
import { NewsLanding } from "@/components/news-landing";
import { getBanners } from "@/lib/banners-server";

export const Route = createFileRoute("/")({
	validateSearch: (search: Record<string, unknown>) => ({
		league: (search.league as string) || undefined,
		sports: (search.sports as string) || undefined,
	}),
	loader: () => getBanners(),
	head: ({ loaderData }) => {
		const firstImage = loaderData?.[0]?.imageUrl;
		if (!firstImage) return {};
		return {
			links: [
				{
					rel: "preload",
					as: "image",
					href: bannerImageUrl(firstImage, 640),
					fetchPriority: "high",
				},
			],
		};
	},
	component: HomeComponent,
});

function HomeComponent() {
	const banners = Route.useLoaderData() || [];

	return (
		<div className="w-full">
			<NewsLanding banners={banners} />
		</div>
	);
}
