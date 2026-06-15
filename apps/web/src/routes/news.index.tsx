import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import BannerCarousel from "@/components/BannerCarousel";
import { NewsPage } from "@/components/news-page";
import { getBanners } from "@/lib/banners-server";
import { cn } from "@/lib/utils";

type CategoryFilter =
	| "all"
	| "football"
	| "basketball"
	| "racing"
	| "tennis"
	| "boxing"
	| "mma/ufc"
	| "politics"
	| "entertainment";

export const Route = createFileRoute("/news/")({
	loader: () => getBanners(),
	component: RouteComponent,
});

function RouteComponent() {
	const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
	const banners = Route.useLoaderData() || [];

	const categoryFilters = [
		{ id: "all", label: "All" },
		{ id: "football", label: "Football" },
		{ id: "basketball", label: "Basketball" },
		{ id: "racing", label: "Racing" },
		{ id: "tennis", label: "Tennis" },
		{ id: "boxing", label: "Boxing" },
		{ id: "mma/ufc", label: "MMA/UFC" },
		{ id: "politics", label: "Politics" },
		{ id: "entertainment", label: "Entertainment" },
	] as const;

	return (
		<div className="">
			<div className="scrollbar-hide mb-6 flex gap-2 overflow-x-auto py-4">
				{categoryFilters.map((filter) => (
					<div
						key={filter.id}
						onClick={() => setCategoryFilter(filter.id)}
						className={cn(
							"flex h-10 w-max cursor-pointer items-center gap-2 rounded-xl bg-white px-4 font-medium text-sm transition-colors",
							categoryFilter === filter.id
								? "bg-accent text-white"
								: "text-gray-500 hover:bg-gray-50",
						)}
					>
						{filter.label}
					</div>
				))}
			</div>

			{banners.length > 0 && (
				<div className="mb-6 px-4 lg:container lg:mx-auto">
					<div className="w-full overflow-hidden rounded-xl">
						<BannerCarousel banners={banners} />
					</div>
				</div>
			)}

			<NewsPage category={categoryFilter} />
		</div>
	);
}
