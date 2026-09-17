import { cn } from "@/lib/utils";
import {
	DUMMY_LEADERBOARD,
	formatTournamentPrize,
	playerInitials,
} from "./tournaments.constant";

const RANK_BADGE: Record<number, string> = {
	1: "bg-[#F5A524] text-white",
	2: "bg-[#C8CBCB] text-[#040C01]",
	3: "bg-[#CD7F32] text-white",
};

const AVATAR_TONES = [
	"bg-accent/20 text-accent",
	"bg-[#1B2722] text-[#C8CBCB]",
	"bg-[#2A2416] text-[#F5A524]",
	"bg-[#1A2430] text-[#7DD3FC]",
];

export function TournamentLeaderboard() {
	return (
		<section className="overflow-hidden rounded-2xl border border-accent/35 bg-[#151616]">
			<h2 className="px-4 pt-5 pb-3 font-extrabold text-lg text-white sm:px-6 sm:text-xl">
				Leaderboard Preview
			</h2>
			<div className="overflow-x-auto">
				<table className="w-full table-fixed text-left text-sm">
					<thead>
						<tr className="border-[#1B2722] border-b text-[#8C8F8F]">
							<th className="w-12 px-3 py-3 font-medium sm:px-5">#</th>
							<th className="w-[26%] px-3 py-3 font-medium sm:px-5">Players</th>
							<th className="w-[30%] px-3 py-3 font-medium sm:px-5">
								Tournament
							</th>
							<th className="w-[18%] px-3 py-3 font-medium sm:px-5">Points</th>
							<th className="w-[18%] px-3 py-3 font-medium sm:px-5">Prize</th>
						</tr>
					</thead>
					<tbody>
						{DUMMY_LEADERBOARD.map((entry) => (
							<tr
								key={entry.id}
								className="border-[#1B2722] border-b last:border-b-0"
							>
								<td className="px-3 py-3 sm:px-5">
									<span
										className={cn(
											"inline-flex size-7 items-center justify-center rounded-full font-bold text-xs",
											RANK_BADGE[entry.rank] ?? "text-[#8C8F8F]",
										)}
									>
										{entry.rank}
									</span>
								</td>
								<td className="px-3 py-3 sm:px-5">
									<div className="flex min-w-0 items-center gap-3">
										<span
											className={cn(
												"inline-flex size-8 shrink-0 items-center justify-center rounded-full font-bold text-[11px]",
												AVATAR_TONES[(entry.rank - 1) % AVATAR_TONES.length],
											)}
										>
											{playerInitials(entry.player)}
										</span>
										<span className="truncate font-medium text-white">
											{entry.player}
										</span>
									</div>
								</td>
								<td className="truncate px-3 py-3 text-[#C8CBCB] sm:px-5">
									{entry.tournament}
								</td>
								<td className="px-3 py-3 text-white sm:px-5">
									{entry.points.toLocaleString("en-NG")}
								</td>
								<td className="px-3 py-3 font-semibold text-white sm:px-5">
									{formatTournamentPrize(entry.prize, true)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
}
