import { Search, SlidersHorizontal } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
	TOURNAMENT_SPORT_FILTERS,
	TOURNAMENT_STATUS_TABS,
	type TournamentStatus,
} from "./tournaments.constant";

type TournamentToolbarProps = {
	activeStatus: TournamentStatus;
	statusCounts: Record<TournamentStatus, number>;
	searchQuery: string;
	sportFilter: string;
	onStatusChange: (status: TournamentStatus) => void;
	onSearchChange: (value: string) => void;
	onSportFilterChange: (value: string) => void;
};

export function TournamentToolbar({
	activeStatus,
	statusCounts,
	searchQuery,
	sportFilter,
	onStatusChange,
	onSearchChange,
	onSportFilterChange,
}: TournamentToolbarProps) {
	return (
		<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
			<div className="flex items-center gap-4">
				{TOURNAMENT_STATUS_TABS.map((tab) => {
					const isActive = activeStatus === tab.id;
					return (
						<button
							key={tab.id}
							type="button"
							onClick={() => onStatusChange(tab.id)}
							aria-pressed={isActive}
							className={cn(
								"flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border px-2 py-1.5 font-semibold text-xs transition-colors",
								isActive
									? "border-accent bg-accent text-[#040C01]"
									: "border-[#1B2722] bg-[#151616] text-[#8C8F8F] hover:text-white",
							)}
						>
							<span>{tab.label}</span>
							<span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#040C01] px-1.5 text-[10px] text-white">
								{statusCounts[tab.id]}
							</span>
						</button>
					);
				})}
			</div>

			<div className="md:ml-auto flex shrink-0 items-center gap-2">
				<label className="relative w-full md:w-[200px]">
					<span className="sr-only">Search tournaments</span>
					<input
						value={searchQuery}
						onChange={(event) => onSearchChange(event.target.value)}
						placeholder="Search..."
						className="h-10 w-full rounded-lg border border-[#1B2722] bg-[#151616] py-2 pr-10 pl-4 text-sm text-white outline-none placeholder:text-[#8C8F8F] focus:border-accent"
					/>
					<Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-[#8C8F8F]" />
				</label>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-[#1B2722] bg-[#151616] px-4 font-semibold text-[#C8CBCB] text-sm transition-colors hover:border-accent hover:text-white"
						>
							<SlidersHorizontal className="size-4" />
							<span className="hidden md:block">Filters</span>
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="end"
						className="w-44 border-[#1B2722] bg-[#151616] text-[#C8CBCB]"
					>
						<DropdownMenuRadioGroup
							value={sportFilter}
							onValueChange={onSportFilterChange}
						>
							{TOURNAMENT_SPORT_FILTERS.map((filter) => (
								<DropdownMenuRadioItem
									key={filter.id}
									value={filter.id}
									className="text-sm focus:bg-accent focus:text-[#040C01]"
								>
									{filter.label}
								</DropdownMenuRadioItem>
							))}
						</DropdownMenuRadioGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}
