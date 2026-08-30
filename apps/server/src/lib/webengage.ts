import type { ExecutionContext } from "hono";
import {
	buildWebengageUserPayload,
	compactEventData,
} from "@/utils/webengage-event";
import type { CloudflareBindings } from "../types";

function getConfig(env: CloudflareBindings) {
	return {
		apiKey: env.WEBENGAGE_API_KEY,
		licenseCode: env.WEBENGAGE_LICENSE_CODE,
		host: env.WEBENGAGE_HOST,
	};
}

function hasWebengageConfig(env: CloudflareBindings) {
	const { apiKey, licenseCode, host } = getConfig(env);
	return Boolean(apiKey && licenseCode && host);
}

function postWebengage(
	env: CloudflareBindings,
	path: "events" | "users",
	payload: Record<string, unknown>,
	label: string,
	executionCtx?: ExecutionContext,
) {
	const { apiKey, licenseCode, host } = getConfig(env);
	if (!apiKey || !licenseCode || !host) {
		console.error("WebEngage skipped: missing API config", {
			path,
			label,
			hasApiKey: Boolean(apiKey),
			hasLicenseCode: Boolean(licenseCode),
			hasHost: Boolean(host),
		});
		return;
	}

	const promise = fetch(`${host}/v1/accounts/${licenseCode}/${path}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify(payload),
	})
		.then(async (res) => {
			const text = await res.text();
			if (!res.ok) {
				console.error("WebEngage error:", path, label, res.status, text);
				return;
			}
			console.log("WebEngage ok:", path, label, res.status);
		})
		.catch((e) => console.error("WebEngage error:", path, label, e));

	if (executionCtx && typeof executionCtx.waitUntil === "function") {
		executionCtx.waitUntil(promise);
	} else {
		promise.catch(() => {});
	}
}

export function trackWebengageEvent(
	env: CloudflareBindings,
	params: {
		userId: string;
		eventName: string;
		eventTime?: string;
		eventData?: Record<string, unknown>;
	},
	executionCtx?: ExecutionContext,
) {
	if (!hasWebengageConfig(env)) {
		console.error("WebEngage event skipped: missing API config", {
			eventName: params.eventName,
			userId: params.userId,
		});
		return;
	}

	const { userId, eventName, eventTime, eventData } = params;
	const payload: Record<string, unknown> = { userId, eventName };
	if (eventTime) payload.eventTime = eventTime;
	if (eventData) {
		const compact = compactEventData(eventData);
		if (Object.keys(compact).length > 0) payload.eventData = compact;
	}

	postWebengage(env, "events", payload, eventName, executionCtx);
}

export function setWebengageUserAttributes(
	env: CloudflareBindings,
	params: {
		userId: string;
		email?: string;
		firstName?: string;
		lastName?: string;
		phone?: string;
		[key: string]: unknown;
	},
	executionCtx?: ExecutionContext,
) {
	if (!hasWebengageConfig(env)) {
		console.error("WebEngage user skipped: missing API config", {
			userId: params.userId,
		});
		return;
	}

	postWebengage(
		env,
		"users",
		buildWebengageUserPayload(params),
		params.userId,
		executionCtx,
	);
}
