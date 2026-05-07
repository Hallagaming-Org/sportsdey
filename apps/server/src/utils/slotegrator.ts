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

	console.log("=== SIGNATURE VERIFICATION START ===");
	console.log("merchantId:", merchantId);
	console.log("timestamp:", timestamp);
	console.log("nonce:", nonce);
	console.log("receivedSign:", receivedSign);

	if (!merchantId || !timestamp || !nonce || !receivedSign) {
		console.log("FAIL: Missing required headers");
		return { valid: false, error: "Missing required headers" };
	}

	console.log("All headers present, continuing...");

	const now = Math.floor(Date.now() / 1000);
	const requestTime = parseInt(timestamp, 10);
	if (Number.isNaN(requestTime) || Math.abs(now - requestTime) > 30) {
		console.log("FAIL: Request timestamp expired", { now, requestTime });
		return { valid: false, error: "Request timestamp expired" };
	}

	const urlSearchParams = new URLSearchParams(rawBody);
	const bodyParams: Record<string, string> = Object.fromEntries(
		urlSearchParams.entries(),
	) as Record<string, string>;
	console.log("bodyParams keys:", Object.keys(bodyParams));

	const allParams: Record<string, string> = {
		...bodyParams,
		"X-Merchant-Id": merchantId,
		"X-Timestamp": timestamp,
		"X-Nonce": nonce,
	};

	const sortedKeys = Object.keys(allParams).sort();
	console.log("sortedKeys:", sortedKeys);

	const queryString = sortedKeys
		.map((key) => {
			const encodedKey = key.replace(/\[/g, "%5B").replace(/\]/g, "%5D");
			return `${encodedKey}=${allParams[key]}`;
		})
		.join("&");
	console.log("queryString:", queryString);

	const crypto = await import("crypto");
	const computedSign = crypto
		.createHmac("sha1", merchantKey)
		.update(queryString)
		.digest("hex");

	console.log("computedSign:", computedSign);
	console.log("receivedSign:", receivedSign);

	if (computedSign !== receivedSign) {
		console.log("FAIL: Signature mismatch");
		return { valid: false, error: "Invalid signature" };
	}

	console.log("SUCCESS: Signature valid");
	return { valid: true };
}