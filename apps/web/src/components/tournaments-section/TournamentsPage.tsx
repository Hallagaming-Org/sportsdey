import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { TournamentCard } from "./TournamentCard";
import { TournamentHero } from "./TournamentHero";
import { TournamentLeaderboard } from "./TournamentLeaderboard";
import { TournamentToolbar } from "./TournamentToolbar";
import {
	DUMMY_TOURNAMENTS,
	FEATURED_TOURNAMENT_ID,
	type Tournament,
	type TournamentStatus,
} from "./tournaments.constant";

export function TournamentsPage() {
	const [activeStatus, setActiveStatus] = useState<TournamentStatus>("active");
	const [searchQuery, setSearchQuery] = useState("");
	const [sportFilter, setSportFilter] = useState("all");
	const [joinedIds, setJoinedIds] = useState<ReadonlySet<string>>(
		() => new Set(),
	);

	const statusCounts = useMemo(() => {
		const counts: Record<TournamentStatus, number> = {
			active: 0,
			upcoming: 0,
			results: 0,
		};
		for (const tournament of DUMMY_TOURNAMENTS) {
			counts[tournament.status] += 1;
		}
		return counts;
	}, []);

	const visibleTournaments = useMemo(() => {
		const query = searchQuery.trim().toLowerCase();
		return DUMMY_TOURNAMENTS.filter((tournament) => {
			if (tournament.status !== activeStatus) return false;
			if (sportFilter !== "all" && tournament.sport !== sportFilter) {
				return false;
			}
			if (!query) return true;
			return tournament.title.toLowerCase().includes(query);
		});
	}, [activeStatus, searchQuery, sportFilter]);

	const joinTournament = (tournament: Tournament) => {
		if (joinedIds.has(tournament.id)) {
			toast.message(`You're already in ${tournament.title}`);
			return;
		}

		setJoinedIds((current) => new Set(current).add(tournament.id));
		toast.success(
			tournament.status === "upcoming"
				? `We'll remind you about ${tournament.title}`
				: `Joined ${tournament.title}`,
		);
	};

	const featuredTournament =
		DUMMY_TOURNAMENTS.find(
			(tournament) => tournament.id === FEATURED_TOURNAMENT_ID,
		) ?? DUMMY_TOURNAMENTS[0];

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

			<TournamentHero onJoin={() => joinTournament(featuredTournament)} />

			<TournamentToolbar
				activeStatus={activeStatus}
				statusCounts={statusCounts}
				searchQuery={searchQuery}
				sportFilter={sportFilter}
				onStatusChange={setActiveStatus}
				onSearchChange={setSearchQuery}
				onSportFilterChange={setSportFilter}
			/>

			{visibleTournaments.length === 0 ? (
				<EmptyState
					title={
						activeStatus === "results"
							? "No tournament results yet"
							: "No tournaments found"
					}
					titleClassName="text-white"
					description={
						activeStatus === "results"
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
							joined={joinedIds.has(tournament.id)}
							onJoin={joinTournament}
						/>
					))}
				</div>
			)}

			<TournamentLeaderboard />
		</div>
	);
}
