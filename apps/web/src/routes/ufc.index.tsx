import { createFileRoute } from "@tanstack/react-router";
import { MobileSportsFilter } from "@/components/MobileSportsFilter";
import SportLandingPage from "@/components/SportLandingPage";
import { getBanners } from "@/lib/banners-server";

export const Route = createFileRoute("/ufc/")({
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
			<MobileSportsFilter />
			<SportLandingPage sport="ufc" banners={banners} />
		</div>
	);
}
