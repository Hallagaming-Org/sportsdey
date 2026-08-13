import { Check, LogIn } from "lucide-react";
import type { MissionCard } from "@/lib/missions";
import { iconForAction } from "./mission-action-icon";
import { formatCompletedAt } from "./mission-format";

type CompletedMissionRowProps = {
	mission: MissionCard;
};

export function CompletedMissionRow({ mission }: CompletedMissionRowProps) {
	const Icon = iconForAction(mission.actionKind);

	return (
		<div className="flex items-center gap-4 rounded-2xl border border-[#1B2722] bg-[#151616] px-4 py-4">
			<div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
				{mission.actionKind === "generic" ? (
					<LogIn className="size-5" />
				) : (
					<Icon className="size-5" />
				)}
			</div>
			<div className="min-w-0 flex-1">
				<p className="font-extrabold text-white">{mission.title}</p>
				<p className="mt-0.5 text-sm text-[#8C8F8F]">{mission.description}</p>
			</div>
			<div className="hidden text-right sm:block">
				<p className="font-bold text-accent">+{mission.rewardPoints} XP</p>
				{mission.completedAt ? (
					<p className="mt-1 text-xs text-[#8C8F8F]">
						Completed on {formatCompletedAt(mission.completedAt)}
					</p>
				) : null}
			</div>
			<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-[#040C01]">
				<Check className="size-4" strokeWidth={3} />
			</div>
		</div>
	);
}
