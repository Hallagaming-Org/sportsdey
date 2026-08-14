import type { CloudflareBindings } from "../../types";
import { BONUS_ENGINE_PATH } from "./bonus-engine.service.constant";
import type {
	BonusEngineApiResult,
	BonusEngineLoginInput,
} from "./bonus-engine.service.type";
import { bonusEngineRequest } from "./client";
import { getBonusEngineConfig } from "./config";
import { getBonusEngineAccessToken } from "./token.service";

/**
 * Syncs a SportsDey player into Bonus Engine via merchant-attested `/login`.
 * New users are created; existing users receive balance updates.
 */
export async function loginBonusEnginePlayer(payload: {
	env: CloudflareBindings;
	player: BonusEngineLoginInput;
}): Promise<BonusEngineApiResult<unknown>> {
	const tokenResult = await getBonusEngineAccessToken(payload.env);
	if (!tokenResult.ok || !tokenResult.data) {
		return {
			ok: false,
			status: tokenResult.status,
			error: tokenResult.error ?? "Failed to obtain Bonus Engine access token",
		};
	}

	const config = getBonusEngineConfig(payload.env);
	const player = payload.player;

	return bonusEngineRequest({
		env: payload.env,
		path: BONUS_ENGINE_PATH.LOGIN,
		accessToken: tokenResult.data,
		body: {
			client_id: config.clientId,
			project_id: config.projectId,
			user_id: player.userId,
			username: player.username,
			real_wallet_balance: player.realWalletBalance,
			bonus_wallet_balance: player.bonusWalletBalance,
			deposit: player.deposit ?? 0,
			sport: player.sport ?? "all",
			currency: player.currency ?? config.currency,
			payment_provider: player.paymentProvider ?? "all",
			device_type: player.deviceType ?? "desktop",
		},
	});
}
