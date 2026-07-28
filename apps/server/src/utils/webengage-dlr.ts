/**
 * WebEngage Private SSP delivery-status relay helpers.
 *
 * Flow: at send time we persist {AT messageId -> WebEngage messageId} in KV;
 * when Africa's Talking POSTs a delivery report we look the mapping up and
 * forward a DSN to WebEngage's webhook URL (WEBENGAGE_DSN_URL).
 *
 * Kept free of Hono imports so it is testable standalone (same pattern as
 * webengage-sms-auth.ts).
 */

import type { CloudflareBindings } from "../types";
import { fetchWithTimeout, isTimeoutError } from "./fetch-with-timeout";

/** KVNamespace is not a global type here; derive it from the binding. */
export type SmsKvNamespace = CloudflareBindings["sportsdey_ns"];

/**
 * AT delivery reports can trail a send by up to the SMS validity period
 * (72h per Africa's Talking); keep mappings a little longer to be safe.
 */
export const SMS_MAPPING_TTL_SECONDS = 96 * 60 * 60;

const WEBENGAGE_DSN_TIMEOUT_MS = 10_000;

export type WebengageSmsMapping = {
	weMessageId: string;
	toNumber: string;
	version: string;
};

export function smsMappingKey(atMessageId: string): string {
	return `we-sms:map:${atMessageId}`;
}

export function dsnSentKey(atMessageId: string): string {
	return `we-sms:dsn-sent:${atMessageId}`;
}

/** Same KV fallback chain used by news/football/basketball routes. */
export function getSmsKv(env: CloudflareBindings): SmsKvNamespace | null {
	return (
		env.sportsdey_ns ||
		env.staging_kv ||
		(env as unknown as Record<string, SmsKvNamespace | undefined>)[
			"staging-kv"
		] ||
		null
	);
}

export async function storeWebengageSmsMapping(
	kv: SmsKvNamespace,
	atMessageId: string,
	mapping: WebengageSmsMapping,
): Promise<void> {
	await kv.put(smsMappingKey(atMessageId), JSON.stringify(mapping), {
		expirationTtl: SMS_MAPPING_TTL_SECONDS,
	});
}

export async function getWebengageSmsMapping(
	kv: SmsKvNamespace,
	atMessageId: string,
): Promise<WebengageSmsMapping | null> {
	const raw = await kv.get(smsMappingKey(atMessageId), "json");
	if (!raw || typeof raw !== "object") return null;
	const record = raw as Partial<WebengageSmsMapping>;
	if (!record.weMessageId || !record.toNumber) return null;
	return {
		weMessageId: record.weMessageId,
		toNumber: record.toNumber,
		version: record.version || "1.0",
	};
}

/**
 * Africa's Talking delivery report (POSTed form-urlencoded to the callback
 * URL configured in the AT dashboard). Field names per AT docs:
 * id, status, phoneNumber, networkCode, failureReason, retryCount.
 */
export type AfricaTalkingDeliveryReport = {
	id: string;
	status: string;
	phoneNumber?: string;
	networkCode?: string;
	failureReason?: string;
	retryCount?: string;
};

export function parseAtDeliveryReport(
	form: Record<string, unknown>,
): AfricaTalkingDeliveryReport | null {
	const id = typeof form.id === "string" ? form.id.trim() : "";
	const status = typeof form.status === "string" ? form.status.trim() : "";
	if (!id || !status) return null;
	return {
		id,
		status,
		phoneNumber:
			typeof form.phoneNumber === "string" ? form.phoneNumber : undefined,
		networkCode:
			typeof form.networkCode === "string" ? form.networkCode : undefined,
		failureReason:
			typeof form.failureReason === "string" && form.failureReason.trim()
				? form.failureReason
				: undefined,
		retryCount:
			typeof form.retryCount === "string" ? form.retryCount : undefined,
	};
}

/** AT statuses that will never be followed by another report. */
const AT_FINAL_SUCCESS_STATUSES = new Set(["success"]);
const AT_FINAL_FAILURE_STATUSES = new Set(["failed", "rejected"]);

export function isFinalAtStatus(status: string): boolean {
	const s = status.toLowerCase();
	return AT_FINAL_SUCCESS_STATUSES.has(s) || AT_FINAL_FAILURE_STATUSES.has(s);
}

/**
 * DSN payload in WebEngage's documented Private SSP shape.
 * status is restricted to sms_sent | sms_failed and statusCode to
 * WebEngage's documented table (0 = success, 2009 = not delivered by the
 * mobile network operator).
 */
export type WebengageDsnPayload = {
	version: string;
	messageId: string;
	toNumber: string;
	status: "sms_sent" | "sms_failed";
	statusCode: number;
	message?: string;
};

export function buildWebengageDsn(
	report: AfricaTalkingDeliveryReport,
	mapping: WebengageSmsMapping,
): WebengageDsnPayload | null {
	const status = report.status.toLowerCase();
	if (AT_FINAL_SUCCESS_STATUSES.has(status)) {
		return {
			version: mapping.version,
			messageId: mapping.weMessageId,
			toNumber: mapping.toNumber,
			status: "sms_sent",
			statusCode: 0,
		};
	}
	if (AT_FINAL_FAILURE_STATUSES.has(status)) {
		return {
			version: mapping.version,
			messageId: mapping.weMessageId,
			toNumber: mapping.toNumber,
			status: "sms_failed",
			statusCode: 2009,
			message:
				report.failureReason ||
				`The message was not delivered by the mobile network operator (${report.status})`,
		};
	}
	// Intermediate statuses (Sent, Submitted, Buffered, Queued): a final
	// report follows, so no DSN yet.
	return null;
}

export type WebengageDsnResult = {
	ok: boolean;
	status: number;
	error?: string;
};

export async function sendWebengageDsn(
	dsnUrl: string,
	payload: WebengageDsnPayload,
): Promise<WebengageDsnResult> {
	let response: Response;
	try {
		response = await fetchWithTimeout(
			dsnUrl,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			},
			WEBENGAGE_DSN_TIMEOUT_MS,
		);
	} catch (error) {
		const timedOut = isTimeoutError(error);
		return {
			ok: false,
			status: timedOut ? 504 : 502,
			error: timedOut
				? "WebEngage DSN request timed out"
				: error instanceof Error
					? error.message
					: "WebEngage DSN request failed",
		};
	}

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		return {
			ok: false,
			status: response.status,
			error: text.trim() || `WebEngage DSN rejected (${response.status})`,
		};
	}
	return { ok: true, status: response.status };
}
