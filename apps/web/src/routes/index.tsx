import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import SportLandingPage from "@/components/SportLandingPage";
import { getBanners } from "@/lib/banners-server";

export const Route = createFileRoute("/")({
	validateSearch: (search: Record<string, unknown>) => ({
		league: (search.league as string) || undefined,
		sports: (search.sports as string) || undefined,
	}),
	loader: () => getBanners(),
	component: HomeComponent,
});

function HomeComponent() {
	const banners = Route.useLoaderData() || [];
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	useEffect(() => {
		// Smart redirect: Only redirect to news on first visit if no sport is selected
		if (!search.sports) {
			const hasVisited = localStorage.getItem("hasVisited");
			if (!hasVisited) {
				localStorage.setItem("hasVisited", "true");
				navigate({
					to: "/news",
					search: {
						tab: "news",
					},
				});
			}
		}
	}, [search.sports, navigate]);

	return (
		<div className="w-full">
			<SportLandingPage sport="football" banners={banners} />
		</div>
	);
}
