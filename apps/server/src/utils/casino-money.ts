/**
 * Canonical money normalization for casino wallet callbacks.
 *
 * The SportsDey wallet stores integer kobo. Every inbound provider amount
 * must pass through `toKobo()` exactly once, at the API boundary. No adapter
 * may roll its own `* 100` / `/ 10` conversion.
 *
 * Provider units:
 * - "kobo":       already kobo (Thndr, Lagos Rush /pockets)
 * - "naira":      NGN major units (Slotegrator, Scorpio, Halla)
 * - "luckyworld": 1 NGN = 1000 provider units, so 10 units = 1 kobo
 */
export type ProviderMoneyUnit = "kobo" | "naira" | "luckyworld";

export class CasinoMoneyError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CasinoMoneyError";
	}
}

/**
 * Normalizes an inbound provider amount to integer kobo.
 * Rejects negative, non-finite, and (for "kobo") non-integer amounts.
 * Zero is allowed here — several providers report zero-amount events
 * (LOSE, free-round tracking); wallet mutation is separately gated on > 0.
 */
export function toKobo(amount: number, unit: ProviderMoneyUnit): number {
	if (typeof amount !== "number" || !Number.isFinite(amount)) {
		throw new CasinoMoneyError(`Invalid amount: ${String(amount)}`);
	}
	if (amount < 0) {
		throw new CasinoMoneyError(`Negative amount: ${amount}`);
	}
	if (unit === "kobo" && !Number.isSafeInteger(amount)) {
		throw new CasinoMoneyError(`Non-integer kobo amount: ${amount}`);
	}
	const kobo =
		unit === "kobo"
			? amount
			: unit === "naira"
				? Math.round(amount * 100)
				: Math.round(amount / 10);
	if (!Number.isSafeInteger(kobo)) {
		throw new CasinoMoneyError(`Amount out of range: ${amount} (${unit})`);
	}
	return kobo;
}

/** True when `kobo` is a positive safe integer — the only values a wallet mutation may use. */
export function isPositiveKobo(kobo: number): boolean {
	return Number.isSafeInteger(kobo) && kobo > 0;
}
