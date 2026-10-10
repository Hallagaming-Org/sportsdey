export const WALLET_FRAUD_FLAG_KEY = "fraudFlag";

export type WalletFraudFlag = {
	flagged: true;
	flaggedAt: number;
	flaggedByAdminId: string;
	flaggedByAdminName: string;
	reason: string | null;
};

export function parseWalletTransactionMetadata(
	raw: string | null | undefined,
): Record<string, unknown> {
	if (!raw?.trim()) return {};
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
	} catch {
		// keep empty
	}
	return {};
}

export function readWalletFraudFlag(
	meta: Record<string, unknown>,
): WalletFraudFlag | null {
	const raw = meta[WALLET_FRAUD_FLAG_KEY];
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
	const flag = raw as Record<string, unknown>;
	if (flag.flagged !== true) return null;
	const flaggedAt = Number(flag.flaggedAt);
	const flaggedByAdminId =
		typeof flag.flaggedByAdminId === "string" ? flag.flaggedByAdminId : "";
	const flaggedByAdminName =
		typeof flag.flaggedByAdminName === "string" ? flag.flaggedByAdminName : "";
	if (!flaggedByAdminId || !Number.isFinite(flaggedAt)) return null;
	return {
		flagged: true,
		flaggedAt,
		flaggedByAdminId,
		flaggedByAdminName,
		reason: typeof flag.reason === "string" && flag.reason.trim() ? flag.reason.trim() : null,
	};
}

export function isWalletTransactionFlagged(
	raw: string | null | undefined,
): boolean {
	return readWalletFraudFlag(parseWalletTransactionMetadata(raw)) !== null;
}

export function withWalletFraudFlag(
	meta: Record<string, unknown>,
	flag: WalletFraudFlag,
): Record<string, unknown> {
	return {
		...meta,
		[WALLET_FRAUD_FLAG_KEY]: flag,
	};
}
