import { Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth/client";
import {
	applyCampaignLevelsToPointsSummary,
	buildDisplayTiersFromCampaignLevels,
	buildLoyaltyHowItWorksSteps,
	buildLoyaltyRedeemOffers,
	fetchLoyaltyHistory,
	fetchLoyaltyLists,
	fetchLoyaltyPoints,
	pickPrimaryCampaignLevels,
	redeemLoyaltyPoints,
} from "@/lib/loyalty";
import { LoyaltyHeader } from "./LoyaltyHeader";
import { LoyaltyHistoryTable } from "./LoyaltyHistoryTable";
import { LoyaltyPageSkeleton } from "./LoyaltyPageSkeleton";
import { LoyaltyRedeemPanel } from "./LoyaltyRedeemPanel";
import { LoyaltyStatusCard } from "./LoyaltyStatusCard";
import { LoyaltyTierStrip } from "./LoyaltyTierStrip";

export function LoyaltyPage() {
	const queryClient = useQueryClient();
	const { data: session, isPending: isSessionLoading } = useSession();

	const pointsQuery = useQuery({
		queryKey: ["loyalty", "points"],
		queryFn: fetchLoyaltyPoints,
		enabled: Boolean(session?.user),
		retry: false,
	});

	const listsQuery = useQuery({
		queryKey: ["loyalty", "lists"],
		queryFn: fetchLoyaltyLists,
		enabled: Boolean(session?.user),
		retry: false,
	});

	const historyQuery = useQuery({
		queryKey: ["loyalty", "history"],
		queryFn: fetchLoyaltyHistory,
		enabled: Boolean(session?.user),
		retry: false,
	});

	const redeemMutation = useMutation({
		mutationFn: redeemLoyaltyPoints,
		onSuccess: async (result) => {
			toast.success(
				`Redeemed ${result.redeemedPoints.toLocaleString()} points`,
			);
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["loyalty", "points"] }),
				queryClient.invalidateQueries({ queryKey: ["loyalty", "history"] }),
				queryClient.invalidateQueries({ queryKey: ["loyalty", "lists"] }),
			]);
		},
	});

	if (!isSessionLoading && !session?.user) {
		return <Navigate to="/auth/sign-in" />;
	}

	const pointsError = pointsQuery.error;
	if (pointsError instanceof ApiError && pointsError.status === 401) {
		return <Navigate to="/auth/sign-in" />;
	}

	const isLoading =
		isSessionLoading ||
		(pointsQuery.isLoading && !pointsQuery.data) ||
		(historyQuery.isLoading && !historyQuery.data);

	const campaignLevels = pickPrimaryCampaignLevels(listsQuery.data ?? []);
	const stripTiers = buildDisplayTiersFromCampaignLevels(campaignLevels);
	const redeemOffers = buildLoyaltyRedeemOffers(listsQuery.data ?? []);
	const howItWorksSteps = buildLoyaltyHowItWorksSteps(listsQuery.data ?? []);
	const pointsSummary = pointsQuery.data
		? applyCampaignLevelsToPointsSummary({
				summary: pointsQuery.data,
				levels: campaignLevels,
			})
		: null;
	const listsErrorMessage =
		listsQuery.isError
			? listsQuery.error instanceof ApiError
				? listsQuery.error.message
				: "Could not load redeem offers."
			: null;

	return (
		<div className="w-full space-y-6">
			<div className="rounded-2xl border border-[#F1F2F4] bg-white p-4 shadow-sm sm:p-6 dark:border-[#1B2722] dark:bg-[#1C1D1F]">
				<LoyaltyHeader howItWorksSteps={howItWorksSteps} />

				{isLoading ? (
					<LoyaltyPageSkeleton />
				) : pointsQuery.isError ? (
					<div className="flex justify-center py-12 text-red-400">
						{pointsError instanceof ApiError
							? pointsError.message
							: "Could not load loyalty points. Try again later."}
					</div>
				) : pointsSummary ? (
					<div className="space-y-6">
						<LoyaltyStatusCard summary={pointsSummary} />
						<LoyaltyTierStrip
							tiers={stripTiers}
							currentTierId={pointsSummary.currentTier.id}
						/>
						<LoyaltyRedeemPanel
							offers={redeemOffers}
							availablePoints={pointsSummary.totalPoints}
							isRedeeming={redeemMutation.isPending}
							listsErrorMessage={listsErrorMessage}
							onRedeem={async (pointsToRedeem) => {
								await redeemMutation.mutateAsync({ pointsToRedeem });
							}}
						/>
						<div>
							<h2 className="mb-3 font-extrabold text-lg text-white">
								Recent Activity
							</h2>
							{historyQuery.isError ? (
								<p className="rounded-2xl border border-[#1B2722] bg-[#151616] px-4 py-8 text-center text-sm text-red-400">
									{historyQuery.error instanceof ApiError
										? historyQuery.error.message
										: "Could not load loyalty history."}
								</p>
							) : (
								<LoyaltyHistoryTable entries={historyQuery.data ?? []} />
							)}
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}
