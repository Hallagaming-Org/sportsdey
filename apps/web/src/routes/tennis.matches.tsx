import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { MobileSportsFilter } from "@/components/MobileSportsFilter";
import { useApiError } from "@/hooks/useApiError";
import { apiRequest } from "@/lib/api";
import SportAccordionCard from "@/shared/SportAccordionCard";
import TennisFixtureFilterHeaders from "@/shared/TennisFixtureFilterHeaders";
import type { RootState } from "@/store";
import { useAppSelector } from "@/store/hook";
import type { TennisScheduleData } from "@/types/api";
import type { MatchCardProps, SetScore } from "@/types/sport";

export const Route = createFileRoute("/tennis/matches")({
	component: RouteComponent,
});

const formatDate = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

function RouteComponent() {
	const search = useSearch({ from: "/tennis" }) as {
		league?: string;
		country?: string;
		flag?: string;
	};

	const selectedDateString = useAppSelector(
		(state: RootState) => state.date.selectedDate,
	);
	const activeFilter = useAppSelector(
		(state: RootState) => state.tennis.activeFilter,
	);
	const selectedDate = new Date(selectedDateString);
	const formattedDate = formatDate(selectedDate);

	const {
		data: scheduleData,
		isLoading,
		error,
		isError,
		refetch,
	} = useQuery({
		queryKey: ["tennis", "schedule", formattedDate],
		queryFn: () =>
			apiRequest<TennisScheduleData>(
				`tennis/schedule/${formattedDate}`,
			),
	});

	const { isNetworkError } = useApiError({ error, isError, refetch });

	const counts = useMemo(() => {
		if (!scheduleData?.competitions)
			return { all: 0, live: 0, finished: 0, upcoming: 0 };

		const allMatches = scheduleData.competitions.flatMap(
			(comp) => comp.matches,
		);

		const isLive = (status: string) => status === "inprogress";
		const isFinished = (status: string) =>
			["closed", "ended", "interrupted"].includes(status);
		const isUpcoming = (status: string) =>
			["scheduled", "ns", "not_started"].includes(status);

		return {
			all: allMatches.length,
			live: allMatches.filter((m) => isLive(m.status)).length,
			finished: allMatches.filter((m) => isFinished(m.status)).length,
			upcoming: allMatches.filter((m) => isUpcoming(m.status)).length,
		};
	}, [scheduleData]);

	const matchesFilter = (status: string) => {
		switch (activeFilter) {
			case "live":
				return status === "inprogress";
			case "finished":
				return ["closed", "ended", "interrupted"].includes(status);
			case "upcoming":
				return ["scheduled", "ns", "not_started"].includes(status);
			case "all":
			default:
				return true;
		}
	};

	const tennisLeagues = useMemo(() => {
		if (!scheduleData?.competitions) return [];

		return scheduleData.competitions
			.map((comp) => {
				const leagueName = search.league || comp.competition.name;

				return {
					id: comp.competition.id,
					country: search.country || "International",
					leagueName: leagueName,
					flag: search.flag,
					matches: comp.matches
						.filter((match) => matchesFilter(match.status))
						.map((match): MatchCardProps => {
							const formatTime = (dateStr: string) => {
								try {
									return new Date(dateStr).toLocaleTimeString("en-US", {
										hour: "2-digit",
										minute: "2-digit",
										hour12: false,
									});
								} catch {
									return "00:00";
								}
							};

							const formatSetScores = (
								scores: {
									set_number: number;
									games_won: number;
									tiebreak_score?: number;
								}[],
							): SetScore[] =>
								scores.map((set) => ({
									games: set.games_won,
									tiebreak: set.tiebreak_score,
								}));

							let displayStatus: string | undefined;
							let displayTime: string | undefined;

							if (match.status === "scheduled") {
								displayTime = formatTime(match.start_time);
							} else if (match.status === "closed") {
								displayStatus = "FT";
							} else if (match.status === "inprogress") {
								displayStatus = "Live";
							}

							return {
								team1: match.home.name,
								team2: match.away.name,
								player1Sets: formatSetScores(match.home.set_scores),
								player2Sets: formatSetScores(match.away.set_scores),
								status: displayStatus,
								time: displayTime,
								id: match.id,
							} as MatchCardProps;
						}),
				};
			})
			.filter((league) => league.matches.length > 0);
	}, [scheduleData, activeFilter, search]);

	if (isError) {
		return (
			<div className="mb-32 space-y-4 pb-10 lg:mb-0">
				<ErrorState
					message={
						isNetworkError
							? "Network Error"
							: "Failed to load tennis schedule"
					}
					description={
						isNetworkError
							? "Please check your internet connection"
							: "Unable to load tennis matches"
					}
					onRetry={refetch}
					isNetworkError={isNetworkError}
				/>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center space-y-2 py-20">
				<Loader2 className="animate-spin" width={24} height={24} />
				<p className="text-gray-500 text-sm">Loading tennis matches...</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<MobileSportsFilter />
			<div className="sticky top-0 z-10 hidden w-full bg-background/95 px-1 py-4 backdrop-blur-sm lg:block">
				<TennisFixtureFilterHeaders counts={counts} />
			</div>
			{tennisLeagues.length === 0 ? (
				<EmptyState
					title={`No ${activeFilter === "all" ? "" : activeFilter} tennis matches`}
					description={
						activeFilter === "all"
							? "No tennis matches scheduled for this date"
							: activeFilter === "live"
								? "No live matches at the moment"
								: activeFilter === "finished"
									? "No finished matches for this date"
									: "No upcoming matches for this date"
					}
				/>
			) : (
				tennisLeagues.map((league) => (
					<SportAccordionCard
						key={league.id}
						sport="tennis"
						country={league.country}
						league={league.leagueName}
						flag={league.flag}
						matches={league.matches}
						detailRoute="/tennis/$Id"
						showTournamentLink
						tournamentId={league.id}
						tournamentRoute="/tennis/tournament/$tournamentId"
					/>
				))
			)}
		</div>
	);
}
