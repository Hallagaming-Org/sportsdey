import { apiRequest } from "@/lib/api";

const DEFAULT_PREDICTION_MARKET_HOME = "https://prediction.sportsdey.com";
const HANDOFF_ROUTE = "handoff/code";
const SSO_PATH = "/users/auth/sso";
const SSO_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Prediction Market web app the user lands on after a successful SSO.
 * Overridable so staging can point at its own deployment.
 */
export function resolvePredictionMarketHome(): string {
	const configured = (import.meta.env.VITE_PREDICTION_MARKET_URL || "").trim();
	return configured || DEFAULT_PREDICTION_MARKET_HOME;
}

/**
 * Prediction Market API origin. Vite only exposes VITE_-prefixed vars to the
 * client, so the configured name is VITE_PREDICTION_MARKET_BACKEND_URL.
 */
export function resolvePredictionBackendUrl(): string {
	const configured = (
		import.meta.env.VITE_PREDICTION_MARKET_BACKEND_URL || ""
	).trim();
	return configured.replace(/\/+$/, "");
}

/** Surfaced to the UI; never carries the code, clientId or token. */
export class PredictionSsoError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PredictionSsoError";
	}
}

export type HandoffCode = {
	code: string;
	expiresIn: number;
	/** sha256 of the client id — an identifier, never the exchange token. */
	hashedClientId: string;
};

export type PredictionSsoSession = {
	user: unknown;
	token: string;
};

/**
 * Exchanges the current session for a single-use handoff code.
 * The code is short-lived (60s) — request one per launch, never cache it.
 */
export async function requestHandoffCode(): Promise<HandoffCode> {
	return apiRequest<HandoffCode>(HANDOFF_ROUTE, {
		method: "POST",
		credentials: "include",
		body: JSON.stringify({}),
	});
}

/**
 * SSO endpoint URL. Both values come from /handoff/code — never hardcoded.
 * The URL is a credential (it carries the code); keep it out of logs.
 */
export function buildSsoApiUrl(code: string, clientId: string): string {
	const base = resolvePredictionBackendUrl();
	if (!base) {
		throw new PredictionSsoError(
			"Prediction Market is not configured. Please try again later.",
		);
	}
	const url = new URL(`${base}${SSO_PATH}`);
	url.searchParams.set("code", code);
	url.searchParams.set("clientId", clientId);
	return url.toString();
}

function isSsoSessionPayload(
	value: unknown,
): value is { data: { user: unknown; token: string } } {
	if (typeof value !== "object" || value === null) return false;
	const body = value as Record<string, unknown>;
	if (typeof body.data !== "object" || body.data === null) return false;
	const data = body.data as Record<string, unknown>;
	return typeof data.token === "string" && data.token.length > 0;
}

/**
 * Calls the Prediction Market SSO endpoint and returns the session it issues.
 * Anything other than HTTP 200 throws — the caller must not store or redirect.
 */
export async function exchangeSsoCode(
	code: string,
	clientId: string,
): Promise<PredictionSsoSession> {
	if (!code) throw new PredictionSsoError("Missing sign-in code.");
	if (!clientId) throw new PredictionSsoError("Missing client identifier.");

	const controller = new AbortController();
	const timeoutId = setTimeout(
		() => controller.abort(),
		SSO_REQUEST_TIMEOUT_MS,
	);

	let response: Response;
	try {
		response = await fetch(buildSsoApiUrl(code, clientId), {
			method: "GET",
			headers: { Accept: "application/json" },
			signal: controller.signal,
		});
	} catch (error) {
		if (error instanceof PredictionSsoError) throw error;
		throw new PredictionSsoError(
			"Network error reaching Prediction Market. Please try again.",
		);
	} finally {
		clearTimeout(timeoutId);
	}

	if (response.status !== 200) {
		// Status only — never echo the response body, it may repeat the code.
		throw new PredictionSsoError(
			response.status === 401 || response.status === 403
				? "Prediction Market sign-in expired. Please try again."
				: "Prediction Market sign-in failed. Please try again.",
		);
	}

	let body: unknown;
	try {
		body = await response.json();
	} catch {
		throw new PredictionSsoError(
			"Prediction Market sign-in failed. Please try again.",
		);
	}

	if (!isSsoSessionPayload(body)) {
		throw new PredictionSsoError(
			"Prediction Market sign-in failed. Please try again.",
		);
	}

	return { user: body.data.user, token: body.data.token };
}

/**
 * Launch URL for the Prediction Market tab: `{home}?sso_token=<jwt>`.
 *
 * The token travels in the URL because `localStorage` is partitioned per
 * origin — a session written here is unreadable on prediction.sportsdey.com,
 * and only code running on that origin can store its own session. The
 * Prediction Market app strips the parameter as soon as it has read it.
 */
export function buildPredictionLaunchUrl(token: string): string {
	if (!token) throw new PredictionSsoError("Missing sign-in token.");

	const url = new URL(resolvePredictionMarketHome());
	// `searchParams` percent-encodes the value on write.
	url.searchParams.set("sso_token", token);
	return url.toString();
}
