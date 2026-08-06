/** Openfort is enabled only when both publishable keys are present (local .env.local). */
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

/** Base Sepolia */
export const OPENFORT_EVM_CHAIN_ID = 84532;

/** Circle USDC on Base Sepolia (6 decimals) */
export const BASE_SEPOLIA_USDC =
	"0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;

/** Circle USDC mint on Solana Devnet (6 decimals) */
export const SOLANA_DEVNET_USDC_MINT =
	"4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export const SOLANA_DEVNET_RPC =
	import.meta.env.VITE_SOLANA_DEVNET_RPC || "https://api.devnet.solana.com";

export const USDC_DECIMALS = 6;
export const SOL_DECIMALS = 9;
