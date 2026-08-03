import type { Context } from "hono";

export interface SignatureVerificationResult {
	valid: boolean;
	error?: string;
}

export type SlotegratorCredentials = {
	merchantId: string;
	merchantKey: string;
	apiUrl: string;
};

export type SlotegratorDemoInitInput = {
	game_uuid: string;
	device?: string;
	language?: string;
	return_url?: string;
	/** ISO-4217; defaults to NGN (merchant market). */
	currency?: string;
};

export class SlotegratorApiError extends Error {
	status: number;
	details: unknown;

	constructor(message: string, status: number, details?: unknown) {
		super(message);
		this.name = "SlotegratorApiError";
		this.status = status;
		this.details = details ?? null;
	}
}

/**
 * Outbound X-Sign: merge request params with the three auth header fields,
 * sort keys ascending, URL-encode as a query string, HMAC-SHA1 hex digest.
 */
export async function buildSlotegratorSign(
	requestParams: Record<string, string>,
	auth: { merchantId: string; timestamp: string; nonce: string },
	merchantKey: string,
): Promise<string> {
	const allParams: Record<string, string> = {
		...requestParams,
		"X-Merchant-Id": auth.merchantId,
		"X-Timestamp": auth.timestamp,
		"X-Nonce": auth.nonce,
	};

	const sortedKeys = Object.keys(allParams).sort();
	const params = new URLSearchParams();
	for (const key of sortedKeys) {
		params.set(key, allParams[key] ?? "");
	}
	const queryString = params.toString();

	const cryptoMod = await import("crypto");
	return cryptoMod
		.createHmac("sha1", merchantKey)
		.update(queryString)
		.digest("hex");
}

export async function createSlotegratorAuthHeaders(
	merchantId: string,
	merchantKey: string,
	requestParams: Record<string, string>,
): Promise<{
	headers: {
		"X-Merchant-Id": string;
		"X-Timestamp": string;
		"X-Nonce": string;
		"X-Sign": string;
	};
	timestamp: string;
	nonce: string;
	sign: string;
}> {
	const timestamp = Math.floor(Date.now() / 1000).toString();
	const nonce = crypto.randomUUID();
	const sign = await buildSlotegratorSign(
		requestParams,
		{ merchantId, timestamp, nonce },
		merchantKey,
	);

	return {
		headers: {
			"X-Merchant-Id": merchantId,
			"X-Timestamp": timestamp,
			"X-Nonce": nonce,
			"X-Sign": sign,
		},
		timestamp,
		nonce,
		sign,
	};
}

function isDemoUnsupportedMessage(message: string): boolean {
	const m = message.toLowerCase();
	if (m.includes("error while getting demo url")) return true;
	return (
		m.includes("demo") &&
		(m.includes("not support") ||
			m.includes("unsupported") ||
			m.includes("not available") ||
			m.includes("disabled"))
	);
}

/** Map Slotegrator upstream HTTP status to our API status + message. */
export function mapSlotegratorUpstreamError(
	status: number,
	body: unknown,
): SlotegratorApiError {
	const messageFromBody = (() => {
		if (!body || typeof body !== "object") return "";
		const record = body as Record<string, unknown>;
		if (typeof record.message === "string") return record.message;
		if (typeof record.error === "string") return record.error;
		if (typeof record.name === "string") return record.name;
		return "";
	})();

	if (messageFromBody && isDemoUnsupportedMessage(messageFromBody)) {
		return new SlotegratorApiError(
			"Game/provider does not support demo mode",
			422,
			body,
		);
	}

	if (status === 400 || status === 422) {
		return new SlotegratorApiError(
			messageFromBody || "Invalid Slotegrator request parameters",
			422,
			body,
		);
	}
	if (status === 401 || status === 403) {
		return new SlotegratorApiError(
			messageFromBody || "Slotegrator merchant authentication failed",
			502,
			body,
		);
	}
	if (status === 404) {
		return new SlotegratorApiError(
			messageFromBody || "Game not found",
			404,
			body,
		);
	}
	if (status === 429 || status === 430) {
		return new SlotegratorApiError(
			messageFromBody || "Slotegrator rate limit exceeded",
			503,
			body,
		);
	}

	return new SlotegratorApiError(
		messageFromBody || "Upstream Slotegrator API error",
		502,
		body,
	);
}

function resolveCredentials(env: {
	SLOTITEGRATION_MERCHANT_ID?: string;
	SLOTITEGRATION_MERCHANT_KEY?: string;
	SLOTEGRATOR_API_URL?: string;
}): SlotegratorCredentials {
	const merchantId = env.SLOTITEGRATION_MERCHANT_ID?.trim() || "";
	const merchantKey = env.SLOTITEGRATION_MERCHANT_KEY?.trim() || "";
	const apiUrl = (env.SLOTEGRATOR_API_URL || "").replace(/\/+$/, "");
	if (!merchantId || !merchantKey || !apiUrl) {
		throw new SlotegratorApiError("Server configuration error", 500);
	}
	return { merchantId, merchantKey, apiUrl };
}

/**
 * GET /games (falls back to /games/index if /games returns 404 — CLI sync path).
 */
export async function fetchSlotegratorGames(
	env: {
		SLOTITEGRATION_MERCHANT_ID?: string;
		SLOTITEGRATION_MERCHANT_KEY?: string;
		SLOTEGRATOR_API_URL?: string;
	},
	query: Record<string, string> = {},
): Promise<unknown> {
	const { merchantId, merchantKey, apiUrl } = resolveCredentials(env);
	const requestParams = { ...query };
	const { headers } = await createSlotegratorAuthHeaders(
		merchantId,
		merchantKey,
		requestParams,
	);

	const qs = new URLSearchParams(requestParams).toString();
	const paths = [`/games`, `/games/index`];
	let lastError: SlotegratorApiError | null = null;

	for (const path of paths) {
		const url = `${apiUrl}${path}${qs ? `?${qs}` : ""}`;
		const response = await fetch(url, {
			method: "GET",
			headers: {
				...headers,
				Accept: "application/json",
				"Content-Type": "application/x-www-form-urlencoded",
			},
		});

		let body: unknown = null;
		const text = await response.text();
		if (text) {
			try {
				body = JSON.parse(text);
			} catch {
				body = text;
			}
		}

		if (response.ok) return body;

		const mapped = mapSlotegratorUpstreamError(response.status, body);
		if (response.status === 404 && path === "/games") {
			lastError = mapped;
			continue;
		}
		throw mapped;
	}

	throw lastError ?? new SlotegratorApiError("Game not found", 404);
}

/**
 * POST /games/init-demo — returns the demo launch URL (no wallet / real money).
 */
export async function initSlotegratorDemo(
	env: {
		SLOTITEGRATION_MERCHANT_ID?: string;
		SLOTITEGRATION_MERCHANT_KEY?: string;
		SLOTEGRATOR_API_URL?: string;
	},
	input: SlotegratorDemoInitInput,
): Promise<{ url: string }> {
	const { merchantId, merchantKey, apiUrl } = resolveCredentials(env);

	const requestBody: Record<string, string> = {
		game_uuid: input.game_uuid,
		currency: (input.currency?.trim() || "NGN").toUpperCase(),
	};
	if (input.device?.trim()) requestBody.device = input.device.trim();
	if (input.language?.trim()) requestBody.language = input.language.trim();
	if (input.return_url?.trim()) requestBody.return_url = input.return_url.trim();

	const { headers } = await createSlotegratorAuthHeaders(
		merchantId,
		merchantKey,
		requestBody,
	);

	const response = await fetch(`${apiUrl}/games/init-demo`, {
		method: "POST",
		headers: {
			...headers,
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams(requestBody),
	});

	let body: unknown = null;
	const text = await response.text();
	if (text) {
		try {
			body = JSON.parse(text);
		} catch {
			body = text;
		}
	}

	if (!response.ok) {
		throw mapSlotegratorUpstreamError(response.status, body);
	}

	const url =
		body &&
		typeof body === "object" &&
		typeof (body as { url?: unknown }).url === "string"
			? (body as { url: string }).url
			: "";

	if (!url) {
		throw new SlotegratorApiError(
			"Slotegrator demo response missing launch URL",
			502,
			body,
		);
	}

	// Do NOT prefetch/probe `url` here — GIS launch links are one-time and
	// a server-side fetch burns the token before the player's browser opens it.

	return { url };
}

/**
 * Resolve Slotegrator return_url.
 * On staging, always prefer stagingweb and never allow production hosts.
 */
export function resolveSlotegratorReturnUrl(
	env: { NODE_ENV?: string },
	requested?: string | null,
): string | undefined {
	const stagingFront = "https://stagingweb.sportsdey.com/games";
	const isStaging = (env.NODE_ENV || "").toLowerCase() === "staging";

	const isProductionFront = (value: string) => {
		try {
			const host = new URL(value).hostname.toLowerCase();
			return (
				host === "sportsdey.com" ||
				host === "www.sportsdey.com" ||
				host === "api.sportsdey.com"
			);
		} catch {
			return false;
		}
	};

	const trimmed = requested?.trim() || "";
	if (isStaging) {
		if (!trimmed || isProductionFront(trimmed)) return stagingFront;
		return trimmed;
	}
	return trimmed || undefined;
}

export async function verifySlotitegrationSignature(
	c: Context,
	rawBody: string,
	merchantKey: string,
): Promise<SignatureVerificationResult> {
	const merchantId = c.req.header("X-Merchant-Id");
	const timestamp = c.req.header("X-Timestamp");
	const nonce = c.req.header("X-Nonce");
	const receivedSign = c.req.header("X-Sign");

	console.log("=== SIGNATURE VERIFICATION START ===");
	console.log("merchantId:", merchantId);
	console.log("timestamp:", timestamp);
	console.log("nonce:", nonce);
	console.log("receivedSign:", receivedSign);

	if (!merchantId || !timestamp || !nonce || !receivedSign) {
		console.log("FAIL: Missing required headers");
		return { valid: false, error: "Missing required headers" };
	}

	console.log("All headers present, continuing...");

	const now = Math.floor(Date.now() / 1000);
	const requestTime = Number.parseInt(timestamp, 10);
	if (Number.isNaN(requestTime) || Math.abs(now - requestTime) > 30) {
		console.log("FAIL: Request timestamp expired", { now, requestTime });
		return { valid: false, error: "Request timestamp expired" };
	}

	const urlSearchParams = new URLSearchParams(rawBody);
	const bodyParams: Record<string, string> = Object.fromEntries(
		urlSearchParams.entries(),
	) as Record<string, string>;
	console.log("bodyParams keys:", Object.keys(bodyParams));

	const allParams: Record<string, string> = {
		...bodyParams,
		"X-Merchant-Id": merchantId,
		"X-Timestamp": timestamp,
		"X-Nonce": nonce,
	};

	const sortedKeys = Object.keys(allParams).sort();
	console.log("sortedKeys:", sortedKeys);

	const queryString = sortedKeys
		.map((key) => {
			const encodedKey = key.replace(/\[/g, "%5B").replace(/\]/g, "%5D");
			return `${encodedKey}=${allParams[key]}`;
		})
		.join("&");
	console.log("queryString:", queryString);

	const crypto = await import("crypto");
	const computedSign = crypto
		.createHmac("sha1", merchantKey)
		.update(queryString)
		.digest("hex");

	console.log("computedSign:", computedSign);
	console.log("receivedSign:", receivedSign);

	if (computedSign !== receivedSign) {
		console.log("FAIL: Signature mismatch");
		return { valid: false, error: "Invalid signature" };
	}

	console.log("SUCCESS: Signature valid");
	return { valid: true };
}
