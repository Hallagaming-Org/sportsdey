export function asEventNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim()) {
		const parsed = Number.parseFloat(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

export function compactEventData(
	data: Record<string, unknown>,
): Record<string, unknown> {
	const compact: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(data)) {
		if (value === "" || value === undefined || value === null) continue;
		compact[key] = value;
	}
	return compact;
}

export const WEBENGAGE_BROWSER_API_EVENTS = [
	"Match viewed",
	"Match Added to Favourite",
	"Match Removed from Favourite",
] as const;

export type WebengageBrowserApiEvent =
	(typeof WEBENGAGE_BROWSER_API_EVENTS)[number];

export function isWebengageBrowserApiEvent(
	eventName: string,
): eventName is WebengageBrowserApiEvent {
	return (WEBENGAGE_BROWSER_API_EVENTS as readonly string[]).includes(
		eventName,
	);
}

export function buildWebengageUserPayload(params: {
	userId: string;
	email?: string;
	firstName?: string;
	lastName?: string;
	phone?: string;
	[key: string]: unknown;
}): Record<string, unknown> {
	const { userId, email, firstName, lastName, phone, ...custom } = params;
	const payload: Record<string, unknown> = { userId };
	if (email) payload.email = email;
	if (firstName) payload.firstName = firstName;
	if (lastName) payload.lastName = lastName;
	if (phone) payload.phone = phone;
	const customAttributes: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(custom)) {
		if (value !== undefined) customAttributes[key] = value;
	}
	if (Object.keys(customAttributes).length > 0) {
		payload.attributes = customAttributes;
	}
	return payload;
}
