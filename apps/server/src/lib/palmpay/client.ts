import crypto from "node:crypto";
import type { CloudflareBindings } from "../../types";

const BASE_URLS = { sandbox: "https://open-gw-sandbox.palmpay-inc.com", production: "https://open-gw-prod.palmpay-inc.com" } as const;
type PalmPayPayload = Record<string, string | number | undefined>;

function pem(value: string, type: "PRIVATE" | "PUBLIC") {
	const body = value.replace(/-----[^-]+-----|\s/g, "");
	return `-----BEGIN ${type} KEY-----\n${body}\n-----END ${type} KEY-----`;
}

function canonicalize(payload: PalmPayPayload) {
	return Object.entries(payload)
		.filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
		.map(([key, value]) => [key, String(value).trim()] as const)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, value]) => `${key}=${value}`).join("&");
}

export function signPalmPay(payload: PalmPayPayload, privateKey: string) {
	const md5 = crypto.createHash("md5").update(canonicalize(payload)).digest("hex").toUpperCase();
	return crypto.createSign("RSA-SHA1").update(md5).end().sign(pem(privateKey, "PRIVATE"), "base64");
}

export function verifyPalmPay(payload: PalmPayPayload, signature: string, publicKey: string) {
	const md5 = crypto.createHash("md5").update(canonicalize(payload)).digest("hex").toUpperCase();
	return crypto.createVerify("RSA-SHA1").update(md5).end().verify(pem(publicKey, "PUBLIC"), signature, "base64");
}

function base(env: CloudflareBindings) { return BASE_URLS[env.PALMPAY_ENV === "production" ? "production" : "sandbox"]; }
function requestFields(fields: PalmPayPayload) { return { requestTime: Date.now(), version: "V1.1", nonceStr: crypto.randomBytes(16).toString("hex"), ...fields }; }

export async function createPalmPayOrder(env: CloudflareBindings, input: { reference: string; amount: number; userId: string; mobile?: string }) {
	const body = requestFields({ orderId: input.reference, title: "Sportsdey wallet top-up", description: "Sportsdey wallet deposit", userId: input.userId, userMobileNo: input.mobile, amount: input.amount, currency: "NGN", notifyUrl: `${env.SERVER_URL}/palmpay/webhook`, callBackUrl: `${env.FRONTEND_URL}/wallet?deposit=processing&reference=${encodeURIComponent(input.reference)}`, orderExpireTime: 1800, productType: "bank_transfer" });
	const response = await fetch(`${base(env)}/api/v2/payment/merchant/createorder`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", CountryCode: "NG", Authorization: `Bearer ${env.PALMPAY_APP_ID}`, Signature: signPalmPay(body, env.PALMPAY_MERCHANT_PRIVATE_KEY) }, body: JSON.stringify(body) });
	const json = await response.json() as { respCode?: string; respMsg?: string; data?: { orderNo: string; checkoutUrl?: string } };
	if (!response.ok || json.respCode !== "00000000" || !json.data?.orderNo) throw new Error(`PalmPay create order failed: ${json.respCode ?? response.status}`);
	return json.data;
}

export async function queryPalmPayOrder(env: CloudflareBindings, reference: string) {
	const body = requestFields({ orderId: reference });
	const response = await fetch(`${base(env)}/api/v2/payment/merchant/order/queryStatus`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", CountryCode: "NG", Authorization: `Bearer ${env.PALMPAY_APP_ID}`, Signature: signPalmPay(body, env.PALMPAY_MERCHANT_PRIVATE_KEY) }, body: JSON.stringify(body) });
	const json = await response.json() as { respCode?: string; data?: { orderStatus?: number; amount?: number } };
	if (!response.ok || json.respCode !== "00000000" || !json.data) throw new Error(`PalmPay status query failed: ${json.respCode ?? response.status}`);
	return json.data;
}
