import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/promotions/$id")({
	component: PromotionDetailsPage,
});

type SinglePromoResponse = {
	_id: string;
	title: string;
	endDate: string;
	bannerImages: { url: string }[];
	body: string | null;
	type: string;
};

function PromotionDetailsPage() {
	const { id } = Route.useParams();
	const navigate = useNavigate();

	const { data: promotion, isLoading, error } = useQuery({
		queryKey: ["promotion", id],
		queryFn: () => apiRequest<SinglePromoResponse>(`cms/public/promos/${id}`),
	});

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center py-20">
				<p className="text-gray-500">Loading promotion...</p>
			</div>
		);
	}

	if (error || !promotion) {
		return (
			<div className="flex flex-col items-center justify-center py-20">
				<h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
					Promotion not found
				</h2>
				<button
					onClick={() => navigate({ to: "/promotions" })}
					className="rounded-lg bg-accent px-6 py-2 font-bold text-[#000606] hover:bg-accent/90"
				>
					Back to Promotions
				</button>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6 px-4 pb-12 lg:container lg:mx-auto">
			<div className="mx-auto w-full max-w-5xl rounded-xl bg-white p-4 shadow-sm sm:p-6 dark:border dark:border-white/5 dark:bg-card mt-6">
				<Link
					to="/promotions"
					className="mb-6 inline-flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
				>
					<ArrowLeft size={26} />
				</Link>
				<div className="w-full flex justify-between items-center">

					<h1 className="mb-4 font-bold text-3xl capitalize">{promotion.title}</h1>

					<div className="flex items-center justify-between">
						<p className="text-gray-400 text-sm">
							{new Date(promotion.endDate).toLocaleDateString()}
						</p>
					</div>
				</div>

				<div className="relative w-full overflow-hidden rounded-lg pb-[50%] mb-8 bg-gray-100 dark:bg-black">
					{promotion.bannerImages?.[0]?.url && (
						<img
							src={promotion.bannerImages[0].url}
							alt={promotion.title}
							className="absolute top-0 left-0 h-full w-full object-cover"
						/>
					)}
					<div className="absolute bottom-6 left-1/2 -translate-x-1/2">
						<button className="rounded-full bg-[#1BAA04] px-8 py-2.5 font-bold text-xs text-white shadow-lg transition-transform hover:scale-105">
							BET NOW
						</button>
					</div>
				</div>

				{promotion.body && (
					<div className="prose prose-sm sm:prose-base lg:prose-lg max-w-none text-gray-800 dark:text-gray-200">
						<div dangerouslySetInnerHTML={{ __html: promotion.body }} />
					</div>
				)}
			</div>
		</div>
	);
}
