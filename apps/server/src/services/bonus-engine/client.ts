import type { CloudflareBindings } from "../../types";
import {
	BONUS_ENGINE_CONTENT_TYPE_JSON,
	BONUS_ENGINE_HEADER,
	BONUS_ENGINE_LOYALTY_PATHS_WITH_QUERY_SIGNATURE,
} from "./bonus-engine.service.constant";
import type { BonusEngineApiResult } from "./bonus-engine.service.type";
import { getBonusEngineConfig, isBonusEngineConfigured } from "./config";
import { signBonusEngineBody } from "./crypto";

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
 * Reads the vendor JSON `status` field. Bonus Engine often returns HTTP 200
 * with `{ status: 411, message: "PLAYER_NOT_FOUND" }` (and similar 4xx codes).
 */
export function readBonusEngineEnvelopeStatus(parsed: unknown): number | null {
	if (typeof parsed !== "object" || parsed === null) return null;
	if (!("status" in parsed)) return null;
	const status = (parsed as { status?: unknown }).status;
	return typeof status === "number" && Number.isFinite(status) ? status : null;
}

/**
 * True when the JSON envelope is a vendor-level failure even if HTTP was 200.
 * `success: false` or a numeric `status` of 400+ both count.
 */
export function isBonusEngineEnvelopeFailure(parsed: unknown): boolean {
	if (typeof parsed !== "object" || parsed === null) return false;
	if (
		"success" in parsed &&
		(parsed as { success?: boolean }).success === false
	) {
		return true;
	}
	const envelopeStatus = readBonusEngineEnvelopeStatus(parsed);
	return envelopeStatus !== null && envelopeStatus >= 400;
}

/**
 * True when Bonus Engine JSON 404 means "no rows". HTML/Express 404s are
 * misconfigured hosts, not empty collections.
 */
export function isBonusEngineJsonNotFound(
	result: BonusEngineApiResult<unknown>,
): boolean {
	if (result.ok || result.status !== 404) return false;
	const error = (result.error ?? "").trim();
	if (!error) return true;
	if (error.startsWith("<") || /cannot post/i.test(error)) return false;
	return !error.includes("<!DOCTYPE");
}


export function isBonusEngineUnhandledException(text?: string): boolean {
	const message = text?.trim() ?? "";
	if (!message) return false;
	return (
		/cannot read propert(?:y|ies).*(?:null|undefined)/i.test(message) ||
		/cannot set propert(?:y|ies).*(?:null|undefined)/i.test(message) ||
		/^typeerror:/i.test(message)
	);
}

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

		if (!response.ok || isBonusEngineEnvelopeFailure(parsed)) {
			return {
				ok: false,
				status:
					(readBonusEngineEnvelopeStatus(parsed) ?? response.status) || 400,
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
