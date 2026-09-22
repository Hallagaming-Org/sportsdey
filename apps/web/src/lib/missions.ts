import { apiRequest } from "@/lib/api";
import { MISSION_API_ROUTE } from "./missions.constant";
import {
	applyMissionLevelLocks,
	normalizeMissionRecord,
	type MissionCard,
} from "./missions-normalize";

export type {
	MissionActionKind,
	MissionCadence,
	MissionCard,
	MissionPeriod,
} from "./missions-normalize";
export {
	applyMissionLevelLocks,
	isActiveEngineMission,
	normalizeMissionRecord,
	resolveMissionAction,
} from "./missions-normalize";

export async function fetchMissionList(): Promise<MissionCard[]> {
	const data = await apiRequest<Record<string, unknown>[]>(MISSION_API_ROUTE.LIST, {
		method: "GET",
		credentials: "include",
	});
	const cards = (Array.isArray(data) ? data : []).map(normalizeMissionRecord);
	return applyMissionLevelLocks(cards);
}
