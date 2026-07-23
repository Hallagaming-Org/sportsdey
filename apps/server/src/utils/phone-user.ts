const PHONE_PLACEHOLDER_EMAIL_DOMAIN = "sportsdey.local";
const PHONE_PLACEHOLDER_EMAIL_PATTERN = /^phone_\d+@sportsdey\.local$/i;
const DEFAULT_PHONE_USER_NAME_PATTERN = /^User \d+$/i;

/** Placeholder email for phone OTP users before they set a real address. */
export function buildPhonePlaceholderEmail(phoneDigits: string): string {
	return `phone_${phoneDigits}@${PHONE_PLACEHOLDER_EMAIL_DOMAIN}`;
}

/** Temporary display name until the user completes their profile. */
export function buildPhonePlaceholderName(phoneDigits: string): string {
	return `User ${phoneDigits.slice(-4)}`;
}

export function isPhonePlaceholderEmail(email: string): boolean {
	return PHONE_PLACEHOLDER_EMAIL_PATTERN.test(email.trim());
}

export function isDefaultPhoneUserName(name: string): boolean {
	return DEFAULT_PHONE_USER_NAME_PATTERN.test(name.trim());
}
