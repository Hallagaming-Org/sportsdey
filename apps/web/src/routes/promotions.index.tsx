import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AssignedBonusPromoCard } from "@/components/assigned-bonus-promo-card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, apiRequest } from "@/lib/api";
import { useSession } from "@/lib/auth/client";
import {
	activatePlayerBonus,
	fetchPlayerBonuses,
	invalidateBonusAndWallet,
	promotionsAssignedBonuses,
} from "@/lib/bonuses";
import { BONUS_QUERY_KEY } from "@/lib/bonuses.constant";
import { cn } from "@/lib/utils";

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
	{ label: "All" },
	// { label: "Sportsdey Exclusive", count: 0 },
	// { label: "Casino", count: 0 },
	// { label: "Sports", count: 0 },
];

function PromotionsPage() {
	const [activeFilter, setActiveFilter] = useState("All");
	const queryClient = useQueryClient();
	const { data: session } = useSession();

	const assignedQuery = useQuery({
		queryKey: BONUS_QUERY_KEY.LIST,
		queryFn: async () => {
			try {
				return await fetchPlayerBonuses();
			} catch (error) {
				if (
					error instanceof ApiError &&
					(error.status === 502 || error.status === 503)
				) {
					return [];
				}
				throw error;
			}
		},
		enabled: Boolean(session?.user),
		retry: false,
		refetchInterval: 15_000,
	});

	const activateMutation = useMutation({
		mutationFn: activatePlayerBonus,
		onSuccess: async () => {
			toast.success("Bonus activated");
			await invalidateBonusAndWallet(queryClient);
		},
		onError: (error) => {
			toast.error(
				error instanceof ApiError
					? error.message
					: "Could not activate this bonus. Try again.",
			);
		},
	});

	const assignedBonuses = promotionsAssignedBonuses(assignedQuery.data ?? []);

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
								<span className="rounded-full h-6 w-6 flex items-center justify-center bg-[#040C01] text-white text-[10px]">{filteredPromotions?.length}</span>
							</button>
						)
					})}
				</div>

				{session?.user && assignedQuery.isError ? (
					<p className="mb-4 text-sm text-red-400">
						{assignedQuery.error instanceof ApiError
							? assignedQuery.error.message
							: "Could not load your assigned bonuses."}
					</p>
				) : null}

				{session?.user && assignedBonuses.length > 0 ? (
					<div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
						{assignedBonuses.map((bonus) => (
							<AssignedBonusPromoCard
								key={bonus.id}
								bonus={bonus}
								isMutating={
									activateMutation.isPending &&
									activateMutation.variables?.userbonusId === bonus.id
								}
								onActivate={(userbonusId) =>
									activateMutation.mutate({ userbonusId })
								}
							/>
						))}
					</div>
				) : null}

				{status === "pending" ? (
					<div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
						{Array.from({ length: 4 }).map((_, i) => (
							<div key={i} className="overflow-hidden rounded-2xl border border-[#F1F2F4] bg-white dark:border-[#2F3033] dark:bg-[#1C1D1F] block">
								<Skeleton className="aspect-[21/9] w-full" />
								<div className="flex items-center justify-between p-4 sm:p-5">
									<div>
										<Skeleton className="h-5 w-48 mb-2" />
										<Skeleton className="h-3 w-24" />
									</div>
									<Skeleton className="h-8 w-16 rounded-lg" />
								</div>
							</div>
						))}
					</div>
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

									</div>

									{/* Content */}
									<div className="flex items-center justify-between p-4">
										<div>
											<h3 className="font-extrabold text-sm text-gray-900 dark:text-white capitalize">
												{promo.title}
											</h3>
											<p className="mt-0.5 text-gray-500 text-xs dark:text-gray-400">
												Ends on {new Date(promo.endDate).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}
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
