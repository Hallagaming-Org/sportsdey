import type { SwipeGamesConfig } from "./config";
import { signCanonicalPayload } from "./sign";
import type {
	CoreErrorResponse,
	CreateFreeRoundsRequest,
	CreateFreeRoundsResponse,
	CreateNewGameRequest,
	CreateNewGameResponse,
	DeleteFreeRoundsRequest,
	FreeRoundsInfoResponse,
	GamesResponse,
} from "./types";

export class SwipeGamesApiError extends Error {
	readonly status: number;
	readonly details?: string;
	readonly code?: string;

	constructor(
		message: string,
		status: number,
		details?: string,
		code?: string,
	) {
		super(message);
		this.name = "SwipeGamesApiError";
		this.status = status;
		this.details = details;
		this.code = code;
	}
}

function joinUrl(baseUrl: string, path: string, query?: Record<string, string>) {
	const url = new URL(path.replace(/^\//, ""), `${baseUrl.replace(/\/$/, "")}/`);
	if (query) {
		for (const [key, value] of Object.entries(query)) {
			if (value !== undefined && value !== "") {
				url.searchParams.set(key, value);
			}
		}
	}
	return url;
}

async function parseError(response: Response): Promise<SwipeGamesApiError> {
	let message = `Swipe Games API error (${response.status})`;
	let details: string | undefined;
	let code: string | undefined;
	try {
		const body = (await response.json()) as CoreErrorResponse;
		if (body.message) message = body.message;
		details = body.details;
		code = body.code;
	} catch {
		// keep generic message
	}
	return new SwipeGamesApiError(message, response.status, details, code);
}

export class SwipeGamesClient {
	constructor(private readonly config: SwipeGamesConfig) {}

	async createNewGame(
		input: Omit<CreateNewGameRequest, "cID" | "extCID"> &
			Partial<Pick<CreateNewGameRequest, "cID" | "extCID">>,
	): Promise<CreateNewGameResponse> {
		const body: CreateNewGameRequest = {
			cID: input.cID ?? this.config.cid,
			extCID: input.extCID ?? this.config.extCid,
			gameID: input.gameID,
			demo: input.demo,
			platform: input.platform,
			currency: input.currency,
			locale: input.locale,
			fallbackToDefaultLocale: input.fallbackToDefaultLocale ?? true,
			sessionID: input.sessionID,
			returnURL: input.returnURL,
			depositURL: input.depositURL,
			initDemoBalance: input.initDemoBalance,
			user: input.user,
		};
		return this.post("/create-new-game", body);
	}

	async listGames(options?: {
		excludeBetLines?: boolean;
		currencyFilters?: string;
		additionalCurrencies?: string;
	}): Promise<GamesResponse> {
		const query: Record<string, string> = {
			cID: this.config.cid,
			extCID: this.config.extCid,
		};
		if (options?.excludeBetLines) query.excludeBetLines = "true";
		if (options?.currencyFilters) {
			query.currencyFilters = options.currencyFilters;
		}
		if (options?.additionalCurrencies) {
			query.additionalCurrencies = options.additionalCurrencies;
		}
		return this.get("/games", query, { timeoutMs: 30_000 });
	}

	async createFreeRounds(
		input: Omit<CreateFreeRoundsRequest, "cID" | "extCID"> &
			Partial<Pick<CreateFreeRoundsRequest, "cID" | "extCID">>,
	): Promise<CreateFreeRoundsResponse> {
		const body: CreateFreeRoundsRequest = {
			cID: input.cID ?? this.config.cid,
			extCID: input.extCID ?? this.config.extCid,
			extID: input.extID,
			currency: input.currency,
			quantity: input.quantity,
			betLine: input.betLine,
			validFrom: input.validFrom,
			validUntil: input.validUntil,
			gameIDs: input.gameIDs,
			userIDs: input.userIDs,
		};
		return this.post("/free-rounds", body);
	}

	async getFreeRounds(input: {
		id?: string;
		extID?: string;
	}): Promise<FreeRoundsInfoResponse> {
		const query: Record<string, string> = {
			cID: this.config.cid,
			extCID: this.config.extCid,
		};
		if (input.id) query.id = input.id;
		if (input.extID) query.extID = input.extID;
		return this.get("/free-rounds", query);
	}

	async deleteFreeRounds(
		input: Omit<DeleteFreeRoundsRequest, "cID" | "extCID"> &
			Partial<Pick<DeleteFreeRoundsRequest, "cID" | "extCID">>,
	): Promise<void> {
		const body: DeleteFreeRoundsRequest = {
			cID: input.cID ?? this.config.cid,
			extCID: input.extCID ?? this.config.extCid,
			id: input.id,
			extID: input.extID,
		};
		await this.request("DELETE", "/free-rounds", { body });
	}

	private async get<T>(
		path: string,
		query: Record<string, string>,
		options?: { acceptGzip?: boolean; timeoutMs?: number },
	): Promise<T> {
		return this.request<T>("GET", path, {
			query,
			acceptGzip: options?.acceptGzip,
			timeoutMs: options?.timeoutMs,
		});
	}

	private async post<T>(path: string, body: unknown): Promise<T> {
		return this.request<T>("POST", path, { body });
	}

	private fetchSigned(
		url: URL,
		method: "GET" | "POST" | "DELETE",
		headers: Record<string, string>,
		body: string | undefined,
		signal: AbortSignal,
	): Promise<Response> {
		return fetch(url, { method, headers, body, signal });
	}

	private async readResponse<T>(
		response: Response,
		method: "GET" | "POST" | "DELETE",
	): Promise<T> {
		if (!response.ok) {
			throw await parseError(response);
		}
		if (response.status === 204 || method === "DELETE") {
			const text = await response.text();
			return (text ? JSON.parse(text) : undefined) as T;
		}
		return (await response.json()) as T;
	}

	private async request<T>(
		method: "GET" | "POST" | "DELETE",
		path: string,
		options: {
			query?: Record<string, string>;
			body?: unknown;
			acceptGzip?: boolean;
			timeoutMs?: number;
		},
	): Promise<T> {
		const signPayload =
			method === "GET" ? (options.query ?? {}) : (options.body ?? {});
		const { canonicalJSON, signature } = await signCanonicalPayload(
			this.config.apiKey,
			signPayload,
		);
		const viaProxy = Boolean(this.config.proxyUrl && this.config.proxySecret);
		const requestBase = viaProxy
			? `${this.config.proxyUrl}/${this.config.env === "production" ? "swipegames" : "swipegames-staging"}`
			: this.config.baseUrl;
		const url = joinUrl(requestBase, path, options.query);
		const headers: Record<string, string> = {
			"X-REQUEST-SIGN": signature,
			Accept: "application/json",
			"User-Agent": "SportsDey-SwipeGames/1.0",
		};
		if (viaProxy && this.config.proxySecret) {
			headers["X-Proxy-Auth"] = this.config.proxySecret;
		}
		if (options.body !== undefined) {
			headers["Content-Type"] = "application/json";
		}
		if (options.acceptGzip) {
			headers["Accept-Encoding"] = "gzip";
		}

		const controller = new AbortController();
		const timeout = setTimeout(
			() => controller.abort(),
			options.timeoutMs ?? 15_000,
		);
		try {
			const response = await this.fetchSigned(
				url,
				method,
				headers,
				options.body !== undefined ? canonicalJSON : undefined,
				controller.signal,
			);
			if (
				!response.ok &&
				viaProxy &&
				(response.status === 404 ||
					response.status === 502 ||
					response.status === 503)
			) {
				console.error("Swipe Games proxy miss, retrying Swipe host", {
					status: response.status,
					path,
					env: this.config.env,
				});
				const directHeaders = { ...headers };
				delete directHeaders["X-Proxy-Auth"];
				const direct = await this.fetchSigned(
					joinUrl(this.config.baseUrl, path, options.query),
					method,
					directHeaders,
					options.body !== undefined ? canonicalJSON : undefined,
					controller.signal,
				);
				return this.readResponse<T>(direct, method);
			}
			return this.readResponse<T>(response, method);
		} finally {
			clearTimeout(timeout);
		}
	}
}
