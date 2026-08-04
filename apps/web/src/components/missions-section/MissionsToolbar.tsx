import { Search } from "lucide-react";
import type { MissionPeriod } from "@/lib/missions";
import { cn } from "@/lib/utils";
import { formatShortDate } from "./mission-format";
import { PERIOD_FILTERS } from "./period-filters.constant";

type MissionsToolbarProps = {
	activePeriod: MissionPeriod;
	periodCounts: Record<MissionPeriod, number>;
	timerQuery: string;
	nearestEndAt: string | undefined;
	onPeriodChange: (period: MissionPeriod) => void;
	onTimerQueryChange: (value: string) => void;
};

/**
 * Period filter tabs and mission search field for the Missions page.
 */
export function MissionsToolbar({
	activePeriod,
	periodCounts,
	timerQuery,
	nearestEndAt,
	onPeriodChange,
	onTimerQueryChange,
}: MissionsToolbarProps) {
	return (
		<div className="mb-6 flex items-center pb-1 sm:justify-between">
			<div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
				{PERIOD_FILTERS.map((filter) => {
					const isActive = activePeriod === filter.id;
					return (
						<button
							key={filter.id}
							type="button"
							onClick={() => onPeriodChange(filter.id)}
							className={cn(
								"flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border px-4 py-1.5 font-semibold text-xs transition-colors",
								isActive
									? "border-accent bg-accent text-[#040C01]"
									: "border-[#1B2722] bg-[#151616] text-gray-500 hover:text-gray-900 dark:text-[#8C8F8F] dark:hover:text-white",
							)}
						>
							<span>{filter.label}</span>
							<span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#040C01] px-1.5 text-[10px] text-white">
								{periodCounts[filter.id]}
							</span>
						</button>
					);
				})}
			</div>
			<label className="relative hidden min-w-[220px] sm:block">
				<span className="sr-only">Daily mission timer</span>
				<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8C8F8F]" />
				<input
					value={timerQuery}
					onChange={(event) => onTimerQueryChange(event.target.value)}
					placeholder={
						nearestEndAt
							? `Ends ${formatShortDate(nearestEndAt)}`
							: "Daily mission timer"
					}
					className="h-10 w-full rounded-md border border-[#1B2722] bg-[#151616] pr-4 pl-10 text-sm text-white outline-none placeholder:text-[#8C8F8F] focus:border-accent"
				/>
			</label>
		</div>
	);
}
