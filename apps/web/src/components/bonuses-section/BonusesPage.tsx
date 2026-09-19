import { Navigate } from "@tanstack/react-router";
import {
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { BonusCard } from "./BonusCard";
import { BonusesHeader } from "./BonusesHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth/client";
import {
	activatePlayerBonus,
	cancelPlayerBonus,
	// fetchAllUserBonuses,
	fetchBonusCampaigns,
	fetchPlayerBonuses,
	invalidateBonusAndWallet,
	type BonusCard as BonusCardModel,
} from "@/lib/bonuses";
import {
	BONUS_QUERY_KEY,
	BONUS_TYPE_DEFAULT,
	BONUS_TYPE_LABEL,
	BONUS_TYPE_VALUES,
	isBonusCampaignType,
	type BonusCampaignType,
} from "@/lib/bonuses.constant";

export function BonusesPage() {
	const queryClient = useQueryClient();
	const { data: session, isPending: isSessionLoading } = useSession();
	const [campaignType, setCampaignType] =
		useState<BonusCampaignType>(BONUS_TYPE_DEFAULT);

	const listQuery = useQuery({
		queryKey: BONUS_QUERY_KEY.LIST,
		queryFn: fetchPlayerBonuses,
		enabled: Boolean(session?.user),
		retry: false,
	});


	// useQuery({
	// 	queryKey: BONUS_QUERY_KEY.GETALL_USER_BONUS,
	// 	queryFn: fetchAllUserBonuses,
	// 	enabled: Boolean(session?.user),
	// 	retry: false,
	// });
	const campaignsQuery = useQuery({
		queryKey: BONUS_QUERY_KEY.campaigns(campaignType),
		queryFn: () => fetchBonusCampaigns({ bonusType: campaignType }),
		enabled: Boolean(session?.user),
		retry: false,
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

	const cancelMutation = useMutation({
		mutationFn: cancelPlayerBonus,
		onSuccess: async () => {
			toast.success("Bonus cancelled");
			await invalidateBonusAndWallet(queryClient);
		},
		onError: (error) => {
			toast.error(
				error instanceof ApiError
					? error.message
					: "Could not cancel this bonus. Try again.",
			);
		},
	});

	if (!isSessionLoading && !session?.user) {
		return <Navigate to="/auth/sign-in" />;
	}

	const authError = listQuery.error;
	if (authError instanceof ApiError && authError.status === 401) {
		return <Navigate to="/auth/sign-in" />;
	}

	const isListLoading =
		isSessionLoading || (listQuery.isLoading && !listQuery.data);
	const isCampaignsLoading =
		campaignsQuery.isLoading && !campaignsQuery.data;

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

	const handleCampaignTypeChange = (value: string) => {
		if (isBonusCampaignType(value)) setCampaignType(value);
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

				{isListLoading ? (
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
							empty="No active campaigns for this bonus type."
							error={campaignsQuery.error}
							bonuses={campaignsQuery.data ?? []}
							isLoading={isCampaignsLoading}
							filter={
								<CampaignTypeFilter
									value={campaignType}
									onChange={handleCampaignTypeChange}
								/>
							}
						/>
					</div>
				)}
			</div>
		</div>
	);
}

/**
 * Filters Available offers by Bonus Engine `bonus_type`. Options match Admin.
 */
function CampaignTypeFilter(payload: {
	value: BonusCampaignType;
	onChange: (value: string) => void;
}) {
	return (
		<label className="flex items-center gap-2">
			<span className="sr-only">Bonus type</span>
			<select
				value={payload.value}
				onChange={(event) => payload.onChange(event.target.value)}
				className="cursor-pointer rounded-md border border-[#1B2722] bg-[#151616] px-3 py-1.5 font-semibold text-xs text-white outline-none focus:border-accent"
			>
				{BONUS_TYPE_VALUES.map((bonusType) => (
					<option key={bonusType} value={bonusType}>
						{BONUS_TYPE_LABEL[bonusType]}
					</option>
				))}
			</select>
		</label>
	);
}

function BonusSection(payload: {
	title: string;
	empty: string;
	error: unknown;
	bonuses: BonusCardModel[];
	mutatingId?: string;
	isLoading?: boolean;
	filter?: ReactNode;
	onActivate?: (userbonusId: string) => void;
	onCancel?: (userbonusId: string) => void;
}) {
	return (
		<section className="space-y-4">
			<div className="flex items-center justify-between gap-3">
				<h2 className="font-extrabold text-lg text-white">{payload.title}</h2>
				{payload.filter}
			</div>
			{payload.isLoading ? (
				<BonusesGridSkeleton />
			) : payload.error ? (
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
