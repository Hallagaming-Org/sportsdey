import { erc20Abi, formatUnits } from "viem";
import { useBalance, useReadContract } from "wagmi";
import {
	OPENFORT_EVM_CHAIN_ID,
	POLYGON_AMOY_USDC,
	USDC_DECIMALS,
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

export function usePolygonAmoyBalances(address?: `0x${string}`) {
	const pol = useBalance({
		address,
		chainId: OPENFORT_EVM_CHAIN_ID,
		query: { enabled: Boolean(address), refetchInterval: 30_000 },
	});
	const usdc = useReadContract({
		address: POLYGON_AMOY_USDC,
		abi: erc20Abi,
		functionName: "balanceOf",
		args: address ? [address] : undefined,
		chainId: OPENFORT_EVM_CHAIN_ID,
		query: { enabled: Boolean(address), refetchInterval: 30_000 },
	});

	return {
		pol,
		usdc,
		isLoading: Boolean(address) && (pol.isLoading || usdc.isLoading),
		isFetching: pol.isFetching || usdc.isFetching,
		refetch: async () => {
			await Promise.all([pol.refetch(), usdc.refetch()]);
		},
	};
}

export { USDC_DECIMALS };
