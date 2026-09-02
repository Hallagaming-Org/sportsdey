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

/** WebEngage Users API birthDate / sheet `date_of_birth` as YYYY-MM-DD. */
export function toWebengageBirthDate(
	value: string | Date | null | undefined,
): string | undefined {
	if (!value) return undefined;
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) return undefined;
		const y = value.getUTCFullYear();
		const m = String(value.getUTCMonth() + 1).padStart(2, "0");
		const d = String(value.getUTCDate()).padStart(2, "0");
		return `${y}-${m}-${d}`;
	}
	const trimmed = value.trim();
	const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
	if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
	const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(trimmed);
	if (dmy) {
		const day = dmy[1].padStart(2, "0");
		const month = dmy[2].padStart(2, "0");
		return `${dmy[3]}-${month}-${day}`;
	}
	const parsed = new Date(trimmed);
	if (Number.isNaN(parsed.getTime())) return undefined;
	return toWebengageBirthDate(parsed);
}

export function buildWebengageUserPayload(params: {
	userId: string;
	email?: string;
	firstName?: string;
	lastName?: string;
	phone?: string;
	birthDate?: string;
	date_of_birth?: string;
	[key: string]: unknown;
}): Record<string, unknown> {
	const {
		userId,
		email,
		firstName,
		lastName,
		phone,
		birthDate,
		date_of_birth,
		...custom
	} = params;
	const payload: Record<string, unknown> = { userId };
	if (email) payload.email = email;
	if (firstName) payload.firstName = firstName;
	if (lastName) payload.lastName = lastName;
	if (phone) payload.phone = phone;
	const resolvedBirth =
		toWebengageBirthDate(birthDate) || toWebengageBirthDate(date_of_birth);
	if (resolvedBirth) payload.birthDate = resolvedBirth;
	const customAttributes: Record<string, unknown> = {};
	if (resolvedBirth) {
		customAttributes.date_of_birth = resolvedBirth;
	}
	for (const [key, value] of Object.entries(custom)) {
		if (value !== undefined) customAttributes[key] = value;
	}
	if (Object.keys(customAttributes).length > 0) {
		payload.attributes = customAttributes;
	}
	return payload;
}
