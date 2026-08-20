import type { CloudflareBindings } from "../../types";
import { BONUS_ENGINE_PATH } from "./bonus-engine.service.constant";
import type {
	BonusEngineApiResult,
	BonusEngineMissionListItem,
} from "./bonus-engine.service.type";
import { bonusEngineRequest } from "./client";
import { getBonusEngineConfig } from "./config";
import { getBonusEngineAccessToken } from "./token.service";

type BonusEngineMissionListEnvelope = {
	status?: number;
	message?: string;
	data?: BonusEngineMissionListItem[];
};

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
	return bonusEngineRequest<BonusEngineMissionListEnvelope>({
		env: payload.env,
		path: BONUS_ENGINE_PATH.MISSION_LIST,
		accessToken: tokenResult.data,
		body: {
			client_id: config.clientId,
			project_id: config.projectId,
			user_id: payload.userId,
		},
	});
}
