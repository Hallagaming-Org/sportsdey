import { bsc, type Chain, mainnet, polygonAmoy } from "viem/chains";

/** Openfort is enabled only when both publishable keys are present. */
export function isOpenfortEnabled(): boolean {
	return Boolean(
		import.meta.env.VITE_OPENFORT_PUBLISHABLE_KEY &&
			import.meta.env.VITE_SHIELD_PUBLISHABLE_KEY,
	);
}

export const OPENFORT_PUBLISHABLE_KEY = import.meta.env
	.VITE_OPENFORT_PUBLISHABLE_KEY as string | undefined;

export const SHIELD_PUBLISHABLE_KEY = import.meta.env
	.VITE_SHIELD_PUBLISHABLE_KEY as string | undefined;

export const OPENFORT_FEE_SPONSORSHIP_ID = import.meta.env
	.VITE_OPENFORT_FEE_SPONSORSHIP_ID as string | undefined;

/**
 * Production chain + asset decision (EVM only — current Openfort wallet type).
 *
 * Quidax Ramp pays USDC/USDT on BEP20, ERC20, Solana, and TRC20. This app's
 * Openfort integration is Ethereum-embedded only, so Solana/TRC20 need a new
 * wallet type and are not used.
 *
 * Chosen production network: BNB Smart Chain (BEP20) + USDC.
 * ERC20 is the other compatible option; BEP20 is preferred for NGN on-ramp gas.
 * Set `VITE_OPENFORT_CHAIN=bsc` after the Openfort dashboard (Shield + fee
 * sponsorship) is on that chain. Default remains Amoy so existing test keys
 * keep working until that dashboard switch.
 */
export type OpenfortChainKey = "amoy" | "bsc" | "ethereum";

export const OPENFORT_PRODUCTION_CHAIN_KEY: OpenfortChainKey = "bsc";
export const OPENFORT_PRODUCTION_STABLECOIN = "USDC";
export const OPENFORT_PRODUCTION_QUIDAX_NETWORK = "BEP20";

const AMOY_USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582" as const;
/** Binance-Peg USDC on BNB Smart Chain (18 decimals). Override via env if Quidax pays a different contract. */
const BSC_USDC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" as const;
const ETH_USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;

const AMOY_RPC = "https://polygon-amoy.gateway.tenderly.co";
const BSC_RPC = "https://bsc-dataseed.binance.org";
const ETH_RPC = "https://eth.llamarpc.com";

export type OpenfortChainConfig = {
	key: OpenfortChainKey;
	chainId: number;
	label: string;
	isTestnet: boolean;
	nativeSymbol: string;
	stablecoinSymbol: "USDC" | "USDT";
	stablecoinAddress: `0x${string}`;
	stablecoinDecimals: number;
	rpcUrl: string;
	explorerTxBaseUrl: string;
	viemChain: Chain;
	/** Quidax widget `network` value. Null means this chain must never be passed to Ramp. */
	quidaxNetwork: "BEP20" | "ERC20" | null;
};

function parseChainKey(raw: string | undefined): OpenfortChainKey {
	const v = (raw ?? "amoy").trim().toLowerCase();
	if (v === "bsc" || v === "bep20" || v === "56") return "bsc";
	if (v === "ethereum" || v === "eth" || v === "erc20" || v === "1") {
		return "ethereum";
	}
	return "amoy";
}

function parseStablecoinSymbol(
	raw: string | undefined,
	fallback: "USDC" | "USDT",
): "USDC" | "USDT" {
	const v = (raw ?? "").trim().toUpperCase();
	if (v === "USDT" || v === "USDC") return v;
	return fallback;
}

function chainPreset(key: OpenfortChainKey): OpenfortChainConfig {
	if (key === "bsc") {
		return {
			key,
			chainId: 56,
			label: "BNB Smart Chain",
			isTestnet: false,
			nativeSymbol: "BNB",
			stablecoinSymbol: "USDC",
			stablecoinAddress: BSC_USDC,
			stablecoinDecimals: 18,
			rpcUrl: BSC_RPC,
			explorerTxBaseUrl: "https://bscscan.com/tx",
			viemChain: bsc,
			quidaxNetwork: "BEP20",
		};
	}
	if (key === "ethereum") {
		return {
			key,
			chainId: 1,
			label: "Ethereum",
			isTestnet: false,
			nativeSymbol: "ETH",
			stablecoinSymbol: "USDC",
			stablecoinAddress: ETH_USDC,
			stablecoinDecimals: 6,
			rpcUrl: ETH_RPC,
			explorerTxBaseUrl: "https://etherscan.io/tx",
			viemChain: mainnet,
			quidaxNetwork: "ERC20",
		};
	}
	return {
		key: "amoy",
		chainId: 80002,
		label: "Polygon Amoy",
		isTestnet: true,
		nativeSymbol: "POL",
		stablecoinSymbol: "USDC",
		stablecoinAddress: AMOY_USDC,
		stablecoinDecimals: 6,
		rpcUrl: AMOY_RPC,
		explorerTxBaseUrl: "https://amoy.polygonscan.com/tx",
		viemChain: polygonAmoy,
		quidaxNetwork: null,
	};
}

function resolveRpcUrl(preset: OpenfortChainConfig): string {
	const explicit = import.meta.env.VITE_OPENFORT_RPC as string | undefined;
	if (explicit) return explicit;
	if (preset.key === "amoy") {
		const legacy = import.meta.env.VITE_POLYGON_AMOY_RPC as string | undefined;
		if (legacy) return legacy;
	}
	return preset.rpcUrl;
}

const chainKey = parseChainKey(import.meta.env.VITE_OPENFORT_CHAIN);
const preset = chainPreset(chainKey);
const envStablecoin = import.meta.env.VITE_OPENFORT_STABLECOIN_ADDRESS as
	| string
	| undefined;
const envDecimals = import.meta.env.VITE_OPENFORT_STABLECOIN_DECIMALS as
	| string
	| undefined;

export const OPENFORT_CHAIN: OpenfortChainConfig = {
	...preset,
	stablecoinSymbol: parseStablecoinSymbol(
		import.meta.env.VITE_OPENFORT_STABLECOIN_SYMBOL,
		preset.stablecoinSymbol,
	),
	stablecoinAddress: (envStablecoin ||
		preset.stablecoinAddress) as `0x${string}`,
	stablecoinDecimals: envDecimals
		? Number.parseInt(envDecimals, 10)
		: preset.stablecoinDecimals,
	rpcUrl: resolveRpcUrl(preset),
};

export const OPENFORT_EVM_CHAIN_ID = OPENFORT_CHAIN.chainId;
export const OPENFORT_CHAIN_LABEL = OPENFORT_CHAIN.label;
export const OPENFORT_STABLECOIN_ADDRESS = OPENFORT_CHAIN.stablecoinAddress;
export const OPENFORT_STABLECOIN_DECIMALS = OPENFORT_CHAIN.stablecoinDecimals;
export const OPENFORT_STABLECOIN_SYMBOL = OPENFORT_CHAIN.stablecoinSymbol;
export const OPENFORT_NATIVE_SYMBOL = OPENFORT_CHAIN.nativeSymbol;
export const OPENFORT_VIEM_CHAIN = OPENFORT_CHAIN.viemChain;
