import {
	AccountTypeEnum,
	RecoveryMethod,
} from "@openfort/react";
import { useEthereumEmbeddedWallet } from "@openfort/react/ethereum";
import { useSolanaEmbeddedWallet } from "@openfort/react/solana";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "@/lib/auth/client";
import {
	formatCryptoAmount,
	SOL_DECIMALS,
	USDC_DECIMALS,
	useBaseSepoliaBalances,
	useSolanaDevnetBalances,
} from "@/lib/openfort/balances";
import { isOpenfortEnabled } from "@/lib/openfort/config";
import { OpenfortProviders } from "@/lib/openfort/providers";

function truncateAddress(address: string) {
	if (address.length <= 12) return address;
	return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function BalanceLine({
	label,
	value,
	isLoading,
}: {
	label: string;
	value: string;
	isLoading?: boolean;
}) {
	return (
		<div className="flex items-center justify-between gap-3 text-sm">
			<span className="text-[#6C7073]">{label}</span>
			{isLoading ? (
				<span className="inline-flex items-center gap-1.5 text-[#6C7073]">
					<Loader2 className="h-3.5 w-3.5 animate-spin" />
					…
				</span>
			) : (
				<span className="font-medium text-white tabular-nums">{value}</span>
			)}
		</div>
	);
}

function AddressRow({
	label,
	address,
}: {
	label: string;
	address: string;
}) {
	const [copied, setCopied] = useState(false);

	return (
		<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
			<span className="text-[#6C7073] text-xs">{label}</span>
			<div className="flex min-w-0 items-center gap-2">
				<span className="truncate font-mono text-sm text-white">
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
					className={
						copied
							? "cursor-pointer text-accent transition-colors"
							: "cursor-pointer text-[#6C7073] transition-colors hover:text-white"
					}
					aria-label={copied ? `${label} copied` : `Copy ${label}`}
				>
					{copied ? (
						<Check className="h-3.5 w-3.5" strokeWidth={3} />
					) : (
						<Copy className="h-3.5 w-3.5" />
					)}
				</button>
			</div>
		</div>
	);
}

function BaseBalances({ address }: { address: `0x${string}` }) {
	const { eth, usdc, isLoading, isFetching, refetch } =
		useBaseSepoliaBalances(address);

	return (
		<div className="mt-3 space-y-2 border-[#1B2722] border-t pt-3">
			<div className="flex items-center justify-between">
				<span className="text-[#6C7073] text-xs uppercase tracking-wide">
					Balances
				</span>
				<button
					type="button"
					onClick={() => void refetch()}
					disabled={isFetching}
					className="cursor-pointer text-[#6C7073] transition-colors hover:text-white disabled:opacity-50"
					aria-label="Refresh Base balances"
				>
					<RefreshCw
						className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
					/>
				</button>
			</div>
			<BalanceLine
				label="ETH"
				isLoading={isLoading}
				value={`${formatCryptoAmount(eth.data?.value, 18)} ETH`}
			/>
			<BalanceLine
				label="USDC"
				isLoading={isLoading}
				value={`${formatCryptoAmount(usdc.data, USDC_DECIMALS)} USDC`}
			/>
			{(eth.isError || usdc.isError) && (
				<p className="text-red-400 text-xs">Could not load Base balances.</p>
			)}
		</div>
	);
}

function SolanaBalances({ address }: { address: string }) {
	const { data, isLoading, isFetching, isError, refetch } =
		useSolanaDevnetBalances(address);

	return (
		<div className="mt-3 space-y-2 border-[#1B2722] border-t pt-3">
			<div className="flex items-center justify-between">
				<span className="text-[#6C7073] text-xs uppercase tracking-wide">
					Balances
				</span>
				<button
					type="button"
					onClick={() => void refetch()}
					disabled={isFetching}
					className="cursor-pointer text-[#6C7073] transition-colors hover:text-white disabled:opacity-50"
					aria-label="Refresh Solana balances"
				>
					<RefreshCw
						className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
					/>
				</button>
			</div>
			<BalanceLine
				label="SOL"
				isLoading={isLoading}
				value={`${formatCryptoAmount(data?.solLamports, SOL_DECIMALS)} SOL`}
			/>
			<BalanceLine
				label="USDC"
				isLoading={isLoading}
				value={`${formatCryptoAmount(data?.usdcRaw, USDC_DECIMALS)} USDC`}
			/>
			{isError && (
				<p className="text-red-400 text-xs">Could not load Solana balances.</p>
			)}
		</div>
	);
}

function OpenfortCryptoWalletInner() {
	const { data: session } = useSession();
	const evm = useEthereumEmbeddedWallet();
	const sol = useSolanaEmbeddedWallet();
	const [error, setError] = useState<string | null>(null);
	const [creating, setCreating] = useState<"evm" | "sol" | null>(null);

	const evmAddress =
		evm.address ?? evm.wallets[0]?.address ?? evm.activeWallet?.address;
	const solAddress =
		sol.address ?? sol.wallets[0]?.address ?? sol.activeWallet?.address;
	const isBusy =
		creating !== null ||
		evm.status === "creating" ||
		sol.status === "creating" ||
		evm.status === "fetching-wallets" ||
		sol.status === "fetching-wallets";

	const createEvm = async () => {
		setError(null);
		setCreating("evm");
		try {
			await evm.create({
				recoveryMethod: RecoveryMethod.PASSKEY,
				accountType: AccountTypeEnum.EOA,
			});
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to create Base wallet",
			);
		} finally {
			setCreating(null);
		}
	};

	const createSol = async () => {
		setError(null);
		setCreating("sol");
		try {
			await sol.create({
				recoveryMethod: RecoveryMethod.PASSKEY,
			});
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to create Solana wallet",
			);
		} finally {
			setCreating(null);
		}
	};

	if (!session?.user) {
		return (
			<p className="text-[#6C7073] text-sm">
				Sign in to create a test crypto wallet.
			</p>
		);
	}

	return (
		<div className="space-y-4">
			<p className="text-[#6C7073] text-sm">
				Separate crypto balance (testnet). Not convertible to ₦. Recovery:
				passkey. Networks: Base Sepolia + Solana devnet.
			</p>

			<div className="space-y-3 rounded-xl border border-[#1B2722] bg-[#04100B] p-4">
				{evmAddress ? (
					<div>
						<AddressRow label="Base (Sepolia)" address={evmAddress} />
						<BaseBalances address={evmAddress} />
					</div>
				) : (
					<button
						type="button"
						disabled={isBusy}
						onClick={() => void createEvm()}
						className="w-full cursor-pointer rounded-xl border border-[#1B2722] bg-[#000606] px-4 py-3 font-medium text-sm text-white transition-colors hover:border-[#2A3A34] disabled:cursor-not-allowed disabled:opacity-60"
					>
						{creating === "evm" ? (
							<span className="inline-flex items-center gap-2">
								<Loader2 className="h-4 w-4 animate-spin" />
								Creating Base wallet…
							</span>
						) : (
							"Create Base wallet (passkey)"
						)}
					</button>
				)}

				{solAddress ? (
					<div className="border-[#1B2722] border-t pt-3">
						<AddressRow label="Solana (devnet)" address={solAddress} />
						<SolanaBalances address={solAddress} />
					</div>
				) : (
					<button
						type="button"
						disabled={isBusy}
						onClick={() => void createSol()}
						className="w-full cursor-pointer rounded-xl border border-[#1B2722] bg-[#000606] px-4 py-3 font-medium text-sm text-white transition-colors hover:border-[#2A3A34] disabled:cursor-not-allowed disabled:opacity-60"
					>
						{creating === "sol" ? (
							<span className="inline-flex items-center gap-2">
								<Loader2 className="h-4 w-4 animate-spin" />
								Creating Solana wallet…
							</span>
						) : (
							"Create Solana wallet (passkey)"
						)}
					</button>
				)}
			</div>

			{error && <p className="text-red-400 text-sm">{error}</p>}
		</div>
	);
}

function ClientOnly({ children }: { children: ReactNode }) {
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
	}, []);
	if (!mounted) {
		return (
			<p className="text-[#6C7073] text-sm">Loading crypto wallet…</p>
		);
	}
	return children;
}

export function OpenfortCryptoWallet() {
	if (!isOpenfortEnabled()) return null;

	return (
		<section className="mt-6 min-h-40 w-full rounded-2xl border border-[#1B2722] bg-[#000606] p-6 shadow-sm md:p-7">
			<div className="mb-4 flex items-center justify-between gap-3 border-[#1B2722] border-b pb-3">
				<h2 className="font-semibold text-base text-white">Crypto</h2>
				<span className="rounded-md border border-[#1B2722] px-2 py-0.5 text-[#6C7073] text-[11px] uppercase tracking-wide">
					Test
				</span>
			</div>
			<ClientOnly>
				<OpenfortProviders>
					<OpenfortCryptoWalletInner />
				</OpenfortProviders>
			</ClientOnly>
		</section>
	);
}
