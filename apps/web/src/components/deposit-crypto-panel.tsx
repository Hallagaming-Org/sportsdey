import { useEthereumEmbeddedWallet } from "@openfort/react/ethereum";
import { Check, Copy, Info, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { OPENFORT_CHAIN_LABEL } from "@/lib/openfort/config";
import { useOpenfortReady } from "@/lib/openfort/scope";

type CryptoAsset = {
	id: string;
	symbol: string;
	network: string;
	hint: string;
};

const ASSETS: CryptoAsset[] = [
	{
		id: "pol-amoy",
		symbol: "POL",
		network: OPENFORT_CHAIN_LABEL,
		hint: "Send only POL on Polygon Amoy. Wrong network transfers can be lost.",
	},
	{
		id: "usdc-amoy",
		symbol: "USDC",
		network: OPENFORT_CHAIN_LABEL,
		hint: "Send only USDC on Polygon Amoy. Wrong network transfers can be lost.",
	},
];

function DepositCryptoPanelInner() {
	const evm = useEthereumEmbeddedWallet();
	const [assetId, setAssetId] = useState(ASSETS[0].id);
	const [copied, setCopied] = useState(false);

	const address =
		evm.address ?? evm.wallets[0]?.address ?? evm.activeWallet?.address;

	const walletsLoading =
		evm.status === "fetching-wallets" ||
		evm.status === "connecting" ||
		evm.status === "reconnecting";

	const availableAssets = useMemo(
		() => (address ? ASSETS : []),
		[address],
	);

	useEffect(() => {
		if (
			availableAssets.length > 0 &&
			!availableAssets.some((a) => a.id === assetId)
		) {
			setAssetId(availableAssets[0].id);
		}
	}, [availableAssets, assetId]);

	const handleCopy = async () => {
		if (!address) return;
		try {
			await navigator.clipboard.writeText(address);
			setCopied(true);
			toast.success("Deposit address copied");
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			toast.error("Could not copy address");
		}
	};

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
					No Polygon wallet yet. Close this modal and create one in the Crypto
					section on your wallet page first.
				</p>
			</div>
		);
	}

	const activeAsset =
		availableAssets.find((a) => a.id === assetId) ?? availableAssets[0];

	return (
		<>
			<div className="mb-4">
				<p className="mb-3 font-semibold text-base text-white sm:text-lg">
					Select asset
				</p>
				<div className="flex flex-wrap gap-2">
					{availableAssets.map((item) => {
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
					Testnet: POL / USDC on {OPENFORT_CHAIN_LABEL}.
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
						{availableAssets.map((item) => (
							<option key={item.id} value={item.id}>
								{item.symbol}
							</option>
						))}
					</select>
				</label>
				<label className="block">
					<span className="mb-1.5 block text-[#8C8F8F] text-sm">Network</span>
					<div className="w-full rounded-lg border border-[#1B2722] bg-[#111] px-4 py-3 text-sm text-white">
						{activeAsset.network}
					</div>
				</label>
			</div>

			<div className="mb-4 flex flex-col gap-4 rounded-2xl bg-[#040E0A] p-5 sm:flex-row sm:items-center">
				<div className="mx-auto flex h-[148px] w-[148px] shrink-0 items-center justify-center rounded-xl bg-white p-2 sm:mx-0">
					<QRCodeSVG value={address} size={132} level="M" includeMargin={false} />
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
