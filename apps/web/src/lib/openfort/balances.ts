import { erc20Abi, formatUnits } from "viem";
import { useBalance, useReadContract } from "wagmi";
import {
	OPENFORT_EVM_CHAIN_ID,
	OPENFORT_STABLECOIN_ADDRESS,
} from "@/lib/openfort/config";

export function formatCryptoAmount(
	value: bigint | undefined,
	decimals: number,
	maxFractionDigits = 6,
): string {
	if (value === undefined) return "—";
	const asNumber = Number(formatUnits(value, decimals));
	if (!Number.isFinite(asNumber)) return formatUnits(value, decimals);
	return asNumber.toLocaleString(undefined, {
		maximumFractionDigits: maxFractionDigits,
	});
}

export function useOpenfortBalances(address?: `0x${string}`) {
	const native = useBalance({
		address,
		chainId: OPENFORT_EVM_CHAIN_ID,
		query: { enabled: Boolean(address), refetchInterval: 30_000 },
	});
	const stablecoin = useReadContract({
		address: OPENFORT_STABLECOIN_ADDRESS,
		abi: erc20Abi,
		functionName: "balanceOf",
		args: address ? [address] : undefined,
		chainId: OPENFORT_EVM_CHAIN_ID,
		query: { enabled: Boolean(address), refetchInterval: 30_000 },
	});

	return {
		native,
		stablecoin,
		isLoading: Boolean(address) && (native.isLoading || stablecoin.isLoading),
		isFetching: native.isFetching || stablecoin.isFetching,
		refetch: async () => {
			await Promise.all([native.refetch(), stablecoin.refetch()]);
		},
	};
}
