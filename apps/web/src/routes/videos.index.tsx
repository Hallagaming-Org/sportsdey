import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { VideosTab } from "@/components/news-videos";
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
	| "entertainment"
	| "crypto/finance";

export const Route = createFileRoute("/videos/")({
	component: RouteComponent,
});

function RouteComponent() {
	const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

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
		{ id: "crypto/finance", label: "Crypto/Finance" },
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

			<VideosTab category={categoryFilter} />
		</div>
	);
}
