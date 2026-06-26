import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useInfiniteQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/promotions/")({
	component: PromotionsPage,
});

type PromoResponse = {
	_id: string;
	title: string;
	endDate: string;
	imageUrl: string;
	type?: string;
};

const FILTERS = [
	{ label: "All", count: 0 },
	{ label: "Sportsdey Exclusive", count: 0 },
	{ label: "Casino", count: 0 },
	{ label: "Sports", count: 0 },
];

function PromotionsPage() {
	const [activeFilter, setActiveFilter] = useState("All");

	const fetchPromos = async ({ pageParam = 0 }) => {
		const data = await apiRequest<PromoResponse[]>(
			`cms/public/promos?type=all&offset=${pageParam}&limit=10`
		);
		return {
			data,
			nextOffset: data.length === 10 ? pageParam + 10 : undefined,
		};
	};

	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		status,
	} = useInfiniteQuery({
		queryKey: ["promotions"],
		queryFn: fetchPromos,
		initialPageParam: 0,
		getNextPageParam: (lastPage) => lastPage.nextOffset,
	});

	const observerRef = useRef<IntersectionObserver | null>(null);
	const loadMoreRef = useCallback(
		(node: HTMLDivElement | null) => {
			if (isFetchingNextPage) return;
			if (observerRef.current) observerRef.current.disconnect();
			observerRef.current = new IntersectionObserver((entries) => {
				if (entries[0].isIntersecting && hasNextPage) {
					fetchNextPage();
				}
			});
			if (node) observerRef.current.observe(node);
		},
		[isFetchingNextPage, hasNextPage, fetchNextPage]
	);

	const allPromotions = data?.pages.flatMap((page) => page.data) || [];

	const filteredPromotions = allPromotions.filter((promo) =>
		activeFilter === "All" || (promo.type && promo.type.toLowerCase() === activeFilter.toLowerCase())
	);

	return (
		<div className="w-full space-y-6">
			<div className="rounded-2xl border border-[#F1F2F4] bg-white p-4 shadow-sm sm:p-6 dark:border-[#2F3033] dark:bg-[#1C1D1F]">
				<h1 className="mb-6 font-extrabold text-xl text-gray-900 dark:text-white sm:text-2xl">
					Promotions
				</h1>

				{/* Filters */}
				<div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
					{FILTERS.map((filter) => {
						const isActive = activeFilter === filter.label;
						return (
							<button
								key={filter.label}
								onClick={() => setActiveFilter(filter.label)}
								className={cn(
									"flex cursor-pointer items-center gap-2 rounded-full border px-4 py-1.5 font-semibold text-xs transition-colors whitespace-nowrap",
									isActive
										? "border-accent bg-accent text-[#040C01]"
										: "border-[#2F3033] bg-transparent text-gray-500 hover:text-gray-900 dark:text-[#8C8F8F] dark:hover:text-white"
								)}
							>
								<span>{filter.label}</span>
							</button>
						)
					})}
				</div>

				{status === "pending" ? (
					<div className="flex justify-center py-12 text-gray-500">Loading promotions...</div>
				) : status === "error" ? (
					<div className="flex justify-center py-12 text-red-500">Error loading promotions</div>
				) : (
					<>
						{/* Grid */}
						<div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
							{filteredPromotions.map((promo) => (
								<Link 
									key={promo._id}
									to="/promotions/$id"
									params={{ id: promo._id }}
									className="group cursor-pointer overflow-hidden rounded-2xl border border-[#F1F2F4] bg-white transition-colors hover:border-accent dark:border-[#2F3033] dark:bg-[#1C1D1F] block"
								>
									{/* Image container */}
									<div className="relative aspect-[21/9] w-full overflow-hidden bg-gray-100 dark:bg-black">
										<img 
											src={promo.imageUrl} 
											alt={promo.title}
											className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
										/>
										<div className="absolute bottom-3 left-1/2 -translate-x-1/2">
											<button className="rounded-full bg-[#1BAA04] px-6 py-1.5 font-bold text-[10px] text-white shadow-md pointer-events-none">
												BET NOW
											</button>
										</div>
									</div>
									
									{/* Content */}
									<div className="flex items-center justify-between p-4">
										<div>
											<h3 className="font-extrabold text-sm text-gray-900 dark:text-white capitalize">
												{promo.title}
											</h3>
											<p className="mt-0.5 text-gray-500 text-xs dark:text-gray-400">
												{new Date(promo.endDate).toLocaleDateString()}
											</p>
										</div>
										<div className="flex items-center rounded-lg bg-accent px-3 py-1.5 font-bold text-[10px] text-[#000606] transition-colors group-hover:bg-[#158f03]">
											View more &gt;
										</div>
									</div>
								</Link>
							))}
						</div>

						{filteredPromotions.length === 0 && (
							<div className="flex flex-col items-center justify-center py-12 text-gray-500">
								<p>No promotions available for this category right now.</p>
							</div>
						)}

						{/* Load more trigger */}
						<div ref={loadMoreRef} className="flex justify-center py-4">
							{isFetchingNextPage ? (
								<span className="text-gray-500 text-sm">Loading more...</span>
							) : hasNextPage ? (
								<span className="text-gray-400 text-sm">Scroll for more</span>
							) : null}
						</div>
					</>
				)}
			</div>
		</div>
	)
}
