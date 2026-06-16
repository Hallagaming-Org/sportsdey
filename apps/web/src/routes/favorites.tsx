import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft, Star, Trash2 } from "lucide-react";
import { useMemo } from "react";
import {
	type FavoriteMatch,
	type FavoriteTeam,
	useFavorites,
} from "@/hooks/useFavorites";
import { apiRequest } from "@/lib/api";
import {
	BasketballComponentHeader,
	MatchCard,
} from "@/shared/BasketballAccordionComponentCard";

const getScore = (
	points: number | null | undefined,
	score: { total?: number } | undefined,
): number | undefined => {
	if (points !== null && points !== undefined) return points;
	if (score && typeof score === "object" && "total" in score)
		return score.total;
	return undefined;
};

export const Route = createFileRoute("/favorites")({
	component: FavoritesPage,
});

const FavoriteMatchCardRow = ({
	match,
	onRemove,
}: {
	match: FavoriteMatch;
	onRemove: () => void;
}) => {
	const { data: gameData } = useQuery({
		queryKey: [match.sport, "game", match.id],
		queryFn: () => apiRequest<any>(`${match.sport}/game/${match.id}`),
		refetchInterval: 30000,
	});

	const team1 = gameData?.home?.name || match.team1;
	const team2 = gameData?.away?.name || match.team2;
	const score1 = getScore(gameData?.home?.points, gameData?.home?.score);
	const score2 = getScore(gameData?.away?.points, gameData?.away?.score);
	const status = gameData
		? gameData?.status === "closed" ||
			gameData?.status === "ended" ||
			gameData?.status === "Finished A.E.T." ||
			gameData?.status === "Full Time"
			? "FT"
			: gameData?.clock
				? "Live"
				: gameData?.status || match.time
		: match.time || "Scheduled";
	const time = gameData?.clock || match.time || "00:00";

	const getRouteConfig = () => {
		switch (match.sport) {
			case "basketball":
				return { to: "/basketball/$Id" as const, params: { Id: match.id } };
			case "tennis":
				return {
					to: "/tennis/$Id" as const,
					params: { Id: match.id },
					search: { country: match.country },
				};
			case "football":
				return { to: "/index/$gameId" as const, params: { gameId: match.id } };
			default:
				return { to: "/index/$gameId" as const, params: { gameId: match.id } };
		}
	};

	const routeConfig = getRouteConfig();

	return (
		<div className="overflow-hidden border-gray-100 border-b bg-white last:border-b-0">
			<Link
				{...routeConfig}
				className="block transition-colors hover:bg-gray-50"
			>
				<MatchCard
					id={match.id}
					team1={team1}
					team2={team2}
					score1={score1}
					score2={score2}
					status={status}
					time={time}
					isFavorite={true}
					onFavoriteToggle={onRemove}
					hideFinishedStatus={true}
				/>
			</Link>
		</div>
	);
};

function FavoritesPage() {
	const router = useRouter();
	const {
		favoriteTeams,
		favoriteMatches,
		favoriteLeagues,
		toggleFavoriteTeam,
		toggleFavoriteMatch,
		toggleFavoriteLeague,
	} = useFavorites();

	const teamsGroupedByLeague = useMemo(() => {
		const groups: Record<
			string,
			{ league: string; country: string; flag?: string; teams: FavoriteTeam[] }
		> = {};

		favoriteTeams.forEach((team) => {
			const leagueKey = team.tournament || "Other";
			if (!groups[leagueKey]) {
				groups[leagueKey] = {
					league: leagueKey,
					country: team.country || "International",
					flag: team.flag,
					teams: [],
				};
			}
			groups[leagueKey].teams.push(team);
		});

		return Object.values(groups);
	}, [favoriteTeams]);

	const matchesGroupedByLeague = useMemo(() => {
		const groups: Record<
			string,
			{
				league: string;
				country: string;
				flag?: string;
				matches: FavoriteMatch[];
			}
		> = {};

		favoriteMatches.forEach((match) => {
			const leagueKey = match.tournament || "Other";
			if (!groups[leagueKey]) {
				groups[leagueKey] = {
					league: leagueKey,
					country: match.country || "International",
					flag: match.flag,
					matches: [],
				};
			}
			groups[leagueKey].matches.push(match);
		});

		return Object.values(groups);
	}, [favoriteMatches]);

	return (
		<div className="h-full bg-[#f8f9fa] dark:bg-[#111211]">
			{/* Header */}
			<div className="sticky top-0 z-20 mb-4 flex items-center bg-white px-6 py-5 shadow-sm dark:border-gray-800 dark:border-b dark:bg-[#1A1A1A]">
				<button
					onClick={() => router.history.back()}
					className="mr-5 rounded-full p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
				>
					<ChevronLeft className="h-6 w-6 text-primary dark:text-white" />
				</button>
				<h1 className="font-bold text-primary text-xl dark:text-white">
					Favorites
				</h1>
			</div>

			<div className="mx-auto w-full space-y-8 px-4">
				{favoriteTeams.length === 0 &&
				favoriteMatches.length === 0 &&
				favoriteLeagues.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-24 text-center">
						<div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 dark:bg-[#202120]">
							<Star className="h-10 w-10 text-gray-300 dark:text-gray-600" />
						</div>
						<h2 className="mb-2 font-bold text-lg text-primary dark:text-white">
							No favorites yet
						</h2>
						<p className="max-w-[260px] text-gray-500 text-sm dark:text-gray-400">
							Tap the star icon next to teams or matches to keep track of them
							here.
						</p>
					</div>
				) : (
					<>
						{/* Favorite Leagues Section */}
						{favoriteLeagues.length > 0 && (
							<section className="space-y-4">
								<h2 className="ml-1 font-bold text-lg text-primary">
									Favorite Leagues
								</h2>
								<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
									{favoriteLeagues.map((league) => {
										const sport = league.sport.toLowerCase();
										const to =
											sport === "basketball"
												? "/basketball"
												: sport === "tennis"
													? "/tennis"
													: "/";
										return (
											<div
												key={league.id}
												className="group flex items-center justify-between overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all hover:bg-gray-50"
											>
												<Link
													to={to as any}
													search={
														{ league: league.name, sports: league.sport } as any
													}
													className="flex flex-1 items-center gap-4 p-4"
												>
													<div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50 p-1.5">
														<img
															src={league.flag || "/International.png"}
															alt={league.name}
															className="h-full w-full rounded-full object-cover"
														/>
													</div>
													<div className="flex flex-col">
														<span className="font-bold text-primary text-sm">
															{league.name}
														</span>
														<span className="font-bold text-[10px] text-gray-400 uppercase tracking-wider">
															{league.country} • {league.sport}
														</span>
													</div>
												</Link>
												<button
													onClick={() => toggleFavoriteLeague(league)}
													className="p-4 text-gray-300 transition-colors hover:text-red-500"
												>
													<Trash2 className="h-4 w-4 cursor-pointer" />
												</button>
											</div>
										);
									})}
								</div>
							</section>
						)}

						{/* Favorite Teams Section */}
						{teamsGroupedByLeague.length > 0 && (
							<section className="space-y-4">
								<h2 className="ml-1 font-bold text-lg text-primary">
									Favorite Teams
								</h2>
								<div className="space-y-4">
									{teamsGroupedByLeague.map((group) => (
										<div
											key={group.league}
											className="overflow-hidden rounded-2xl bg-white shadow-sm"
										>
											<BasketballComponentHeader
												league={group.league}
												country={group.country}
												flag={group.flag}
												isExpanded={true}
												onToggle={() => {}}
											/>
											<div className="grid grid-cols-1 gap-4 bg-gray-50/50 p-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
												{group.teams.map((team) => (
													<div
														key={team.id}
														className="group flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:bg-gray-50"
													>
														<div className="flex items-center gap-4">
															<div className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-100 bg-gray-50 p-1.5">
																<img
																	src={team.logo || "/Profile.png"}
																	alt={team.name}
																	className="h-full w-full object-contain"
																/>
															</div>
															<div className="flex flex-col">
																<span className="font-bold text-primary text-sm">
																	{team.name}
																</span>
																<span className="font-bold text-[10px] text-gray-400 uppercase tracking-wider">
																	{team.sport}
																</span>
															</div>
														</div>
														<button
															onClick={() => toggleFavoriteTeam(team)}
															className="p-2 text-gray-300 transition-colors hover:text-red-500"
														>
															<Trash2 className="h-4 w-4" />
														</button>
													</div>
												))}
											</div>
										</div>
									))}
								</div>
							</section>
						)}

						{/* Favorite Matches Section */}
						{matchesGroupedByLeague.length > 0 && (
							<section className="space-y-4">
								<h2 className="ml-1 font-bold text-lg text-primary">
									Favorite Matches
								</h2>
								<div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
									{matchesGroupedByLeague.map((group) => (
										<div
											key={group.league}
											className="overflow-hidden rounded-2xl bg-white shadow-sm"
										>
											<BasketballComponentHeader
												league={group.league}
												country={group.country}
												flag={group.flag}
												isExpanded={true}
												onToggle={() => {}}
											/>
											<div className="divide-y divide-gray-100">
												{group.matches.map((match) => (
													<FavoriteMatchCardRow
														key={match.id}
														match={match}
														onRemove={() => toggleFavoriteMatch(match)}
													/>
												))}
											</div>
										</div>
									))}
								</div>
							</section>
						)}
					</>
				)}
			</div>
		</div>
	);
}
