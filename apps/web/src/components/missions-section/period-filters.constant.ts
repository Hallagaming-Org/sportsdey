import type { MissionPeriod } from "@/lib/missions";

/** Period tabs shown on the Missions page (All first). */
export const PERIOD_FILTERS = [
	{ id: "all", label: "All" },
	{ id: "daily", label: "Daily" },
	{ id: "weekly", label: "Weekly" },
	{ id: "monthly", label: "Monthly" },
] as const satisfies ReadonlyArray<{ id: MissionPeriod; label: string }>;
