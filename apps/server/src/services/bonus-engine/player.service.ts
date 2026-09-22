import type { ExecutionContext } from "hono";
import type { CloudflareBindings } from "../../types";
import { BONUS_ENGINE_PATH } from "./bonus-engine.service.constant";
import type {
	BonusEngineApiResult,
	BonusEngineLoginInput,
} from "./bonus-engine.service.type";
import { bonusEngineRequest } from "./client";
import { getBonusEngineConfig, isBonusEngineConfigured } from "./config";
import { getBonusEngineWalletBalances } from "./persistence.service";
import { getBonusEngineAccessToken } from "./token.service";

/**
 * Syncs a SportsDey player through Bonus Engine `POST /login`.
 * Existing players get a session/balance refresh. Unknown `user_id` values
 * currently return vendor `411 PLAYER_NOT_FOUND` — this engine does not
 * upsert new players on `/login`.
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

export async function syncBonusEnginePlayerOnAppLogin(payload: {
	env: CloudflareBindings;
	userId: string;
	username: string;
}): Promise<void> {
	if (!isBonusEngineConfigured(payload.env)) return;

	try {
		const balances = await getBonusEngineWalletBalances({
			env: payload.env,
			userId: payload.userId,
		});
		const result = await loginBonusEnginePlayer({
			env: payload.env,
			player: {
				userId: payload.userId,
				username: payload.username,
				realWalletBalance: balances.realWalletBalance,
				bonusWalletBalance: balances.bonusWalletBalance,
			},
		});
		if (!result.ok) {
			console.error("Bonus Engine app-login sync failed", {
				userId: payload.userId,
				status: result.status,
				error: result.error,
			});
		}
	} catch (error: unknown) {
		console.error("Bonus Engine app-login sync error", {
			userId: payload.userId,
			error,
		});
	}
}

/**
 * Login must not wait on Bonus Engine (D1 + untimed HTTP). Use waitUntil when
 * the Worker provides it so the sync can finish after the response is sent.
 */
export function scheduleBonusEnginePlayerOnAppLogin(payload: {
	env: CloudflareBindings;
	userId: string;
	username: string;
	executionCtx?: ExecutionContext;
}): void {
	const work = syncBonusEnginePlayerOnAppLogin(payload);
	if (typeof payload.executionCtx?.waitUntil === "function") {
		payload.executionCtx.waitUntil(work);
		return;
	}
	void work;
}
