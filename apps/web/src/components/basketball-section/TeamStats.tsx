import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Player {
	name: string;
	number: string;
	pts: number;
	fg: string;
	threePt: string;
	ft: string;
	reb: number;
	ast: number;
	to: number;
	stl: number;
	blk: number;
	oreb: number;
	dreb: number;
	pf: number;
	min: string | number;
	plusMinus: number;
}

interface TeamTotals {
	pts: number;
	fg: string;
	threePt: string;
	ft: string;
	reb: number;
	ast: number;
	to: number;
	stl: number;
	blk: number;
	oreb: number;
	dreb: number;
	pf: number;
	min: string | number;
	fgPct: number;
	threePtPct: number;
	ftPct: number;
}

export interface TeamStatsData {
	teamName: string;
	teamLogo?: string;
	starters: Player[];
	bench: Player[];
	totals: TeamTotals;
}

interface TeamStatsProps {
	teams: TeamStatsData[];
	className?: string;
	isLoading?: boolean;
}

const statColumns = [
	{ key: "pts", label: "PTS" },
	{ key: "fg", label: "FG" },
	{ key: "threePt", label: "3PT" },
	{ key: "ft", label: "FT" },
	{ key: "reb", label: "REB" },
	{ key: "ast", label: "AST" },
	{ key: "to", label: "TO" },
	{ key: "stl", label: "STL" },
	{ key: "blk", label: "BLK" },
	{ key: "oreb", label: "OREB" },
	{ key: "dreb", label: "DREB" },
	{ key: "pf", label: "PF" },
	{ key: "min", label: "MIN" },
	{ key: "plusMinus", label: "+/-" },
];

function PlayerRow({ player }: { player: Player }) {
	return (
		<tr className="border-[#C8C8C8] border-b transition-colors hover:bg-gray-300/50 dark:border-[#5A5F63]">
			<td className="sticky left-0 z-10 border-[#C8C8C8] border-r bg-white px-3 py-2 text-left shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:border-[#5A5F63] dark:bg-card">
				<span className="text-[11px] text-primary dark:text-white">
					{player.name}
				</span>
				<span className="ml-2 text-[11px] text-primary dark:text-white">
					#{player.number}
				</span>
			</td>
			<td className="px-2 py-2 text-center text-[11px] text-primary dark:text-white">
				{player.pts}
			</td>
			<td className="px-2 py-2 text-center text-[11px] text-primary dark:text-white">
				{player.fg}
			</td>
			<td className="px-2 py-2 text-center text-[11px] text-primary dark:text-white">
				{player.threePt}
			</td>
			<td className="px-2 py-2 text-center text-[11px] text-primary dark:text-white">
				{player.ft}
			</td>
			<td className="px-2 py-2 text-center text-[11px] text-primary dark:text-white">
				{player.reb}
			</td>
			<td className="px-2 py-2 text-center text-[11px] text-primary dark:text-white">
				{player.ast}
			</td>
			<td className="px-2 py-2 text-center text-[11px] text-primary dark:text-white">
				{player.to}
			</td>
			<td className="px-2 py-2 text-center text-[11px] text-primary dark:text-white">
				{player.stl}
			</td>
			<td className="px-2 py-2 text-center text-[11px] text-primary dark:text-white">
				{player.blk}
			</td>
			<td className="px-2 py-2 text-center text-[11px] text-primary dark:text-white">
				{player.oreb}
			</td>
			<td className="px-2 py-2 text-center text-[11px] text-primary dark:text-white">
				{player.dreb}
			</td>
			<td className="px-2 py-2 text-center text-[11px] text-primary dark:text-white">
				{player.pf}
			</td>
			<td className="px-2 py-2 text-center text-[11px] text-primary dark:text-white">
				{player.min}
			</td>
			<td
				className={cn(
					"px-2 py-2 text-center text-[11px]",
					player.plusMinus > 0
						? "text-emerald-400"
						: player.plusMinus < 0
							? "text-red-400"
							: "text-primary dark:text-white",
				)}
			>
				{player.plusMinus > 0 ? `+${player.plusMinus}` : player.plusMinus}
			</td>
		</tr>
	);
}

function SectionHeader({ title }: { title: string }) {
	return (
		<tr className="border-[#C8C8C8] border-t border-b bg-white dark:bg-card">
			<td className="sticky left-0 z-10 border-[#C8C8C8] border-r bg-white px-3 py-2 text-left font-semibold text-primary text-xs dark:bg-card">
				{title}
			</td>
			{statColumns.map((col) => (
				<td
					key={col.key}
					className="px-2 py-2 text-center font-semibold text-[10px] text-primary dark:text-white"
				>
					{col.label}
				</td>
			))}
		</tr>
	);
}

function TeamTotalsRow({ totals }: { totals: TeamTotals }) {
	return (
		<>
			<tr className="bg-white font-semibold dark:bg-card">
				<td className="sticky left-0 z-10 border-[#C8C8C8] border-r bg-white px-3 py-2 text-left text-primary text-xs shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:bg-card dark:text-white">
					TEAM
				</td>
				<td className="px-2 py-2 text-center font-semibold text-[10px]">
					{totals.pts}
				</td>
				<td className="px-2 py-2 text-center text-[10px] text-primary dark:text-white">
					{totals.fg}
				</td>
				<td className="px-2 py-2 text-center text-[10px] text-primary dark:text-white">
					{totals.threePt}
				</td>
				<td className="px-2 py-2 text-center text-[10px] text-primary dark:text-white">
					{totals.ft}
				</td>
				<td className="px-2 py-2 text-center text-[10px] text-primary dark:text-white">
					{totals.reb}
				</td>
				<td className="px-2 py-2 text-center text-[10px] text-primary dark:text-white">
					{totals.ast}
				</td>
				<td className="px-2 py-2 text-center text-[10px] text-primary dark:text-white">
					{totals.to}
				</td>
				<td className="px-2 py-2 text-center text-[10px] text-primary dark:text-white">
					{totals.stl}
				</td>
				<td className="px-2 py-2 text-center text-[10px] text-primary dark:text-white">
					{totals.blk}
				</td>
				<td className="px-2 py-2 text-center text-[10px] text-primary dark:text-white">
					{totals.oreb}
				</td>
				<td className="px-2 py-2 text-center text-[10px] text-primary">
					{totals.dreb}
				</td>
				<td className="px-2 py-2 text-center text-[10px] text-primary dark:text-white">
					{totals.pf}
				</td>
				<td className="px-2 py-2 text-center text-[10px] text-primary dark:text-white">
					{totals.min}
				</td>
				<td className="px-2 py-2 text-center text-[10px] text-primary dark:text-white">
					-
				</td>
			</tr>
			<tr className="border-[#C8C8C8] border-b font-semibold dark:border-[#5A5F63]">
				<td className="sticky left-0 z-10 border-[#C8C8C8] border-r bg-white px-3 py-2 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:border-[#5A5F63] dark:bg-card" />
				<td className="px-2 py-2" />
				<td className="px-2 py-2 text-center text-[10px]">{totals.fgPct}%</td>
				<td className="px-2 py-2 text-center text-[10px]">
					{totals.threePtPct}%
				</td>
				<td className="px-2 py-2 text-center text-[10px]">{totals.ftPct}%</td>
				<td colSpan={10} />
			</tr>
		</>
	);
}

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";

export function TeamStats({ teams, className, isLoading }: TeamStatsProps) {
	if (isLoading) {
		return (
			<div
				className={cn(
					"space-y-4 rounded-lg bg-white p-4 dark:bg-card",
					className,
				)}
			>
				<Skeleton className="h-6 w-32 bg-gray-100 dark:bg-card/60" />
				<div className="space-y-3">
					{[1, 2].map((i) => (
						<div
							key={i}
							className="space-y-3 rounded-lg border border-[#C8C8C8] p-4 dark:border-[#5A5F63]"
						>
							<div className="flex items-center gap-2">
								<Skeleton className="h-6 w-6 rounded-full bg-gray-100 dark:bg-card/60" />
								<Skeleton className="h-4 w-40 bg-gray-100 dark:bg-card/60" />
							</div>
							<Skeleton className="h-32 w-full bg-gray-100 dark:bg-card/60" />
						</div>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className={cn("rounded-lg bg-white dark:bg-card", className)}>
			<h2 className="border-b border-b-[#C8C8C8] px-2 py-3 font-semibold text-primary text-sm dark:border-[#5A5F63] dark:text-white">
				Team stats
			</h2>
			<Accordion type="multiple" className="w-full">
				{teams.map((team, idx) => (
					<AccordionItem
						key={idx}
						value={`item-${idx}`}
						className="border-[#C8C8C8] border-b dark:border-[#5A5F63]"
					>
						<AccordionTrigger
							className="px-3 py-3 hover:bg-gray-50 hover:no-underline dark:hover:bg-[#5A5F63]"
							isCollapsible={true}
						>
							<div className="flex items-center gap-x-2">
								{team.teamLogo && (
									<img
										src={team.teamLogo || "/placeholder.svg"}
										alt={team.teamName}
										className="h-6 w-6 object-contain"
									/>
								)}
								<h3 className="font-semibold text-primary text-sm dark:text-white">
									{team.teamName}
								</h3>
							</div>
						</AccordionTrigger>
						<AccordionContent>
							<div className="max-w-[calc(100vw-2rem)] overflow-x-auto pb-4 md:max-w-none">
								<table className="w-full text-sm">
									<tbody>
										<SectionHeader title="Starters" />
										{team.starters.map((player, idx) => (
											<PlayerRow key={`starter-${idx}`} player={player} />
										))}
										<SectionHeader title="Bench" />
										{team.bench.map((player, idx) => (
											<PlayerRow key={`bench-${idx}`} player={player} />
										))}
										<TeamTotalsRow totals={team.totals} />
									</tbody>
								</table>
							</div>
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
			<p className="mt-2 px-3 py-2 text-xs text-zinc-500">
				+/- denotes team&apos;s net points while the player is on the court
			</p>
		</div>
	);
}
