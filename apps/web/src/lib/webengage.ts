declare global {
	interface Window {
		webengage?: {
			init: (licenseKey: string) => void;
			track: (name: string, attributes?: Record<string, unknown>) => void;
			user: {
				login: (userId: string) => void;
				logout: () => void;
				setAttribute: (attribute: string, value: unknown) => void;
			};
		};
	}
}

const Webengage = () => {
	if (typeof window === "undefined" || !window.webengage) return null;
	return window.webengage;
};

export function loginWebengageUser(userId: string) {
	Webengage()?.user.login(userId);
}

export function logoutWebengageUser() {
	Webengage()?.user.logout();
}

export function trackWebengageLoginInitiated(type: string) {
	trackWebengageEvent("User Login Initiated", { Type: type });
}

export function webengagePageReferrer(): string {
	if (typeof document === "undefined") return "";
	return document.referrer || "";
}

export function toWebengageTimestamp(
	value: string | Date | null | undefined,
): Date | undefined {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? undefined : value;
	}
	if (!value || typeof value !== "string") return undefined;
	const trimmed = value.trim();
	const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
	if (iso) {
		const parsed = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
		return Number.isNaN(parsed.getTime()) ? undefined : parsed;
	}
	const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
	if (dmy) {
		const parsed = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
		return Number.isNaN(parsed.getTime()) ? undefined : parsed;
	}
	const parsed = new Date(trimmed);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function compactWebengageAttrs(
	attributes: Record<string, unknown>,
): Record<string, unknown> {
	const compact: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(attributes)) {
		if (value === "" || value === undefined || value === null) continue;
		compact[key] = value;
	}
	return compact;
}

export function matchWebengageAttrs(input: {
	match_id: string;
	sport: string;
	league?: string;
	teams: string;
	timings?: string | Date | null;
	match_status?: string;
	match_score?: string;
	match_time?: string;
}) {
	return {
		match_id: input.match_id,
		sport: input.sport,
		league: input.league,
		teams: input.teams,
		timings: toWebengageTimestamp(input.timings),
		match_status: input.match_status,
		match_score: input.match_score,
		match_time: input.match_time,
		referrer: webengagePageReferrer(),
	};
}

export function setWebengageUserAttribute(attribute: string, value: unknown) {
	Webengage()?.user.setAttribute(attribute, value);
}

export function setWebengageUserAttributes(
	attributes: Record<string, unknown>,
) {
	const we = Webengage();
	if (!we) return;
	for (const [key, value] of Object.entries(
		compactWebengageAttrs(attributes),
	)) {
		we.user.setAttribute(key, value);
	}
}

export function setWebengageSdkUserProfile(input: {
	email?: string | null;
	firstName?: string | null;
	lastName?: string | null;
	phone?: string | null;
	dateOfBirth?: string | Date | null;
	preferredLanguage?: string | null;
}) {
	const dateOfBirth = toWebengageTimestamp(input.dateOfBirth);
	const language =
		input.preferredLanguage?.trim() ||
		(typeof navigator !== "undefined" ? navigator.language : "") ||
		"en";
	setWebengageUserAttributes({
		we_email: input.email,
		we_first_name: input.firstName,
		we_last_name: input.lastName,
		we_phone: input.phone,
		we_birth_date: dateOfBirth,
		date_of_birth: dateOfBirth,
		preferred_language: language,
	});
}

const WEBENGAGE_API_EVENTS = new Set([
	"Match viewed",
	"Match Added to Favourite",
	"Match Removed from Favourite",
]);

function serializeEventData(
	attributes?: Record<string, unknown>,
): Record<string, unknown> | undefined {
	if (!attributes) return undefined;
	const data: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(attributes)) {
		if (value instanceof Date) {
			data[key] = value.toISOString();
			continue;
		}
		data[key] = value;
	}
	return data;
}

async function postWebengageApiEvent(
	eventName: string,
	attributes?: Record<string, unknown>,
) {
	if (!WEBENGAGE_API_EVENTS.has(eventName)) return;
	try {
		const { apiRequest } = await import("@/lib/api");
		await apiRequest("webengage/events", {
			method: "POST",
			credentials: "include",
			body: JSON.stringify({
				eventName,
				eventData: serializeEventData(attributes),
			}),
		});
	} catch {
		// Website SDK still fired; API delivery must not break the page.
	}
}

export function trackWebengageEvent(
	eventName: string,
	attributes?: Record<string, unknown>,
) {
	const compact = attributes ? compactWebengageAttrs(attributes) : undefined;
	Webengage()?.track(eventName, compact);
	void postWebengageApiEvent(eventName, compact);
}
