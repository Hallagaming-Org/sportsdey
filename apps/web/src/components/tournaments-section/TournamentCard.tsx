import { TOURNAMENT_STATUS } from "@/lib/tournaments.constant";
import { cn } from "@/lib/utils";
import {
	formatTournamentPrize,
	type Tournament,
} from "./tournaments.constant";

type TournamentCardProps = {
	tournament: Tournament;
	joined: boolean;
	joining?: boolean;
	onJoin: (tournament: Tournament) => void;
};

export function TournamentCard({
	tournament,
	joined,
	joining = false,
	onJoin,
}: TournamentCardProps) {
	const isResults = tournament.status === TOURNAMENT_STATUS.RESULTS;
	const actionLabel = isResults
		? "Ended"
		: joined
			? "Joined"
			: joining
				? "Joining..."
				: "Join now";
	const canJoin = !isResults && !joined && !joining;

	return (
		<article className="flex flex-col overflow-hidden rounded-2xl border border-accent/35 bg-[#151616]">
			<div className="aspect-[16/10] w-full overflow-hidden">
				<img
					src={tournament.image}
					alt={tournament.title}
					className="h-full w-full object-cover"
				/>
			</div>

			<div className="flex flex-1 flex-col p-4">
				<h3 className="min-h-10 font-extrabold text-white text-base leading-snug">
					{tournament.title}
				</h3>
				<p className="mt-1 font-extrabold text-accent text-lg">
					{formatTournamentPrize(tournament.prize)}
				</p>
				<hr className="mt-2 border-[#595D5D]" />
				<div className="mt-3 mb-4 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] text-[#8C8F8F]">
					<span className="shrink-0">
						{tournament.players > 0
							? `${tournament.players.toLocaleString("en-NG")} Players`
							: "No players yet"}
					</span>
					<span className="shrink-0 tabular-nums">{tournament.remaining}</span>
				</div>

				<button
					type="button"
					disabled={!canJoin}
					onClick={() => onJoin(tournament)}
					className={cn(
						"mt-auto h-11 w-full rounded-xl font-bold text-sm transition-colors",
						canJoin
							? "bg-accent text-[#040C01] hover:bg-[#158f03] hover:text-white"
							: "cursor-default bg-[#1B2722] text-[#8C8F8F]",
					)}
				>
					{actionLabel}
				</button>
			</div>
		</article>
	);
}
