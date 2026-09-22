import type { MissionPeriod } from "@/lib/missions";

export const PERIOD_FILTERS = [
	{ id: "all", label: "All" },
	{ id: "daily", label: "Daily" },
	{ id: "weekly", label: "Weekly" },
	{ id: "monthly", label: "Monthly" },
] as const satisfies ReadonlyArray<{ id: MissionPeriod; label: string }>;
