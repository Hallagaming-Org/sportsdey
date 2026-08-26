/// <reference types="vite-plugin-svgr/client" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_OPENFORT_PUBLISHABLE_KEY?: string;
	readonly VITE_SHIELD_PUBLISHABLE_KEY?: string;
	readonly VITE_OPENFORT_FEE_SPONSORSHIP_ID?: string;
	readonly VITE_OPENFORT_CHAIN?: string;
	readonly VITE_OPENFORT_RPC?: string;
	readonly VITE_POLYGON_AMOY_RPC?: string;
	readonly VITE_OPENFORT_STABLECOIN_ADDRESS?: string;
	readonly VITE_OPENFORT_STABLECOIN_DECIMALS?: string;
	readonly VITE_OPENFORT_STABLECOIN_SYMBOL?: string;
	readonly VITE_QUIDAX_RAMP_PUBLIC_KEY?: string;
	readonly VITE_QUIDAX_RAMP_TO_CURRENCY?: string;
	readonly VITE_WALLET_CONNECT_PROJECT_ID?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
