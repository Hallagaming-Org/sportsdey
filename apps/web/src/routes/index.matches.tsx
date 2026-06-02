import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import BannerCarousel from "@/components/BannerCarousel";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { MobileSportsFilter } from "@/components/MobileSportsFilter";
import RightSidebar from "@/components/RightSidebar";
import { useCurrentFilter } from "@/hooks/use-current-filter";
import { useFootballSchedule } from "@/hooks/use-fooball-schedule";
import { useApiError } from "@/hooks/useApiError";
import type { BannerData } from "@/lib/banners-server";
import { getBanners } from "@/lib/banners-server";
import FixtureFilterHeaders from "@/shared/FixtureFilterHeaders";
import SportAccordionCard from "@/shared/SportAccordionCard";
import type { RootState } from "@/store";
import { useAppSelector } from "@/store/hook";

export const Route = createFileRoute("/index/matches")({
	loader: () => getBanners(),
	component: RouteComponent,
});

const getCountryInfo = (name: string): { country: string; flag?: string } => {
	const lower = name.toLowerCase();
	const mapping: Record<string, string> = {
		"premier league": "gb-eng",
		england: "gb-eng",
		english: "gb-eng",
		"la liga": "es",
		spain: "es",
		spanish: "es",
		"serie a": "it",
		italy: "it",
		italian: "it",
		bundesliga: "de",
		germany: "de",
		german: "de",
		"ligue 1": "fr",
		france: "fr",
		french: "fr",
		eredivisie: "nl",
		netherlands: "nl",
		dutch: "nl",
		portugal: "pt",
		portuguese: "pt",
		brazil: "br",
		brazilian: "br",
		argentina: "ar",
		argentinian: "ar",
		"primeira liga": "pt",
		belgium: "be",
		belgian: "be",
		turkey: "tr",
		turkish: "tr",
		greece: "gr",
		greek: "gr",
		scotland: "gb-sct",
		scottish: "gb-sct",
		switzerland: "ch",
		swiss: "ch",
		austria: "at",
		austrian: "at",
		usa: "us",
		"major league soccer": "us",
		mls: "us",
		mexico: "mx",
		mexican: "mx",
		japan: "jp",
		japanese: "jp",
		"j1 league": "jp",
		china: "cn",
		chinese: "cn",
		"south korea": "kr",
		korea: "kr",
		"k league": "kr",
		australia: "au",
		australian: "au",
		"a-league": "au",
		saudi: "sa",
		"saudi arabia": "sa",
		qatar: "qa",
		uae: "ae",
		russia: "ru",
		russian: "ru",
		ukraine: "ua",
		croatia: "hr",
		croatian: "hr",
		serbia: "rs",
		serbian: "rs",
		poland: "pl",
		polish: "pl",
		czech: "cz",
		"czech republic": "cz",
		romania: "ro",
		romanian: "ro",
		denmark: "dk",
		danish: "dk",
		sweden: "se",
		swedish: "se",
		norway: "no",
		norwegian: "no",
		finland: "fi",
		finnish: "fi",
		hungary: "hu",
		hungarian: "hu",
		bulgaria: "bg",
		bulgarian: "bg",
		slovenia: "si",
		slovenian: "si",
		slovakia: "sk",
		slovak: "sk",
		israel: "il",
		israeli: "il",
		india: "in",
		indian: "in",
		"super league": "gr",
		ligue: "fr",
	}

	for (const key in mapping) {
		if (lower.includes(key)) {
			const code = mapping[key];
			const names: Record<string, string> = {
				"gb-eng": "England",
				es: "Spain",
				it: "Italy",
				de: "Germany",
				fr: "France",
				nl: "Netherlands",
				pt: "Portugal",
				br: "Brazil",
				ar: "Argentina",
				be: "Belgium",
				tr: "Turkey",
				gr: "Greece",
				"gb-sct": "Scotland",
				ch: "Switzerland",
				at: "Austria",
				us: "USA",
				mx: "Mexico",
				jp: "Japan",
				cn: "China",
				kr: "South Korea",
				au: "Australia",
				sa: "Saudi Arabia",
				qa: "Qatar",
				ae: "UAE",
				ru: "Russia",
				ua: "Ukraine",
				hr: "Croatia",
				rs: "Serbia",
				pl: "Poland",
				cz: "Czech Republic",
				ro: "Romania",
				dk: "Denmark",
				se: "Sweden",
				no: "Norway",
				fi: "Finland",
				hu: "Hungary",
				bg: "Bulgaria",
				si: "Slovenia",
				sk: "Slovakia",
				il: "Israel",
				in: "India",
			}
			return {
				country: names[code] || name,
				flag: `https://flagcdn.com/w40/${code}.png`,
			}
		}
	}

	return { country: name, flag: undefined };
};

function RouteComponent() {
	const banners = Route.useLoaderData() as BannerData[];

	const selectedDateString = useAppSelector(
		(state: RootState) => state.date.selectedDate,
	)
	const selectedDate = new Date(selectedDateString);
	const { currentFilter } = useCurrentFilter();

	const formattedDate = `${selectedDate.getDate().toString().padStart(2, `0`)}/${(selectedDate.getMonth() + 1).toString().padStart(2, `0`)}/${selectedDate.getFullYear()}`;

	const {
		data: scheduleData,
		isLoading,
		error,
		isError,
		refetch,
	} = useFootballSchedule(formattedDate, "en");

	const { isNetworkError } = useApiError({ error, isError, refetch });

	const counts = useMemo(() => {
		if (!scheduleData) {
			return { all: 0, live: 0, finished: 0, upcoming: 0 };
		}

		let live = 0;
		let finished = 0;
		let upcoming = 0;

		for (const comp of scheduleData.competitions) {
			for (const match of comp.matches) {
				if (match.match_status === "closed") {
					finished++
				} else if (match.match_status === "SCH") {
					upcoming++
				} else {
					live++
				}
			}
		}

		return { all: scheduleData.total_matches, live, finished, upcoming };
	}, [scheduleData]);

	const filteredCompetitions = useMemo(() => {
		if (!scheduleData?.competitions) return [];

		return scheduleData.competitions
			.map((comp) => {
				const { country, flag } = getCountryInfo(
					comp.category?.name || comp.competition.name,
				)

				const filteredMatches = comp.matches
					.filter((match) => {
						if (currentFilter === "all") return true;
						if (currentFilter === "finished")
							return match.match_status === "closed";
						if (currentFilter === "upcoming")
							return match.match_status === "SCH";
						if (currentFilter === "live")
							return (
								match.match_status !== "closed" && match.match_status !== "SCH"
							)
						return false
					})
					.map((match) => {
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

						return {
							id: match.id,
							team1: match.competitors.home.name,
							team2: match.competitors.away.name,
							score1: match.competitors.home.score,
							score2: match.competitors.away.score,
							status: match.match_status,
							time: formatTime(match.start_time) || match.start_time,
							clock: match.clock?.toString(),
						};
					})

				if (filteredMatches.length === 0) return null;

				return {
					id: comp.competition.id,
					country,
					leagueName: comp.competition.name,
					flag,
					imageUrl: comp.competition.imageUrl || undefined,
					matches: filteredMatches,
				}
			})
			.filter(Boolean) as {
			id: string;
			country: string;
			leagueName: string;
			flag?: string;
			imageUrl?: string;
			matches: any[];
		}[]
	}, [scheduleData, currentFilter]);

	if (isError) {
		return (
			<div className="mb-32 space-y-4 lg:mb-0">
				<ErrorState
					message={isNetworkError ? "Network Error" : "Failed to load schedule"}
					description={
						isNetworkError
							? "Please check your internet connection"
							: "Unable to load football matches"
					}
					onRetry={refetch}
					isNetworkError={isNetworkError}
				/>
			</div>
		)
	}

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center space-y-2">
				<Loader2 className="animate-spin" width={24} height={24} />
				<p className="text-gray-500 text-sm">Loading matches...</p>
			</div>
		)
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
					{filteredCompetitions.length === 0 ? (
						<EmptyState
							title={`No ${currentFilter === `all` ? `` : currentFilter} football matches`}
							description="We couldn't find any matches matching your criteria for this date."
						/>
					) : (
						filteredCompetitions.map((league) => (
							<SportAccordionCard
								key={league.id}
								sport="football"
								country={league.country}
								league={league.leagueName}
								flag={league.flag}
								matches={league.matches}
								imageUrl={league.imageUrl}
								detailRoute="/index/$gameId"
								showTournamentLink
								tournamentId={league.id}
								tournamentRoute="/index/tournament/$tournamentId"
							/>
						))
					)}
				</div>
				<div className="no-scrollbar hidden h-full overflow-y-auto pb-20 lg:block lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
					<RightSidebar />
				</div>
			</div>
		</div>
	)
}
