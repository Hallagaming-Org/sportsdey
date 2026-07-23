import { createHmac, timingSafeEqual } from "node:crypto";
import type { ScorpioSettings } from "@/utils/scorpio-config";

export class ScorpioSignatureError extends Error {
	constructor(message = "Invalid Scorpio request signature") {
		super(message);
		this.name = "ScorpioSignatureError";
	}
}

export class ScorpioIpForbiddenError extends Error {
	constructor(message = "Scorpio callback IP is not allowed") {
		super(message);
		this.name = "ScorpioIpForbiddenError";
	}
}

/**
 * Build the HMAC payload string per Scorpio Seamless docs:
 * flat JSON → sort keys alphabetically → join values with commas.
 */
export function buildScorpioSignaturePayload(
	body: Record<string, unknown>,
): string {
	const keys = Object.keys(body).sort();
	return keys
		.map((key) => {
			const value = body[key];
			if (value === null || value === undefined) return "";
			if (typeof value === "object") {
				return JSON.stringify(value);
			}
			return String(value);
		})
		.join(",");
}

export function computeScorpioSignature(
	body: Record<string, unknown>,
	apiToken: string,
): string {
	const data = buildScorpioSignaturePayload(body);
	return createHmac("sha512", apiToken).update(data).digest("base64");
}

export function verifyScorpioSignature(
	body: Record<string, unknown>,
	receivedSignature: string | undefined,
	apiToken: string,
): void {
	if (!receivedSignature?.trim()) {
		throw new ScorpioSignatureError("Missing X-Request-Signature header");
	}
	if (!apiToken) {
		throw new ScorpioSignatureError("Scorpio API token is not configured");
	}

	const expected = computeScorpioSignature(body, apiToken);
	const receivedBuf = Buffer.from(receivedSignature);
	const expectedBuf = Buffer.from(expected);

	if (
		receivedBuf.length !== expectedBuf.length ||
		!timingSafeEqual(receivedBuf, expectedBuf)
	) {
		throw new ScorpioSignatureError();
	}
}

export function isIpAllowed(
	clientIp: string,
	settings: Pick<ScorpioSettings, "allowedIps" | "ipRestrictionEnabled">,
): boolean {
	if (!settings.ipRestrictionEnabled) return true;
	if (!clientIp) return false;
	return settings.allowedIps.includes(clientIp);
}

export function assertScorpioCallbackIp(
	clientIp: string,
	settings: Pick<ScorpioSettings, "allowedIps" | "ipRestrictionEnabled">,
): void {
	if (!isIpAllowed(clientIp, settings)) {
		throw new ScorpioIpForbiddenError();
	}
}
