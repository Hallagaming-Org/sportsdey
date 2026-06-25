import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/promotions")({
	component: PromotionsPage,
});

const PROMOTIONS = [
	{
		id: "1",
		title: "Superbet Champions Winners",
		endDate: "Ends Jun 12",
		image: "https://placehold.co/600x400/04100B/FFF?text=FIFA+WORLD+CUP+2026",
		tag: "Sports",
	},
	{
		id: "2",
		title: "Superbet Champions Winners",
		endDate: "Ends Jun 12",
		image: "https://placehold.co/600x400/04100B/FFF?text=MAN.+UNITED+vs+MAN.+CITY",
		tag: "Sportsdey Exclusive",
	},
	{
		id: "3",
		title: "Superbet Champions Winners",
		endDate: "Ends Jun 12",
		image: "https://placehold.co/600x400/04100B/FFF?text=FIFA+WORLD+CUP+2026",
		tag: "Sports",
	},
	{
		id: "4",
		title: "Superbet Champions Winners",
		endDate: "Ends Jun 12",
		image: "https://placehold.co/600x400/04100B/FFF?text=MAN.+UNITED+vs+MAN.+CITY",
		tag: "Casino",
	},
	{
		id: "5",
		title: "Superbet Champions Winners",
		endDate: "Ends Jun 12",
		image: "https://placehold.co/600x400/04100B/FFF?text=FIFA+WORLD+CUP+2026",
		tag: "Sports",
	},
	{
		id: "6",
		title: "Superbet Champions Winners",
		endDate: "Ends Jun 12",
		image: "https://placehold.co/600x400/04100B/FFF?text=MAN.+UNITED+vs+MAN.+CITY",
		tag: "Casino",
	},
];

const FILTERS = [
	{ label: "All", count: 12 },
	{ label: "Sportsdey Exclusive", count: 2 },
	{ label: "Casino", count: 4 },
	{ label: "Sports", count: 6 },
];

function PromotionsPage() {
	const [activeFilter, setActiveFilter] = useState("All");

	const filteredPromotions = PROMOTIONS.filter((promo) =>
		activeFilter === "All" || promo.tag === activeFilter
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
								<span
									className={cn(
										"flex h-5 w-5 items-center text-[8px] justify-center rounded-full text-[10px]",
										isActive
											? "bg-[#040C01] text-white"
											: "bg-[#2F3033] text-gray-400 dark:text-[#8C8F8F]"
									)}
								>
									{filter.count}
								</span>
							</button>
						);
					})}
				</div>

				{/* Grid */}
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
					{filteredPromotions.map((promo) => (
						<div
							key={promo.id}
							className="group cursor-pointer overflow-hidden rounded-2xl border border-[#F1F2F4] bg-white transition-colors hover:border-accent dark:border-[#2F3033] dark:bg-[#1C1D1F]"
						>
							{/* Image container */}
							<div className="relative aspect-[21/9] w-full overflow-hidden bg-gray-100 dark:bg-black">
								<img
									src={promo.image}
									alt={promo.title}
									className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
								/>
								<div className="absolute bottom-3 left-1/2 -translate-x-1/2">
									<button className="rounded-full bg-[#1BAA04] px-6 py-1.5 font-bold text-[10px] text-white shadow-md">
										BET NOW
									</button>
								</div>
							</div>

							{/* Content */}
							<div className="flex items-center justify-between p-4">
								<div>
									<h3 className="font-extrabold text-sm text-gray-900 dark:text-white">
										{promo.title}
									</h3>
									<p className="mt-0.5 text-gray-500 text-xs dark:text-gray-400">
										{promo.endDate}
									</p>
								</div>
								<button className="flex items-center rounded-lg bg-accent px-3 py-1.5 font-bold text-[10px] text-white transition-colors hover:bg-[#158f03]">
									View more &gt;
								</button>
							</div>
						</div>
					))}
				</div>

				{filteredPromotions.length === 0 && (
					<div className="flex flex-col items-center justify-center py-12 text-gray-500">
						<p>No promotions available for this category right now.</p>
					</div>
				)}
			</div>
		</div>
	);
}
