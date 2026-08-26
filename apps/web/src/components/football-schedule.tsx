import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2, X } from "lucide-react";
import { useMemo, useTransition } from "react";
import BannerCarousel from "@/components/BannerCarousel";
import { useCurrentFilter } from "@/hooks/use-current-filter";
import { useFootballSchedule } from "@/hooks/use-fooball-schedule";
import { useFavorites } from "@/hooks/useFavorites";
import type { BannerData } from "@/lib/banners-server";
import type { Sport } from "@/lib/constants";
import { formatTime } from "@/lib/utils";
import { MatchCard } from "@/shared/BasketballAccordionComponentCard";
import FixtureFilterHeaders from "@/shared/FixtureFilterHeaders";
import type { RootState } from "@/store";
import { useAppSelector } from "@/store/hook";
import { BetConverter } from "./bet-converter";
import { EmptyState } from "./EmptyState";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "./ui/accordion";

interface FootballScheduleProps {
	banners?: BannerData[];
}

const FootballSchedule = ({ banners }: FootballScheduleProps) => {
	const { isFavoriteMatch, toggleFavoriteMatch } = useFavorites();
	// const router = useRouter();
	const search = useSearch({ from: "/" }) as {
		league?: string;
		sports?: Sport;
	};
	const navigate = useNavigate();
	const activeLeague = search.league;

	const selectedDateString = useAppSelector(
		(state: RootState) => state.date.selectedDate,
	);
	const selectedDate = new Date(selectedDateString);
	const { currentFilter } = useCurrentFilter();
	const [isPending] = useTransition();
	const { data: schedules, isLoading } = useFootballSchedule(
		`${selectedDate.getDate().toString().padStart(2, "0")}/${(selectedDate.getMonth() + 1).toString().padStart(2, "0")}/${selectedDate.getFullYear()}`,
		"en",
	);

	const filtersCount = useMemo(() => {
		if (!schedules) {
			return {
				all: 0,
				live: 0,
				finished: 0,
				upcoming: 0,
			};
		}

		const all = schedules.total_matches;
		let live = 0;
		let finished = 0;
		let upcoming = 0;

		schedules.competitions.forEach((competition) => {
			competition.matches.forEach((match) => {
				if (match.match_status === "closed") {
					finished++;
				} else if (match.match_status === "SCH") {
					upcoming++;
				} else {
					live++;
				}
			});
		});

		return {
			all,
			live,
			finished,
			upcoming,
		};
	}, [schedules]);

	const filteredSchedules = useMemo(() => {
		if (!schedules) return null;

		const nameCount = new Map<string, number>();
		schedules.competitions.forEach((comp) => {
			const name = comp.competition.name;
			nameCount.set(name, (nameCount.get(name) || 0) + 1);
		});

		const processedCompetitions = schedules.competitions.map((comp) => {
			const name = comp.competition.name;
			const shouldPrefix =
				nameCount.get(name)! > 1 && comp.competition.country?.name;
			return {
				...comp,
				displayName: shouldPrefix
					? `${comp.competition.country.name}: ${name}`
					: name,
			};
		});

		const filterByStatus = (comp: (typeof processedCompetitions)[0]) => {
			if (currentFilter === "all") return true;
			const hasFinished = comp.matches.some((m) => m.match_status === "closed");
			const hasUpcoming = comp.matches.some(
				(m) => m.match_status === "SCH" || m.match_status === "AET",
			);
			const hasLive = comp.matches.some(
				(m) =>
					m.match_status !== "closed" &&
					m.match_status !== "SCH" &&
					m.match_status !== "AET" &&
					m.match_status !== "FTO",
			);
			if (currentFilter === "finished") return hasFinished;
			if (currentFilter === "upcoming") return hasUpcoming;
			if (currentFilter === "live") return hasLive;
			return false;
		};

		const filteredCompetitions = processedCompetitions.filter(filterByStatus);

		const finalCompetitions = activeLeague
			? filteredCompetitions.filter((comp) => comp.displayName === activeLeague)
			: filteredCompetitions;

		return {
			...schedules,
			competitions: finalCompetitions.map((comp) => ({
				...comp,
				competition: {
					...comp.competition,
					name: comp.displayName,
				},
			})),
		};
	}, [schedules, currentFilter, activeLeague]);

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center space-y-2">
				<Loader2 className="animate-spin" width={24} height={24} />
				<p className="text-gray-500 text-sm">Loading matches...</p>
			</div>
		);
	}

	return (
		<div>
			<div className="sticky top-[-16px] z-10 hidden items-center justify-between bg-background/95 px-1 py-4 backdrop-blur-sm lg:flex">
				<FixtureFilterHeaders counts={filtersCount} />
			</div>
			{banners && banners.length > 0 && (
				<div className="mb-4">
					<BannerCarousel banners={banners} />
				</div>
			)}
			{isPending && (
				<div className="flex items-center justify-center py-4">
					<Loader2 className="mr-2 animate-spin" width={20} height={20} />
					<span className="text-gray-600 text-sm">Filtering matches...</span>
				</div>
			)}

			{activeLeague && !isLoading && (
				<div className="mb-4 flex items-center justify-between rounded-xl border border-accent/20 bg-accent/10 px-4 py-3">
					<div className="flex items-center gap-2">
						<span className="font-medium text-primary text-sm">
							Filtered by:
						</span>
						<span className="font-bold text-accent text-sm">
							{activeLeague}
						</span>
					</div>
					<button
						onClick={() =>
							navigate({
								to: "/",
								search: { league: undefined, sports: search.sports },
							})
						}
						className="flex items-center gap-1 rounded-lg px-2 py-1 font-bold text-accent text-xs transition-colors hover:bg-accent/20"
						type="button"
					>
						<X className="h-3 w-3" />
						Clear Filter
					</button>
				</div>
			)}

			{/* <BetConverter /> */}
			<div className="space-y-4">
				{filteredSchedules?.competitions.length === 0 ? (
					<EmptyState
						title={`No ${currentFilter === "all" ? "" : currentFilter} matches found`}
						description={`We couldn't find any matches matching your criteria for this date.`}
					/>
				) : (
					filteredSchedules?.competitions.map((competition) => (
						<Accordion
							key={`${competition.competition.id}`}
							type="single"
							collapsible={false}
							defaultValue={`${competition.competition.id}`}
						>
							<AccordionItem
								value={`${competition.competition.id}`}
								className="w-full rounded-2xl bg-white dark:bg-card"
							>
								<Link
									to="/index/tournament/$tournamentId"
									params={{ tournamentId: competition.competition.id }}
								>
									<AccordionTrigger
										className="cursor-pointer rounded-none border-gray-100 px-4 font-bold text-primary dark:text-white [&[data-state=open]]:border-b"
										isCollapsible={false}
									>
										{competition.competition.name}
									</AccordionTrigger>
								</Link>

								<AccordionContent className="cursor-pointer overflow-hidden">
									<div>
										{competition.matches.map((match, index) => (
											<Link
												to="/index/$gameId"
												params={{ gameId: match.id }}
												key={`${index}+1`}
											>
												<MatchCard
													team1={match.competitors.home.name}
													team2={match.competitors.away.name}
													time={formatTime(new Date(match.start_time))}
													score1={match.competitors.home.score}
													score2={match.competitors.away.score}
													clock={match.clock}
													isFavorite={
														match.id ? isFavoriteMatch(match.id) : false
													}
													status={match.match_status}
													onFavoriteToggle={() =>
														toggleFavoriteMatch({
															id: match.id,
															team1: match.competitors.home.name,
															team2: match.competitors.away.name,
															sport: "football",
															date: match.start_time,
															tournament: competition.competition.name,
														})
													}
													id={match.id}
												/>
											</Link>
										))}
									</div>
								</AccordionContent>
							</AccordionItem>
						</Accordion>
					))
				)}
			</div>
		</div>
	);
};
export default FootballSchedule;
