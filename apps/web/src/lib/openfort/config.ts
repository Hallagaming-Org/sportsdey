import { type Chain, polygon, polygonAmoy } from "viem/chains";

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
 * Openfort is Polygon-only. Production is Polygon PoS + native USDC.
 * Amoy stays for test keys. BSC / Ethereum are not offered.
 *
 * Set `VITE_OPENFORT_CHAIN=polygon` after the Openfort dashboard (Shield +
 * fee sponsorship) is on chain 137. Default remains Amoy so existing test
 * keys keep working until that dashboard switch.
 */
export type OpenfortChainKey = "amoy" | "polygon";

export const OPENFORT_PRODUCTION_CHAIN_KEY: OpenfortChainKey = "polygon";
export const OPENFORT_PRODUCTION_STABLECOIN = "USDC";
export const OPENFORT_PRODUCTION_QUIDAX_NETWORK = "POLYGON";

const AMOY_USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582" as const;
/** Circle native USDC on Polygon PoS (6 decimals). Override via env if Quidax pays USDC.e. */
const POLYGON_USDC = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" as const;

const AMOY_RPC = "https://polygon-amoy.gateway.tenderly.co";
const POLYGON_RPC = "https://polygon-rpc.com";

export type OpenfortQuidaxNetwork = "POLYGON";

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
	quidaxNetwork: OpenfortQuidaxNetwork | null;
};

function parseChainKey(raw: string | undefined): OpenfortChainKey {
	const v = (raw ?? "amoy").trim().toLowerCase();
	if (v === "amoy" || v === "80002" || v === "testnet") return "amoy";
	if (
		v === "polygon" ||
		v === "matic" ||
		v === "pol" ||
		v === "137" ||
		v === "polygon-mainnet"
	) {
		return "polygon";
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
	if (key === "polygon") {
		return {
			key,
			chainId: 137,
			label: "Polygon",
			isTestnet: false,
			nativeSymbol: "POL",
			stablecoinSymbol: "USDC",
			stablecoinAddress: POLYGON_USDC,
			stablecoinDecimals: 6,
			rpcUrl: POLYGON_RPC,
			explorerTxBaseUrl: "https://polygonscan.com/tx",
			viemChain: polygon,
			quidaxNetwork: "POLYGON",
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
