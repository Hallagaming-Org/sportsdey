import type { CloudflareBindings } from "../../types";
import {
	BONUS_ENGINE_MISSION_RECONCILE_GRACE_MS,
	BONUS_ENGINE_PATH,
} from "./bonus-engine.service.constant";
import type {
	BonusEngineApiResult,
	BonusEngineMissionListItem,
} from "./bonus-engine.service.type";
import { getBonusEngineConfig, isBonusEngineConfigured } from "./config";
import { attachLiveSportsbookPaths } from "./mission-sportsbook-path";
import {
	listBonusEngineMissionProgressForUser,
	listMissionsAwaitingReward,
	upsertBonusEngineMissionProgress,
} from "./persistence.service";
import { creditMissionReward } from "./rewards.service";
import { bonusEngineAuthedRequest } from "./token.service";

type BonusEngineMissionListEnvelope = {
	status?: number;
	message?: string;
	data?: BonusEngineMissionListItem[];
};

type LocalMissionProgress = {
	missionId: string;
	progressPercentage: number;
	completedAt: Date | null;
	engineCompletedAt?: Date | null;
	rewardJson: string | null;
};

export type BonusEngineMissionProgressView = {
	missionId: string;
	progressPercentage: number;
	progressCurrent: number;
	progressTarget: number;
	completed: boolean;
};

/**
 * `reward_status` on a completed mission: `credited` once the reward was
 * handled (complete callback or reconciliation), `pending` while the engine
 * says complete but the reward has not landed yet.
 */
export const MISSION_REWARD_STATUS = {
	CREDITED: "credited",
	PENDING: "pending",
} as const;

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
	const result = await fetchMissionList(payload);
	if (!result.ok) return result;

	const missions = Array.isArray(result.data?.data) ? result.data.data : [];
	const withEngineProgress = await attachEngineMissionProgress({
		env: payload.env,
		userId: payload.userId,
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
		const listResult = await fetchMissionList(payload);
		if (!listResult.ok) return;

		const missions = Array.isArray(listResult.data?.data)
			? listResult.data.data
			: [];
		await attachEngineMissionProgress({
			env: payload.env,
			userId: payload.userId,
			missions,
		});
	} catch (error) {
		console.error("Bonus Engine mission progress refresh failed", {
			userId: payload.userId,
			error,
		});
	}
}

function fetchMissionList(payload: {
	env: CloudflareBindings;
	userId: string;
}): Promise<BonusEngineApiResult<BonusEngineMissionListEnvelope>> {
	const config = getBonusEngineConfig(payload.env);
	return bonusEngineAuthedRequest<BonusEngineMissionListEnvelope>({
		env: payload.env,
		path: BONUS_ENGINE_PATH.MISSION_LIST,
		body: {
			client_id: config.clientId,
			project_id: config.projectId,
			user_id: payload.userId,
		},
	});
}

/**
 * Reward entries a mission definition advertises, from
 * `mission_triggers[].parameters.rewards[]` (and top-level `reward(s)`).
 */
export function missionRewardDefinitions(
	mission: BonusEngineMissionListItem,
): Array<{ type: string; amount: number }> {
	const entries: Array<{ type: string; amount: number }> = [];
	const pushReward = (value: unknown) => {
		const row = asRecord(value);
		if (!row) return;
		const type = typeof row.type === "string" ? row.type.trim() : "";
		const amount = asProgressNumber(row.amount ?? row.value);
		if (type && amount > 0) entries.push({ type, amount });
	};

	const triggers = Array.isArray(mission.mission_triggers)
		? mission.mission_triggers
		: Array.isArray(mission.triggers)
			? mission.triggers
			: [];
	for (const trigger of triggers) {
		const parameters = asRecord(asRecord(trigger)?.parameters);
		const rewards = Array.isArray(parameters?.rewards)
			? parameters.rewards
			: [];
		rewards.forEach(pushReward);
	}
	if (entries.length === 0) {
		const topLevel = Array.isArray(mission.rewards)
			? mission.rewards
			: [mission.reward];
		topLevel.forEach(pushReward);
	}
	return entries;
}

/**
 * Safety net for a lost `mission/complete` callback. For missions the engine
 * reported complete more than the grace window ago with no reward handled,
 * re-reads the mission definition and grants its reward under the same
 * reference the callback uses, so the two paths can never both pay. Only an
 * unambiguous single reward is granted; anything else is flagged for ops.
 */
export async function reconcileMissionRewards(
	env: CloudflareBindings,
	options?: { now?: Date; limit?: number },
): Promise<{ reconciled: number; manualReview: number }> {
	const stats = { reconciled: 0, manualReview: 0 };
	if (!isBonusEngineConfigured(env)) return stats;

	const now = options?.now ?? new Date();
	const pending = await listMissionsAwaitingReward({
		env,
		olderThan: new Date(
			now.getTime() - BONUS_ENGINE_MISSION_RECONCILE_GRACE_MS,
		),
		limit: options?.limit ?? 25,
	});

	const byUser = new Map<string, string[]>();
	for (const row of pending) {
		byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row.missionId]);
	}

	for (const [userId, missionIds] of byUser) {
		const listResult = await fetchMissionList({ env, userId });
		if (!listResult.ok) continue;
		const missions = Array.isArray(listResult.data?.data)
			? listResult.data.data
			: [];
		const byId = new Map(
			missions.map((mission) => [missionListItemId(mission), mission]),
		);

		for (const missionId of missionIds) {
			const mission = byId.get(missionId);
			const rewards = mission ? missionRewardDefinitions(mission) : [];
			if (rewards.length !== 1) {
				console.error(
					JSON.stringify({
						tag: "bonus_engine_mission_reward_manual_review",
						userId,
						missionId,
						reason: mission
							? "ambiguous_or_missing_rewards"
							: "mission_not_listed",
						rewards,
					}),
				);
				await upsertBonusEngineMissionProgress({
					env,
					userId,
					missionId,
					progressPercentage: 100,
					completedAt: now,
					rewardJson: JSON.stringify({
						reconcile: "manual_review",
						rewards,
					}),
				});
				stats.manualReview += 1;
				continue;
			}

			const credit = await creditMissionReward({
				env,
				userId,
				missionId,
				reward: rewards,
			});
			if (credit.status === "wallet_missing") continue;
			await upsertBonusEngineMissionProgress({
				env,
				userId,
				missionId,
				progressPercentage: 100,
				completedAt: now,
				rewardJson: JSON.stringify({ ...rewards[0], reconciled: true }),
			});
			stats.reconciled += 1;
		}
	}
	return stats;
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

	const status = String(data.mission_status ?? data.status ?? "").toUpperCase();
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
	missions: BonusEngineMissionListItem[];
}): Promise<BonusEngineMissionListItem[]> {
	if (payload.missions.length === 0) return payload.missions;

	const config = getBonusEngineConfig(payload.env);
	const views = await Promise.all(
		payload.missions.map(async (mission) => {
			const missionId = missionListItemId(mission);
			if (!missionId) return { mission, view: null };
			try {
				const result = await bonusEngineAuthedRequest({
					env: payload.env,
					path: BONUS_ENGINE_PATH.MISSION_PROGRESS,
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
				// Polling only records that the engine sees the mission done;
				// `completedAt` (reward handled) is the complete callback's job.
				await upsertBonusEngineMissionProgress({
					env: payload.env,
					userId: payload.userId,
					missionId,
					progressPercentage: view.progressPercentage,
					engineCompletedAt: view.completed ? new Date() : null,
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

	const local = await listBonusEngineMissionProgressForUser({
		env: payload.env,
		userId: payload.userId,
	});
	const localById = new Map(local.map((row) => [row.missionId, row]));

	return views.map((entry) => {
		const missionId = missionListItemId(entry.mission);
		const snapshot = missionId ? localById.get(missionId) : undefined;
		if (entry.view) {
			return overlayEngineProgress({
				mission: entry.mission,
				view: entry.view,
				rewardHandled: Boolean(snapshot?.completedAt),
			});
		}
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
	rewardHandled: boolean;
}): BonusEngineMissionListItem {
	return {
		...payload.mission,
		progress_percentage: payload.view.progressPercentage,
		progress_current: payload.view.progressCurrent,
		current: payload.view.progressCurrent,
		progress_target: payload.view.progressTarget,
		target: payload.view.progressTarget,
		...(payload.view.completed
			? {
					mission_status: "COMPLETED",
					progress_percentage: 100,
					reward_status: payload.rewardHandled
						? MISSION_REWARD_STATUS.CREDITED
						: MISSION_REWARD_STATUS.PENDING,
				}
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
			? {
					mission_status: "COMPLETED",
					progress_percentage: 100,
					reward_status: payload.snapshot.completedAt
						? MISSION_REWARD_STATUS.CREDITED
						: MISSION_REWARD_STATUS.PENDING,
				}
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
