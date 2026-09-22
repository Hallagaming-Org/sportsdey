import { useEthereumEmbeddedWallet } from "@openfort/react/ethereum";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Info, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useOpenfortBalances } from "@/lib/openfort/balances";
import {
	OPENFORT_CHAIN,
	OPENFORT_CHAIN_LABEL,
	OPENFORT_NATIVE_SYMBOL,
	OPENFORT_STABLECOIN_SYMBOL,
} from "@/lib/openfort/config";
import { useOpenfortReady } from "@/lib/openfort/scope";
import {
	canPassOpenfortAddressToQuidax,
	openQuidaxRampBuy,
} from "@/lib/quidax/ramp";

type CryptoAsset = {
	id: string;
	symbol: string;
	network: string;
	hint: string;
};

type CryptoDepositPath = "choose" | "naira" | "onchain";

function depositAssets(): CryptoAsset[] {
	return [
		{
			id: `${OPENFORT_NATIVE_SYMBOL.toLowerCase()}-${OPENFORT_CHAIN.key}`,
			symbol: OPENFORT_NATIVE_SYMBOL,
			network: OPENFORT_CHAIN_LABEL,
			hint: `Send only ${OPENFORT_NATIVE_SYMBOL} on ${OPENFORT_CHAIN_LABEL}. Wrong network transfers can be lost.`,
		},
		{
			id: `${OPENFORT_STABLECOIN_SYMBOL.toLowerCase()}-${OPENFORT_CHAIN.key}`,
			symbol: OPENFORT_STABLECOIN_SYMBOL,
			network: OPENFORT_CHAIN_LABEL,
			hint: `Send only ${OPENFORT_STABLECOIN_SYMBOL} on ${OPENFORT_CHAIN_LABEL}. Wrong network transfers can be lost.`,
		},
	];
}

function PathChooser({
	onChoose,
}: {
	onChoose: (path: Exclude<CryptoDepositPath, "choose">) => void;
}) {
	return (
		<div>
			<p className="mb-3 font-semibold text-base text-white sm:text-lg">
				How do you want to deposit?
			</p>
			<div className="grid gap-2 sm:grid-cols-2">
				<button
					type="button"
					onClick={() => onChoose("naira")}
					className="cursor-pointer rounded-lg border border-[#2A2B2A] bg-transparent px-4 py-3 text-left transition-colors hover:border-accent hover:bg-[#04100B]"
				>
					<p className="font-medium text-sm text-white">Naira</p>
					<p className="mt-1 text-[#8C8F8F] text-xs">
						Buy {OPENFORT_STABLECOIN_SYMBOL} with NGN. Credits your crypto
						wallet on-chain, not your Naira balance.
					</p>
				</button>
				<button
					type="button"
					onClick={() => onChoose("onchain")}
					className="cursor-pointer rounded-lg border border-[#2A2B2A] bg-transparent px-4 py-3 text-left transition-colors hover:border-accent hover:bg-[#04100B]"
				>
					<p className="font-medium text-sm text-white">On-chain address</p>
					<p className="mt-1 text-[#8C8F8F] text-xs">
						Send {OPENFORT_NATIVE_SYMBOL} or {OPENFORT_STABLECOIN_SYMBOL} on{" "}
						{OPENFORT_CHAIN_LABEL}.
					</p>
				</button>
			</div>
		</div>
	);
}

function NairaRampPanel({ address }: { address: `0x${string}` }) {
	const queryClient = useQueryClient();
	const { refetch: refetchBalances } = useOpenfortBalances(address);
	const [amount, setAmount] = useState("");
	const [opening, setOpening] = useState(false);
	const check = canPassOpenfortAddressToQuidax();

	const handleBuy = async () => {
		if (!check.ok) return;
		const ngn = amount.trim();
		if (ngn && Number(ngn) <= 0) {
			toast.error("Enter a valid Naira amount");
			return;
		}
		setOpening(true);
		try {
			await openQuidaxRampBuy({
				address,
				fromAmountNgn: ngn || undefined,
				onSuccess: () => {
					void refetchBalances();
					void queryClient.invalidateQueries({
						queryKey: ["crypto-incoming-transfers"],
					});
					toast.success(
						`${OPENFORT_STABLECOIN_SYMBOL} is on the way to your crypto wallet. This does not credit your Naira balance.`,
					);
				},
			});
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Could not open Naira buy",
			);
		} finally {
			setOpening(false);
		}
	};

	if (!check.ok) {
		return (
			<div className="rounded-2xl bg-[#040E0A] px-5 py-6">
				<p className="text-[#8C8F8F] text-sm">{check.reason}</p>
				<p className="mt-3 text-[#6C7073] text-xs">
					Use the on-chain address to deposit {OPENFORT_NATIVE_SYMBOL} or{" "}
					{OPENFORT_STABLECOIN_SYMBOL} on {OPENFORT_CHAIN_LABEL}.
				</p>
			</div>
		);
	}

	return (
		<>
			<p className="mb-3 text-[#8C8F8F] text-sm">
				Pay in Naira. Quidax sends {OPENFORT_STABLECOIN_SYMBOL} on{" "}
				{OPENFORT_CHAIN_LABEL} to your crypto address. This never credits your
				Sportsdey Naira wallet.
			</p>
			<label className="mb-4 block">
				<span className="mb-1.5 block text-[#8C8F8F] text-sm">
					Amount (NGN, optional)
				</span>
				<input
					value={amount}
					onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
					inputMode="decimal"
					placeholder="e.g. 5000"
					className="w-full rounded-lg border border-[#1B2722] bg-[#111] px-4 py-3 text-sm text-white placeholder:text-[#6B6E6C] focus:outline-none"
				/>
			</label>
			<button
				type="button"
				onClick={() => void handleBuy()}
				disabled={opening}
				className="w-full cursor-pointer rounded-xl bg-[#1BAA04] px-4 py-3 font-medium text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
			>
				{opening ? (
					<span className="inline-flex items-center justify-center gap-2">
						<Loader2 className="h-4 w-4 animate-spin" />
						Opening Naira buy…
					</span>
				) : (
					`Buy ${OPENFORT_STABLECOIN_SYMBOL} with Naira`
				)}
			</button>
		</>
	);
}

function OnChainAddressPanel({ address }: { address: string }) {
	const assets = useMemo(() => depositAssets(), []);
	const [assetId, setAssetId] = useState(assets[0].id);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (assets.length > 0 && !assets.some((a) => a.id === assetId)) {
			setAssetId(assets[0].id);
		}
	}, [assets, assetId]);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(address);
			setCopied(true);
			toast.success("Deposit address copied");
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			toast.error("Could not copy address");
		}
	};

	const activeAsset = assets.find((a) => a.id === assetId) ?? assets[0];

	return (
		<>
			<div className="mb-4">
				<p className="mb-3 font-semibold text-base text-white sm:text-lg">
					Select asset
				</p>
				<div className="flex flex-wrap gap-2">
					{assets.map((item) => {
						const selected = item.id === activeAsset.id;
						return (
							<button
								key={item.id}
								type="button"
								onClick={() => setAssetId(item.id)}
								className={`flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border font-semibold text-xs transition-colors ${
									selected
										? "border-accent bg-[#04100B] text-white"
										: "border-[#2A2B2A] bg-[#111] text-[#B5B7B5] hover:border-[#3A3B3A]"
								}`}
								aria-label={`${item.symbol} on ${item.network}`}
								title={`${item.symbol} · ${item.network}`}
							>
								{item.symbol.slice(0, 4)}
							</button>
						);
					})}
				</div>
				<p className="mt-2 text-[#6C7073] text-xs">
					{OPENFORT_CHAIN.isTestnet ? "Testnet: " : ""}
					{OPENFORT_NATIVE_SYMBOL} / {OPENFORT_STABLECOIN_SYMBOL} on{" "}
					{OPENFORT_CHAIN_LABEL}.
				</p>
			</div>

			<div className="mb-4 grid gap-3 sm:grid-cols-2">
				<label className="block">
					<span className="mb-1.5 block text-[#8C8F8F] text-sm">Currency</span>
					<select
						value={activeAsset.id}
						onChange={(e) => setAssetId(e.target.value)}
						className="w-full cursor-pointer rounded-lg border border-[#1B2722] bg-[#111] px-4 py-3 text-sm text-white focus:outline-none"
					>
						{assets.map((item) => (
							<option key={item.id} value={item.id}>
								{item.symbol}
							</option>
						))}
					</select>
				</label>
				<div>
					<p className="mb-1.5 text-[#8C8F8F] text-sm">Network</p>
					<div className="w-full rounded-lg border border-[#1B2722] bg-[#111] px-4 py-3 text-sm text-white">
						{activeAsset.network}
					</div>
				</div>
			</div>

			<div className="mb-4 flex flex-col gap-4 rounded-2xl bg-[#040E0A] p-5 sm:flex-row sm:items-center">
				<div className="mx-auto flex h-[148px] w-[148px] shrink-0 items-center justify-center rounded-xl bg-white p-2 sm:mx-0">
					<QRCodeSVG
						value={address}
						size={132}
						level="M"
						includeMargin={false}
					/>
				</div>
				<div className="min-w-0 flex-1">
					<p className="mb-1.5 text-[#8C8F8F] text-sm">Deposit address</p>
					<div className="flex items-center gap-2 rounded-lg bg-[#111] px-3 py-3">
						<span className="min-w-0 flex-1 break-all font-mono text-sm text-white">
							{address}
						</span>
						<button
							type="button"
							onClick={() => void handleCopy()}
							aria-label="Copy deposit address"
							className="shrink-0 cursor-pointer text-[#17b000] hover:opacity-80"
						>
							{copied ? (
								<Check className="h-4 w-4" strokeWidth={3} />
							) : (
								<Copy className="h-4 w-4" />
							)}
						</button>
					</div>
				</div>
			</div>

			<div className="flex items-start gap-3 rounded-lg bg-[#B5B7B5] px-4 py-3">
				<Info className="mt-0.5 h-4 w-4 shrink-0 text-black" />
				<p className="text-black text-sm">{activeAsset.hint}</p>
			</div>
		</>
	);
}

function DepositCryptoPanelInner() {
	const evm = useEthereumEmbeddedWallet();
	const [path, setPath] = useState<CryptoDepositPath>("choose");

	const address =
		evm.address ?? evm.wallets[0]?.address ?? evm.activeWallet?.address;

	const walletsLoading =
		evm.status === "fetching-wallets" ||
		evm.status === "connecting" ||
		evm.status === "reconnecting";

	if (walletsLoading && !address) {
		return (
			<div className="flex items-center justify-center gap-2 py-10 text-[#8C8F8F] text-sm">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading crypto wallet…
			</div>
		);
	}

	if (!address) {
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
			{path !== "choose" && (
				<button
					type="button"
					onClick={() => setPath("choose")}
					className="mb-4 cursor-pointer text-[#8C8F8F] text-sm hover:text-white"
				>
					← Back
				</button>
			)}
			{path === "choose" && <PathChooser onChoose={(next) => setPath(next)} />}
			{path === "naira" && (
				<NairaRampPanel address={address as `0x${string}`} />
			)}
			{path === "onchain" && <OnChainAddressPanel address={address} />}
		</>
	);
}

export function DepositCryptoPanel() {
	const openfortReady = useOpenfortReady();

	if (!openfortReady) {
		return (
			<div className="flex items-center justify-center gap-2 py-10 text-[#8C8F8F] text-sm">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading crypto…
			</div>
		);
	}

	return <DepositCryptoPanelInner />;
}
