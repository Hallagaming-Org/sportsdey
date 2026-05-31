import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import BannerCarousel from "@/components/BannerCarousel";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
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
import type { BasketballTournamentScheduleData } from "@/types/api";
import type { League } from "@/types/basketball";

export const Route = createFileRoute("/basketball/tournament/$tournamentId")({
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

function RouteComponent() {
	const { tournamentId } = Route.useParams();
	const banners = Route.useLoaderData() as BannerData[];
	const search = useSearch({ from: "/basketball" }) as {
		league?: string;
		country?: string;
		flag?: string;
	};
	const navigate = useNavigate();
	const activeLeague = search.league;

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
		queryKey: ["basketball", "schedule", year, month, day, tournamentId],
		retry: true,
		refetchInterval: 30 * 1000,
		queryFn: () => {
			const paddedMonth = month.toString().padStart(2, "0");
			const paddedDay = day.toString().padStart(2, "0");
			return apiRequest<BasketballTournamentScheduleData>(
				`basketball/tournament/${tournamentId}?date=${paddedDay}/${paddedMonth}/${year}&language=en`,
			);
		},
	});

	const { isNetworkError } = useApiError({ error, isError, refetch });

	/* eslint-disable @typescript-eslint/no-unused-vars */
	const getCountryCode = (name: string): string => {
		const lowerName = name.toLowerCase();

		// Manual mapping for common basketball leagues/countries
		const mapping: Record<string, string> = {
			usa: "us",
			nba: "us",
			ncaa: "us",
			america: "us",
			australia: "au",
			australian: "au",
			argentina: "ar",
			lnb: "ar",
			italy: "it",
			italian: "it",
			spain: "es",
			spanish: "es",
			acb: "es",
			germany: "de",
			german: "de",
			bbl: "de",
			france: "fr",
			french: "fr",
			"lnb pro a": "fr",
			greece: "gr",
			greek: "gr",
			turkey: "tr",
			turkish: "tr",
			tbsl: "tr",
			lithuania: "lt",
			lithuanian: "lt",
			lkl: "lt",
			china: "cn",
			chinese: "cn",
			cba: "cn",
			poland: "pl",
			polish: "pl",
			"south korea": "kr",
			korea: "kr",
			korean: "kr",
			kbl: "kr",
			brazil: "br",
			brazilian: "br",
			nbb: "br",
			israel: "il",
			israeli: "il",
			slovenia: "si",
			slovenian: "si",
			bulgaria: "bg",
			bulgarian: "bg",
			serbia: "rs",
			serbian: "rs",
			croatia: "hr",
			croatian: "hr",
			russia: "ru",
			russian: "ru",
			vtb: "ru",
			japan: "jp",
			japanese: "jp",
			"b.league": "jp",
			philippines: "ph",
			philippine: "ph",
			pba: "ph",
			mexico: "mx",
			mexican: "mx",
			lnbp: "mx",
			"puerto rico": "pr",
			bsn: "pr",
			venezuela: "ve",
			lpb: "ve",
			uruguay: "uy",
			fubb: "uy",
			canada: "ca",
			canadian: "ca",
			cebl: "ca",
			"great britain": "gb",
			british: "gb",
			"bbl uk": "gb",
			belgium: "be",
			belgian: "be",
			bnxt: "be",
			netherlands: "nl",
			dutch: "nl",
			finland: "fi",
			finnish: "fi",
			korisliiga: "fi",
			sweden: "se",
			swedish: "se",
			basketligan: "se",
			"czech republic": "cz",
			czech: "cz",
			"nbl cz": "cz",
			hungary: "hu",
			hungarian: "hu",
			romania: "ro",
			romanian: "ro",
			latvia: "lv",
			latvian: "lv",
			estonia: "ee",
			estonian: "ee",
			ukraine: "ua",
			ukrainian: "ua",
			georgia: "ge",
			georgian: "ge",
			montenegro: "me",
			montenegrin: "me",
			bosnia: "ba",
			bosnian: "ba",
			macedonia: "mk",
			macedonian: "mk",
			cyprus: "cy",
			cypriot: "cy",
			portugal: "pt",
			portuguese: "pt",
			lebanon: "lb",
			lebanese: "lb",
			qatar: "qa",
			qsl: "qa",
			bahrain: "bh",
			taiwan: "tw",
			"p.league+": "tw",
			"t1 league": "tw",
			algeria: "dz",
			algerian: "dz",
			euroleague: "eu",
			eurocup: "eu",
			iceland: "is",
			icelandic: "is",
			norway: "no",
			norwegian: "no",
			denmark: "dk",
			danish: "dk",
			england: "gb-eng",
			english: "gb-eng",
			ireland: "ie",
			irish: "ie",
			scotland: "gb-sct",
			scottish: "gb-sct",
			wales: "gb-wls",
			welsh: "gb-wls",
			austria: "at",
			austrian: "at",
			switzerland: "ch",
			swiss: "ch",
			luxembourg: "lu",
			slovakia: "sk",
			slovak: "sk",
			belarus: "by",
			belarusian: "by",
			moldova: "md",
			albania: "al",
			albanian: "al",
			kosovo: "xk",
			armenia: "am",
			azerbaijan: "az",
			kazakhstan: "kz",
			kazakh: "kz",
			iran: "ir",
			iraq: "iq",
			jordan: "jo",
			kuwait: "kw",
			uae: "ae",
			"saudi arabia": "sa",
			oman: "om",
			yemen: "ye",
			syria: "sy",
			palestine: "ps",
			indonesia: "id",
			indonesian: "id",
			malaysia: "my",
			thailand: "th",
			thai: "th",
			vietnam: "vn",
			vietnamese: "vn",
			singapore: "sg",
			"hong kong": "hk",
			mongolia: "mn",
			"new zealand": "nz",
			chile: "cl",
			colombia: "co",
			peru: "pe",
			ecuador: "ec",
			paraguay: "py",
			bolivia: "bo",
			panama: "pa",
			"costa rica": "cr",
			"dominican republic": "do",
			dominican: "do",
			cuba: "cu",
			cuban: "cu",
			jamaica: "jm",
			bahamas: "bs",
			morocco: "ma",
			moroccan: "ma",
			tunisia: "tn",
			tunisian: "tn",
			libya: "ly",
			sudan: "sd",
			"south africa": "za",
			nigeria: "ng",
			senegal: "sn",
			mali: "ml",
			"ivory coast": "ci",
			cameroon: "cm",
			rwanda: "rw",
			uganda: "ug",
			kenya: "ke",
		};

		// Try extended fuzzy matching
		for (const key in mapping) {
			if (lowerName.includes(key)) return mapping[key];
		}

		return "";
	};

	const getCompetitionInfo = (
		name: string,
	): { country: string; flag: string } => {
		// If name contains specific country keywords, return that.
		// Otherwise default to the name itself or "International"
		// And try to find a flag code.

		const code = getCountryCode(name);
		// Determine a display Country Name.
		// This is naive; ideally we'd map "Polish Tauron Basket Liga" -> "Poland".
		// For now, we rely on the flag.
		// If code exists, use it.

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
			else if (code === "qa") countryDisplay = "Qatar";
			else if (code === "dz") countryDisplay = "Algeria";
			else if (code === "eu") countryDisplay = "Europe";
			else if (code === "gb") countryDisplay = "United Kingdom";
			else if (code === "pt") countryDisplay = "Portugal";
			else if (code === "cz") countryDisplay = "Czech Republic";
			else if (code === "ro") countryDisplay = "Romania";
			else if (code === "be") countryDisplay = "Belgium";
			else if (code === "nl") countryDisplay = "Netherlands";
			else if (code === "is") countryDisplay = "Iceland";
			else if (code === "lv") countryDisplay = "Latvia";
			else if (code === "ee") countryDisplay = "Estonia";
			else if (code === "no") countryDisplay = "Norway";
			else if (code === "dk") countryDisplay = "Denmark";
			else if (code === "fi") countryDisplay = "Finland";
			else if (code === "se") countryDisplay = "Sweden";
			else if (code === "tw") countryDisplay = "Taiwan";
			else countryDisplay = name.split(" ")[0] || name;
		} else {
			countryDisplay = name.includes("League") ? "International" : name;
		}

		const flagUrl =
			code && code !== "eu"
				? `https://flagcdn.com/w40/${code}.png`
				: code === "eu"
					? "/International.png"
					: "/International.png";
		// console.log("flagUrl", flagUrl, "countryDisplay", countryDisplay);

		return { country: countryDisplay, flag: flagUrl };
	};

	const { currentFilter: activeFilter } = useCurrentFilter();

	const leagues: League[] = useMemo(() => {
		if (!scheduleData?.games || !scheduleData.competition) return [];

		const comp = scheduleData.competition;
		// Prefer search params for display, fallback to API data + heuristics
		const leagueName = search.league || comp.name;

		// Get heuristic info based on the best available name
		const { country: derivedCountry, flag: derivedFlag } =
			getCompetitionInfo(leagueName);

		// Use search params if available, otherwise derived info
		const country = search.country || derivedCountry;
		const flag = search.flag || derivedFlag;

		const mappedMatches = scheduleData.games.map((game) => {
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

		if (filteredMatches.length === 0) return [];

		return [
			{
				id: comp.id.toString(),
				country,
				leagueName: leagueName,
				flag: flag,
				matches: filteredMatches,
			},
		];
	}, [scheduleData, activeFilter]);

	const counts = useMemo(() => {
		if (!scheduleData?.games)
			return { all: 0, live: 0, finished: 0, upcoming: 0 };

		const allGames = scheduleData.games;

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
					<div className="sticky top-0 z-10 hidden w-full bg-background/95 px-1 py-4 backdrop-blur-sm lg:block">
						<FixtureFilterHeaders counts={counts} />
					</div>
					{banners.length > 0 && <BannerCarousel banners={banners} />}
					{!isLoading && leagues.length === 0 && (
						<EmptyState
							title={`No ${activeFilter === "all" ? "" : activeFilter} basketball matches`}
							description={`We couldn't find any matches matching your criteria for this date.`}
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
