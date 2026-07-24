/** UNIX timestamp in seconds (Affnook expectation). */
export function getAffnookTimestamp(date: Date = new Date()): number {
	return Math.floor(date.getTime() / 1000);
}

export function parseUserAgentMeta(userAgent?: string | null): {
	browser?: string;
	os?: string;
} {
	if (!userAgent) return {};

	let browser: string | undefined;
	if (userAgent.includes("Edg/")) browser = "Edge";
	else if (userAgent.includes("Chrome/")) browser = "Chrome";
	else if (userAgent.includes("Safari/") && !userAgent.includes("Chrome/"))
		browser = "Safari";
	else if (userAgent.includes("Firefox/")) browser = "Firefox";

	let os: string | undefined;
	if (userAgent.includes("Android")) os = "Android";
	else if (
		userAgent.includes("iPhone") ||
		userAgent.includes("iPad") ||
		userAgent.includes("iOS")
	)
		os = "iOS";
	else if (userAgent.includes("Mac OS X") || userAgent.includes("Macintosh"))
		os = "macOS";
	else if (userAgent.includes("Windows")) os = "Windows";
	else if (userAgent.includes("Linux")) os = "Linux";

	return { browser, os };
}
