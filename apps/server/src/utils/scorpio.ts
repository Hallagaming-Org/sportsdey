import { fetchWithTimeout, isTimeoutError } from "@/utils/fetch-with-timeout";
import {
	assertScorpioSettings,
	loadScorpioSettings,
	normalizeScorpioCallbackUrl,
	type ScorpioSettings,
} from "@/utils/scorpio-config";

/** Per-isolate cache so we do not hit operator/info on every launch. */
let syncedCallbackUrl: string | null = null;

export const SCORPIO_ERROR_CODES = [
	"UNDER_MAINTENANCE",
	"TOKEN_INVALID",
	"TOKEN_NOT_FOUND",
	"PERMISSION_ERROR",
	"PROVIDER_ERROR",
	"VALIDATION_ERROR",
	"SERVER_IS_BUSY",
	"CALLBACK_ERROR",
	"AGENT_NOT_FOUND",
	"USER_NOT_FOUND",
	"GAME_NOT_FOUND",
	"POINT_NOT_ENOUGH",
	"BALANCE_NOT_ENOUGH",
	"PROVIDER_NOT_FOUND",
	"ROUND_NOT_FOUND",
	"CURRENCY_NOT_SUPPORTED",
	"BONUSCALL_DOUBLE",
	"BONUSCALL_ALREADY_ENDED",
	"INTERNAL_SERVER_ERROR",
] as const;

export type ScorpioErrorCode = (typeof SCORPIO_ERROR_CODES)[number];

export type ScorpioConfig = {
	apiUrl: string;
	apiToken: string;
};

export class ScorpioApiError extends Error {
	code: string;
	status: number;
	details: unknown;

	constructor(code: string, message: string, status = 400, details?: unknown) {
		super(message);
		this.name = "ScorpioApiError";
		this.code = code;
		this.status = status;
		this.details = details ?? null;
	}
}

type ScorpioEnvelope<T> = {
	success: boolean;
	message?: string;
	data?: T;
	errorCode?: string;
	code?: string;
};

function resolveConfig(config: ScorpioConfig): ScorpioConfig {
	const apiUrl = config.apiUrl?.replace(/\/+$/, "");
	if (!apiUrl || !config.apiToken) {
		throw new ScorpioApiError(
			"TOKEN_NOT_FOUND",
			"Scorpio Play API is not configured",
			500,
		);
	}
	return { apiUrl, apiToken: config.apiToken };
}

function extractErrorCode(body: ScorpioEnvelope<unknown>, status: number): string {
	const candidate =
		body.errorCode ||
		body.code ||
		(typeof body.message === "string" &&
		SCORPIO_ERROR_CODES.includes(body.message as ScorpioErrorCode)
			? body.message
			: null);
	if (candidate) return String(candidate);
	if (status === 401 || status === 403) return "TOKEN_INVALID";
	if (status === 404) return "USER_NOT_FOUND";
	if (status >= 500) return "INTERNAL_SERVER_ERROR";
	return "PROVIDER_ERROR";
}

async function scorpioRequest<T>(
	config: ScorpioConfig,
	method: string,
	path: string,
	options: {
		query?: Record<string, string | number | undefined | null>;
		body?: unknown;
	} = {},
): Promise<T> {
	const { apiUrl, apiToken } = resolveConfig(config);
	const url = new URL(`${apiUrl}${path.startsWith("/") ? path : `/${path}`}`);
	if (options.query) {
		for (const [key, value] of Object.entries(options.query)) {
			if (value === undefined || value === null || value === "") continue;
			url.searchParams.set(key, String(value));
		}
	}

	const started = Date.now();
	const endpoint = `${method} ${url.pathname}`;

	try {
		const response = await fetchWithTimeout(
			url.toString(),
			{
				method,
				headers: {
					Authorization: `Bearer ${apiToken}`,
					Accept: "application/json",
					"Content-Type": "application/json",
				},
				body:
					options.body === undefined ? undefined : JSON.stringify(options.body),
			},
			15000,
		);

		const durationMs = Date.now() - started;
		let payload: ScorpioEnvelope<T> = { success: false };
		const text = await response.text();
		if (text) {
			try {
				payload = JSON.parse(text) as ScorpioEnvelope<T>;
			} catch {
				console.log("scorpio request failed to parse json", {
					endpoint,
					status: response.status,
					durationMs,
				});
				throw new ScorpioApiError(
					"PROVIDER_ERROR",
					"Invalid response from Scorpio Play",
					502,
				);
			}
		}

		console.log("scorpio request", {
			endpoint,
			status: response.status,
			durationMs,
			success: payload.success,
		});

		if (!response.ok || payload.success === false) {
			const code = extractErrorCode(payload, response.status);
			throw new ScorpioApiError(
				code,
				payload.message || "Scorpio Play request failed",
				response.status >= 400 ? response.status : 400,
				payload.data ?? null,
			);
		}

		return payload.data as T;
	} catch (error) {
		if (error instanceof ScorpioApiError) throw error;
		if (isTimeoutError(error)) {
			console.log("scorpio request timeout", {
				endpoint,
				durationMs: Date.now() - started,
			});
			throw new ScorpioApiError(
				"SERVER_IS_BUSY",
				"Scorpio Play request timed out",
				504,
			);
		}
		console.log("scorpio request error", {
			endpoint,
			durationMs: Date.now() - started,
			error: error instanceof Error ? error.message : "unknown",
		});
		throw new ScorpioApiError(
			"INTERNAL_SERVER_ERROR",
			"Failed to reach Scorpio Play",
			502,
		);
	}
}

export function getScorpioConfig(env: {
	SCORPIO_API_URL?: string;
	SCORPIO_BASE_URL?: string;
	SCORPIO_API_TOKEN?: string;
	SCORPIO_CALLBACK_URL?: string;
	SCORPIO_SERVER_IP?: string;
	SCORPIO_ALLOWED_IPS?: string;
}): ScorpioConfig {
	const settings = loadScorpioSettings(env);
	assertScorpioSettings(settings);
	return {
		apiUrl: settings.apiUrl,
		apiToken: settings.apiToken,
	};
}

export function scorpioErrorToHttpStatus(code: string): number {
	switch (code) {
		case "TOKEN_INVALID":
		case "TOKEN_NOT_FOUND":
			// Operator API token issues — not the end-user session.
			return 401;
		case "PERMISSION_ERROR":
			// Scorpio uses this for business rejects (e.g. currency unavailable,
			// operator deposit balance empty). Must NOT be HTTP 401 — the web
			// client treats 401 as "user logged out" and redirects to sign-in.
			return 400;
		case "USER_NOT_FOUND":
		case "GAME_NOT_FOUND":
		case "PROVIDER_NOT_FOUND":
		case "AGENT_NOT_FOUND":
		case "ROUND_NOT_FOUND":
			return 404;
		case "POINT_NOT_ENOUGH":
		case "BALANCE_NOT_ENOUGH":
			return 402;
		case "UNDER_MAINTENANCE":
		case "SERVER_IS_BUSY":
			return 503;
		case "INTERNAL_SERVER_ERROR":
			return 502;
		default:
			return 400;
	}
}

/** Operator */
export function getOperatorInfo(config: ScorpioConfig) {
	return scorpioRequest<Record<string, unknown>>(config, "GET", "/v1/operator/info");
}

export function createOperator(
	config: ScorpioConfig,
	body: Record<string, unknown>,
) {
	return scorpioRequest<Record<string, unknown>>(
		config,
		"POST",
		"/v1/operator/create",
		{ body },
	);
}

export function updateOperator(
	config: ScorpioConfig,
	body: Record<string, unknown>,
) {
	return scorpioRequest<Record<string, unknown>>(
		config,
		"PATCH",
		"/v1/operator/update",
		{ body },
	);
}

/**
 * Keep Scorpio operator callbackURL aligned with SCORPIO_CALLBACK_URL.
 * A wrong/staging URL makes balance callbacks hit the wrong D1 → ERR_INVALID_PLAYER_ID
 * and Amusnet "connection lost" after a successful launch.
 *
 * Staging and production share one Scorpio operator — only sync intentionally
 * (see `cli/sync-scorpio-callback.ts`), not on every launch.
 */
export async function ensureScorpioOperatorCallback(
	env: {
		SCORPIO_API_URL?: string;
		SCORPIO_BASE_URL?: string;
		SCORPIO_API_TOKEN?: string;
		SCORPIO_CALLBACK_URL?: string;
		SCORPIO_SERVER_IP?: string;
		SCORPIO_ALLOWED_IPS?: string;
	},
	options: { force?: boolean } = {},
): Promise<{ synced: boolean; from?: string; to?: string }> {
	const settings: ScorpioSettings = loadScorpioSettings(env);
	if (!settings.callbackUrl) {
		return { synced: false };
	}
	const desired = normalizeScorpioCallbackUrl(settings.callbackUrl);
	if (!options.force && syncedCallbackUrl === desired) {
		return { synced: false };
	}

	const config = getScorpioConfig(env);
	const info = await getOperatorInfo(config);
	const currentRaw = String(
		info.callbackURL ?? info.callbackUrl ?? info.callback_url ?? "",
	);
	const current = normalizeScorpioCallbackUrl(currentRaw);
	if (current === desired) {
		syncedCallbackUrl = desired;
		return { synced: false, from: current, to: desired };
	}

	await updateOperator(config, { callbackURL: desired });
	syncedCallbackUrl = desired;
	console.log("scorpio operator callbackURL synced", {
		from: current || currentRaw || null,
		to: desired,
	});
	return { synced: true, from: current || currentRaw, to: desired };
}

/** Player */
export function createPlayer(config: ScorpioConfig, playerExternalId: string) {
	return scorpioRequest<{ playerCode: number }>(
		config,
		"POST",
		"/v1/player/create",
		{ body: { playerExternalId } },
	);
}

export function getPlayerInfo(config: ScorpioConfig, playerExternalId: string) {
	return scorpioRequest<{
		playerCode: number;
		balance: Array<{ currency: string; amount: number }>;
	}>(config, "GET", "/v1/player/info", {
		query: { playerExternalId },
	});
}

/** Providers */
export function listProviders(config: ScorpioConfig) {
	return scorpioRequest<
		Array<{
			providerId: number;
			providerName: string;
			logo?: string;
			status?: number;
		}>
	>(config, "GET", "/v1/provider/list");
}

export function getProviderSettings(config: ScorpioConfig) {
	return scorpioRequest<unknown>(config, "GET", "/v1/provider/settings");
}

export function getProviderSettingsById(
	config: ScorpioConfig,
	providerId: number,
	currency: string,
) {
	return scorpioRequest<unknown>(
		config,
		"GET",
		`/v1/provider/settings/${providerId}/${encodeURIComponent(currency)}`,
	);
}

/** Games */
export function listGames(config: ScorpioConfig, providerId: number) {
	return scorpioRequest<
		Array<{
			gameID: string;
			gameName: string;
			gameImage?: string;
			gameType?: number;
			inMaintenance?: boolean;
		}>
	>(config, "GET", `/v1/game/list/${providerId}`);
}

export type LaunchGameInput = {
	playerExternalId: string;
	providerId: number;
	gameCode: string;
	language: string;
	currency: string;
	returnUrl?: string;
	rtp?: number;
};

export function launchGame(config: ScorpioConfig, input: LaunchGameInput) {
	return scorpioRequest<{ gameUrl: string }>(config, "POST", "/v1/game/launch", {
		body: {
			playerExternalId: input.playerExternalId,
			providerId: input.providerId,
			gameCode: input.gameCode,
			language: input.language,
			currency: input.currency,
			returnUrl: input.returnUrl,
			rtp: input.rtp ?? 0,
		},
	});
}

export function kickPlayer(config: ScorpioConfig, playerExternalId: string) {
	return scorpioRequest<unknown>(config, "POST", "/v1/game/kick", {
		body: { playerExternalId },
	});
}

/** Transactions */
export function listTransactions(
	config: ScorpioConfig,
	query: {
		startTime: string;
		endTime: string;
		offset: number;
		limit: number;
	},
) {
	return scorpioRequest<{
		total: number;
		offset: number;
		count: number;
		list: unknown[];
	}>(config, "GET", "/v1/transaction/list", { query });
}

export function getTransactionRound(
	config: ScorpioConfig,
	query: Record<string, string | number>,
) {
	return scorpioRequest<unknown>(config, "GET", "/v1/transaction/round", {
		query,
	});
}

/** Bonus calls */
export function registerBonusCall(
	config: ScorpioConfig,
	body: Record<string, unknown>,
) {
	return scorpioRequest<{ issueId: string }>(
		config,
		"POST",
		"/v1/bonus-call/register",
		{ body },
	);
}

export function cancelBonusCall(
	config: ScorpioConfig,
	body: Record<string, unknown>,
) {
	return scorpioRequest<unknown>(config, "POST", "/v1/bonus-call/cancel", {
		body,
	});
}

export function getBonusCallDetail(config: ScorpioConfig, issueId: string) {
	return scorpioRequest<unknown>(
		config,
		"GET",
		`/v1/bonus-call/detail/${encodeURIComponent(issueId)}`,
	);
}
