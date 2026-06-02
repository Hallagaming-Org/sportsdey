import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
} from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import BannerCarousel from "@/components/BannerCarousel";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { MobileSportsFilter } from "@/components/MobileSportsFilter";
import RightSidebar from "@/components/RightSidebar";
import { useCurrentFilter } from "@/hooks/use-current-filter";
import { useApiError } from "@/hooks/useApiError";
import { apiRequest } from "@/lib/api";
import type { BannerData } from "@/lib/banners-server";
import { getBanners } from "@/lib/banners-server";
import BasketballAccordionComponentCard from "@/shared/BasketballAccordionComponentCard";
import FixtureFilterHeaders from "@/shared/FixtureFilterHeaders";
import ImportantUpdate from "@/shared/ImportantUpdate";
import type { RootState } from "@/store";
import { useAppSelector } from "@/store/hook";
import type { BasketballScheduleData } from "@/types/api";
import type { League } from "@/types/basketball";

export const Route = createFileRoute("/basketball/matches")({
	loader: () => getBanners(),
	component: RouteComponent,
});

const formatDate = (date: Date) => {
	return {
		year: date.getFullYear(),
		month: date.getMonth() + 1,
		day: date.getDate(),
	};
};

const getCountryCode = (name: string): string => {
	const lowerName = name.toLowerCase();

	const mapping: Record<string, string> = {
		usa: "us", nba: "us", ncaa: "us", america: "us",
		australia: "au", australian: "au",
		argentina: "ar", lnb: "ar",
		italy: "it", italian: "it",
		spain: "es", spanish: "es", acb: "es",
		germany: "de", german: "de", bbl: "de",
		france: "fr", french: "fr",
		greece: "gr", greek: "gr",
		turkey: "tr", turkish: "tr", tbsl: "tr",
		lithuania: "lt", lithuanian: "lt", lkl: "lt",
		china: "cn", chinese: "cn", cba: "cn",
		poland: "pl", polish: "pl",
		"south korea": "kr", korea: "kr", korean: "kr", kbl: "kr",
		brazil: "br", brazilian: "br", nbb: "br",
		israel: "il", israeli: "il",
		slovenia: "si", slovenian: "si",
		bulgaria: "bg", bulgarian: "bg",
		serbia: "rs", serbian: "rs",
		croatia: "hr", croatian: "hr",
		russia: "ru", russian: "ru", vtb: "ru",
		japan: "jp", japanese: "jp", "b.league": "jp",
		philippines: "ph", philippine: "ph", pba: "ph",
		mexico: "mx", mexican: "mx", lnbp: "mx",
		"puerto rico": "pr", bsn: "pr",
		venezuela: "ve", lpb: "ve",
		canada: "ca", canadian: "ca", cebl: "ca",
		"great britain": "gb", british: "gb",
		belgium: "be", belgian: "be", bnxt: "be",
		netherlands: "nl", dutch: "nl",
		finland: "fi", finnish: "fi", korisliiga: "fi",
		sweden: "se", swedish: "se", basketligan: "se",
		"czech republic": "cz", czech: "cz",
		hungary: "hu", hungarian: "hu",
		romania: "ro", romanian: "ro",
		portugal: "pt", portuguese: "pt",
		euroleague: "eu", eurocup: "eu",
		england: "gb-eng", english: "gb-eng",
	};

	for (const key in mapping) {
		if (lowerName.includes(key)) return mapping[key];
	}

	return "";
};

const getCompetitionInfo = (name: string): { country: string; flag: string } => {
	const code = getCountryCode(name);

	let countryDisplay = "International";
	if (code) {
		if (code === "us") countryDisplay = "USA";
		else if (code === "au") countryDisplay = "Australia";
		else if (code === "es") countryDisplay = "Spain";
		else if (code === "fr") countryDisplay = "France";
		else if (code === "de") countryDisplay = "Germany";
		else if (code === "it") countryDisplay = "Italy";
		else if (code === "tr") countryDisplay = "Turkey";
		else if (code === "gr") countryDisplay = "Greece";
		else if (code === "lt") countryDisplay = "Lithuania";
		else if (code === "cn") countryDisplay = "China";
		else if (code === "ar") countryDisplay = "Argentina";
		else if (code === "br") countryDisplay = "Brazil";
		else if (code === "il") countryDisplay = "Israel";
		else if (code === "si") countryDisplay = "Slovenia";
		else if (code === "bg") countryDisplay = "Bulgaria";
		else if (code === "rs") countryDisplay = "Serbia";
		else if (code === "hr") countryDisplay = "Croatia";
		else if (code === "ru") countryDisplay = "Russia";
		else if (code === "jp") countryDisplay = "Japan";
		else if (code === "ph") countryDisplay = "Philippines";
		else if (code === "pl") countryDisplay = "Poland";
		else if (code === "kr") countryDisplay = "South Korea";
		else if (code === "eu") countryDisplay = "Europe";
		else if (code === "gb") countryDisplay = "United Kingdom";
		else if (code === "pt") countryDisplay = "Portugal";
		else if (code === "cz") countryDisplay = "Czech Republic";
		else if (code === "ro") countryDisplay = "Romania";
		else if (code === "be") countryDisplay = "Belgium";
		else if (code === "nl") countryDisplay = "Netherlands";
		else if (code === "fi") countryDisplay = "Finland";
		else if (code === "se") countryDisplay = "Sweden";
		else countryDisplay = name.split(" ")[0] || name;
	} else {
		countryDisplay = name.includes("League") ? "International" : name;
	}

	const flagUrl =
		code && code !== "eu"
			? `https://flagcdn.com/w40/${code}.png`
			: "/International.png";

	return { country: countryDisplay, flag: flagUrl };
};

function RouteComponent() {
	const banners = Route.useLoaderData() as BannerData[];

	const selectedDateString = useAppSelector(
		(state: RootState) => state.date.selectedDate,
	);
	const selectedDate = new Date(selectedDateString);
	const { year, month, day } = formatDate(selectedDate);

	const {
		data: scheduleData,
		isLoading,
		error,
		isError,
		refetch,
	} = useQuery({
		queryKey: ["basketball", "schedule", year, month, day],
		retry: true,
		refetchInterval: 30 * 1000,
		queryFn: () => {
			const paddedMonth = month.toString().padStart(2, "0");
			const paddedDay = day.toString().padStart(2, "0");
			return apiRequest<BasketballScheduleData>(
				`basketball/schedule?date=${paddedDay}/${paddedMonth}/${year}&language=en`,
			);
		},
	});

	const { isNetworkError } = useApiError({ error, isError, refetch });
	const { currentFilter: activeFilter } = useCurrentFilter();

	const leagues: League[] = useMemo(() => {
		if (!scheduleData?.competitions) return [];

		const filteredCompetitions = scheduleData.competitions.map((comp) => {
			const { country: derivedCountry, flag: derivedFlag } =
				getCompetitionInfo(comp.name);

			const mappedMatches = comp.games.map((game) => {
				const formatTime = (dateStr?: string) => {
					if (!dateStr) return undefined;
					try {
						return new Date(dateStr).toLocaleTimeString("en-US", {
							hour: "2-digit",
							minute: "2-digit",
							hour12: false,
						});
					} catch {
						return undefined;
					}
				};

				const isLive =
					!!game.clock ||
					!["closed", "cancelled", "scheduled", "ns"].includes(
						game.status.toLowerCase(),
					);
				const isFinished = ["closed", "ft", "aot"].includes(
					game.status.toLowerCase(),
				);
				const isUpcoming = !isLive && !isFinished;

				return {
					id: game.id,
					team1: game.home.name,
					team2: game.away.name,
					score1: game.home.points ?? undefined,
					score2: game.away.points ?? undefined,
					status:
						game.status === "closed" ? "FT" : game.clock ? "Live" : game.status,
					time:
						game.clock || formatTime(game.scheduledTime || game.time) || "00:00",
					clock: game.clock,
					isLive,
					isFinished,
					isUpcoming,
				};
			});

			const filteredMatches = mappedMatches.filter((match) => {
				if (activeFilter === "all") return true;
				if (activeFilter === "live") return match.isLive;
				if (activeFilter === "finished") return match.isFinished;
				if (activeFilter === "upcoming") return match.isUpcoming;
				return true;
			});

			if (filteredMatches.length === 0) return null;

			return {
				id: comp.id,
				country: derivedCountry,
				leagueName: comp.name,
				flag: derivedFlag,
				imageUrl: comp.imageUrl,
				matches: filteredMatches,
			};
		});

		return filteredCompetitions.filter(Boolean) as League[];
	}, [scheduleData, activeFilter]);

	const counts = useMemo(() => {
		if (!scheduleData?.competitions)
			return { all: 0, live: 0, finished: 0, upcoming: 0 };

		const allGames = scheduleData.competitions.flatMap((comp) => comp.games);

		return {
			all: allGames.length,
			live: allGames.filter(
				(g) =>
					!!g.clock ||
					!["closed", "cancelled", "scheduled", "ns"].includes(
						g.status.toLowerCase(),
					),
			).length,
			finished: allGames.filter((g) =>
				["closed", "ft", "aot"].includes(g.status.toLowerCase()),
			).length,
			upcoming: allGames.filter(
				(g) => !g.clock && ["scheduled", "ns"].includes(g.status.toLowerCase()),
			).length,
		};
	}, [scheduleData]);

	if (isError) {
		return (
			<div className="mb-32 space-y-4 lg:mb-0">
				<ErrorState
					message={isNetworkError ? "Network Error" : "Failed to load schedule"}
					description={
						isNetworkError
							? "Please check your internet connection"
							: "Unable to load basketball games"
					}
					onRetry={refetch}
					isNetworkError={isNetworkError}
				/>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center space-y-2">
				<Loader2 className="animate-spin" width={24} height={24} />
				<p className="text-gray-500 text-sm">Loading matches...</p>
			</div>
		);
	}

	return (
		<div className="h-full">
			<div className="h-full items-start gap-6 lg:grid lg:grid-cols-[3fr_1fr]">
				<div className="no-scrollbar h-full space-y-6 overflow-y-auto pb-20">
					<MobileSportsFilter />
					<div className="sticky top-0 z-10 hidden w-full bg-background/95 px-1 py-4 backdrop-blur-sm lg:block">
						<FixtureFilterHeaders counts={counts} />
					</div>
					{banners.length > 0 && <BannerCarousel banners={banners} />}
					{!isLoading && leagues.length === 0 && (
						<EmptyState
							title={`No ${activeFilter === "all" ? "" : activeFilter} basketball matches`}
							description="We couldn't find any matches matching your criteria for this date."
						/>
					)}
					{!isLoading &&
						leagues.map((league) => (
							<BasketballAccordionComponentCard
								key={league.id}
								country={league.country}
								league={league.leagueName}
								flag={league.flag}
								matches={league.matches}
								imageUrl={league.imageUrl}
								tournamentId={league.id}
							/>
						))}
					<ImportantUpdate />
				</div>
				<div className="no-scrollbar hidden h-full overflow-y-auto pb-20 lg:block lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
					<RightSidebar />
				</div>
			</div>
		</div>
	);
}
