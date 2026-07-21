import type { ExecutionContext } from "hono";
import type { CloudflareBindings } from "../types";

function getConfig(env: CloudflareBindings) {
	return {
		apiKey: env.WEBENGAGE_API_KEY,
		licenseCode: env.WEBENGAGE_LICENSE_CODE,
		host: env.WEBENGAGE_HOST,
	};
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
	const { apiKey, licenseCode, host } = getConfig(env);
	if (!apiKey || !licenseCode || !host) return;

	const { userId, eventName, eventTime, eventData } = params;
	const payload: Record<string, unknown> = { userId, eventName };
	if (eventTime) payload.eventTime = eventTime;
	if (eventData) payload.eventData = eventData;

	const promise = fetch(
		`${host}/v1/accounts/${licenseCode}/events`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(payload),
		},
	)
		.then(async (res) => {
			if (!res.ok) {
				const text = await res.text();
				console.error("WebEngage event error:", res.status, text);
			}
		})
		.catch((e) => console.error("WebEngage event error:", e));

	if (executionCtx && typeof executionCtx.waitUntil === "function") {
		executionCtx.waitUntil(promise);
	} else {
		promise.catch(() => {});
	}
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
	const { apiKey, licenseCode, host } = getConfig(env);
	if (!apiKey || !licenseCode || !host) return;

	const { userId, email, firstName, lastName, phone, ...custom } = params;
	const payload: Record<string, unknown> = { userId };
	if (email) payload.email = email;
	if (firstName) payload.firstName = firstName;
	if (lastName) payload.lastName = lastName;
	if (phone) payload.phone = phone;
	for (const [key, value] of Object.entries(custom)) {
		payload[key] = value;
	}

	const promise = fetch(
		`${host}/v1/accounts/${licenseCode}/users`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(payload),
		},
	)
		.then(async (res) => {
			if (!res.ok) {
				const text = await res.text();
				console.error("WebEngage user error:", res.status, text);
			}
		})
		.catch((e) => console.error("WebEngage user error:", e));

	if (executionCtx && typeof executionCtx.waitUntil === "function") {
		executionCtx.waitUntil(promise);
	} else {
		promise.catch(() => {});
	}
}
