import type { CloudflareBindings } from "../../types";
import { getAffnookConfig } from "./config";
import type { AffnookApiResult } from "./types";

export function extractAffnookMessage(parsed: unknown, fallback: string) {
	if (typeof parsed !== "object" || parsed === null) return fallback;

	const record = parsed as {
		message?: string;
		type?: string;
		error?: string | { message?: string; code?: string };
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
	if (typeof record.type === "string" && record.type.trim()) {
		return record.type;
	}
	return fallback;
}

export async function affnookRequest<T = unknown>(
	env: CloudflareBindings,
	path: string,
	init: {
		method?: string;
		body?: unknown;
	} = {},
): Promise<AffnookApiResult<T>> {
	const { baseUrl, apiKey } = getAffnookConfig(env);
	if (!apiKey) {
		return {
			ok: false,
			status: 500,
			error: "Affnook is not configured. Set AFFNOOK_API_KEY.",
		};
	}

	try {
		const response = await fetch(`${baseUrl}${path}`, {
			method: init.method || "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": apiKey,
			},
			body: init.body === undefined ? undefined : JSON.stringify(init.body),
		});

		const text = await response.text();
		let parsed: unknown = undefined;
		if (text) {
			try {
				parsed = JSON.parse(text);
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
				error: extractAffnookMessage(
					parsed,
					text || `Affnook request failed (${response.status})`,
				),
				data: parsed as T,
			};
		}

		return {
			ok: true,
			status: response.status,
			data: parsed as T,
			message: extractAffnookMessage(parsed, ""),
		};
	} catch (error) {
		return {
			ok: false,
			status: 500,
			error:
				error instanceof Error ? error.message : "Affnook request failed",
		};
	}
}
