import { Navigate } from "@tanstack/react-router";
import {
	useMutation,
	useQuery,
	useQueryClient,
	type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { BonusCard } from "./BonusCard";
import { BonusesHeader } from "./BonusesHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth/client";
import {
	activatePlayerBonus,
	cancelPlayerBonus,
	fetchBonusCampaigns,
	fetchPlayerBonuses,
	type BonusCard as BonusCardModel,
} from "@/lib/bonuses";
import { BONUS_QUERY_KEY } from "@/lib/bonuses.constant";

export function BonusesPage() {
	const queryClient = useQueryClient();
	const { data: session, isPending: isSessionLoading } = useSession();

	const listQuery = useQuery({
		queryKey: BONUS_QUERY_KEY.LIST,
		queryFn: fetchPlayerBonuses,
		enabled: Boolean(session?.user),
		retry: false,
	});

	const campaignsQuery = useQuery({
		queryKey: BONUS_QUERY_KEY.CAMPAIGNS,
		queryFn: fetchBonusCampaigns,
		enabled: Boolean(session?.user),
		retry: false,
	});

	const activateMutation = useMutation({
		mutationFn: activatePlayerBonus,
		onSuccess: async () => {
			toast.success("Bonus activated");
			await invalidateBonusQueries(queryClient);
		},
	});

	const cancelMutation = useMutation({
		mutationFn: cancelPlayerBonus,
		onSuccess: async () => {
			toast.success("Bonus cancelled");
			await invalidateBonusQueries(queryClient);
		},
	});

	if (!isSessionLoading && !session?.user) {
		return <Navigate to="/auth/sign-in" />;
	}

	const authError = listQuery.error;
	if (authError instanceof ApiError && authError.status === 401) {
		return <Navigate to="/auth/sign-in" />;
	}

	const isLoading =
		isSessionLoading ||
		(listQuery.isLoading && !listQuery.data) ||
		(campaignsQuery.isLoading && !campaignsQuery.data);

	const mutatingId = activateMutation.isPending
		? activateMutation.variables?.userbonusId
		: cancelMutation.isPending
			? cancelMutation.variables?.userbonusId
			: undefined;

	const handleActivate = (userbonusId: string) => {
		activateMutation.mutate({ userbonusId });
	};

	const handleCancel = (userbonusId: string) => {
		cancelMutation.mutate({ userbonusId });
	};

	const mutationError =
		activateMutation.error ?? cancelMutation.error ?? null;

	return (
		<div className="w-full space-y-6">
			<div className="rounded-2xl border border-[#F1F2F4] bg-white p-4 shadow-sm sm:p-6 dark:border-[#1B2722] dark:bg-[#1C1D1F]">
				<BonusesHeader />

				{mutationError ? (
					<p className="mb-4 text-sm text-red-400">
						{mutationError instanceof ApiError
							? mutationError.message
							: "Could not update bonus. Try again."}
					</p>
				) : null}

				{isLoading ? (
					<BonusesGridSkeleton />
				) : (
					<div className="space-y-8">
						<BonusSection
							title="Your bonuses"
							empty="No bonuses assigned yet."
							error={listQuery.error}
							bonuses={listQuery.data ?? []}
							mutatingId={mutatingId}
							onActivate={handleActivate}
							onCancel={handleCancel}
						/>
						<BonusSection
							title="Available offers"
							empty="No active campaigns right now."
							error={campaignsQuery.error}
							bonuses={campaignsQuery.data ?? []}
						/>
					</div>
				)}
			</div>
		</div>
	);
}

function BonusSection(payload: {
	title: string;
	empty: string;
	error: unknown;
	bonuses: BonusCardModel[];
	mutatingId?: string;
	onActivate?: (userbonusId: string) => void;
	onCancel?: (userbonusId: string) => void;
}) {
	return (
		<section className="space-y-4">
			<h2 className="font-extrabold text-lg text-white">{payload.title}</h2>
			{payload.error ? (
				<p className="py-6 text-center text-sm text-red-400">
					{payload.error instanceof ApiError
						? payload.error.message
						: "Could not load bonuses. Try again later."}
				</p>
			) : payload.bonuses.length === 0 ? (
				<p className="py-6 text-center text-sm text-[#8C8F8F]">{payload.empty}</p>
			) : (
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
					{payload.bonuses.map((bonus) => (
						<BonusCard
							key={`${payload.title}-${bonus.id}`}
							bonus={bonus}
							isMutating={payload.mutatingId === bonus.id}
							onActivate={payload.onActivate}
							onCancel={payload.onCancel}
						/>
					))}
				</div>
			)}
		</section>
	);
}

function BonusesGridSkeleton() {
	return (
		<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
			{Array.from({ length: 6 }).map((_, index) => (
				<div
					key={index}
					className="rounded-2xl border border-[#1B2722] bg-[#151616] p-5"
				>
					<div className="mb-4 flex gap-3">
						<Skeleton className="size-12 rounded-full" />
						<div className="flex-1 space-y-2">
							<Skeleton className="h-5 w-2/3" />
							<Skeleton className="h-4 w-full" />
						</div>
					</div>
					<Skeleton className="mb-4 h-2 w-full rounded-full" />
					<Skeleton className="mb-4 h-4 w-24" />
					<Skeleton className="h-11 w-full rounded-xl" />
				</div>
			))}
		</div>
	);
}

async function invalidateBonusQueries(queryClient: QueryClient): Promise<void> {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: BONUS_QUERY_KEY.LIST }),
		queryClient.invalidateQueries({ queryKey: BONUS_QUERY_KEY.CAMPAIGNS }),
		queryClient.invalidateQueries({ queryKey: ["wallet"] }),
	]);
}
