const MONNIFY_BASE_URL = "https://sandbox.monnify.com/api";

interface MonnifyAccessToken {
	token: string;
	expiresAt: number;
}

let cachedToken: MonnifyAccessToken | null = null;

export interface MonnifyCategory {
	categoryCode: string;
	categoryName: string;
	categoryDescription: string;
}

export interface MonnifyBiller {
	billerCode: string;
	billerName: string;
	categoryCode: string;
	categoryName: string;
	billerType: string;
	website: string;
	contactPhone: string;
	contactEmail: string;
	country: string;
	isActive: number;
}

export interface MonnifyProduct {
	code: string;
	name: string;
	category: { code: string; name: string };
	billers: { code: string; name: string }[];
	minAmount: number | null;
	maxAmount: number | null;
	price: number | null;
	priceType: "OPEN" | "FIXED";
	metadata: {
		volume: number;
		duration: number;
		productType: { code: string; name: string };
		durationUnit: string | null;
		productCategory: string | null;
	};
}

export interface MonnifyProductsResponse {
	content: MonnifyProduct[];
	totalElements: number;
	size: number;
	number: number;
	empty: boolean;
	nextPage: number | null;
}

export interface MonnifyValidationResponse {
	customerName: string;
	customerId: string;
	validationReference: string;
	exists: boolean;
	commission: number | null;
	billerName: string;
	billerCode: string;
	productCode: string;
	productName: string;
	vendInstruction: {
		requireValidationRef: boolean;
		message: string;
	};
}

export interface MonnifyVendResponse {
	transactionReference: string;
	paymentReference: string;
	vendReference: string;
	vendStatus: "SUCCESS" | "FAILED" | "IN_PROGRESS";
	merchantName: string;
	billerName: string;
	productName: string;
	customerId: string;
	customerName: string;
	amountPaid: number;
	vendAmount: number;
	totalAmount: number;
	commission: number;
	additionalData: Record<string, unknown>;
}

export interface MonnifyRequeryResponse {
	transactionReference: string;
	paymentReference: string;
	vendReference: string;
	vendStatus: "SUCCESS" | "FAILED" | "IN_PROGRESS";
	merchantName: string;
	billerName: string;
	productName: string;
	customerId: string;
	customerName: string;
	amountPaid: number;
	vendAmount: number;
	totalAmount: number;
	commission: number;
}

interface MonnifyErrorResponse {
	responseMessage: string;
	responseCode: string;
}

async function monnifyRequest<T>(
	method: "GET" | "POST",
	endpoint: string,
	env: {
		MONNIFY_API_KEY: string;
		MONNIFY_CLIENT_SECRET: string;
		MONNIFY_CONTRACT_CODE: string;
	},
	body?: Record<string, unknown>,
): Promise<{ ok: boolean; data?: T; error?: string }> {
	const token = await getAccessToken(env);
	if (!token) {
		return { ok: false, error: "Failed to obtain access token" };
	}

	console.log("access_token", token);

	const url = `${MONNIFY_BASE_URL}${endpoint}`;
	const headers: Record<string, string> = {
		Authorization: `Bearer ${token}`,
		"Content-Type": "application/json",
	};

	console.log("headers", headers);

	try {
		const res = await fetch(url, {
			method,
			headers,
			...(body ? { body: JSON.stringify(body) } : {}),
		});

		const ras = await res.json();
		console.log("validation result", ras);

		const data = ras as
			| { responseCode: string; responseMessage: string; responseBody: T }
			| MonnifyErrorResponse;

		console.log("validation result", data);

		if ("requestSuccessful" in data && data.requestSuccessful === true) {
			const body = data as {
				requestSuccessful: boolean;
				responseCode: string;
				responseMessage: string;
				responseBody: T;
			};
			return { ok: true, data: body.responseBody };
		}

		if ("requestSuccessful" in data && data.requestSuccessful === false) {
			return {
				ok: false,
				error: data.responseMessage || `API error: ${data.responseCode}`,
			};
		}

		if ("responseCode" in data && data.responseCode === "0") {
			const body = data as {
				responseCode: string;
				responseMessage: string;
				responseBody: T;
			};
			return { ok: true, data: body.responseBody };
		}

		if ("responseCode" in data && data.responseCode !== "0") {
			return {
				ok: false,
				error: data.responseMessage || `API error: ${data.responseCode}`,
			};
		}

		return {
			ok: false,
			error:
				"responseMessage" in data
					? (data as MonnifyErrorResponse).responseMessage
					: "Unknown error",
		};
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : "Unknown error",
		};
	}
}

export async function getAccessToken(env: {
	MONNIFY_API_KEY: string;
	MONNIFY_CLIENT_SECRET: string;
}): Promise<string | null> {
	if (cachedToken && Date.now() < cachedToken.expiresAt) {
		return cachedToken.token;
	}

	const credentials = Buffer.from(
		`${env.MONNIFY_API_KEY}:${env.MONNIFY_CLIENT_SECRET}`,
	).toString("base64");

	const url = `${MONNIFY_BASE_URL}/auth/login`;
	const method = "POST";
	const headers = {
		Authorization: `Basic ${credentials}`,
		"Content-Type": "application/json",
	};
	const body = JSON.stringify({});

	console.log({ url, method, headers, body });

	try {
		const res = await fetch(url, { method, headers });

		const data = (await res.json()) as {
			requestSuccessful?: boolean;
			responseCode: string;
			responseMessage: string;
			responseBody?: { accessToken: string; expiresIn: number };
		};

		console.log("access_token_result", data);

		if (
			data.requestSuccessful === true &&
			data.responseCode === "0" &&
			data.responseBody
		) {
			cachedToken = {
				token: data.responseBody.accessToken,
				expiresAt: Date.now() + (data.responseBody.expiresIn - 60) * 1000,
			};
			return cachedToken.token;
		}
	} catch {
		return null;
	}

	return null;
}

export async function getCategories(env: {
	MONNIFY_API_KEY: string;
	MONNIFY_CLIENT_SECRET: string;
	MONNIFY_CONTRACT_CODE: string;
}): Promise<{
	ok: boolean;
	data?: MonnifyCategory[];
	error?: string;
}> {
	return monnifyRequest<MonnifyCategory[]>(
		"GET",
		"/vas/bills-payment/biller-categories",
		env,
	);
}

export async function getBillers(
	env: {
		MONNIFY_API_KEY: string;
		MONNIFY_CLIENT_SECRET: string;
		MONNIFY_CONTRACT_CODE: string;
	},
	categoryCode?: string,
): Promise<{ ok: boolean; data?: MonnifyBiller[]; error?: string }> {
	const endpoint = `/vas/bills-payment/billers?category_code=${categoryCode}`;
	return monnifyRequest<MonnifyBiller[]>("GET", endpoint, env);
}

export async function getProducts(
	env: {
		MONNIFY_API_KEY: string;
		MONNIFY_CLIENT_SECRET: string;
		MONNIFY_CONTRACT_CODE: string;
	},
	billerCode: string,
	categoryCode?: string,
): Promise<{ ok: boolean; data?: MonnifyProductsResponse; error?: string }> {
	const result = await monnifyRequest<MonnifyProductsResponse>(
		"GET",
		`/vas/bills-payment/biller-products?biller_code=${billerCode}`,
		env,
	);

	if (!result.ok || !result.data) {
		return {
			ok: result.ok,
			error: result.error,
		};
	}

	if (categoryCode) {
		const filteredContent = result.data.content.filter(
			(p) => p.category?.code === categoryCode,
		);
		return {
			ok: true,
			data: {
				...result.data,
				content: filteredContent,
				totalElements: filteredContent.length,
			},
		};
	}

	return result;
}

export async function validateCustomer(
	env: {
		MONNIFY_API_KEY: string;
		MONNIFY_CLIENT_SECRET: string;
		MONNIFY_CONTRACT_CODE: string;
	},
	productCode: string,
	customerId: string,
): Promise<{
	ok: boolean;
	data?: MonnifyValidationResponse;
	error?: string;
}> {
	return monnifyRequest<MonnifyValidationResponse>(
		"POST",
		"/vas/bills-payment/validate-customer",
		env,
		{
			billerCode: productCode.split("_")[0],
			productCode,
			customerId,
		},
	);
}

export async function vendBill(
	env: {
		MONNIFY_API_KEY: string;
		MONNIFY_CLIENT_SECRET: string;
		MONNIFY_CONTRACT_CODE: string;
	},
	params: {
		productCode: string;
		customerId: string;
		vendAmount: number;
		vendReference: string;
		validationReference?: string;
		customerName?: string;
	},
): Promise<{ ok: boolean; data?: MonnifyVendResponse; error?: string }> {
	return monnifyRequest<MonnifyVendResponse>(
		"POST",
		"/vas/bills-payment/vend",
		env,
		{
			billerCode: params.productCode.split("_")[0],
			productCode: params.productCode,
			customerId: params.customerId,
			amount: params.vendAmount,
			vendReference: params.vendReference,
			...(params.validationReference
				? { validationReference: params.validationReference }
				: {}),
			...(params.customerName ? { customerName: params.customerName } : {}),
		},
	);
}

export async function requeryTransaction(
	env: {
		MONNIFY_API_KEY: string;
		MONNIFY_CLIENT_SECRET: string;
		MONNIFY_CONTRACT_CODE: string;
	},
	transactionReference: string,
): Promise<{
	ok: boolean;
	data?: MonnifyRequeryResponse;
	error?: string;
}> {
	return monnifyRequest<MonnifyRequeryResponse>(
		"GET",
		`/vas/bills-payment/requery?reference=${transactionReference}`,
		env,
	);
}
