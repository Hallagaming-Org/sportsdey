function sortKeysDeep(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(sortKeysDeep);
	}
	if (value !== null && typeof value === "object") {
		const sorted: Record<string, unknown> = {};
		for (const key of Object.keys(value as Record<string, unknown>).sort()) {
			sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
		}
		return sorted;
	}
	return value;
}

async function hmacSha512Hex(payload: string, secretKey: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secretKey),
		{ name: "HMAC", hash: "SHA-512" },
		false,
		["sign"],
	);
	const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
	return Array.from(new Uint8Array(signatureBuffer))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}


export async function signRequestBody(body: unknown, privateKey: string): Promise<string> {
	const sorted = sortKeysDeep(body);
	const json = JSON.stringify(sorted);
	return hmacSha512Hex(json, privateKey);
}


export async function verifyCallbackSignature(
	rawBody: string,
	privateKey: string,
): Promise<{ valid: boolean; payload?: Record<string, unknown> }> {
	let parsed: { payload?: Record<string, unknown>; sha512?: string };
	try {
		parsed = JSON.parse(rawBody);
	} catch {
		return { valid: false };
	}

	if (!parsed.payload || typeof parsed.sha512 !== "string") {
		return { valid: false };
	}

	const sorted = sortKeysDeep(parsed.payload);
	const json = JSON.stringify(sorted);
	const expectedSignature = await hmacSha512Hex(json, privateKey);

	const valid = timingSafeEqualHex(expectedSignature, parsed.sha512);
	return { valid, payload: valid ? parsed.payload : undefined };
}


function timingSafeEqualHex(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return result === 0;
}