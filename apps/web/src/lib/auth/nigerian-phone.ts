/**
 * Canonical Nigerian mobile storage/login format: E.164 `+234` + 10 digits
 * (no leading 0 after the country code).
 *
 * Accepts:
 * - local `0XXXXXXXXXX` (e.g. 09012345678)
 * - E.164 / intl `+234XXXXXXXXXX` or `234XXXXXXXXXX`
 * - national 10-digit (field beside a +234 prefix): `9012345678`
 * - common mistake `+2340XXXXXXXXXX` (country code + local with leading 0)
 */

const LOCAL = /^0[789][01]\d{8}$/;
const INTL = /^234[789][01]\d{8}$/;
const INTL_WITH_LOCAL_ZERO = /^2340[789][01]\d{8}$/;
const NATIONAL = /^[789][01]\d{8}$/;

export function normalizeNigerianPhone(raw: string): string | null {
	const digits = raw.replace(/\D/g, "");
	if (!digits) return null;

	if (LOCAL.test(digits)) {
		return `+234${digits.slice(1)}`;
	}
	if (INTL_WITH_LOCAL_ZERO.test(digits)) {
		return `+234${digits.slice(4)}`;
	}
	if (INTL.test(digits)) {
		return `+${digits}`;
	}
	if (NATIONAL.test(digits)) {
		return `+234${digits}`;
	}
	return null;
}

/**
 * Digits kept in the national input beside a fixed +234 prefix.
 * Completes/pastes of +234… collapse to the 10-digit national form.
 * Local 0… may be typed in full; once valid it also collapses to national.
 */
export function toNigerianNationalInput(raw: string): string {
	const digits = raw.replace(/\D/g, "");
	if (!digits) return "";

	const normalized = normalizeNigerianPhone(digits);
	if (normalized) {
		return normalized.slice(4);
	}

	if (digits.startsWith("2340") && digits.length > 4) {
		return digits.slice(4, 14);
	}
	if (digits.startsWith("234") && digits.length > 3) {
		return digits.slice(3, 13);
	}
	if (digits.startsWith("0")) {
		return digits.slice(0, 11);
	}
	return digits.slice(0, 10);
}
