import { OPENFORT_CHAIN } from "@/lib/openfort/config";

/**
 * Quidax Ramp (client-only). Public key in web env; never put the
 * Quidax private key in the web app.
 *
 * Official ramp.js mounts an iframe to https://ramp.quidax.io. That origin
 * answers cross-site iframes with Cloudflare Bot Fight (X-Frame-Options:
 * SAMEORIGIN), which Chrome renders as "ramp.quidax.io refused to connect."
 * We open the same checkout as a popup and send INITIALIZE_QUIDAX_RAMP via
 * postMessage — the protocol ramp.js already uses after iframe load.
 *
 * Worker webhooks only acknowledge events. Crypto is paid on-chain to the
 * Openfort address — never creditWallet / Paystack / OPay.
 */
export const QUIDAX_RAMP_CHECKOUT_URL = "https://ramp.quidax.io";

export const QUIDAX_RAMP_PUBLIC_KEY = import.meta.env
	.VITE_QUIDAX_RAMP_PUBLIC_KEY as string | undefined;

export type QuidaxRampAddressCheck =
	| { ok: true; network: "POLYGON"; toCurrency: string }
	| { ok: false; reason: string };

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
	if (chain.quidaxNetwork !== "POLYGON") {
		return {
			ok: false,
			reason: `This Openfort chain (${chain.label}) is not a Quidax payout network. Use Polygon.`,
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

type QuidaxRampInitPayload = {
	type: "INITIALIZE_QUIDAX_RAMP";
	public_key: string;
	reference: string;
	from_currency: string;
	to_currency: string;
	from_amount?: string;
	mode: "buy";
	address: string;
	network: string;
	enableWalletConnect: false;
};

function isQuidaxCheckoutOrigin(origin: string): boolean {
	return origin === QUIDAX_RAMP_CHECKOUT_URL;
}

function postRampInit(target: Window, payload: QuidaxRampInitPayload) {
	target.postMessage(payload, QUIDAX_RAMP_CHECKOUT_URL);
}

export function openQuidaxRampBuy(params: {
	address: string;
	fromAmountNgn?: string;
	onSuccess?: () => void;
	onClose?: () => void;
}): void {
	const check = canPassOpenfortAddressToQuidax();
	if (!check.ok) {
		throw new Error(check.reason);
	}
	if (!QUIDAX_RAMP_PUBLIC_KEY) {
		throw new Error("Missing Quidax Ramp public key");
	}
	if (typeof window === "undefined") {
		throw new Error("Quidax Ramp is browser-only");
	}

	const payload: QuidaxRampInitPayload = {
		type: "INITIALIZE_QUIDAX_RAMP",
		public_key: QUIDAX_RAMP_PUBLIC_KEY,
		reference: createQuidaxRampReference(),
		from_currency: "ngn",
		to_currency: check.toCurrency,
		...(params.fromAmountNgn ? { from_amount: params.fromAmountNgn } : {}),
		mode: "buy",
		address: params.address,
		network: check.network,
		enableWalletConnect: false,
	};

	// Must run in the same tick as the click. Any await here gets the popup blocked.
	const popup = window.open(
		QUIDAX_RAMP_CHECKOUT_URL,
		"quidax-ramp",
		"popup=yes,width=480,height=740,scrollbars=yes,resizable=yes",
	);
	if (!popup) {
		throw new Error(
			"Allow popups for sportsdey.com to continue Naira buy with Quidax.",
		);
	}

	let settled = false;
	const finish = (kind: "success" | "close") => {
		if (settled) return;
		settled = true;
		window.removeEventListener("message", onMessage);
		window.clearInterval(closedPoll);
		window.clearInterval(initPoll);
		if (!popup.closed) popup.close();
		if (kind === "success") {
			params.onSuccess?.();
		} else {
			params.onClose?.();
		}
	};

	const onMessage = (event: MessageEvent) => {
		if (!isQuidaxCheckoutOrigin(event.origin)) return;
		const type =
			event.data && typeof event.data === "object"
				? (event.data as { type?: string }).type
				: undefined;
		if (type === "ready") {
			window.clearInterval(initPoll);
			postRampInit(popup, payload);
			return;
		}
		if (type === "quidaxRampTransactionSuccess") {
			finish("success");
			return;
		}
		if (type === "closeQuidaxRampWidget") {
			finish("close");
		}
	};

	window.addEventListener("message", onMessage);
	const initPoll = window.setInterval(() => {
		if (popup.closed) return;
		try {
			postRampInit(popup, payload);
		} catch {
			// Popup may not be ready yet.
		}
	}, 800);
	const closedPoll = window.setInterval(() => {
		if (popup.closed) finish("close");
	}, 400);
}
