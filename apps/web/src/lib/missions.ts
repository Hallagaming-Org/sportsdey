import { apiRequest } from "@/lib/api";
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
	normalizeMissionRecord,
	resolveMissionAction,
} from "./missions-normalize";

export async function fetchMissionList(): Promise<MissionCard[]> {
	const data = await apiRequest<Record<string, unknown>[]>("mission/list", {
		method: "POST",
		credentials: "include",
		body: JSON.stringify({}),
	});
	const cards = (Array.isArray(data) ? data : []).map(normalizeMissionRecord);
	return applyMissionLevelLocks(cards);
}
