import {
	AccountTypeEnum,
	RecoveryMethod,
} from "@openfort/react";
import { useEthereumEmbeddedWallet } from "@openfort/react/ethereum";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useSession } from "@/lib/auth/client";
import {
	formatCryptoAmount,
	USDC_DECIMALS,
	usePolygonAmoyBalances,
} from "@/lib/openfort/balances";
import {
	isOpenfortEnabled,
	OPENFORT_CHAIN_LABEL,
} from "@/lib/openfort/config";

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

function PolygonBalances({ address }: { address: `0x${string}` }) {
	const { pol, usdc, isLoading, isFetching, refetch } =
		usePolygonAmoyBalances(address);

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
					aria-label="Refresh Polygon balances"
				>
					<RefreshCw
						className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
					/>
				</button>
			</div>
			<BalanceLine
				label="POL"
				isLoading={isLoading}
				value={`${formatCryptoAmount(pol.data?.value, 18)} POL`}
			/>
			<BalanceLine
				label="USDC"
				isLoading={isLoading}
				value={`${formatCryptoAmount(usdc.data, USDC_DECIMALS)} USDC`}
			/>
			{(pol.isError || usdc.isError) && (
				<p className="text-red-400 text-xs">Could not load Polygon balances.</p>
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
		creating ||
		evm.status === "creating" ||
		evm.status === "fetching-wallets";

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
				err instanceof Error
					? err.message
					: "Failed to create Polygon wallet",
			);
		} finally {
			setCreating(false);
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
				passkey. Network: {OPENFORT_CHAIN_LABEL}.
			</p>

			<div className="space-y-3 rounded-xl border border-[#1B2722] bg-[#04100B] p-4">
				{address ? (
					<div>
						<AddressRow label={OPENFORT_CHAIN_LABEL} address={address} />
						<PolygonBalances address={address} />
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
								Creating Polygon wallet…
							</span>
						) : (
							"Create Polygon wallet (passkey)"
						)}
					</button>
				)}
			</div>

			{error && <p className="text-red-400 text-sm">{error}</p>}
		</div>
	);
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
			<OpenfortCryptoWalletInner />
		</section>
	);
}
