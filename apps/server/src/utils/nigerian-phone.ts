/**
 * Canonical Nigerian mobile: E.164 `+234` + 10 digits (no leading 0 after CC).
 * Same acceptance rules as apps/web/src/lib/auth/nigerian-phone.ts.
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

/** Formats that may already exist on a user row from older writes or account edits. */
export function phoneNumberLookupValues(e164Phone: string): string[] {
	const digits = e164Phone.replace(/\D/g, "");
	const national =
		digits.startsWith("234") && digits.length === 13
			? digits.slice(3)
			: digits.length === 10
				? digits
				: null;
	const local = national ? `0${national}` : null;
	return Array.from(
		new Set(
			[
				e164Phone,
				digits,
				national,
				local,
				digits.startsWith("234") ? `+${digits}` : null,
			].filter((value): value is string => Boolean(value)),
		),
	);
}

/**
 * Placeholder emails historically used either E.164 digits (`234…`) or local
 * (`080…` / `80…`). Signup duplicate checks must try all of them.
 */
export function phonePlaceholderEmailLookupValues(e164Phone: string): string[] {
	const variants = phoneNumberLookupValues(e164Phone).map((value) =>
		value.replace(/\D/g, ""),
	);
	return Array.from(
		new Set(
			variants
				.filter((digits) => digits.length >= 10)
				.map((digits) => `phone_${digits}@sportsdey.local`),
		),
	);
}
