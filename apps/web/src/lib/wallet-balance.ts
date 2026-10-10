export type PlayerWalletBalances = {
	id?: string;
	balance?: number | null;
	bonusBalance?: number | null;
	withdrawableBalance?: number | null;
	totalBalance?: number | null;
};

function nairaField(value: unknown): number {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}

/** Full playable Naira (cash + bonus). Same figure admin shows as Wallet Balance. */
export function playableWalletNaira(
	wallet?: PlayerWalletBalances | null,
): number {
	const cash = nairaField(wallet?.balance);
	const bonus = nairaField(wallet?.bonusBalance);
	const total = nairaField(wallet?.totalBalance);
	return Math.max(total, cash + bonus);
}
