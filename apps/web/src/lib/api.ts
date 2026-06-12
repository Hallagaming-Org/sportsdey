// const resolveApiBaseUrl = () => import.meta.env.DEV ? "http://localhost:3000/" : (import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_API_URL || "https://staging-api.sportsdey.com/");

const resolveApiBaseUrl = () => process.env.VITE_API_URL || "https://staging-api.sportsdey.com/"
const API_BASE_URL = resolveApiBaseUrl();
// const API_BASE_URL = "/api/";

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

	const config: RequestInit = {
		headers: {
			"Content-Type": "application/json",
			...options.headers,
		},
		...options,
	};

	try {
		const response = await fetch(url, config);

		if (!response.ok) {
			const data = (await response.json()) as ApiErrorResponse;

			// User-friendly error messages based on status code
			let userMessage = data.error || "An error occurred";

			if (response.status >= 500) {
				userMessage = "Server error. Please try again later.";
			} else if (response.status === 404) {
				userMessage = "Resource not found.";
			} else if (response.status === 401 || response.status === 403) {
				userMessage = "Unauthorized access.";
			} else if (response.status === 400) {
				userMessage = data.error || "Invalid request.";
			}

			throw new ApiError(userMessage, response.status, data.details, false);
		}

		const json = (await response.json()) as ApiSuccessResponse<T>;
		return json.data;
	} catch (error) {
		// Network errors (offline, timeout, etc.)
		if (error instanceof TypeError || error instanceof DOMException) {
			throw new ApiError(
				"Network error. Please check your connection and try again.",
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
