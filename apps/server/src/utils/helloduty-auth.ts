export function parseHellodutyAllowedIps(raw?: string): string[] {
	if (!raw?.trim() || raw.trim() === "off" || raw.trim() === "*") return [];
	return raw
		.split(",")
		.map((ip) => ip.trim())
		.filter(Boolean);
}

export function isHellodutyCallbackIpAllowed(
	clientIp: string,
	allowedIps: string[],
): boolean {
	if (allowedIps.length === 0) return false;
	if (!clientIp) return false;
	return allowedIps.includes(clientIp);
}

/**
 * HelloDuty authenticates by source IP. Requests must come from
 * HELLODUTY_ALLOWED_IPS (cf-connecting-ip).
 */
export function authorizeHellodutyRequest(opts: {
	clientIp: string;
	allowedIpsRaw?: string;
}): "ok" | "unconfigured" | "forbidden" {
	const allowedIps = parseHellodutyAllowedIps(opts.allowedIpsRaw);
	if (allowedIps.length === 0) return "unconfigured";
	if (isHellodutyCallbackIpAllowed(opts.clientIp, allowedIps)) return "ok";
	return "forbidden";
}
