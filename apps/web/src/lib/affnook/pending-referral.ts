const PENDING_REFERRAL_KEY = "sportsdey_pending_referral_code";

export function storePendingReferralCode(code: string) {
	if (typeof window === "undefined") return;
	const trimmed = code.trim();
	if (!trimmed) return;
	try {
		window.sessionStorage.setItem(PENDING_REFERRAL_KEY, trimmed);
	} catch {
		// ignore
	}
}

export function getPendingReferralCode(): string | null {
	if (typeof window === "undefined") return null;
	try {
		return window.sessionStorage.getItem(PENDING_REFERRAL_KEY);
	} catch {
		return null;
	}
}

export function clearPendingReferralCode() {
	if (typeof window === "undefined") return;
	try {
		window.sessionStorage.removeItem(PENDING_REFERRAL_KEY);
	} catch {
		// ignore
	}
}
