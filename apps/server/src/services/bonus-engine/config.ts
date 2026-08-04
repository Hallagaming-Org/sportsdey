import type { CloudflareBindings } from "../../types";
import {
	BONUS_ENGINE_DEFAULT_BASE_URL,
	BONUS_ENGINE_DEFAULT_CURRENCY,
} from "./bonus-engine.service.constant";
import type { BonusEngineConfig } from "./bonus-engine.service.type";

/**
 * Maps Cloudflare env bindings into a Bonus Engine merchant adapter config.
 * Empty strings are preserved so callers can surface clear misconfiguration errors.
 */
export function getBonusEngineConfig(env: CloudflareBindings): BonusEngineConfig {
	return {
		baseUrl: (env.BONUS_ENGINE_BASE_URL || BONUS_ENGINE_DEFAULT_BASE_URL).replace(
			/\/$/,
			"",
		),
		clientId: env.BONUS_ENGINE_CLIENT_ID || "",
		projectId: env.BONUS_ENGINE_PROJECT_ID || "",
		clientSecret: env.BONUS_ENGINE_CLIENT_SECRET || "",
		privateKeyPem: normalizePem(env.BONUS_ENGINE_PRIVATE_KEY || ""),
		callbackPublicKeyPem: normalizePem(
			env.BONUS_ENGINE_CALLBACK_PUBLIC_KEY || "",
		),
		currency: (env.BONUS_ENGINE_CURRENCY || BONUS_ENGINE_DEFAULT_CURRENCY).toUpperCase(),
	};
}

/**
 * Returns true when outbound auth credentials and private key are present.
 * Callback public key is checked separately for inbound webhook handlers.
 */
export function isBonusEngineConfigured(env: CloudflareBindings): boolean {
	const config = getBonusEngineConfig(env);
	return Boolean(
		config.clientId &&
			config.projectId &&
			config.clientSecret &&
			config.privateKeyPem,
	);
}

/**
 * Returns true when inbound callback signature verification can run.
 */
export function isBonusEngineCallbackVerifyConfigured(
	env: CloudflareBindings,
): boolean {
	return Boolean(getBonusEngineConfig(env).callbackPublicKeyPem);
}

/**
 * Normalizes PEM material that may arrive with escaped newlines from secrets stores.
 */
function normalizePem(value: string): string {
	return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}
