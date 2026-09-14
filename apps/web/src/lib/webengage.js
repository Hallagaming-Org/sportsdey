const Webengage = () => {
    if (typeof window === "undefined" || !window.webengage)
        return null;
    return window.webengage;
};
export function loginWebengageUser(userId) {
    Webengage()?.user.login(userId);
}
export function logoutWebengageUser() {
    Webengage()?.user.logout();
}
export function trackWebengageLoginInitiated(type) {
    trackWebengageEvent("User Login Initiated", { Type: type });
}
export function webengagePageReferrer() {
    if (typeof document === "undefined")
        return "";
    return document.referrer || "";
}
export function toWebengageTimestamp(value) {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? undefined : value;
    }
    if (!value || typeof value !== "string")
        return undefined;
    const trimmed = value.trim();
    if (!trimmed)
        return undefined;
    const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (isoDate) {
        const parsed = new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]));
        return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }
    // DD/MM/YYYY or DD-MM-YYYY, optional time (HH:mm or HH:mm:ss)
    const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(trimmed);
    if (dmy) {
        const parsed = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), dmy[4] != null ? Number(dmy[4]) : 0, dmy[5] != null ? Number(dmy[5]) : 0, dmy[6] != null ? Number(dmy[6]) : 0);
        return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }
    // YYYY-MM-DD HH:mm[:ss]
    const ymdTime = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(trimmed);
    if (ymdTime) {
        const parsed = new Date(Number(ymdTime[1]), Number(ymdTime[2]) - 1, Number(ymdTime[3]), Number(ymdTime[4]), Number(ymdTime[5]), ymdTime[6] != null ? Number(ymdTime[6]) : 0);
        return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
export function compactWebengageAttrs(attributes) {
    const compact = {};
    for (const [key, value] of Object.entries(attributes)) {
        if (value === "" || value === undefined || value === null)
            continue;
        compact[key] = value;
    }
    return compact;
}
export function matchWebengageAttrs(input) {
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
export function setWebengageUserAttribute(attribute, value) {
    Webengage()?.user.setAttribute(attribute, value);
}
export function setWebengageUserAttributes(attributes) {
    const we = Webengage();
    if (!we)
        return;
    for (const [key, value] of Object.entries(compactWebengageAttrs(attributes))) {
        we.user.setAttribute(key, value);
    }
}
export function setWebengageSdkUserProfile(input) {
    const dateOfBirth = toWebengageTimestamp(input.dateOfBirth);
    const language = input.preferredLanguage?.trim() ||
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
function serializeEventData(attributes) {
    if (!attributes)
        return undefined;
    const data = {};
    for (const [key, value] of Object.entries(attributes)) {
        if (value instanceof Date) {
            data[key] = value.toISOString();
            continue;
        }
        data[key] = value;
    }
    return data;
}
async function postWebengageApiEvent(eventName, attributes) {
    if (!WEBENGAGE_API_EVENTS.has(eventName))
        return;
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
    }
    catch {
        // Website SDK still fired; API delivery must not break the page.
    }
}
export function trackWebengageEvent(eventName, attributes) {
    const compact = attributes ? compactWebengageAttrs(attributes) : undefined;
    Webengage()?.track(eventName, compact);
    void postWebengageApiEvent(eventName, compact);
}
