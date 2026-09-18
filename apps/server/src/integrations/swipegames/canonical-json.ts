/**
 * Canonical JSON for Swipe Games HMAC signing.
 *
 * Keys sorted alphabetically at every object level, compact (no whitespace).
 * Arrays keep their order. Matches Python `json.dumps(..., sort_keys=True,
 * separators=(',', ':'))` for ASCII payloads, and the documented example:
 *
 * {"cID":"...","currency":"USD","demo":true,"extCID":"...","gameID":"...","locale":"en_us","platform":"desktop","returnURL":"https://..."}
 *
 * GET /balance must not escape non-ASCII; JSON.stringify leaves Unicode as-is
 * and does not escape `/`, matching the documented canonical form.
 */
export function sortKeysDeep(value: unknown): unknown {
	if (value === null || typeof value !== "object") {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map(sortKeysDeep);
	}
	const source = value as Record<string, unknown>;
	const sorted: Record<string, unknown> = {};
	for (const key of Object.keys(source).sort()) {
		sorted[key] = sortKeysDeep(source[key]);
	}
	return sorted;
}

export function toCanonicalJSON(value: unknown): string {
	return JSON.stringify(sortKeysDeep(value));
}

/** Flatten query params to string values, then canonicalize. */
export function queryParamsToCanonicalJSON(
	params: Record<string, string | string[] | undefined>,
): string {
	const flattened: Record<string, string> = {};
	for (const key of Object.keys(params)) {
		const value = params[key];
		if (value === undefined) continue;
		flattened[key] = Array.isArray(value) ? (value[0] ?? "") : value;
	}
	return toCanonicalJSON(flattened);
}
