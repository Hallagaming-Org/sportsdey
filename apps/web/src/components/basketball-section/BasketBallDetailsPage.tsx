import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { useFavorites } from "@/hooks/useFavorites";
import { apiRequest } from "@/lib/api";
import { trackWebengageEvent } from "@/lib/webengage";
import DetailsImageCard from "@/shared/DetailsImageCard";
import type { BasketballGameDetails } from "@/types/api";
import { getTimeUntilStart, safeParseDate } from "@/utils/timeUtils";

import { GameDetailsSkeleton } from "./GameDetailsSkeleton";
import InfoTab from "./InfoTab";
import StandingsTab from "./StandingsTab";
import type { TeamStatsData } from "./TeamStats";
import { TeamStats } from "./TeamStats";
import { VideosTab } from "./VideosTab";

const BasketBallDetailsPage = () => {
	const { Id } = useParams({ from: "/basketball/$Id" });
	const [activeTab, setActiveTab] = useState("info");
	const [countdown, setCountdown] = useState<string>("");
	const [standingsConference, setStandingsConference] = useState<
		"western" | "eastern"
	>("western");
	const [standingsEnabled, setStandingsEnabled] = useState(false);
	const [statsEnabled, setStatsEnabled] = useState(false);
	const matchTrackedRef = useRef(false);

	const {
		isFavoriteTeam,
		toggleFavoriteTeam,
		isFavoriteLeague,
		toggleFavoriteLeague,
	} = useFavorites();

	const { data: gameDetails, isLoading: isGameLoading } = useQuery({
		queryKey: ["basketball", "game", Id],
		queryFn: () => apiRequest<BasketballGameDetails>(`basketball/game/${Id}`),
		enabled: !!Id,
	});

	useEffect(() => {
		if (activeTab === "standings") {
			setStandingsEnabled(true);
		}
		if (activeTab === "team_stats") {
			setStatsEnabled(true);
		}
	}, [activeTab]);

	const { data: statsData, isLoading: isStatsLoading } = useQuery({
		queryKey: ["basketball", "game", Id, "stats"],
		queryFn: () => apiRequest<any>(`basketball/game/${Id}/stats`),
		enabled: !!Id && statsEnabled,
		staleTime: 5 * 60 * 1000,
	});

	const tournamentId = gameDetails?.tournament?.id;

	const { data: standingsData, isLoading: isStandingsLoading } = useQuery({
		queryKey: ["basketball", "standings", tournamentId],
		queryFn: () => apiRequest<any>(`basketball/standings/${tournamentId}`),
		enabled: !!tournamentId && standingsEnabled,
		staleTime: 5 * 60 * 1000, // Preserve for 5 minutes
	});

	const homeTeamId = gameDetails?.home.name || "";
	const awayTeamId = gameDetails?.away.name || "";

	const isHomeFavorite = isFavoriteTeam(homeTeamId);
	const isAwayFavorite = isFavoriteTeam(awayTeamId);

	const handleToggleFavorite = (teamName: string, logo = "/Profile.png") => {
		const tournamentName = gameDetails?.tournament?.name || "";
		const country = getCountryName(tournamentName);
		const flag = getCountryCode(tournamentName)
			? `https://flagcdn.com/w40/${getCountryCode(tournamentName)}.png`
			: undefined;

		toggleFavoriteTeam({
			id: teamName,
			name: teamName,
			logo,
			sport: "basketball",
			tournament: tournamentName,
			tournamentId: gameDetails?.tournament?.id?.toString(),
			country,
			flag,
		});
	};

	const handleToggleFavoriteLeague = () => {
		if (!gameDetails?.tournament) return;

		const tournamentName = gameDetails.tournament.name || "";
		const country = getCountryName(tournamentName);
		const flag = getCountryCode(tournamentName)
			? `https://flagcdn.com/w40/${getCountryCode(tournamentName)}.png`
			: undefined;

		toggleFavoriteLeague({
			id: tournamentName,
			name: tournamentName,
			country,
			flag,
			sport: "basketball",
		});
	};

	const getCountryCode = (name: string): string => {
		const lowerName = name.toLowerCase();
		const mapping: Record<string, string> = {
			usa: "us",
			nba: "us",
			ncaa: "us",
			america: "us",
			turkey: "tr",
			turkish: "tr",
			tbsl: "tr",
			bsl: "tr",
			efes: "tr",
			spain: "es",
			spanish: "es",
			acb: "es",
			germany: "de",
			german: "de",
			bbl: "de",
			france: "fr",
			french: "fr",
			lnb: "fr",
			italy: "it",
			italian: "it",
			lba: "it",
			greece: "gr",
			greek: "gr",
			australia: "au",
			australian: "au",
			china: "cn",
			chinese: "cn",
			cba: "cn",
			philippines: "ph",
			philippine: "ph",
			pba: "ph",
			japan: "jp",
			japanese: "jp",
			"b.league": "jp",
		};
		for (const key in mapping) {
			if (lowerName.includes(key)) return mapping[key];
		}
		return "";
	};

	const getCountryName = (name: string): string => {
		const code = getCountryCode(name);
		if (code === "tr") return "Turkey";
		if (code === "us") return "USA";
		if (code === "de") return "Germany";
		if (code === "es") return "Spain";
		if (code === "fr") return "France";
		if (code === "it") return "Italy";
		if (code === "gr") return "Greece";
		return name || "International";
	};

	const mapStatsData = (
		apiStats: any,
		side: "home" | "away",
	): TeamStatsData => {
		const teamData = apiStats?.[side];
		const teamFromDetails = gameDetails?.[side];
		const teamName = teamFromDetails?.name || "";
		const teamLogo = teamFromDetails?.imageUrl || "/Profile.png";

		// If we have API stats (lazy loaded), use them.
		// Otherwise, check if gameDetails has the info (starters/bench)
		const effectiveData = teamData || {
			starters: teamFromDetails?.starters || [],
			bench: teamFromDetails?.bench || [],
		};

		if (!effectiveData.starters.length && !effectiveData.bench.length) {
			return {
				teamName,
				teamLogo,
				starters: [],
				bench: [],
				totals: {
					pts: 0,
					fg: "0/0",
					fgPct: 0,
					threePt: "0/0",
					threePtPct: 0,
					ft: "0/0",
					ftPct: 0,
					reb: 0,
					oreb: 0,
					dreb: 0,
					ast: 0,
					stl: 0,
					blk: 0,
					to: 0,
					pf: 0,
					min: "0",
				} as any,
			};
		}

		const mapPlayerWithMins = (p: any) => {
			const formatMins = (min: number) => {
				if (min === 0) return "00:00";
				const m = Math.floor(min);
				const s = Math.floor((min - m) * 60);
				return `${m}:${s.toString().padStart(2, "0")}`;
			};

			const s = p.statistics;
			const pts =
				2 * s.field_goals_made + s.three_points_made + s.free_throws_made;

			return {
				name: p.full_name,
				number: "-",
				pts,
				fg: `${s.field_goals_made}/${s.field_goals_att}`,
				threePt: `${s.three_points_made}/${s.three_points_att}`,
				ft: `${s.free_throws_made}/${s.free_throws_att}`,
				reb: s.rebounds,
				ast: s.assists,
				to: s.turnovers,
				stl: s.steals,
				blk: s.blocks,
				oreb: s.offensive_rebounds,
				dreb: s.defensive_rebounds,
				pf: s.personal_fouls,
				min: formatMins(p.pls_min),
				plusMinus: 0,
			};
		};

		const starters = effectiveData.starters.map(mapPlayerWithMins);
		const bench = effectiveData.bench.map(mapPlayerWithMins);

		const rawPlayers = [...effectiveData.starters, ...effectiveData.bench];
		const agg = rawPlayers.reduce(
			(acc, player) => {
				const s = player.statistics;
				const pts =
					2 * s.field_goals_made + s.three_points_made + s.free_throws_made;

				acc.pts += pts;
				acc.fgm += s.field_goals_made;
				acc.fga += s.field_goals_att;
				acc.tpm += s.three_points_made;
				acc.tpa += s.three_points_att;
				acc.ftm += s.free_throws_made;
				acc.fta += s.free_throws_att;
				acc.reb += s.rebounds;
				acc.oreb += s.offensive_rebounds;
				acc.dreb += s.defensive_rebounds;
				acc.ast += s.assists;
				acc.stl += s.steals;
				acc.blk += s.blocks;
				acc.to += s.turnovers;
				return acc;
			},
			{
				pts: 0,
				fgm: 0,
				fga: 0,
				tpm: 0,
				tpa: 0,
				ftm: 0,
				fta: 0,
				reb: 0,
				oreb: 0,
				dreb: 0,
				ast: 0,
				stl: 0,
				blk: 0,
				to: 0,
			},
		);

		const formatPct = (made: number, att: number) =>
			att > 0 ? Math.round((made / att) * 100) : 0;

		return {
			teamName,
			teamLogo,
			starters,
			bench,
			totals: {
				pts: agg.pts,
				fg: `${agg.fgm}/${agg.fga}`,
				fgPct: formatPct(agg.fgm, agg.fga),
				threePt: `${agg.tpm}/${agg.tpa}`,
				threePtPct: formatPct(agg.tpm, agg.tpa),
				ft: `${agg.ftm}/${agg.fta}`,
				ftPct: formatPct(agg.ftm, agg.fta),
				reb: agg.reb,
				oreb: agg.oreb,
				dreb: agg.dreb,
				ast: agg.ast,
				stl: agg.stl,
				blk: agg.blk,
				to: agg.to,
				pf: 0,
				min: 240,
			},
		};
	};

	const mappedTeamStats = gameDetails
		? [mapStatsData(statsData, "home"), mapStatsData(statsData, "away")]
		: [];

	const gameTabs = [
		{ id: "info", label: "Info" },
		{ id: "standings", label: "Standings" },
		{ id: "team_stats", label: "Team Stats" },
		{ id: "videos", label: "Videos" },
	];

	const renderTabContent = () => {
		switch (activeTab) {
			case "info":
				return (
					<InfoTab gameDetails={gameDetails} teamStats={mappedTeamStats} />
				);
			case "standings": {
				const isUSLeague =
					gameDetails?.tournament?.name?.toLowerCase().includes("us") ||
					gameDetails?.tournament?.name?.toLowerCase().includes("nba");

				return (
					<StandingsTab
						teams={standingsData?.data || []}
						conference={standingsConference}
						onConferenceChange={setStandingsConference}
						homeTeam={gameDetails?.home.name}
						awayTeam={gameDetails?.away.name}
						hideConference={isUSLeague}
						isLoading={isStandingsLoading}
					/>
				);
			}
			case "team_stats":
				return <TeamStats teams={mappedTeamStats} isLoading={isStatsLoading} />;
			case "videos":
				return (
					<VideosTab
						homeTeam={gameDetails?.home.name || ""}
						awayTeam={gameDetails?.away.name || ""}
					/>
				);
			default:
				return null;
		}
	};

	useEffect(() => {
		if (gameDetails && !matchTrackedRef.current) {
			matchTrackedRef.current = true;
			trackWebengageEvent("Match viewed", {
				match_id: Id,
				sport: "basketball",
				league: gameDetails.tournament?.name || "",
				teams: `${gameDetails.home?.name || ""} vs ${gameDetails.away?.name || ""}`,
				timings: gameDetails.date || "",
				match_status: gameDetails.status || "",
				match_score: `${gameDetails.home?.points ?? ""} - ${gameDetails.away?.points ?? ""}`,
				match_time: gameDetails.clock || "",
				referrer: "",
			});
		}
	}, [gameDetails, Id]);

	useEffect(() => {
		if (
			gameDetails?.status === "scheduled" ||
			!gameDetails?.status.toLowerCase().includes("full")
		) {
			if (gameDetails?.date) {
				const updateCountdown = () => {
					setCountdown(getTimeUntilStart(gameDetails.date));
				};
				updateCountdown();
				const interval = setInterval(updateCountdown, 1000);
				return () => clearInterval(interval);
			}
		}
	}, [gameDetails]);

	if (isGameLoading) {
		return <GameDetailsSkeleton />;
	}

	return (
		<div className="flex flex-col gap-4">
			{gameDetails && (
				<DetailsImageCard
					gameTabs={gameTabs}
					activeTab={activeTab}
					setActiveTab={setActiveTab}
					competitionCountry={
						getCountryCode(gameDetails.tournament?.name || "") === "tr"
							? "Turkey"
							: gameDetails.tournament?.name || "International"
					}
					competitionName={gameDetails.tournament?.name || ""}
					hostTeamName={gameDetails.home.name}
					hostTeamLogo={gameDetails.home.imageUrl || "/Profile.png"}
					matchStatus={gameDetails.status}
					clock={gameDetails.clock}
					hostTeamScore={gameDetails.home.points}
					guestTeamScore={gameDetails.away.points}
					guestTeamLogo={gameDetails.away.imageUrl || "/Profile.png"}
					guestTeamName={gameDetails.away.name}
					isUpcoming={gameDetails.status.toLowerCase() === "scheduled"}
					countdownText={countdown}
					scheduledDate={
						gameDetails.date
							? format(safeParseDate(gameDetails.date), "dd/MM/yyyy")
							: undefined
					}
					scheduledTime={
						gameDetails.date
							? format(safeParseDate(gameDetails.date), "HH:mm")
							: undefined
					}
					isHomeFavorite={isHomeFavorite}
					isAwayFavorite={isAwayFavorite}
					onToggleHomeFavorite={() =>
						gameDetails &&
						handleToggleFavorite(
							gameDetails.home.name,
							gameDetails.home.imageUrl,
						)
					}
					onToggleAwayFavorite={() =>
						gameDetails &&
						handleToggleFavorite(
							gameDetails.away.name,
							gameDetails.away.imageUrl,
						)
					}
					isFavorite={isFavoriteLeague(gameDetails.tournament?.name || "")}
					onFavoriteToggle={handleToggleFavoriteLeague}
				/>
			)}
			<div className="mt-4">{renderTabContent()}</div>
		</div>
	);
};

export default BasketBallDetailsPage;
