import { OPENFORT_CHAIN } from "@/lib/openfort/config";

/**
 * Quidax Ramp (client-only). Public key in web env; never put the
 * Quidax private key in the web app.
 *
 * Official integration is `window.ramp.initialize()` from ramp.js. That
 * mounts an overlay iframe to https://ramp.quidax.io and posts
 * INITIALIZE_QUIDAX_RAMP after load. Opening ramp.quidax.io as a tab
 * stays blank: checkout posts `ready` to `parent`, Cloudflare COOP
 * severs `window.opener`, and the page never receives init.
 *
 * Worker webhooks only acknowledge events. Crypto is paid on-chain to the
 * Openfort address — never creditWallet / Paystack / OPay.
 */
export const QUIDAX_RAMP_CHECKOUT_URL = "https://ramp.quidax.io";
export const QUIDAX_RAMP_SCRIPT_URL =
	"https://d309lcjd52k0i0.cloudfront.net/ramp.js";

export const QUIDAX_RAMP_PUBLIC_KEY = import.meta.env
	.VITE_QUIDAX_RAMP_PUBLIC_KEY as string | undefined;

export type QuidaxRampAddressCheck =
	| { ok: true; network: "polygon"; toCurrency: string }
	| { ok: false; reason: string };

type QuidaxRampSdk = {
	initialize: (config: Record<string, unknown>) => void;
	destroy?: () => void;
};

/**
 * Hard rule: never pass a testnet (Amoy) Openfort address to Quidax.
 * Production payouts are Polygon + USDC only.
 */
export function canPassOpenfortAddressToQuidax(
	chain = OPENFORT_CHAIN,
	publicKey = QUIDAX_RAMP_PUBLIC_KEY,
): QuidaxRampAddressCheck {
	if (chain.chainId === 80002 || chain.isTestnet || chain.key === "amoy") {
		return {
			ok: false,
			reason:
				"Naira buy is unavailable on testnet. The Crypto address is not on a Quidax production network.",
		};
	}
	if (chain.quidaxNetwork !== "polygon") {
		return {
			ok: false,
			reason: `This Openfort chain (${chain.label}) is not a Quidax payout network. Use Polygon.`,
		};
	}
	if (!publicKey?.trim() || !publicKey.trim().startsWith("pub_")) {
		return {
			ok: false,
			reason: "Naira buy is not configured (missing Quidax Ramp public key).",
		};
	}
	return {
		ok: true,
		network: chain.quidaxNetwork,
		toCurrency: (
			import.meta.env.VITE_QUIDAX_RAMP_TO_CURRENCY || chain.stablecoinSymbol
		).toLowerCase(),
	};
}

export function isQuidaxRampBuyEnabled(): boolean {
	return canPassOpenfortAddressToQuidax().ok;
}

export function createQuidaxRampReference(): string {
	const rand = Math.random().toString(36).slice(2, 10);
	return `sd-ramp-${Date.now()}-${rand}`;
}

function getRampSdk(): QuidaxRampSdk | undefined {
	if (typeof window === "undefined") return undefined;
	return (window as Window & { ramp?: QuidaxRampSdk }).ramp;
}

function loadQuidaxRampScript(): Promise<QuidaxRampSdk> {
	const existing = getRampSdk();
	if (existing?.initialize) return Promise.resolve(existing);

	return new Promise((resolve, reject) => {
		const finish = () => {
			const sdk = getRampSdk();
			if (sdk?.initialize) {
				resolve(sdk);
				return;
			}
			reject(new Error("Quidax Ramp failed to load"));
		};

		const found = document.querySelector<HTMLScriptElement>(
			'script[data-quidax-ramp="1"]',
		);
		if (found) {
			found.addEventListener("load", finish, { once: true });
			found.addEventListener(
				"error",
				() => reject(new Error("Could not load Quidax Ramp")),
				{ once: true },
			);
			return;
		}

		const script = document.createElement("script");
		script.src = QUIDAX_RAMP_SCRIPT_URL;
		script.async = true;
		script.dataset.quidaxRamp = "1";
		script.addEventListener("load", finish, { once: true });
		script.addEventListener(
			"error",
			() => reject(new Error("Could not load Quidax Ramp")),
			{ once: true },
		);
		document.head.appendChild(script);
	});
}

export async function openQuidaxRampBuy(params: {
	address: string;
	fromAmountNgn?: string;
	onSuccess?: () => void;
	onClose?: () => void;
}): Promise<void> {
	const check = canPassOpenfortAddressToQuidax();
	if (!check.ok) {
		throw new Error(check.reason);
	}
	if (!QUIDAX_RAMP_PUBLIC_KEY?.trim().startsWith("pub_")) {
		throw new Error("Missing Quidax Ramp public key");
	}
	if (typeof window === "undefined") {
		throw new Error("Quidax Ramp is browser-only");
	}

	const publicKey = QUIDAX_RAMP_PUBLIC_KEY.trim();
	if (!publicKey.startsWith("pub_")) {
		throw new Error("Quidax Ramp public key is not a Ramp pub_ key.");
	}

	const ramp = await loadQuidaxRampScript();
	ramp.initialize({
		public_key: publicKey,
		reference: createQuidaxRampReference(),
		from_currency: "ngn",
		to_currency: check.toCurrency,
		...(params.fromAmountNgn ? { from_amount: params.fromAmountNgn } : {}),
		mode: "buy",
		address: params.address,
		network: check.network,
		enableWalletConnect: false,
		onClose: () => params.onClose?.(),
		onSuccess: () => params.onSuccess?.(),
	});
}
