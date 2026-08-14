const PEM_HEADER_FOOTER = /-----BEGIN [^-]+-----|-----END [^-]+-----|\s+/g;

/**
 * Signs a UTF-8 request body with RSA-SHA256 and returns a Base64 signature.
 * The body string must be the exact bytes sent on the wire (no re-stringify after signing).
 */
export async function signBonusEngineBody(payload: {
	privateKeyPem: string;
	bodyString: string;
}): Promise<string> {
	const key = await importRsaPrivateKey(payload.privateKeyPem);
	const signature = await crypto.subtle.sign(
		{ name: "RSASSA-PKCS1-v1_5" },
		key,
		new TextEncoder().encode(payload.bodyString),
	);
	return bufferToBase64(signature);
}

/**
 * Verifies a Base64 RSA-SHA256 signature over the exact raw body string.
 * Used for inbound Bonus Engine callbacks; return false on any verify failure.
 */
export async function verifyBonusEngineBody(payload: {
	publicKeyPem: string;
	bodyString: string;
	signatureBase64: string;
}): Promise<boolean> {
	try {
		const key = await importRsaPublicKey(payload.publicKeyPem);
		const signature = base64ToBuffer(payload.signatureBase64);
		return await crypto.subtle.verify(
			{ name: "RSASSA-PKCS1-v1_5" },
			key,
			signature,
			new TextEncoder().encode(payload.bodyString),
		);
	} catch {
		return false;
	}
}

/**
 * Verifies the merchant-hosted reference-data `X-Secure-Data` header.
 * Swagger: sign/encrypt the header name itself with RSA-SHA256 (Base64).
 * Accepts either the merchant private-key signature (Try it out / self-test)
 * or a signature verifiable with `BONUS_ENGINE_CALLBACK_PUBLIC_KEY` (Admin → merchant).
 */
export async function verifyBonusEngineSecureDataHeader(payload: {
	headerValue: string;
	privateKeyPem: string;
	callbackPublicKeyPem?: string;
}): Promise<boolean> {
	const headerValue = payload.headerValue.trim();
	if (!headerValue) return false;

	const expected = await signBonusEngineBody({
		privateKeyPem: payload.privateKeyPem,
		bodyString: "X-Secure-Data",
	});
	if (timingSafeEqualBase64(expected, headerValue)) return true;

	const callbackPublicKeyPem = payload.callbackPublicKeyPem?.trim();
	if (!callbackPublicKeyPem) return false;

	return verifyBonusEngineBody({
		publicKeyPem: callbackPublicKeyPem,
		bodyString: "X-Secure-Data",
		signatureBase64: headerValue,
	});
}

/**
 * Builds a stable SHA-256 hex digest for callback idempotency keys.
 */
export async function hashBonusEngineIdempotencyKey(
	value: string,
): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value),
	);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

async function importRsaPrivateKey(pem: string) {
	const der = pemToArrayBuffer(pem);
	return crypto.subtle.importKey(
		"pkcs8",
		der,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["sign"],
	);
}

async function importRsaPublicKey(pem: string) {
	const der = pemToArrayBuffer(pem);
	return crypto.subtle.importKey(
		"spki",
		der,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["verify"],
	);
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
	const base64 = pem.replace(PEM_HEADER_FOOTER, "");
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes.buffer;
}

function bufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

function base64ToBuffer(value: string): ArrayBuffer {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes.buffer;
}

/**
 * Compares two Base64 strings after decoding so padding/encoding quirks do not
 * create false negatives; falls back to length-safe string compare on decode failure.
 */
function timingSafeEqualBase64(left: string, right: string): boolean {
	try {
		const leftBytes = new Uint8Array(base64ToBuffer(left));
		const rightBytes = new Uint8Array(base64ToBuffer(right));
		if (leftBytes.length !== rightBytes.length) return false;
		let mismatch = 0;
		for (let index = 0; index < leftBytes.length; index += 1) {
			mismatch |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
		}
		return mismatch === 0;
	} catch {
		if (left.length !== right.length) return false;
		let mismatch = 0;
		for (let index = 0; index < left.length; index += 1) {
			mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
		}
		return mismatch === 0;
	}
}
