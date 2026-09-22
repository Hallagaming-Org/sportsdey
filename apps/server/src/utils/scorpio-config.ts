export type ScorpioSettings = {
	apiUrl: string;
	apiToken: string;
	callbackUrl: string;
	serverIp: string;
	allowedIps: string[];
	/** When non-empty, incoming callback IPs must match. */
	ipRestrictionEnabled: boolean;
};

export class ScorpioConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ScorpioConfigError";
	}
}

function parseAllowedIps(raw?: string): string[] {
	if (!raw?.trim()) return [];
	return raw
		.split(",")
		.map((ip) => ip.trim())
		.filter(Boolean);
}

/**
 * Load Scorpio settings from Cloudflare env / process env.
 * Accepts SCORPIO_API_URL or SCORPIO_BASE_URL (alias).
 */
export function loadScorpioSettings(env: {
	SCORPIO_API_URL?: string;
	SCORPIO_BASE_URL?: string;
	SCORPIO_API_TOKEN?: string;
	SCORPIO_CALLBACK_URL?: string;
	SCORPIO_SERVER_IP?: string;
	SCORPIO_ALLOWED_IPS?: string;
}): ScorpioSettings {
	const apiUrl = (env.SCORPIO_API_URL || env.SCORPIO_BASE_URL || "").replace(
		/\/+$/,
		"",
	);
	const apiToken = env.SCORPIO_API_TOKEN || "";
	const callbackUrl = env.SCORPIO_CALLBACK_URL || "";
	const serverIp = env.SCORPIO_SERVER_IP || "";
	const allowedIps = parseAllowedIps(env.SCORPIO_ALLOWED_IPS);

	return {
		apiUrl,
		apiToken,
		callbackUrl,
		serverIp,
		allowedIps,
		ipRestrictionEnabled: allowedIps.length > 0,
	};
}

/** Fail fast when Main API or seamless callback secrets are required. */
export function assertScorpioSettings(
	settings: ScorpioSettings,
	options: { requireCallbackUrl?: boolean } = {},
): void {
	if (!settings.apiUrl) {
		throw new ScorpioConfigError(
			"SCORPIO_API_URL (or SCORPIO_BASE_URL) is required",
		);
	}
	if (!settings.apiToken) {
		throw new ScorpioConfigError("SCORPIO_API_TOKEN is required");
	}
	if (options.requireCallbackUrl && !settings.callbackUrl) {
		throw new ScorpioConfigError("SCORPIO_CALLBACK_URL is required");
	}
}

export function getConfiguredServerIp(settings: ScorpioSettings): string {
	return settings.serverIp;
}

export function getAllowedIps(settings: ScorpioSettings): string[] {
	return [...settings.allowedIps];
}

/**
 * Normalize Scorpio callback URLs for comparison.
 * Scorpio backoffice has been observed storing `https:/host` (one slash).
 */
export function normalizeScorpioCallbackUrl(url: string): string {
	return url
		.trim()
		.replace(/^https:\/(?!\/)/i, "https://")
		.replace(/^http:\/(?!\/)/i, "http://")
		.replace(/\/+$/, "");
}
