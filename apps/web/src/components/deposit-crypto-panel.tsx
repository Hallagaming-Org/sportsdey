import { useEthereumEmbeddedWallet } from "@openfort/react/ethereum";
import { useSolanaEmbeddedWallet } from "@openfort/react/solana";
import { Check, Copy, Info, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
	formatCryptoAmount,
	SOL_DECIMALS,
	USDC_DECIMALS,
	useBaseSepoliaBalances,
	useSolanaDevnetBalances,
} from "@/lib/openfort/balances";
import { OpenfortProviders } from "@/lib/openfort/providers";

function truncateAddress(address: string) {
	if (address.length <= 14) return address;
	return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function CopyableAddress({
	label,
	address,
}: {
	label: string;
	address: string;
}) {
	const [copied, setCopied] = useState(false);

	return (
		<div className="flex items-center justify-between gap-3 py-4">
			<span className="shrink-0 text-[#8C8F8F] text-sm">{label}</span>
			<span className="flex min-w-0 items-center gap-2 font-semibold text-white">
				<span className="truncate font-mono text-sm">
					{truncateAddress(address)}
				</span>
				<button
					type="button"
					onClick={async () => {
						try {
							await navigator.clipboard.writeText(address);
							setCopied(true);
						} catch {
							setCopied(false);
						}
					}}
					aria-label={`Copy ${label}`}
					className="shrink-0 cursor-pointer text-[#17b000] hover:opacity-80"
				>
					{copied ? (
						<Check className="h-4 w-4" strokeWidth={3} />
					) : (
						<Copy className="h-4 w-4" />
					)}
				</button>
			</span>
		</div>
	);
}

function BalanceRow({
	label,
	value,
	isLoading,
}: {
	label: string;
	value: string;
	isLoading?: boolean;
}) {
	return (
		<div className="flex items-center justify-between gap-3 py-2 text-sm">
			<span className="text-[#8C8F8F]">{label}</span>
			{isLoading ? (
				<span className="inline-flex items-center gap-1.5 text-[#6C7073]">
					<Loader2 className="h-3.5 w-3.5 animate-spin" />
				</span>
			) : (
				<span className="font-medium text-white tabular-nums">{value}</span>
			)}
		</div>
	);
}

function DepositCryptoPanelInner() {
	const evm = useEthereumEmbeddedWallet();
	const sol = useSolanaEmbeddedWallet();

	const evmAddress =
		evm.address ?? evm.wallets[0]?.address ?? evm.activeWallet?.address;
	const solAddress =
		sol.address ?? sol.wallets[0]?.address ?? sol.activeWallet?.address;

	const base = useBaseSepoliaBalances(evmAddress);
	const solana = useSolanaDevnetBalances(solAddress);

	const walletsLoading =
		evm.status === "fetching-wallets" || sol.status === "fetching-wallets";

	if (walletsLoading) {
		return (
			<div className="flex items-center justify-center gap-2 py-10 text-[#8C8F8F] text-sm">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading crypto wallets…
			</div>
		);
	}

	if (!evmAddress && !solAddress) {
		return (
			<div className="rounded-2xl bg-[#040E0A] px-5 py-6">
				<p className="text-[#8C8F8F] text-sm">
					No crypto wallet yet. Close this modal and create one in the Crypto
					section on your wallet page first.
				</p>
			</div>
		);
	}

	return (
		<>
			<div className="mb-4">
				<p className="font-semibold text-base text-white sm:text-lg">
					Crypto deposit details
				</p>
				<p className="mt-1 text-[#8C8F8F] text-sm">
					Send testnet USDC (or native ETH/SOL) to your addresses below. This
					balance stays separate from ₦ and is not convertible.
				</p>
			</div>

			{evmAddress && (
				<div className="mb-4 divide-y divide-[#1B2722] rounded-2xl bg-[#040E0A] px-5">
					<CopyableAddress label="Base (Sepolia)" address={evmAddress} />
					<div className="py-3">
						<div className="mb-1 flex items-center justify-between">
							<span className="text-[#6C7073] text-xs uppercase tracking-wide">
								Balance
							</span>
							<button
								type="button"
								onClick={() => void base.refetch()}
								disabled={base.isFetching}
								className="cursor-pointer text-[#6C7073] hover:text-white disabled:opacity-50"
								aria-label="Refresh Base balances"
							>
								<RefreshCw
									className={`h-3.5 w-3.5 ${base.isFetching ? "animate-spin" : ""}`}
								/>
							</button>
						</div>
						<BalanceRow
							label="ETH"
							isLoading={base.isLoading}
							value={`${formatCryptoAmount(base.eth.data?.value, 18)} ETH`}
						/>
						<BalanceRow
							label="USDC"
							isLoading={base.isLoading}
							value={`${formatCryptoAmount(base.usdc.data, USDC_DECIMALS)} USDC`}
						/>
					</div>
				</div>
			)}

			{solAddress && (
				<div className="mb-4 divide-y divide-[#1B2722] rounded-2xl bg-[#040E0A] px-5">
					<CopyableAddress label="Solana (devnet)" address={solAddress} />
					<div className="py-3">
						<div className="mb-1 flex items-center justify-between">
							<span className="text-[#6C7073] text-xs uppercase tracking-wide">
								Balance
							</span>
							<button
								type="button"
								onClick={() => void solana.refetch()}
								disabled={solana.isFetching}
								className="cursor-pointer text-[#6C7073] hover:text-white disabled:opacity-50"
								aria-label="Refresh Solana balances"
							>
								<RefreshCw
									className={`h-3.5 w-3.5 ${solana.isFetching ? "animate-spin" : ""}`}
								/>
							</button>
						</div>
						<BalanceRow
							label="SOL"
							isLoading={solana.isLoading}
							value={`${formatCryptoAmount(solana.data?.solLamports, SOL_DECIMALS)} SOL`}
						/>
						<BalanceRow
							label="USDC"
							isLoading={solana.isLoading}
							value={`${formatCryptoAmount(solana.data?.usdcRaw, USDC_DECIMALS)} USDC`}
						/>
					</div>
				</div>
			)}

			<div className="flex items-start gap-3 rounded-lg bg-[#B5B7B5] px-4 py-3">
				<Info className="mt-0.5 h-4 w-4 shrink-0 text-black" />
				<p className="text-black text-sm">
					Only send assets on the matching network (Base Sepolia / Solana
					devnet). Wrong-network sends can be lost.
				</p>
			</div>
		</>
	);
}

function ClientOnly({ children }: { children: ReactNode }) {
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
	}, []);
	if (!mounted) {
		return (
			<div className="flex items-center justify-center gap-2 py-10 text-[#8C8F8F] text-sm">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading…
			</div>
		);
	}
	return children;
}

export function DepositCryptoPanel() {
	return (
		<ClientOnly>
			<OpenfortProviders>
				<DepositCryptoPanelInner />
			</OpenfortProviders>
		</ClientOnly>
	);
}
