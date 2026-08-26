import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useFavorites } from "@/hooks/useFavorites";
import SportMatchCard from "@/shared/SportMatchCard";
import type { SportAccordionProps, SportType } from "@/types/sport";

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

interface AccordionHeaderProps {
	flag?: string;
	country: string;
	league: string;
	isExpanded: boolean;
	onToggle: () => void;
	imageUrl?: string;
	isFavorite: boolean;
	onFavoriteToggle: (e: React.MouseEvent) => void;
	showTournamentLink?: boolean;
	tournamentId?: string;
	tournamentRoute?: string;
	sport: SportType;
}

const AccordionHeader: React.FC<AccordionHeaderProps> = ({
	flag,
	country,
	league,
	isExpanded,
	onToggle,
	imageUrl,
	isFavorite,
	onFavoriteToggle,
	showTournamentLink,
	tournamentId,
	tournamentRoute,
	sport,
}) => {
	const headerContent = (
		<div
			className="flex w-full cursor-pointer items-center justify-between border-b px-5 py-4 transition-colors"
			onClick={(e) => {
				if (tournamentRoute && tournamentId) return;
				onToggle();
			}}
		>
			<div className="flex items-center gap-x-3">
				{flag ? (
					<img
						src={flag}
						alt={`${country} flag`}
						className="h-6 w-6 rounded-full"
					/>
				) : imageUrl ? (
					<img
						src={imageUrl}
						alt={`${country} flag`}
						className="h-6 w-6 rounded-full"
					/>
				) : (
					<img
						src={`/${country}.png`}
						alt={`${country} flag`}
						className="h-6 w-6 rounded-full"
					/>
				)}
				<div className="inline-flex items-center gap-x-1 text-sm">
					<p className="font-bold text-primary dark:text-white">
						{country === "South Korea" ? "S/Korea" : country}
					</p>
					-
					<p className="font-bold text-primary text-xs dark:text-white">
						{league}
					</p>
					<button
						onClick={(e) => {
							e.stopPropagation();
							e.preventDefault();
							onFavoriteToggle(e);
						}}
						className={`ml-1 cursor-pointer border-none bg-transparent text-sm transition-colors ${
							isFavorite
								? "text-yellow-400"
								: "text-[#C8C8C8] hover:text-yellow-400"
						}`}
					>
						★
					</button>
				</div>
			</div>
			{tournamentRoute && tournamentId ? (
				<span className="text-muted-foreground text-xs">
					<ChevronRight />
				</span>
			) : (
				<span className={"text-primary text-xs dark:text-white"}>
					{isExpanded ? <ChevronRight /> : <ChevronDown />}
				</span>
			)}
		</div>
	);

	if (showTournamentLink && tournamentId && tournamentRoute) {
		const routeParts = tournamentRoute.split("$");
		const paramName = routeParts[1] || "tournamentId";

		return (
			<Link
				to={tournamentRoute}
				params={{ [paramName]: tournamentId }}
				search={{ league, country, flag } as any}
			>
				{headerContent}
			</Link>
		);
	}

	return headerContent;
};

const SportAccordionCard: React.FC<SportAccordionProps> = ({
	sport,
	country,
	league,
	tournamentId,
	flag,
	matches,
	defaultExpanded = true,
	imageUrl,
	detailRoute,
	tournamentRoute,
	showTournamentLink = false,
}) => {
	const [isExpanded, setIsExpanded] = useState(defaultExpanded);

	const {
		isFavoriteLeague,
		toggleFavoriteLeague,
		isFavoriteMatch,
		toggleFavoriteMatch,
	} = useFavorites();

	const handleLeagueFavoriteToggle = (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		toggleFavoriteLeague({
			id: league,
			name: league,
			country,
			flag,
			sport,
		});
	};

	const handleMatchFavoriteToggle = (match: any) => {
		if (!match.id) return;
		toggleFavoriteMatch({
			id: match.id,
			team1: match.team1 || "",
			team2: match.team2 || "",
			date: match.date || match.start_time,
			time: match.time,
			sport: sport,
			tournament: league,
			country: getCountryName(country || league || ""),
			flag:
				flag ||
				(getCountryCode(country || league || "")
					? `https://flagcdn.com/w40/${getCountryCode(country || league || "")}.png`
					: undefined),
		});
	};

	return (
		<div className="w-full overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-card">
			<AccordionHeader
				flag={flag}
				country={country}
				league={league}
				isExpanded={isExpanded}
				onToggle={() => setIsExpanded(!isExpanded)}
				imageUrl={imageUrl}
				isFavorite={isFavoriteLeague(league)}
				onFavoriteToggle={handleLeagueFavoriteToggle}
				showTournamentLink={showTournamentLink}
				tournamentId={tournamentId}
				tournamentRoute={tournamentRoute}
				sport={sport}
			/>

			{isExpanded && matches && matches.length > 0 && (
				<div className="flex flex-col">
					{matches.map((match, index) => (
						<SportMatchCard
							key={match.id || index}
							sport={sport}
							id={match.id}
							team1={match.team1}
							team2={match.team2}
							time={match.time}
							clock={match.clock}
							player1Sets={match.player1Sets}
							player2Sets={match.player2Sets}
							score1={match.score1}
							score2={match.score2}
							status={match.status ? match.status : match.time}
							isFavorite={match.id ? isFavoriteMatch(match.id) : false}
							onFavoriteToggle={() => handleMatchFavoriteToggle(match)}
							country={country}
							detailRoute={detailRoute}
						/>
					))}
				</div>
			)}
		</div>
	);
};

export default SportAccordionCard;
