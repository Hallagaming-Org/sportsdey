const PHONE_PLACEHOLDER_EMAIL_PATTERN = /^phone_\d+@sportsdey\.local$/i;
const DEFAULT_PHONE_USER_NAME_PATTERN = /^User \d+$/i;

/** True when the account still has the phone-OTP placeholder email. */
export function isPhonePlaceholderEmail(email: string): boolean {
	return PHONE_PLACEHOLDER_EMAIL_PATTERN.test(email.trim());
}

/** True when the display name is still the generated `User ####` placeholder. */
export function isDefaultPhoneUserName(name: string): boolean {
	return DEFAULT_PHONE_USER_NAME_PATTERN.test(name.trim());
}

/**
 * Phone OTP users who still need onboarding.
 * Prefer the server `needsProfileCompletion` flag when present.
 * Only first-time signup should force complete-profile — not returning logins.
 */
export function needsPhoneProfileCompletion(user: {
	name?: string | null;
	email?: string | null;
	isFirstTimeSignIn?: boolean;
	needsProfileCompletion?: boolean;
}): boolean {
	if (typeof user.needsProfileCompletion === "boolean") {
		return user.needsProfileCompletion;
	}

	// Fallback when older API responses omit the flag: only first-time signup.
	return Boolean(user.isFirstTimeSignIn);
}
