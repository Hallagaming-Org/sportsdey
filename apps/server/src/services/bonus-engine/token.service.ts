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
 * `forceRefresh` skips the cache (after the engine rejected a cached token).
 */
export async function getBonusEngineAccessToken(
	env: CloudflareBindings,
	options?: { forceRefresh?: boolean },
): Promise<BonusEngineApiResult<string>> {
	const config = getBonusEngineConfig(env);
	const cacheKey = bonusEngineTokenCacheKey(config.projectId);
	const kv = getBonusEngineKv(env);

	if (kv && !options?.forceRefresh) {
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

	return {
		ok: true,
		status: result.status,
		data: token,
		message: result.message,
	};
}

/**
 * Signed, token-authenticated call to a Bonus Engine feature route. A cached
 * token the engine rejects (revoked, rotated, expired early) is dropped and
 * the call retried once with a fresh one, instead of failing every request
 * until the cache entry expires.
 */
export async function bonusEngineAuthedRequest<T = unknown>(payload: {
	env: CloudflareBindings;
	path: string;
	body: Record<string, unknown>;
}): Promise<BonusEngineApiResult<T>> {
	const tokenResult = await getBonusEngineAccessToken(payload.env);
	if (!tokenResult.ok || !tokenResult.data) {
		return tokenFailure(tokenResult);
	}

	const result = await bonusEngineRequest<T>({
		...payload,
		accessToken: tokenResult.data,
	});
	if (!isBonusEngineTokenRejected(result)) return result;

	console.warn("Bonus Engine rejected cached access token; refreshing", {
		path: payload.path,
		status: result.status,
		error: result.error,
	});
	await invalidateBonusEngineAccessToken(payload.env);
	const fresh = await getBonusEngineAccessToken(payload.env, {
		forceRefresh: true,
	});
	if (!fresh.ok || !fresh.data) return result;
	return bonusEngineRequest<T>({ ...payload, accessToken: fresh.data });
}

/**
 * True when the engine refused the access token rather than the request.
 * A bare 413 INVALID_SIGNATURE is a key problem a new token cannot fix.
 */
export function isBonusEngineTokenRejected(
	result: BonusEngineApiResult<unknown>,
): boolean {
	if (result.ok) return false;
	if (result.status === 401 || result.status === 403) return true;
	const text = `${result.error ?? ""} ${result.message ?? ""}`.toLowerCase();
	return /\b(token|jwt)\b|unauthori[sz]ed/.test(text);
}

function tokenFailure<T>(
	tokenResult: BonusEngineApiResult<string>,
): BonusEngineApiResult<T> {
	return {
		ok: false,
		status: tokenResult.status,
		error: tokenResult.error ?? "Failed to obtain Bonus Engine access token",
	};
}

/** Drops the cached token so the next call mints a fresh one. */
export async function invalidateBonusEngineAccessToken(
	env: CloudflareBindings,
): Promise<void> {
	const kv = getBonusEngineKv(env);
	if (!kv) return;
	try {
		await kv.delete(
			bonusEngineTokenCacheKey(getBonusEngineConfig(env).projectId),
		);
	} catch (error) {
		console.error("Bonus Engine token cache invalidation failed", { error });
	}
}

function bonusEngineTokenCacheKey(projectId: string): string {
	return `${BONUS_ENGINE_TOKEN_CACHE_KEY_PREFIX}:${projectId}`;
}

/**
 * Production binds `sportsdey_ns`; staging binds `staging-kv`, which is only
 * reachable by index (`env.staging_kv` is always undefined).
 */
export function getBonusEngineKv(env: CloudflareBindings) {
	const bindings = env as unknown as Record<
		string,
		KVNamespaceLike | undefined
	>;
	return (
		env.sportsdey_ns || bindings["staging-kv"] || bindings.staging_kv || null
	);
}

type KVNamespaceLike = CloudflareBindings["sportsdey_ns"];
