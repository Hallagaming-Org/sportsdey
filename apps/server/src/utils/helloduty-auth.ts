import {
	extractBearerToken,
	timingSafeEqualString,
} from "./webengage-sms-auth";

export function verifyHellodutySecret(opts: {
	expectedSecret: string | undefined;
	authorizationHeader?: string;
	xHellodutySecretHeader?: string;
}): boolean {
	const expected = opts.expectedSecret?.trim();
	if (!expected) return false;

	const bearer = extractBearerToken(opts.authorizationHeader);
	if (bearer && timingSafeEqualString(bearer, expected)) return true;

	const headerSecret = opts.xHellodutySecretHeader?.trim();
	if (headerSecret && timingSafeEqualString(headerSecret, expected)) {
		return true;
	}

	return false;
}
