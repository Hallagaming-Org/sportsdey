import { OPENFORT_CHAIN } from "@/lib/openfort/config";

/**
 * Quidax Ramp widget (client-only). Public key in web env; never put the
 * Quidax private key in the web app.
 *
 * Worker + buy_transaction webhooks are intentionally not implemented.
 * Stay on the widget until we need server-issued merchant_reference rows,
 * payouts that complete after the modal closes, custom bank-account UI,
 * refund / needs_attention handling, or settlement that cannot trust
 * widget onSuccess. If that work is added later: the Worker holds the
 * private key and still must never call creditWallet / Paystack / OPay.
 */
export const QUIDAX_RAMP_SCRIPT_URL =
	"https://d309lcjd52k0i0.cloudfront.net/ramp.js";

export const QUIDAX_RAMP_PUBLIC_KEY = import.meta.env
	.VITE_QUIDAX_RAMP_PUBLIC_KEY as string | undefined;

export type QuidaxRampAddressCheck =
	| { ok: true; network: "BEP20" | "ERC20"; toCurrency: string }
	| { ok: false; reason: string };

/**
 * Hard rule: never pass a testnet (Amoy) Openfort address to Quidax.
 * Production payouts are BEP20/ERC20 only with the current EVM wallet.
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
	if (chain.quidaxNetwork !== "BEP20" && chain.quidaxNetwork !== "ERC20") {
		return {
			ok: false,
			reason: `This Openfort chain (${chain.label}) is not a Quidax payout network. Use BEP20 or ERC20.`,
		};
	}
	if (!publicKey?.trim()) {
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

export type QuidaxRampInitializeOptions = {
	public_key: string;
	reference: string;
	from_currency: string;
	to_currency: string;
	from_amount?: string;
	mode: "buy" | "sell";
	address?: string;
	network: string;
	onClose?: (ref: unknown) => void;
	onSuccess?: (transaction: unknown) => void;
	onReceiveWalletDetails?: (walletDetails: unknown) => void;
};

declare global {
	interface Window {
		ramp?: {
			initialize: (options: QuidaxRampInitializeOptions) => void;
		};
	}
}

let scriptLoad: Promise<void> | null = null;

export function loadQuidaxRampScript(): Promise<void> {
	if (typeof window === "undefined") {
		return Promise.reject(new Error("Quidax Ramp is browser-only"));
	}
	if (window.ramp) return Promise.resolve();
	if (scriptLoad) return scriptLoad;

	scriptLoad = new Promise((resolve, reject) => {
		const existing = document.querySelector<HTMLScriptElement>(
			`script[src="${QUIDAX_RAMP_SCRIPT_URL}"]`,
		);
		if (existing) {
			if (window.ramp) {
				resolve();
				return;
			}
			existing.addEventListener("load", () => resolve(), { once: true });
			existing.addEventListener(
				"error",
				() => reject(new Error("Failed to load Quidax Ramp")),
				{ once: true },
			);
			return;
		}

		const script = document.createElement("script");
		script.src = QUIDAX_RAMP_SCRIPT_URL;
		script.async = true;
		script.onload = () => resolve();
		script.onerror = () => {
			scriptLoad = null;
			reject(new Error("Failed to load Quidax Ramp"));
		};
		document.head.appendChild(script);
	});

	return scriptLoad;
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
	if (!QUIDAX_RAMP_PUBLIC_KEY) {
		throw new Error("Missing Quidax Ramp public key");
	}

	await loadQuidaxRampScript();
	if (!window.ramp) {
		throw new Error("Quidax Ramp failed to initialize");
	}

	window.ramp.initialize({
		public_key: QUIDAX_RAMP_PUBLIC_KEY,
		reference: createQuidaxRampReference(),
		from_currency: "ngn",
		to_currency: check.toCurrency,
		...(params.fromAmountNgn ? { from_amount: params.fromAmountNgn } : {}),
		mode: "buy",
		address: params.address,
		network: check.network,
		onClose: () => {
			params.onClose?.();
		},
		onSuccess: () => {
			// On-chain credit is Quidax's payout to Openfort — never D1 / creditWallet.
			params.onSuccess?.();
		},
	});
}
