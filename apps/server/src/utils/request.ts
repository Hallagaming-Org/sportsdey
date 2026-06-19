import type { Context } from "hono";

export function getClientIp(c: Context): string {
	return (
		c.req.header("cf-connecting-ip") ||
		c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
		""
	);
}

export function getDeviceInfo(userAgent: string): string {
	const ua = userAgent.toLowerCase();
	let browser = "Unknown";
	let os = "Unknown";

	if (ua.includes("chrome") && !ua.includes("edg") && !ua.includes("opr")) {
		browser = "Chrome";
	} else if (ua.includes("safari") && !ua.includes("chrome")) {
		browser = "Safari";
	} else if (ua.includes("firefox")) {
		browser = "Firefox";
	} else if (ua.includes("edg")) {
		browser = "Edge";
	} else if (ua.includes("opr") || ua.includes("opera")) {
		browser = "Opera";
	} else if (ua.includes("msie") || ua.includes("trident")) {
		browser = "Internet Explorer";
	}

	if (ua.includes("windows")) {
		os = "Windows";
	} else if (ua.includes("mac os") || ua.includes("macintosh")) {
		os = "macOS";
	} else if (ua.includes("linux") && !ua.includes("android")) {
		os = "Linux";
	} else if (ua.includes("android")) {
		os = "Android";
	} else if (ua.includes("ios") || (ua.includes("iphone") || ua.includes("ipad"))) {
		os = "iOS";
	}

	return `${browser} on ${os}`;
}

export function getLocation(c: Context): string {
	const country = c.req.header("cf-ipcountry") || "";
	const city = c.req.header("cf-city") || "";
	if (city && country) return `${city}, ${country}`;
	if (country) return country;
	return "";
}

export function getTransactionChannel(userAgent: string): string {
	const ua = userAgent.toLowerCase();
	if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
		return "Mobile App";
	}
	return "Web Platform";
}