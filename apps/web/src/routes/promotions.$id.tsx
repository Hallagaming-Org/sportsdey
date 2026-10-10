import { createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, apiRequest } from "@/lib/api";
import { useSession } from "@/lib/auth/client";
import {
	activatePlayerBonus,
	fetchPlayerBonuses,
	invalidateBonusAndWallet,
	type BonusCard,
} from "@/lib/bonuses";
import { BONUS_QUERY_KEY, BONUS_TYPE } from "@/lib/bonuses.constant";
import { Skeleton } from "@/components/ui/skeleton";
import { PortableText } from "@portabletext/react";
import { cn } from "@/lib/utils";

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
			<div className="flex flex-col gap-6 px-4 pb-12 lg:container lg:mx-auto">
				<div className="mx-auto w-full max-w-5xl rounded-xl bg-white p-4 shadow-sm sm:p-6 dark:border dark:border-white/5 dark:bg-card mt-6">
					<Skeleton className="h-8 w-10 mb-6" />
					<div className="w-full flex justify-between items-center mb-4">
						<Skeleton className="h-8 w-64" />
						<Skeleton className="h-4 w-32" />
					</div>
					<Skeleton className="w-full h-64 md:h-96 rounded-lg mb-8" />
					<div className="space-y-4">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-5/6" />
						<Skeleton className="h-4 w-4/6" />
					</div>
				</div>
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
							Ends on {new Date(promotion.endDate).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}
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
				</div>

				{/* {promotion.body && (
					<div className="prose prose-sm sm:prose-base lg:prose-lg max-w-none text-gray-800 dark:text-gray-200">
						<div dangerouslySetInnerHTML={{ __html: promotion.body }} />
					</div>
				)} */}
				<div className="flex flex-col items-stretch gap-8 md:flex-row md:items-center md:justify-between md:gap-10">
					<div className="prose prose-sm sm:prose-base lg:prose-lg min-w-0 max-w-none flex-1">
						<PortableText
							value={(promotion?.body as any) || []}
							components={{
								block: {
									normal: ({ children }: any) => {
										const text = children.join("").trim();
										if (!text) return <div className="h-4" />;
										return <p className="mb-4 leading-relaxed">{children}</p>;
									},
								},
								marks: {
									link: ({ value, children }: any) => (
										<a
											href={value?.href}
											target="_blank"
											rel="noopener noreferrer"
											className="text-blue-600 underline"
										>
											{children}
										</a>
									),
								},
							}}
						/>
					</div>
					<PromoActivateButton />
				</div>
			</div>
		</div>
	);
}

function pickReadyBonus(bonuses: BonusCard[]): BonusCard | undefined {
	const ready = bonuses.filter((bonus) => bonus.canActivate);
	return (
		ready.find(
			(bonus) => bonus.bonusType.toLowerCase() === BONUS_TYPE.FREEBET,
		) ?? ready[0]
	);
}

function PromoActivateButton() {
	const navigate = useNavigate();
	const location = useLocation();
	const queryClient = useQueryClient();
	const { data: session, isPending: isSessionLoading } = useSession();

	const bonusesQuery = useQuery({
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
	});

	const readyBonus = pickReadyBonus(bonusesQuery.data ?? []);

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

	const onActivate = () => {
		if (!session?.user) {
			void navigate({
				to: "/auth/sign-up",
				search: { returnTo: location.href, mode: "signup" },
			});
			return;
		}
		if (!readyBonus) {
			void navigate({ to: "/bonuses" });
			return;
		}
		activateMutation.mutate({ userbonusId: readyBonus.id });
	};

	const isBusy = isSessionLoading || activateMutation.isPending;

	return (
		<div className="flex shrink-0 items-center justify-center md:min-w-[240px] md:justify-end">
			<button
				type="button"
				onClick={onActivate}
				disabled={isBusy}
				className={cn(
					"promo-activate-glow group relative inline-flex cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-[#0e7a02] via-accent to-[#5dff45] px-10 py-4 font-extrabold text-lg text-white transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:cursor-wait disabled:opacity-70",
				)}
			>
				<span
					aria-hidden
					className="promo-activate-shine pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/45 to-transparent"
				/>
				{isBusy ? (
					<Loader2 className="relative size-5 animate-spin" />
				) : (
					<Sparkles className="relative size-5" />
				)}
				<span className="relative">Activate Now</span>
			</button>
		</div>
	);
}
