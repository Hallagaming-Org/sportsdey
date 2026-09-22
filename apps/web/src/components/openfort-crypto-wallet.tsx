import { AccountTypeEnum, RecoveryMethod } from "@openfort/react";
import { useEthereumEmbeddedWallet } from "@openfort/react/ethereum";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useSession } from "@/lib/auth/client";
import {
	formatCryptoAmount,
	useOpenfortBalances,
} from "@/lib/openfort/balances";
import {
	isOpenfortEnabled,
	OPENFORT_CHAIN,
	OPENFORT_CHAIN_LABEL,
	OPENFORT_NATIVE_SYMBOL,
	OPENFORT_STABLECOIN_DECIMALS,
	OPENFORT_STABLECOIN_SYMBOL,
} from "@/lib/openfort/config";
import { useOpenfortReady } from "@/lib/openfort/scope";

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
					<Loader2 className="h-3.5 w-3.5 animate-spin" />…
				</span>
			) : (
				<span className="font-medium text-white tabular-nums">{value}</span>
			)}
		</div>
	);
}

function AddressRow({ label, address }: { label: string; address: string }) {
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

function ChainBalances({ address }: { address: `0x${string}` }) {
	const { native, stablecoin, isLoading, isFetching, refetch } =
		useOpenfortBalances(address);

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
					aria-label={`Refresh ${OPENFORT_CHAIN_LABEL} balances`}
				>
					<RefreshCw
						className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
					/>
				</button>
			</div>
			<BalanceLine
				label={OPENFORT_NATIVE_SYMBOL}
				isLoading={isLoading}
				value={`${formatCryptoAmount(native.data?.value, 18)} ${OPENFORT_NATIVE_SYMBOL}`}
			/>
			<BalanceLine
				label={OPENFORT_STABLECOIN_SYMBOL}
				isLoading={isLoading}
				value={`${formatCryptoAmount(stablecoin.data, OPENFORT_STABLECOIN_DECIMALS)} ${OPENFORT_STABLECOIN_SYMBOL}`}
			/>
			{(native.isError || stablecoin.isError) && (
				<p className="text-red-400 text-xs">
					Could not load {OPENFORT_CHAIN_LABEL} balances.
				</p>
			)}
		</div>
	);
}

function OpenfortCryptoWalletInner() {
	const { data: session } = useSession();
	const evm = useEthereumEmbeddedWallet();
	const [error, setError] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);

	const address =
		evm.address ?? evm.wallets[0]?.address ?? evm.activeWallet?.address;
	const isBusy =
		creating || evm.status === "creating" || evm.status === "fetching-wallets";

	const createWallet = async () => {
		setError(null);
		setCreating(true);
		try {
			await evm.create({
				recoveryMethod: RecoveryMethod.PASSKEY,
				accountType: AccountTypeEnum.EOA,
			});
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to create crypto wallet",
			);
		} finally {
			setCreating(false);
		}
	};

	if (!session?.user) {
		return (
			<p className="text-[#6C7073] text-sm">
				Sign in to create a crypto wallet.
			</p>
		);
	}

	return (
		<div className="space-y-4">
			<p className="text-[#6C7073] text-sm">
				Separate crypto balance
				{OPENFORT_CHAIN.isTestnet ? " (testnet)" : ""}. Not convertible to ₦.
				Recovery: passkey. Network: {OPENFORT_CHAIN_LABEL}.
			</p>

			<div className="space-y-3 rounded-xl border border-[#1B2722] bg-[#04100B] p-4">
				{address ? (
					<div>
						<AddressRow label={OPENFORT_CHAIN_LABEL} address={address} />
						<ChainBalances address={address} />
					</div>
				) : (
					<button
						type="button"
						disabled={isBusy}
						onClick={() => void createWallet()}
						className="w-full cursor-pointer rounded-xl border border-[#1B2722] bg-[#000606] px-4 py-3 font-medium text-sm text-white transition-colors hover:border-[#2A3A34] disabled:cursor-not-allowed disabled:opacity-60"
					>
						{creating ? (
							<span className="inline-flex items-center gap-2">
								<Loader2 className="h-4 w-4 animate-spin" />
								Creating crypto wallet…
							</span>
						) : (
							"Create crypto wallet (passkey)"
						)}
					</button>
				)}
			</div>

			{error && <p className="text-red-400 text-sm">{error}</p>}
		</div>
	);
}

export function OpenfortCryptoWallet() {
	const openfortReady = useOpenfortReady();

	if (!isOpenfortEnabled()) return null;

	return (
		<section className="mt-6 min-h-40 w-full rounded-2xl border border-[#1B2722] bg-[#000606] p-6 shadow-sm md:p-7">
			<div className="mb-4 flex items-center justify-between gap-3 border-[#1B2722] border-b pb-3">
				<h2 className="font-semibold text-base text-white">Crypto</h2>
				{OPENFORT_CHAIN.isTestnet ? (
					<span className="rounded-md border border-[#1B2722] px-2 py-0.5 text-[#6C7073] text-[11px] uppercase tracking-wide">
						Test
					</span>
				) : (
					<span className="rounded-md border border-[#1B2722] px-2 py-0.5 text-[#6C7073] text-[11px] uppercase tracking-wide">
						{OPENFORT_CHAIN_LABEL}
					</span>
				)}
			</div>
			{openfortReady ? (
				<OpenfortCryptoWalletInner />
			) : (
				<p className="flex items-center gap-2 text-[#6C7073] text-sm">
					<Loader2 className="h-4 w-4 animate-spin" />
					Loading crypto wallet…
				</p>
			)}
		</section>
	);
}
