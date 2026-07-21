const resolveApiBaseUrl = () =>
	import.meta.env.VITE_SERVER_URL ||
	import.meta.env.VITE_API_URL ||
	"https://staging-api.sportsdey.com/";

const API_BASE_URL = resolveApiBaseUrl();

type ApiSuccessResponse<T> = {
	data: T;
};

type ApiErrorResponse = {
	error: string;
	details: [
		{
			field: string;
			message: string;
			code: string;
		},
	];
};

export class ApiError extends Error {
	status?: number;
	details?: ApiErrorResponse["details"];
	isNetworkError: boolean;

	constructor(
		message: string,
		status?: number,
		details?: ApiErrorResponse["details"],
		isNetworkError = false,
	) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.details = details;
		this.isNetworkError = isNetworkError;
	}
}

export async function apiRequest<T>(
	endpoint: string,
	options: RequestInit = {},
): Promise<T> {
	const url = `${API_BASE_URL}${endpoint}`;

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 10000);

	const config: RequestInit = {
		...options,
		headers: {
			"Content-Type": "application/json",
			...options.headers,
		},
		signal: controller.signal,
	};

	try {
		const response = await fetch(url, config);
		clearTimeout(timeoutId);

		if (!response.ok) {
			let data: ApiErrorResponse;
			try {
				data = (await response.json()) as ApiErrorResponse;
			} catch (jsonError) {
				data = {
					error: `Unexpected server response (${response.status} ${response.statusText})`,
					details: [] as any,
				};
			}

			let userMessage =
				typeof data.error === "string" && data.error.trim()
					? data.error
					: "An error occurred. Try again later.";

			if (!(typeof data.error === "string" && data.error.trim())) {
				if (response.status >= 500) {
					userMessage = "Server error. Please try again later.";
				} else if (response.status === 404) {
					userMessage = "Resource not found.";
				} else if (response.status === 401 || response.status === 403) {
					userMessage = "Unauthorized access.";
				} else if (response.status === 400) {
					userMessage = "Invalid request.";
				}
			}

			throw new ApiError(userMessage, response.status, data.details, false);
		}

		const json = (await response.json()) as ApiSuccessResponse<T>;
		return json.data;
	} catch (error) {
		clearTimeout(timeoutId);
		// Network errors (offline, timeout, etc.)
		if (
			error instanceof TypeError ||
			error instanceof DOMException ||
			(error instanceof Error && error.name === "AbortError")
		) {
			throw new ApiError(
				"Network error or timeout. Please check your connection and try again.",
				undefined,
				undefined,
				true,
			);
		}

		// Re-throw ApiError instances
		if (error instanceof ApiError) {
			throw error;
		}

		// Unknown errors
		throw new ApiError(
			"An unexpected error occurred. Please try again.",
			undefined,
			undefined,
			false,
		);
	}
}
