import { getAffnookTimestamp } from "@/utils/affnook";
import type { CloudflareBindings } from "../../types";
import { affnookRequest } from "./client";
import { getAffnookConfig, isAffnookConfigured } from "./config";
import type {
	AffnookApiResult,
	AffnookCreateCustomerInput,
	AffnookCustomerLoginInput,
} from "./types";


export async function createAffnookCustomer(
	env: CloudflareBindings,
	input: AffnookCreateCustomerInput,
): Promise<AffnookApiResult> {
	if (!isAffnookConfigured(env)) {
		return {
			ok: false,
			status: 500,
			error: "Affnook is not configured. Set AFFNOOK_API_KEY.",
		};
	}

	const config = getAffnookConfig(env);
	const payload: Record<string, unknown> = {
		customerId: input.customerId,
		customerName: input.customerName,
		timestamp: input.timestamp ?? getAffnookTimestamp(),
		currency: (input.currency || config.currency || "NGN").toUpperCase(),
		country: (input.country || config.defaultCountry || "NG").toUpperCase(),
	};

	if (input.email) payload.email = input.email;
	if (input.brandId || config.brandId) {
		payload.brandId = input.brandId || config.brandId;
	}
	if (input.productId || config.productId) {
		payload.productId = input.productId || config.productId;
	}
	if (input.trackingToken) payload.trackingToken = input.trackingToken;
	if (input.promocode || config.defaultPromocode) {
		payload.promocode = input.promocode || config.defaultPromocode;
	}

	const result = await affnookRequest(env, "/api/admin/v2/customers", {
		method: "POST",
		body: payload,
	});

	if (
		!result.ok &&
		typeof result.data === "object" &&
		result.data !== null &&
		"error" in result.data
	) {
		const errorStatus = (
			result.data as { error?: { error_status?: number; message?: string } }
		).error?.error_status;
		const message = (
			result.data as { error?: { message?: string } }
		).error?.message;
		if (
			errorStatus === 302 ||
			errorStatus === 301 ||
			message?.toLowerCase().includes("already exist")
		) {
			return {
				ok: true,
				status: 200,
				data: result.data,
				message: message || result.error,
			};
		}
	}

	return result;
}

export async function recordAffnookCustomerLogin(
	env: CloudflareBindings,
	input: AffnookCustomerLoginInput,
): Promise<AffnookApiResult> {
	if (!isAffnookConfigured(env)) {
		return {
			ok: false,
			status: 500,
			error: "Affnook is not configured. Set AFFNOOK_API_KEY.",
		};
	}

	const payload: Record<string, unknown> = {
		customer_id: input.customerId,
		timestamp: input.timestamp ?? getAffnookTimestamp(),
	};

	if (input.browser) payload.browser = input.browser;
	if (input.os) payload.os = input.os;
	if (input.ip) payload.ip = input.ip;
	if (input.userAgent) payload.ua = input.userAgent;
	if (input.city) payload.city = input.city;
	if (input.region) payload.region = input.region;
	if (input.country) payload.country = input.country;

	return affnookRequest(env, "/api/admin/v2/customer-login", {
		method: "POST",
		body: payload,
	});
}
