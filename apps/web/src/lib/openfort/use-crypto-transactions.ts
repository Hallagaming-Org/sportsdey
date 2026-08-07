import { useEthereumEmbeddedWallet } from "@openfort/react/ethereum";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import {
	cryptoTransferToWalletTx,
	fetchIncomingCryptoTransfers,
} from "@/lib/openfort/incoming-transfers";
import type { WalletTransaction } from "@/lib/wallet-transactions";

/**
 * Must only be called under OpenfortWalletScope when `useOpenfortReady()` is true.
 */
export function useCryptoIncomingTransactions(): {
	transactions: WalletTransaction[];
	isLoading: boolean;
	address?: Address;
} {
	const evm = useEthereumEmbeddedWallet();
	const address = (evm.address ??
		evm.wallets[0]?.address ??
		evm.activeWallet?.address) as Address | undefined;

	const query = useQuery({
		queryKey: ["crypto-incoming-transfers", address],
		queryFn: () => fetchIncomingCryptoTransfers(address as Address),
		enabled: Boolean(address),
		staleTime: 60_000,
		refetchInterval: 60_000,
		retry: 1,
		// Keep last good rows visible while a slow/failed RPC refetch runs.
		placeholderData: (previous) => previous,
	});

	return {
		transactions: (query.data ?? []).map((t) => cryptoTransferToWalletTx(t)),
		isLoading: Boolean(address) && query.isLoading,
		address,
	};
}
