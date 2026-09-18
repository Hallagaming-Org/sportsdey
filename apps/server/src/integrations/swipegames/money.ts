/**
 * Swipe Games amounts are decimal strings in the currency MAIN unit
 * (e.g. "0.90" = ₦0.90). Sportsdey stores integer kobo.
 *
 * Convert at the boundary with integer/string arithmetic only.
 */
const NAIRA_DECIMAL = /^(0|[1-9]\d*)(\.\d{1,2})?$/;

export function nairaDecimalToKobo(amount: string): number {
	const trimmed = amount.trim();
	if (!NAIRA_DECIMAL.test(trimmed)) {
		throw new Error(`Invalid Swipe Games amount: ${amount}`);
	}
	const [whole, frac = ""] = trimmed.split(".");
	const fracPadded = `${frac}00`.slice(0, 2);
	const kobo = BigInt(whole ?? "0") * 100n + BigInt(fracPadded);
	if (kobo > BigInt(Number.MAX_SAFE_INTEGER)) {
		throw new Error(`Amount exceeds safe integer kobo: ${amount}`);
	}
	return Number(kobo);
}

export function koboToNairaDecimal(kobo: number): string {
	const truncated = Math.trunc(kobo);
	const sign = truncated < 0 ? "-" : "";
	const abs = Math.abs(truncated);
	const whole = Math.trunc(abs / 100);
	const frac = abs % 100;
	return `${sign}${whole}.${String(frac).padStart(2, "0")}`;
}
