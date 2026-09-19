import type { CloudflareBindings } from "../../types";
import { BONUS_ENGINE_PATH } from "./bonus-engine.service.constant";
import type {
	BonusEngineApiResult,
	BonusEngineMissionListItem,
} from "./bonus-engine.service.type";
import { bonusEngineRequest } from "./client";
import { getBonusEngineConfig } from "./config";
import { attachLiveSportsbookPaths } from "./mission-sportsbook-path";
import {
	listBonusEngineMissionProgressForUser,
	upsertBonusEngineMissionProgress,
} from "./persistence.service";
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

export type BonusEngineMissionProgressView = {
	missionId: string;
	progressPercentage: number;
	progressCurrent: number;
	progressTarget: number;
	completed: boolean;
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
	const withEngineProgress = await attachEngineMissionProgress({
		env: payload.env,
		userId: payload.userId,
		accessToken: tokenResult.data,
		missions,
	});
	const withSportsbookPaths = await attachLiveSportsbookPaths({
		env: payload.env,
		records: withEngineProgress,
	});
	return {
		...result,
		data: {
			...result.data,
			data: withSportsbookPaths,
		},
	};
}

/**
 * Pulls live progress from `POST /mission/progress` after a bet or result.
 * Failures are swallowed so a wallet callback never 500s.
 */
export async function refreshBonusEngineMissionProgressForUser(payload: {
	env: CloudflareBindings;
	userId: string;
}): Promise<void> {
	try {
		const tokenResult = await getBonusEngineAccessToken(payload.env);
		if (!tokenResult.ok || !tokenResult.data) return;

		const config = getBonusEngineConfig(payload.env);
		const listResult = await bonusEngineRequest<BonusEngineMissionListEnvelope>({
			env: payload.env,
			path: BONUS_ENGINE_PATH.MISSION_LIST,
			accessToken: tokenResult.data,
			body: {
				client_id: config.clientId,
				project_id: config.projectId,
				user_id: payload.userId,
			},
		});
		if (!listResult.ok) return;

		const missions = Array.isArray(listResult.data?.data)
			? listResult.data.data
			: [];
		await attachEngineMissionProgress({
			env: payload.env,
			userId: payload.userId,
			accessToken: tokenResult.data,
			missions,
		});
	} catch (error) {
		console.error("Bonus Engine mission progress refresh failed", {
			userId: payload.userId,
			error,
		});
	}
}

export function parseBonusEngineMissionProgress(payload: {
	missionId: string;
	body: unknown;
}): BonusEngineMissionProgressView {
	const root = asRecord(payload.body) ?? {};
	const data = asRecord(root.data) ?? root;
	const triggers = Array.isArray(data.triggers)
		? data.triggers
		: Array.isArray(data.mission_triggers)
			? data.mission_triggers
			: [];

	let progressCurrent = firstFiniteNumber(
		data.progress_current,
		data.current,
		data.current_value,
		data.completed_count,
	);
	let progressTarget = firstFiniteNumber(
		data.progress_target,
		data.target,
		data.target_value,
		data.required_count,
	);

	if (progressCurrent === 0 && progressTarget === 0 && triggers.length > 0) {
		for (const entry of triggers) {
			const trigger = asRecord(entry);
			if (!trigger) continue;
			progressCurrent += firstFiniteNumber(
				trigger.current,
				trigger.progress_current,
				trigger.current_value,
			);
			progressTarget += firstFiniteNumber(
				trigger.target,
				trigger.progress_target,
				trigger.target_value,
			);
		}
	}

	let progressPercentage = firstFiniteNumber(
		data.progress_percentage,
		data.progress,
		data.completion_percentage,
	);
	if (progressPercentage === 0 && progressTarget > 0) {
		progressPercentage = Math.min(
			100,
			(progressCurrent / progressTarget) * 100,
		);
	}
	if (progressCurrent === 0 && progressPercentage > 0 && progressTarget > 0) {
		progressCurrent = (progressPercentage / 100) * progressTarget;
	}

	const status = String(
		data.mission_status ?? data.status ?? "",
	).toUpperCase();
	const completed =
		status === "COMPLETED" ||
		status === "COMPLETE" ||
		progressPercentage >= 100;

	return {
		missionId: payload.missionId,
		progressPercentage: completed ? 100 : progressPercentage,
		progressCurrent,
		progressTarget,
		completed,
	};
}

async function attachEngineMissionProgress(payload: {
	env: CloudflareBindings;
	userId: string;
	accessToken: string;
	missions: BonusEngineMissionListItem[];
}): Promise<BonusEngineMissionListItem[]> {
	if (payload.missions.length === 0) return payload.missions;

	const config = getBonusEngineConfig(payload.env);
	const views = await Promise.all(
		payload.missions.map(async (mission) => {
			const missionId = missionListItemId(mission);
			if (!missionId) return { mission, view: null };
			try {
				const result = await bonusEngineRequest({
					env: payload.env,
					path: BONUS_ENGINE_PATH.MISSION_PROGRESS,
					accessToken: payload.accessToken,
					body: {
						client_id: config.clientId,
						project_id: config.projectId,
						user_id: payload.userId,
						mission_id: missionId,
					},
				});
				if (!result.ok) return { mission, view: null };
				const view = parseBonusEngineMissionProgress({
					missionId,
					body: result.data,
				});
				await upsertBonusEngineMissionProgress({
					env: payload.env,
					userId: payload.userId,
					missionId,
					progressPercentage: view.progressPercentage,
					completedAt: view.completed ? new Date() : null,
				});
				return { mission, view };
			} catch (error) {
				console.error("Bonus Engine POST /mission/progress failed", {
					userId: payload.userId,
					missionId,
					error,
				});
				return { mission, view: null };
			}
		}),
	);

	const missing = views.some((entry) => entry.view === null);
	const local = missing
		? await listBonusEngineMissionProgressForUser({
				env: payload.env,
				userId: payload.userId,
			})
		: [];
	const localById = new Map(local.map((row) => [row.missionId, row]));

	return views.map((entry) => {
		if (entry.view) {
			return overlayEngineProgress({
				mission: entry.mission,
				view: entry.view,
			});
		}
		const missionId = missionListItemId(entry.mission);
		const snapshot = missionId ? localById.get(missionId) : undefined;
		if (!snapshot) return entry.mission;
		return overlayMissionProgress({
			mission: entry.mission,
			snapshot,
		});
	});
}

function overlayEngineProgress(payload: {
	mission: BonusEngineMissionListItem;
	view: BonusEngineMissionProgressView;
}): BonusEngineMissionListItem {
	return {
		...payload.mission,
		progress_percentage: payload.view.progressPercentage,
		progress_current: payload.view.progressCurrent,
		current: payload.view.progressCurrent,
		progress_target: payload.view.progressTarget,
		target: payload.view.progressTarget,
		...(payload.view.completed
			? { mission_status: "COMPLETED", progress_percentage: 100 }
			: {}),
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

function asRecord(value: unknown): Record<string, unknown> | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return null;
	}
	return value as Record<string, unknown>;
}

function firstFiniteNumber(...values: unknown[]): number {
	for (const value of values) {
		const parsed = asProgressNumber(value);
		if (parsed > 0) return parsed;
	}
	return 0;
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
