import type { CloudflareBindings } from "../../types";
import { BONUS_ENGINE_PATH } from "./bonus-engine.service.constant";
import type {
	BonusEngineApiResult,
	BonusEngineMissionListItem,
} from "./bonus-engine.service.type";
import { bonusEngineRequest } from "./client";
import { getBonusEngineConfig } from "./config";
import { attachLiveSportsbookPaths } from "./mission-sportsbook-path";
import { listBonusEngineMissionProgressForUser } from "./persistence.service";
import { getBonusEngineAccessToken } from "./token.service";

type BonusEngineMissionListEnvelope = {
	status?: number;
	message?: string;
	data?: BonusEngineMissionListItem[];
};

type LocalMissionProgress = {
	missionId: string;
	progressPercentage: number;
	completedAt: Date | null;
	rewardJson: string | null;
};

export function mergeMissionListWithLocalProgress(payload: {
	missions: BonusEngineMissionListItem[];
	progress: LocalMissionProgress[];
}): BonusEngineMissionListItem[] {
	if (payload.progress.length === 0) return payload.missions;
	const byMissionId = new Map(
		payload.progress.map((row) => [row.missionId, row]),
	);
	return payload.missions.map((mission) => {
		const missionId = missionListItemId(mission);
		if (!missionId) return mission;
		const snapshot = byMissionId.get(missionId);
		if (!snapshot) return mission;
		return overlayMissionProgress({ mission, snapshot });
	});
}

export async function listBonusEngineMissions(payload: {
	env: CloudflareBindings;
	userId: string;
}): Promise<BonusEngineApiResult<BonusEngineMissionListEnvelope>> {
	const tokenResult = await getBonusEngineAccessToken(payload.env);
	if (!tokenResult.ok || !tokenResult.data) {
		return {
			ok: false,
			status: tokenResult.status,
			error: tokenResult.error ?? "Failed to obtain Bonus Engine access token",
		};
	}

	const config = getBonusEngineConfig(payload.env);
	const result = await bonusEngineRequest<BonusEngineMissionListEnvelope>({
		env: payload.env,
		path: BONUS_ENGINE_PATH.MISSION_LIST,
		accessToken: tokenResult.data,
		body: {
			client_id: config.clientId,
			project_id: config.projectId,
			user_id: payload.userId,
		},
	});
	if (!result.ok) return result;

	const missions = Array.isArray(result.data?.data) ? result.data.data : [];
	const progress = await listBonusEngineMissionProgressForUser({
		env: payload.env,
		userId: payload.userId,
	});
	const merged = mergeMissionListWithLocalProgress({ missions, progress });
	const withSportsbookPaths = await attachLiveSportsbookPaths({
		env: payload.env,
		records: merged,
	});
	return {
		...result,
		data: {
			...result.data,
			data: withSportsbookPaths,
		},
	};
}

function overlayMissionProgress(payload: {
	mission: BonusEngineMissionListItem;
	snapshot: LocalMissionProgress;
}): BonusEngineMissionListItem {
	const upstreamPercent = asProgressNumber(payload.mission.progress_percentage);
	const progressPercentage = Math.max(
		upstreamPercent,
		payload.snapshot.progressPercentage,
	);
	const completed =
		payload.snapshot.completedAt !== null || progressPercentage >= 100;
	return {
		...payload.mission,
		progress_percentage: progressPercentage,
		...(payload.snapshot.completedAt
			? { completed_at: payload.snapshot.completedAt.toISOString() }
			: {}),
		...(payload.snapshot.rewardJson
			? { reward: parseRewardJson(payload.snapshot.rewardJson) }
			: {}),
		...(completed
			? { mission_status: "COMPLETED", progress_percentage: 100 }
			: {}),
	};
}

function missionListItemId(mission: BonusEngineMissionListItem): string {
	for (const key of ["_id", "mission_id", "id"] as const) {
		const value = mission[key];
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return "";
}

function asProgressNumber(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim()) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
}

function parseRewardJson(value: string): unknown {
	try {
		return JSON.parse(value) as unknown;
	} catch {
		return value;
	}
}
