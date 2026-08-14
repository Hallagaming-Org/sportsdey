/** Shared auth helpers for WebEngage SSP SMS webhook (testable without Hono). */

export function timingSafeEqualString(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let mismatch = 0;
	for (let i = 0; i < a.length; i++) {
		mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return mismatch === 0;
}

export function extractBearerToken(authorization: string | undefined): string | null {
	if (!authorization) return null;
	const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
	return match?.[1]?.trim() || null;
}

export function verifyWebengageSmsSecret(opts: {
	expectedSecret: string | undefined;
	authorizationHeader?: string;
	xWebEngageSecretHeader?: string;
}): boolean {
	const expected = opts.expectedSecret?.trim();
	if (!expected) return false;

	const bearer = extractBearerToken(opts.authorizationHeader);
	if (bearer && timingSafeEqualString(bearer, expected)) return true;

	const headerSecret = opts.xWebEngageSecretHeader?.trim();
	if (headerSecret && timingSafeEqualString(headerSecret, expected)) {
		return true;
	}

	return false;
}
