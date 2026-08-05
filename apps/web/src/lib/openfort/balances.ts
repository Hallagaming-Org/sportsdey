import { useQuery } from "@tanstack/react-query";
import { erc20Abi, formatUnits } from "viem";
import { useBalance, useReadContract } from "wagmi";
import {
	BASE_SEPOLIA_USDC,
	OPENFORT_EVM_CHAIN_ID,
	SOL_DECIMALS,
	SOLANA_DEVNET_RPC,
	SOLANA_DEVNET_USDC_MINT,
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

export function useBaseSepoliaBalances(address?: `0x${string}`) {
	const eth = useBalance({
		address,
		chainId: OPENFORT_EVM_CHAIN_ID,
		query: { enabled: Boolean(address), refetchInterval: 30_000 },
	});
	const usdc = useReadContract({
		address: BASE_SEPOLIA_USDC,
		abi: erc20Abi,
		functionName: "balanceOf",
		args: address ? [address] : undefined,
		chainId: OPENFORT_EVM_CHAIN_ID,
		query: { enabled: Boolean(address), refetchInterval: 30_000 },
	});

	return {
		eth,
		usdc,
		isLoading: Boolean(address) && (eth.isLoading || usdc.isLoading),
		isFetching: eth.isFetching || usdc.isFetching,
		refetch: async () => {
			await Promise.all([eth.refetch(), usdc.refetch()]);
		},
	};
}

type SolanaRpcResponse<T> = {
	result?: T;
	error?: { message?: string };
};

async function solanaRpc<T>(method: string, params: unknown[]): Promise<T> {
	const response = await fetch(SOLANA_DEVNET_RPC, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
	});
	if (!response.ok) {
		throw new Error(`Solana RPC HTTP ${response.status}`);
	}
	const json = (await response.json()) as SolanaRpcResponse<T>;
	if (json.error) {
		throw new Error(json.error.message || "Solana RPC error");
	}
	if (json.result === undefined) {
		throw new Error("Solana RPC returned empty result");
	}
	return json.result;
}

export type SolanaBalances = {
	solLamports: bigint;
	usdcRaw: bigint;
};

export async function fetchSolanaDevnetBalances(
	address: string,
): Promise<SolanaBalances> {
	const [balanceResult, tokenAccounts] = await Promise.all([
		solanaRpc<{ value: number }>("getBalance", [address]),
		solanaRpc<{
			value: Array<{
				account: {
					data: {
						parsed?: {
							info?: {
								tokenAmount?: {
									amount?: string;
									decimals?: number;
								};
							};
						};
					};
				};
			}>;
		}>("getTokenAccountsByOwner", [
			address,
			{ mint: SOLANA_DEVNET_USDC_MINT },
			{ encoding: "jsonParsed" },
		]),
	]);

	let usdcRaw = 0n;
	for (const entry of tokenAccounts.value ?? []) {
		const amount = entry.account.data.parsed?.info?.tokenAmount?.amount;
		if (amount) usdcRaw += BigInt(amount);
	}

	return {
		solLamports: BigInt(balanceResult.value ?? 0),
		usdcRaw,
	};
}

export function useSolanaDevnetBalances(address?: string) {
	return useQuery({
		queryKey: ["openfort-solana-balances", address],
		queryFn: () => fetchSolanaDevnetBalances(address!),
		enabled: Boolean(address),
		refetchInterval: 30_000,
	});
}

export { SOL_DECIMALS, USDC_DECIMALS };
