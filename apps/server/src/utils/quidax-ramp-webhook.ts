import { createHmac, timingSafeEqual } from "node:crypto";

/** Ramp widget webhooks sign the JSON body with HMAC-SHA256 (`x-ramp-signature`). */
export function verifyRampWebhookSignature(
	rawBody: string,
	signatureHeader: string | null | undefined,
	secret: string,
): boolean {
	if (!secret || !signatureHeader?.trim()) return false;
	const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
	const provided = signatureHeader.trim();
	const expectedBuf = Buffer.from(expected, "utf8");
	const providedBuf = Buffer.from(provided, "utf8");
	if (expectedBuf.length !== providedBuf.length) return false;
	return timingSafeEqual(expectedBuf, providedBuf);
}

export function quidaxRampEventName(payload: unknown): string | null {
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		return null;
	}
	const event = (payload as { event?: unknown }).event;
	return typeof event === "string" && event.trim() ? event.trim() : null;
}
