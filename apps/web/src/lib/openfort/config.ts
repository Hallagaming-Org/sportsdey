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

/** Polygon Amoy (testnet) — prediction market / crypto wallet chain */
export const OPENFORT_EVM_CHAIN_ID = 80002;

export const OPENFORT_CHAIN_LABEL = "Polygon Amoy";

/** Circle USDC on Polygon Amoy (6 decimals) */
export const POLYGON_AMOY_USDC =
	"0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582" as const;

export const USDC_DECIMALS = 6;
