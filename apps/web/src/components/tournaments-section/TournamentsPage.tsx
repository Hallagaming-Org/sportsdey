import { Navigate } from "@tanstack/react-router";
import {
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth/client";
import {
	fetchTournamentLeaderboard,
	fetchTournamentList,
	isLeaderboardOptedIn,
	isTournamentAlreadyOptedInError,
	joinTournament,
	pickFeaturedTournament,
	type LeaderboardEntry,
	type TournamentCard as Tournament,
	type TournamentStatus,
} from "@/lib/tournaments";
import { TOURNAMENT_QUERY_KEY, TOURNAMENT_STATUS } from "@/lib/tournaments.constant";
import { TournamentCard } from "./TournamentCard";
import { TournamentGridSkeleton } from "./TournamentGridSkeleton";
import { TournamentHero } from "./TournamentHero";
import { TournamentLeaderboard } from "./TournamentLeaderboard";
import { TournamentToolbar } from "./TournamentToolbar";
import { TOURNAMENT_SPORT_FILTER_ALL } from "./tournaments.constant";

export function TournamentsPage() {
	const queryClient = useQueryClient();
	const { data: session, isPending: isSessionLoading } = useSession();
	const [activeStatus, setActiveStatus] = useState<TournamentStatus>(
		TOURNAMENT_STATUS.ACTIVE,
	);
	const [searchQuery, setSearchQuery] = useState("");
	const [sportFilter, setSportFilter] = useState<string>(
		TOURNAMENT_SPORT_FILTER_ALL,
	);
	const [joinedIds, setJoinedIds] = useState<ReadonlySet<string>>(
		() => new Set(),
	);

	const listQuery = useQuery({
		queryKey: TOURNAMENT_QUERY_KEY.LIST,
		queryFn: fetchTournamentList,
		enabled: Boolean(session?.user),
		retry: false,
	});

	const tournaments = listQuery.data ?? [];
	const featuredTournament = useMemo(
		() => pickFeaturedTournament(tournaments),
		[tournaments],
	);
	const sessionUserId = session?.user?.id ?? "";
	const joinableTournaments = useMemo(
		() =>
			tournaments.filter(
				(tournament) => tournament.status !== TOURNAMENT_STATUS.RESULTS,
			),
		[tournaments],
	);

	const leaderboardQueries = useQueries({
		queries: tournaments.map((tournament) => ({
			queryKey: TOURNAMENT_QUERY_KEY.leaderboard(tournament.id),
			queryFn: () =>
				fetchTournamentLeaderboard({
					tournamentId: tournament.id,
					tournamentTitle: tournament.title,
				}),
			enabled: Boolean(session?.user && tournament.id),
			retry: false,
		})),
	});

	const leaderboardByTournamentId = useMemo(() => {
		const byId = new Map<string, LeaderboardEntry[]>();
		for (const [index, tournament] of tournaments.entries()) {
			const entries = leaderboardQueries[index]?.data;
			if (!entries) continue;
			byId.set(tournament.id, entries);
		}
		return byId;
	}, [leaderboardQueries, tournaments]);

	const optedInIds = useMemo(() => {
		const ids = new Set(joinedIds);
		if (!sessionUserId) return ids;
		for (const tournament of joinableTournaments) {
			const entries = leaderboardByTournamentId.get(tournament.id);
			if (!entries) continue;
			if (isLeaderboardOptedIn({ entries, userId: sessionUserId })) {
				ids.add(tournament.id);
			}
		}
		return ids;
	}, [joinableTournaments, joinedIds, leaderboardByTournamentId, sessionUserId]);

	const featuredLeaderboard = featuredTournament
		? (leaderboardByTournamentId.get(featuredTournament.id) ?? [])
		: [];
	const featuredLeaderboardQuery = featuredTournament
		? leaderboardQueries[
				tournaments.findIndex(
					(tournament) => tournament.id === featuredTournament.id,
				)
			]
		: undefined;
	const featuredLeaderboardLoading = Boolean(
		featuredLeaderboardQuery?.isLoading,
	);

	const joinMutation = useMutation({
		mutationFn: joinTournament,
		onSuccess: async (_data, variables) => {
			setJoinedIds((current) => new Set(current).add(variables.tournamentId));
			toast.success("Joined tournament");
			await queryClient.invalidateQueries({
				queryKey: TOURNAMENT_QUERY_KEY.leaderboard(variables.tournamentId),
			});
		},
		onError: (error, variables) => {
			if (isTournamentAlreadyOptedInError(error)) {
				setJoinedIds((current) => new Set(current).add(variables.tournamentId));
				return;
			}
			toast.error(
				error instanceof ApiError
					? error.message
					: "Could not join this tournament. Try again.",
			);
		},
	});

	const statusCounts = useMemo(() => {
		const counts: Record<TournamentStatus, number> = {
			[TOURNAMENT_STATUS.ACTIVE]: 0,
			[TOURNAMENT_STATUS.UPCOMING]: 0,
			[TOURNAMENT_STATUS.RESULTS]: 0,
		};
		for (const tournament of tournaments) {
			counts[tournament.status] += 1;
		}
		return counts;
	}, [tournaments]);

	const visibleTournaments = useMemo(() => {
		const query = searchQuery.trim().toLowerCase();
		return tournaments.filter((tournament) => {
			if (tournament.status !== activeStatus) return false;
			if (
				sportFilter !== TOURNAMENT_SPORT_FILTER_ALL &&
				tournament.sport !== sportFilter
			) {
				return false;
			}
			if (!query) return true;
			return tournament.title.toLowerCase().includes(query);
		});
	}, [activeStatus, searchQuery, sportFilter, tournaments]);

	const handleJoin = (tournament: Tournament) => {
		if (tournament.status === TOURNAMENT_STATUS.RESULTS) return;
		if (optedInIds.has(tournament.id)) {
			toast.message(`You're already in ${tournament.title}`);
			return;
		}
		joinMutation.mutate({ tournamentId: tournament.id });
	};

	if (!isSessionLoading && !session?.user) {
		return <Navigate to="/auth/sign-in" />;
	}

	if (listQuery.error instanceof ApiError && listQuery.error.status === 401) {
		return <Navigate to="/auth/sign-in" />;
	}

	const isListLoading = isSessionLoading || listQuery.isLoading;
	const joiningId = joinMutation.isPending
		? joinMutation.variables?.tournamentId
		: undefined;

	return (
		<div className="w-full space-y-8 pb-8">
			<header>
				<h1 className="font-extrabold text-2xl text-white sm:text-3xl">
					Tournaments
				</h1>
				<p className="mt-1 text-sm text-[#8C8F8F]">
					Compete, climb the leaderboard and win amazing prices.
				</p>
			</header>

			<TournamentHero
				title={featuredTournament?.title ?? "Tournaments"}
				disabled={
					!featuredTournament ||
					featuredTournament.status === TOURNAMENT_STATUS.RESULTS ||
					optedInIds.has(featuredTournament.id)
				}
				onJoin={() => {
					if (featuredTournament) handleJoin(featuredTournament);
				}}
			/>

			<TournamentToolbar
				activeStatus={activeStatus}
				statusCounts={statusCounts}
				searchQuery={searchQuery}
				sportFilter={sportFilter}
				onStatusChange={setActiveStatus}
				onSearchChange={setSearchQuery}
				onSportFilterChange={setSportFilter}
			/>

			{isListLoading ? (
				<TournamentGridSkeleton />
			) : listQuery.isError ? (
				<EmptyState
					title="Could not load tournaments"
					titleClassName="text-white"
					description={
						listQuery.error instanceof ApiError
							? listQuery.error.message
							: "Try again in a moment."
					}
				/>
			) : visibleTournaments.length === 0 ? (
				<EmptyState
					title={
						activeStatus === TOURNAMENT_STATUS.RESULTS
							? "No tournament results yet"
							: "No tournaments found"
					}
					titleClassName="text-white"
					description={
						activeStatus === TOURNAMENT_STATUS.RESULTS
							? "Finished tournaments will show up here once a winner is declared."
							: "Try another tab, sport filter, or search term."
					}
				/>
			) : (
				<div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
					{visibleTournaments.map((tournament) => (
						<TournamentCard
							key={tournament.id}
							tournament={tournament}
							joined={optedInIds.has(tournament.id)}
							joining={joiningId === tournament.id}
							playerCount={
								leaderboardByTournamentId.get(tournament.id)?.length
							}
							onJoin={handleJoin}
						/>
					))}
				</div>
			)}

			<TournamentLeaderboard
				entries={featuredLeaderboard}
				isLoading={featuredLeaderboardLoading}
				title={
					featuredTournament
						? `${featuredTournament.title} leaderboard`
						: "Leaderboard Preview"
				}
			/>
		</div>
	);
}
