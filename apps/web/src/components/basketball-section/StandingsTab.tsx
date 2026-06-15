"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { FilterType, TeamStanding } from "@/types/basketball";
import { StandingsSkeleton } from "./StandingsSkeleton";

interface StandingsTableProps {
	teams: TeamStanding[];
	className?: string;
	onSeeAllClick?: () => void;
	isLoading?: boolean;
}

function FilterTabs({
	activeFilter,
	onFilterChange,
}: {
	activeFilter: FilterType;
	onFilterChange: (filter: FilterType) => void;
}) {
	const filters: { id: FilterType; label: string }[] = [
		{ id: "all", label: "All" },
	];

	return (
		<div className="mb-4 flex gap-x-3">
			{filters.map((filter) => (
				<button
					key={filter.id}
					onClick={() => onFilterChange(filter.id)}
					className={cn(
						"h-10 w-[73px] cursor-pointer rounded-full font-medium text-sm transition-colors md:w-[146px]",
						activeFilter === filter.id
							? "bg-[#1BAA04] text-white"
							: "bg-white text-primary",
					)}
				>
					{filter.label}
				</button>
			))}
		</div>
	);
}

function StandingsView({
	teams,
	onSeeAllClick,
}: {
	teams: TeamStanding[];
	onSeeAllClick?: () => void;
}) {
	const hasData = (key: keyof TeamStanding) => {
		return teams.some((team) => {
			const val = team[key];
			return val !== undefined && val !== null && val !== "";
		});
	};

	const showP = hasData("played");
	const showW = hasData("wins");
	const showL = hasData("losses");
	const showStr = hasData("streak");
	const showGB = hasData("gamesBehind");
	const showDiff = hasData("diff");
	const showPct = hasData("pct");

	return (
		<div className="max-w-screen rounded-xl border-0 bg-white py-4 shadow-xs dark:bg-card">
			<div className="no-scrollbar max-w-[calc(100vw-2rem)] overflow-x-auto md:max-w-none">
				<table className="w-full text-sm">
					<thead>
						<tr className="text-[10px] text-primary">
							<th className="sticky left-0 z-20 w-[50px] bg-white py-2 text-center dark:bg-card" />
							<th className="sticky left-[50px] z-20 bg-white py-2 pr-4 text-left font-medium text-xs shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:bg-card dark:text-white">
								Standings
							</th>
							{showP && (
								<th className="px-2 py-2 text-center font-medium">P</th>
							)}
							{showW && (
								<th className="px-2 py-2 text-center font-medium">W</th>
							)}
							{showL && (
								<th className="px-2 py-2 text-center font-medium">L</th>
							)}
							{showStr && (
								<th className="px-2 py-2 text-center font-medium">Str</th>
							)}
							{showGB && (
								<th className="px-2 py-2 text-center font-medium">GB</th>
							)}
							{showDiff && (
								<th className="px-2 py-2 text-center font-medium">DIFF</th>
							)}
							{showPct && (
								<th className="px-2 py-2 text-center font-medium">PCT</th>
							)}
						</tr>
					</thead>
					<tbody>
						{teams.map((team, index) => (
							<tr
								key={index}
								className={cn(
									"border-[#C8C8C8] border-t",
									team.isHighlighted ? "bg-[#EDF6EB]" : "bg-white dark:bg-card",
								)}
							>
								<td
									className={cn(
										"sticky left-0 z-10 w-[50px] py-2.5 text-center text-[11.92px]",
										team.isHighlighted
											? "bg-[#EDF6EB] text-[#1BAA04]"
											: "bg-white text-primary dark:bg-card dark:text-white",
										[1, 2, 3].includes(index + 1)
											? "border-[#1BBD2A] border-l-4"
											: [4, 5].includes(index + 1)
												? "border-[#E5A400] border-l-4"
												: "",
									)}
								>
									{index + 1}
								</td>
								<td
									className={cn(
										"sticky left-[50px] z-10 whitespace-nowrap py-2.5 pr-4 font-medium text-[11.92px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]",
										team.isHighlighted
											? "bg-[#EDF6EB] text-[#1BAA04]"
											: "bg-white text-primary dark:bg-card dark:text-white",
									)}
								>
									{team.name}
								</td>
								{showP && (
									<td
										className={cn(
											"px-2 py-2.5 text-center text-[10.21px]",
											team.isHighlighted
												? "text-[#1BAA04]"
												: "text-primary dark:text-white",
										)}
									>
										{team.played}
									</td>
								)}
								{showW && (
									<td
										className={cn(
											"px-2 py-2.5 text-center text-[10.21px]",
											team.isHighlighted
												? "text-[#1BAA04]"
												: "text-primary dark:text-white",
										)}
									>
										{team.wins}
									</td>
								)}
								{showL && (
									<td
										className={cn(
											"px-2 py-2.5 text-center text-[10.21px]",
											team.isHighlighted
												? "text-[#1BAA04]"
												: "text-primary dark:text-white",
										)}
									>
										{team.losses}
									</td>
								)}
								{showStr && (
									<td
										className={cn(
											"px-2 py-2.5 text-center text-[10.21px]",
											team.isHighlighted
												? "text-[#1BAA04]"
												: "text-primary dark:text-white",
										)}
									>
										{team.streak}
									</td>
								)}
								{showGB && (
									<td
										className={cn(
											"px-2 py-2.5 text-center text-[10.21px]",
											team.isHighlighted
												? "text-[#1BAA04]"
												: "text-primary dark:text-white",
										)}
									>
										{team.gamesBehind}
									</td>
								)}
								{showDiff && (
									<td
										className={cn(
											"px-2 py-2.5 text-center text-[10.21px]",
											team.isHighlighted
												? "text-[#1BAA04]"
												: "text-primary dark:text-white",
										)}
									>
										{team.diff}
									</td>
								)}
								{showPct && (
									<td
										className={cn(
											"px-2 py-2.5 text-center text-[10.21px]",
											team.isHighlighted
												? "text-[#1BAA04]"
												: "text-primary dark:text-white",
										)}
									>
										{team.pct}
									</td>
								)}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{onSeeAllClick && (
				<button
					onClick={onSeeAllClick}
					className="mt-2 w-full cursor-pointer py-3 text-center text-[10px] text-primary underline hover:text-primary dark:hover:text-white"
				>
					See all Standings
				</button>
			)}
		</div>
	);
}

function StandingsTab({
	teams,
	className,
	onSeeAllClick,
	conference,
	onConferenceChange,
	homeTeam,
	awayTeam,
	hideConference,
	isLoading,
}: StandingsTableProps & {
	conference: "western" | "eastern";
	onConferenceChange: (conference: "western" | "eastern") => void;
	homeTeam?: string;
	awayTeam?: string;
	hideConference?: boolean;
}) {
	const [activeFilter, setActiveFilter] = useState<FilterType>("all");

	const isTeamHighlighted = (teamName: string) => {
		if (!homeTeam && !awayTeam) return false;
		return teamName === homeTeam || teamName === awayTeam;
	};

	const enhancedTeams = teams.map((team) => ({
		...team,
		isHighlighted: isTeamHighlighted(team.name),
	}));

	if (isLoading) {
		return (
			<div className={cn("rounded-lg", className)}>
				<StandingsSkeleton />
			</div>
		);
	}

	return (
		<div className={cn("rounded-lg", className)}>
			{/* {!hideConference && (
        <div className="flex gap-x-3 mb-4">
          <button
            onClick={() => onConferenceChange('western')}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-medium transition-colors border",
              conference === 'western'
                ? "bg-[#1BAA04] text-white border-[#1BAA04]"
                : "bg-white text-primary border-gray-200 hover:bg-gray-50"
            )}
          >
            Western Conference
          </button>
          <button
            onClick={() => onConferenceChange('eastern')}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-medium transition-colors border",
              conference === 'eastern'
                ? "bg-[#1BAA04] text-white border-[#1BAA04]"
                : "bg-white text-primary border-gray-200 hover:bg-gray-50"
            )}
          >
            Eastern Conference
          </button>
        </div>
      )} */}

			<FilterTabs
				activeFilter={activeFilter}
				onFilterChange={setActiveFilter}
			/>

			<StandingsView teams={enhancedTeams} onSeeAllClick={onSeeAllClick} />
		</div>
	);
}

export default StandingsTab;
