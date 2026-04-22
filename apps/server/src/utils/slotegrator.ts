import type { Context } from "hono";

export interface SignatureVerificationResult {
	valid: boolean;
	error?: string;
}

export async function verifySlotitegrationSignature(
	c: Context,
	rawBody: string,
	merchantKey: string,
): Promise<SignatureVerificationResult> {
	const merchantId = c.req.header("X-Merchant-Id");
	const timestamp = c.req.header("X-Timestamp");
	const nonce = c.req.header("X-Nonce");
	const receivedSign = c.req.header("X-Sign");

	if (!merchantId || !timestamp || !nonce || !receivedSign) {
		return { valid: false, error: "Missing required headers" };
	}

	const now = Math.floor(Date.now() / 1000);
	const requestTime = parseInt(timestamp, 10);
	if (Number.isNaN(requestTime) || Math.abs(now - requestTime) > 30) {
		return { valid: false, error: "Request timestamp expired" };
	}

	let bodyParams: Record<string, string>;
	try {
		bodyParams = JSON.parse(rawBody);
	} catch {
		return { valid: false, error: "Invalid JSON body" };
	}

	const allParams: Record<string, string> = {
		...bodyParams,
		"X-Merchant-Id": merchantId,
		"X-Timestamp": timestamp,
		"X-Nonce": nonce,
	};

	const sortedKeys = Object.keys(allParams).sort();
	const queryString = sortedKeys
		.map((key) => `${key}=${allParams[key]}`)
		.join("&");

	const crypto = await import("crypto");
	const computedSign = crypto
		.createHmac("sha1", merchantKey)
		.update(queryString)
		.digest("hex");

	if (computedSign !== receivedSign) {
		return { valid: false, error: "Invalid signature" };
	}

	return { valid: true };
}