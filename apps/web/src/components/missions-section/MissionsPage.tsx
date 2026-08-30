import { Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth/client";
import { fetchMissionList, type MissionPeriod } from "@/lib/missions";
import { MissionsError } from "./MissionsError";
import { MissionsGridSkeleton } from "./MissionsGridSkeleton";
import { MissionsHeader } from "./MissionsHeader";
import { MissionsList } from "./MissionsList";
import { MissionsToolbar } from "./MissionsToolbar";

export function MissionsPage() {
	const { data: session, isPending: isSessionLoading } = useSession();
	const [activePeriod, setActivePeriod] = useState<MissionPeriod>("all");
	const [timerQuery, setTimerQuery] = useState("");

	const {
		data: missions = [],
		isLoading,
		error,
		isError,
	} = useQuery({
		queryKey: ["missions", "list"],
		queryFn: fetchMissionList,
		enabled: Boolean(session?.user),
		retry: false,
	});

	const periodCounts = useMemo(() => {
		const counts: Record<MissionPeriod, number> = {
			all: missions.length,
			daily: 0,
			weekly: 0,
			monthly: 0,
		};
		for (const mission of missions) {
			counts[mission.period] += 1;
		}
		return counts;
	}, [missions]);

	const periodMissions = useMemo(
		() =>
			activePeriod === "all"
				? missions
				: missions.filter((mission) => mission.period === activePeriod),
		[activePeriod, missions],
	);
	const completedMissions = useMemo(
		() => missions.filter((mission) => mission.status === "completed"),
		[missions],
	);

	const filteredPeriodMissions = useMemo(() => {
		const query = timerQuery.trim().toLowerCase();
		if (!query) return periodMissions;
		return periodMissions.filter(
			(mission) =>
				mission.title.toLowerCase().includes(query) ||
				mission.description.toLowerCase().includes(query),
		);
	}, [periodMissions, timerQuery]);

	const nearestEndAt = periodMissions
		.map((mission) => mission.endAt)
		.filter((value): value is string => Boolean(value))
		.sort()[0];

	if (!isSessionLoading && !session?.user) {
		return <Navigate to="/auth/sign-in" />;
	}

	if (error instanceof ApiError && error.status === 401) {
		return <Navigate to="/auth/sign-in" />;
	}

	return (
		<div className="w-full space-y-6">
			<div className="rounded-2xl border border-[#F1F2F4] bg-white p-4 shadow-sm sm:p-6 dark:border-[#1B2722] dark:bg-[#1C1D1F]">
				<MissionsHeader />

				<MissionsToolbar
					activePeriod={activePeriod}
					periodCounts={periodCounts}
					timerQuery={timerQuery}
					nearestEndAt={nearestEndAt}
					onPeriodChange={setActivePeriod}
					onTimerQueryChange={setTimerQuery}
				/>

				{isSessionLoading || isLoading ? (
					<MissionsGridSkeleton />
				) : isError ? (
					<MissionsError error={error} />
				) : (
					<MissionsList
						missions={filteredPeriodMissions}
						completedMissions={completedMissions}
					/>
				)}
			</div>
		</div>
	);
}
