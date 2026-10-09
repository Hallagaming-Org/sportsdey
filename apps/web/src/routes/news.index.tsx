import { createFileRoute } from "@tanstack/react-router";
import { NewsLanding } from "@/components/news-landing";
import { getBanners } from "@/lib/banners-server";

export const Route = createFileRoute("/news/")({
	loader: () => getBanners(),
	component: RouteComponent,
});

function RouteComponent() {
	const banners = Route.useLoaderData() || [];

	return <NewsLanding banners={banners} />;
}
