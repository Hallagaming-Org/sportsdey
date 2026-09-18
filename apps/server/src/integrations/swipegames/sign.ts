import { queryParamsToCanonicalJSON, toCanonicalJSON } from "./canonical-json";

export async function hmacSha256Hex(
	key: string,
	data: string | Uint8Array,
): Promise<string> {
	const encoder = new TextEncoder();
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		encoder.encode(key),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const payload = typeof data === "string" ? encoder.encode(data) : data;
	const signature = await crypto.subtle.sign("HMAC", cryptoKey, payload);
	return [...new Uint8Array(signature)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

export function timingSafeEqual(left: string, right: string): boolean {
	const encoder = new TextEncoder();
	const a = encoder.encode(left);
	const b = encoder.encode(right);
	const length = Math.max(a.length, b.length);
	let mismatch = a.length === b.length ? 0 : 1;
	for (let i = 0; i < length; i++) {
		mismatch |= (a[i] ?? 0) ^ (b[i] ?? 0);
	}
	return mismatch === 0;
}

export async function signCanonicalPayload(
	apiKey: string,
	payload: unknown,
): Promise<{ canonicalJSON: string; signature: string }> {
	const canonicalJSON = toCanonicalJSON(payload);
	const signature = await hmacSha256Hex(apiKey, canonicalJSON);
	return { canonicalJSON, signature };
}

export async function verifyRawBodySignature(
	integrationApiKey: string,
	rawBody: Uint8Array,
	signature: string | undefined,
): Promise<boolean> {
	if (!signature) return false;
	const expected = await hmacSha256Hex(integrationApiKey, rawBody);
	return timingSafeEqual(expected, signature.trim().toLowerCase());
}

export async function verifyQuerySignature(
	integrationApiKey: string,
	params: Record<string, string | string[] | undefined>,
	signature: string | undefined,
): Promise<boolean> {
	if (!signature) return false;
	const canonicalJSON = queryParamsToCanonicalJSON(params);
	const expected = await hmacSha256Hex(integrationApiKey, canonicalJSON);
	return timingSafeEqual(expected, signature.trim().toLowerCase());
}
