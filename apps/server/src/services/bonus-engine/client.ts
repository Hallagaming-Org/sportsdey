import type { CloudflareBindings } from "../../types";
import {
	BONUS_ENGINE_CONTENT_TYPE_JSON,
	BONUS_ENGINE_HEADER,
	BONUS_ENGINE_LOYALTY_PATHS_WITH_QUERY_SIGNATURE,
} from "./bonus-engine.service.constant";
import type { BonusEngineApiResult } from "./bonus-engine.service.type";
import { getBonusEngineConfig, isBonusEngineConfigured } from "./config";
import { signBonusEngineBody } from "./crypto";

/**
 * Extracts a human-readable message from Bonus Engine JSON error bodies.
 */
export function extractBonusEngineMessage(
	parsed: unknown,
	fallback: string,
): string {
	if (typeof parsed !== "object" || parsed === null) return fallback;

	const record = parsed as {
		message?: string;
		error?: string | { message?: string };
	};

	if (typeof record.error === "object" && record.error?.message?.trim()) {
		return record.error.message;
	}
	if (typeof record.error === "string" && record.error.trim()) {
		return record.error;
	}
	if (typeof record.message === "string" && record.message.trim()) {
		return record.message;
	}
	return fallback;
}

/**
 * Sends a signed JSON POST to Bonus Engine.
 * Serializes the body once, signs those exact bytes, and sends the same string.
 * Optionally attaches a JWT `Token` header for feature routes.
 */
export async function bonusEngineRequest<T = unknown>(payload: {
	env: CloudflareBindings;
	path: string;
	body: Record<string, unknown>;
	accessToken?: string;
}): Promise<BonusEngineApiResult<T>> {
	if (!isBonusEngineConfigured(payload.env)) {
		return {
			ok: false,
			status: 503,
			error:
				"Bonus Engine is not configured. Set BONUS_ENGINE_CLIENT_ID, PROJECT_ID, CLIENT_SECRET, and PRIVATE_KEY.",
		};
	}

	const config = getBonusEngineConfig(payload.env);
	const bodyString = JSON.stringify(payload.body);

	try {
		const signature = await signBonusEngineBody({
			privateKeyPem: config.privateKeyPem,
			bodyString,
		});

		const headers: Record<string, string> = {
			[BONUS_ENGINE_HEADER.CONTENT_TYPE]: BONUS_ENGINE_CONTENT_TYPE_JSON,
			[BONUS_ENGINE_HEADER.SIGNATURE]: signature,
		};
		if (payload.accessToken) {
			headers[BONUS_ENGINE_HEADER.TOKEN] = payload.accessToken;
		}

		const url = new URL(`${config.baseUrl}${payload.path}`);
		if (BONUS_ENGINE_LOYALTY_PATHS_WITH_QUERY_SIGNATURE.has(payload.path)) {
			url.searchParams.set("signature", signature);
		}

		const response = await fetch(url.toString(), {
			method: "POST",
			headers,
			body: bodyString,
		});

		const text = await response.text();
		let parsed: unknown;
		if (text) {
			try {
				parsed = JSON.parse(text) as unknown;
			} catch {
				parsed = text;
			}
		}

		const successFlag =
			typeof parsed === "object" && parsed !== null && "success" in parsed
				? Boolean((parsed as { success?: boolean }).success)
				: undefined;

		if (!response.ok || successFlag === false) {
			return {
				ok: false,
				status: response.status || 400,
				error: extractBonusEngineMessage(
					parsed,
					text || `Bonus Engine request failed (${response.status})`,
				),
				data: parsed as T,
			};
		}

		return {
			ok: true,
			status: response.status,
			data: parsed as T,
			message: extractBonusEngineMessage(parsed, ""),
		};
	} catch (error) {
		return {
			ok: false,
			status: 500,
			error:
				error instanceof Error
					? error.message
					: "Bonus Engine request failed",
		};
	}
}
