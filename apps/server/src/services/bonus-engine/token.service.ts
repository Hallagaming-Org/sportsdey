import type { CloudflareBindings } from "../../types";
import {
	BONUS_ENGINE_PATH,
	BONUS_ENGINE_TOKEN_CACHE_KEY_PREFIX,
	BONUS_ENGINE_TOKEN_CACHE_TTL_SECONDS,
} from "./bonus-engine.service.constant";
import type {
	BonusEngineAccessTokenResponse,
	BonusEngineApiResult,
} from "./bonus-engine.service.type";
import { bonusEngineRequest, extractBonusEngineMessage } from "./client";
import { getBonusEngineConfig } from "./config";

/**
 * Returns a cached or freshly minted Bonus Engine access token JWT.
 * Tokens are cached in KV when available; otherwise fetched every call.
 */
export async function getBonusEngineAccessToken(
	env: CloudflareBindings,
): Promise<BonusEngineApiResult<string>> {
	const config = getBonusEngineConfig(env);
	const cacheKey = `${BONUS_ENGINE_TOKEN_CACHE_KEY_PREFIX}:${config.projectId}`;
	const kv = getBonusEngineKv(env);

	if (kv) {
		const cached = await kv.get(cacheKey);
		if (cached?.trim()) {
			return { ok: true, status: 200, data: cached };
		}
	}

	const result = await bonusEngineRequest<BonusEngineAccessTokenResponse>({
		env,
		path: BONUS_ENGINE_PATH.ACCESS_TOKEN,
		body: {
			client_id: config.clientId,
			project_id: config.projectId,
			client_secret: config.clientSecret,
		},
	});

	if (!result.ok) {
		return {
			ok: false,
			status: result.status,
			error: result.error,
			data: undefined,
		};
	}

	const token =
		result.data?.token?.trim() || result.data?.accessToken?.trim() || "";
	if (!token) {
		return {
			ok: false,
			status: 502,
			error: extractBonusEngineMessage(
				result.data,
				"Bonus Engine access token missing in response",
			),
		};
	}

	if (kv) {
		await kv.put(cacheKey, token, {
			expirationTtl: BONUS_ENGINE_TOKEN_CACHE_TTL_SECONDS,
		});
	}

	return { ok: true, status: result.status, data: token, message: result.message };
}

function getBonusEngineKv(env: CloudflareBindings) {
	return env.sportsdey_ns || env.staging_kv || null;
}
