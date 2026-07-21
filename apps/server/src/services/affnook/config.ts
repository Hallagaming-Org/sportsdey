import type { CloudflareBindings } from "../../types";

export function getAffnookConfig(env: CloudflareBindings) {
	return {
		baseUrl: (env.AFFNOOK_BASE_URL || "https://api.affnook.io").replace(
			/\/$/,
			"",
		),
		apiKey: env.AFFNOOK_API_KEY || "",
		brandId: env.AFFNOOK_BRAND_ID || "",
		productId: env.AFFNOOK_PRODUCT_ID || "",
		currency: (env.AFFNOOK_CURRENCY || "NGN").toUpperCase(),
		defaultCountry: (env.AFFNOOK_DEFAULT_COUNTRY || "NG").toUpperCase(),
		defaultPromocode: env.AFFNOOK_DEFAULT_PROMOCODE || "TSTTTAB",
	};
}

export function isAffnookConfigured(env: CloudflareBindings) {
	return Boolean(getAffnookConfig(env).apiKey);
}
