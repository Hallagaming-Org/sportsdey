import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import type { MissionCard as MissionCardModel } from "@/lib/missions";
import { sportsbookSplatFromHref } from "@/lib/missions.constant";
import { cn } from "@/lib/utils";
import { iconForAction } from "./mission-action-icon";

type MissionCardProps = {
	mission: MissionCardModel;
};

const missionPath = (href: string): string => {
	return href.split("#")[0] ?? href;
};

const missionHash = (href: string): string | undefined => {
	return href.split("#")[1] ?? undefined;
};

export function MissionCard({ mission }: MissionCardProps) {
	const isLocked = mission.status === "locked";
	const isCompleted = mission.status === "completed";
	const progressPercent =
		mission.progressTarget > 0
			? Math.min(100, (mission.progressCurrent / mission.progressTarget) * 100)
			: 0;
	const Icon = iconForAction(mission.actionKind);
	const sportsbookSplat = sportsbookSplatFromHref(mission.actionHref);

	return (
		<article
			className={cn(
				"relative flex flex-col overflow-hidden rounded-2xl border border-[#1B2722] bg-[#151616] p-5",
				isLocked && "min-h-[280px]",
			)}
		>
			{isLocked ? (
				<div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#151616]/80 px-6 text-center backdrop-blur-[1px]">
					<div className="flex size-14 items-center justify-center rounded-full border border-[#1B2722] bg-[#1C1D1F]">
						<Lock className="size-6 text-[#8C8F8F]" />
					</div>
					<p className="max-w-[220px] text-sm text-[#C8CBCB]">
						{mission.lockedMessage ?? "Locked"}
					</p>
				</div>
			) : null}

			<div className={cn("flex flex-1 flex-col", isLocked && "opacity-40")}>
				<div className="mb-5 flex items-start gap-3">
					<div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
						<Icon className="size-5" />
					</div>
					<div className="min-w-0">
						<h3 className="font-extrabold text-base text-white">
							{mission.title}
						</h3>
						<p className="mt-1 line-clamp-2 text-sm text-[#8C8F8F]">
							{mission.description}
						</p>
					</div>
				</div>

				<div className="mb-1 flex items-center justify-between gap-3 text-xs">
					<span className="text-[#8C8F8F]">{mission.progressLabel}</span>
					<span className="font-semibold text-white">
						{mission.progressCurrent}/{mission.progressTarget}
					</span>
				</div>
				<div className="mb-5 h-2 overflow-hidden rounded-full bg-[#1B2722]">
					<div
						className="h-full rounded-full bg-accent transition-[width] duration-500"
						style={{ width: `${progressPercent}%` }}
					/>
				</div>

				<div className="mb-5 flex items-center justify-between text-sm">
					<span className="text-[#8C8F8F]">Reward</span>
					<span className="font-bold text-white">{mission.rewardLabel}</span>
				</div>

				{isCompleted ? (
					<button
						type="button"
						disabled
						className="mt-auto h-11 w-full cursor-default rounded-xl bg-[#1B2722] font-bold text-sm text-[#8C8F8F]"
					>
						Completed
					</button>
				) : sportsbookSplat ? (
					<a
						href={mission.actionHref}
						className="mt-auto flex h-11 w-full items-center justify-center rounded-xl bg-accent font-bold text-sm text-[#040C01] transition-colors hover:bg-[#158f03] hover:text-white"
					>
						{mission.actionLabel}
					</a>
				) : (
					<Link
						to={missionPath(mission.actionHref)}
						hash={missionHash(mission.actionHref)}
						search={mission.actionSearch}
						className="mt-auto flex h-11 w-full items-center justify-center rounded-xl bg-accent font-bold text-sm text-[#040C01] transition-colors hover:bg-[#158f03] hover:text-white"
					>
						{mission.actionLabel}
					</Link>
				)}
			</div>
		</article>
	);
}

