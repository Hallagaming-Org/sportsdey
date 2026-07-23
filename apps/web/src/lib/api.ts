import { getStoredSessionToken } from "@/lib/auth/session-token";

const DEFAULT_API_BASE_URL = "https://staging-api.sportsdey.com/";
const API_REQUEST_TIMEOUT_MS = 10_000;

const resolveApiBaseUrl = () =>
	import.meta.env.VITE_SERVER_URL ||
	import.meta.env.VITE_API_URL ||
	DEFAULT_API_BASE_URL;

const API_BASE_URL = resolveApiBaseUrl();

type ApiErrorDetail = {
	field: string;
	message: string;
	code: string;
};

type ApiSuccessResponse<T> = {
	data: T;
};

type ApiErrorResponse = {
	error: string;
	details?: ApiErrorDetail[];
};

const STATUS_FALLBACK_MESSAGES: Record<number, string> = {
	400: "Invalid request.",
	401: "Unauthorized access.",
	403: "Unauthorized access.",
	404: "Resource not found.",
};

export class ApiError extends Error {
	status?: number;
	details?: ApiErrorDetail[];
	isNetworkError: boolean;

	constructor({
		message,
		status,
		details,
		isNetworkError = false,
	}: {
		message: string;
		status?: number;
		details?: ApiErrorDetail[];
		isNetworkError?: boolean;
	}) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.details = details;
		this.isNetworkError = isNetworkError;
	}
}

function fallbackMessageForStatus(status: number): string {
	if (STATUS_FALLBACK_MESSAGES[status]) {
		return STATUS_FALLBACK_MESSAGES[status];
	}
	if (status >= 500) {
		return "Server error. Please try again later.";
	}
	return "An error occurred. Try again later.";
}

export async function apiRequest<T>(
	endpoint: string,
	options: RequestInit = {},
): Promise<T> {
	const url = `${API_BASE_URL}${endpoint}`;

	const controller = new AbortController();
	const timeoutId = setTimeout(
		() => controller.abort(),
		API_REQUEST_TIMEOUT_MS,
	);

	const sessionToken = getStoredSessionToken();
	const headers = new Headers(options.headers);
	if (!headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}
	if (sessionToken && !headers.has("Authorization")) {
		headers.set("Authorization", `Bearer ${sessionToken}`);
	}

	const config: RequestInit = {
		...options,
		headers,
		credentials: options.credentials ?? "include",
		signal: controller.signal,
	};

	try {
		const response = await fetch(url, config);
		clearTimeout(timeoutId);

		if (!response.ok) {
			let data: ApiErrorResponse;
			try {
				data = (await response.json()) as ApiErrorResponse;
			} catch {
				data = {
					error: `Unexpected server response (${response.status} ${response.statusText})`,
					details: [],
				};
			}

			const serverError =
				typeof data.error === "string" && data.error.trim()
					? data.error.trim()
					: "";
			const userMessage =
				serverError || fallbackMessageForStatus(response.status);

			throw new ApiError({
				message: userMessage,
				status: response.status,
				details: data.details,
			});
		}

		const json = (await response.json()) as ApiSuccessResponse<T>;
		return json.data;
	} catch (error) {
		clearTimeout(timeoutId);
		if (
			error instanceof TypeError ||
			error instanceof DOMException ||
			(error instanceof Error && error.name === "AbortError")
		) {
			throw new ApiError({
				message:
					"Network error or timeout. Please check your connection and try again.",
				isNetworkError: true,
			});
		}

		if (error instanceof ApiError) {
			throw error;
		}

		throw new ApiError({
			message: "An unexpected error occurred. Please try again.",
		});
	}
}

type UploadedFile = {
	id: string;
	url: string;
	fileName: string;
	mimeType: string;
	size: number;
};

/** Multipart upload — do not set Content-Type so the browser adds the boundary. */
export async function apiUploadFile({
	endpoint,
	file,
	fields,
}: {
	endpoint: string;
	file: File;
	fields: Record<string, string>;
}): Promise<UploadedFile> {
	const url = `${API_BASE_URL}${endpoint}`;
	const formData = new FormData();
	formData.append("file", file);
	for (const [key, value] of Object.entries(fields)) {
		formData.append(key, value);
	}

	const sessionToken = getStoredSessionToken();
	const headers = new Headers();
	if (sessionToken) {
		headers.set("Authorization", `Bearer ${sessionToken}`);
	}

	const response = await fetch(url, {
		method: "POST",
		credentials: "include",
		headers,
		body: formData,
	});

	if (!response.ok) {
		let message = fallbackMessageForStatus(response.status);
		try {
			const data = (await response.json()) as ApiErrorResponse;
			if (typeof data.error === "string" && data.error.trim()) {
				message = data.error.trim();
			}
		} catch {
			// keep fallback
		}
		throw new ApiError({ message, status: response.status });
	}

	const json = (await response.json()) as ApiSuccessResponse<UploadedFile>;
	return json.data;
}
