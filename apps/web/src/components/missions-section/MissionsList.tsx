import { EmptyState } from "@/components/EmptyState";
import type { MissionCard as MissionCardModel } from "@/lib/missions";
import { CompletedMissionRow } from "./CompletedMissionRow";
import { MissionCard } from "./MissionCard";

type MissionsListProps = {
	missions: MissionCardModel[];
	completedMissions: MissionCardModel[];
};

export function MissionsList({
	missions,
	completedMissions,
}: MissionsListProps) {
	return (
		<>
			{missions.length === 0 ? (
				<EmptyState
					title="No missions in this period"
					titleClassName="text-white"
					description="Check All, Daily, Weekly, or Monthly — new challenges unlock as campaigns go live."
				/>
			) : (
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
					{missions.map((mission) => (
						<MissionCard key={mission.id} mission={mission} />
					))}
				</div>
			)}

			{completedMissions.length > 0 ? (
				<section className="mt-10">
					<h2 className="mb-4 font-extrabold text-gray-900 text-lg sm:text-xl dark:text-white">
						Completed Missions
					</h2>
					<div className="space-y-3">
						{completedMissions.map((mission) => (
							<CompletedMissionRow
								key={`completed-${mission.id}`}
								mission={mission}
							/>
						))}
					</div>
				</section>
			) : null}
		</>
	);
}
