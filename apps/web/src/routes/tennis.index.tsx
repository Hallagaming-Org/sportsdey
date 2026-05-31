import { createFileRoute } from "@tanstack/react-router";
import SportLandingPage from "@/components/SportLandingPage";
import { getBanners } from "@/lib/banners-server";

export const Route = createFileRoute("/tennis/")({
	validateSearch: (search: Record<string, unknown>) => ({
		league: (search.league as string) || undefined,
	}),
	loader: () => getBanners(),
	component: RouteComponent,
});

function RouteComponent() {
	const banners = Route.useLoaderData() || [];
	return (
		<div className="w-full">
			<SportLandingPage sport="tennis" banners={banners} />
		</div>
	);
}
