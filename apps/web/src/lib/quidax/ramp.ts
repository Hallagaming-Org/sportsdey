import { OPENFORT_CHAIN } from "@/lib/openfort/config";

/**
 * Quidax Ramp (client-only). Public key in web env; never put the
 * Quidax private key in the web app.
 *
 * Do not put `public_key` (or the rest of the payload) on the checkout
 * URL. Quidax treats `?public_key=` as a standalone session, checks it
 * without sportsdey.com as the parent, and shows "Invalid public key"
 * in the address bar.
 *
 * Official ramp.js iframes ramp.quidax.io; Cloudflare answers that
 * iframe with X-Frame-Options: SAMEORIGIN ("refused to connect").
 * We open a clean checkout tab and send INITIALIZE_QUIDAX_RAMP from
 * this origin via postMessage — the protocol ramp.js uses after load.
 *
 * Worker webhooks only acknowledge events. Crypto is paid on-chain to the
 * Openfort address — never creditWallet / Paystack / OPay.
 */
export const QUIDAX_RAMP_CHECKOUT_URL = "https://ramp.quidax.io";

export const QUIDAX_RAMP_PUBLIC_KEY = import.meta.env
	.VITE_QUIDAX_RAMP_PUBLIC_KEY as string | undefined;

export type QuidaxRampAddressCheck =
	| { ok: true; network: "polygon"; toCurrency: string }
	| { ok: false; reason: string };

export type QuidaxRampOpenMode = "popup";

type QuidaxRampConfig = {
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

function isQuidaxCheckoutOrigin(origin: string): boolean {
	return origin === QUIDAX_RAMP_CHECKOUT_URL;
}

function postRampInit(target: Window, config: QuidaxRampConfig) {
	target.postMessage(
		{ type: "INITIALIZE_QUIDAX_RAMP", ...config },
		QUIDAX_RAMP_CHECKOUT_URL,
	);
}

export async function openQuidaxRampBuy(params: {
	address: string;
	fromAmountNgn?: string;
	onSuccess?: () => void;
	onClose?: () => void;
}): Promise<QuidaxRampOpenMode> {
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

	const config: QuidaxRampConfig = {
		public_key: QUIDAX_RAMP_PUBLIC_KEY.trim(),
		reference: createQuidaxRampReference(),
		from_currency: "ngn",
		to_currency: check.toCurrency,
		...(params.fromAmountNgn ? { from_amount: params.fromAmountNgn } : {}),
		mode: "buy",
		address: params.address,
		network: check.network,
		enableWalletConnect: false,
	};

	// Clean URL only — never put the public key in the address bar.
	// Must run in the same tick as the click.
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
	let initPoll = 0;
	let closedPoll = 0;

	const sendInit = () => {
		if (popup.closed) return;
		try {
			postRampInit(popup, config);
		} catch {
			// Checkout window may not accept messages yet (CF challenge).
		}
	};

	const finish = (kind: "success" | "close") => {
		if (settled) return;
		settled = true;
		window.clearInterval(initPoll);
		window.clearInterval(closedPoll);
		window.removeEventListener("message", onMessage);
		if (!popup.closed) popup.close();
		if (kind === "success") params.onSuccess?.();
		else params.onClose?.();
	};

	const onMessage = (event: MessageEvent) => {
		if (!isQuidaxCheckoutOrigin(event.origin)) return;
		const type =
			event.data && typeof event.data === "object"
				? (event.data as { type?: string }).type
				: undefined;
		if (type === "ready") {
			sendInit();
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
	sendInit();
	initPoll = window.setInterval(sendInit, 600);
	window.setTimeout(() => window.clearInterval(initPoll), 45_000);
	closedPoll = window.setInterval(() => {
		if (popup.closed) finish("close");
	}, 400);

	return "popup";
}
