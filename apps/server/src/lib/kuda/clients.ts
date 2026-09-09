import type { CloudflareBindings } from "../../types";
import {
	KudaBaseRequest,
	KudaBaseResponse,
	KudaBalanceResponse,
	KudaBank,
	KudaConfig,
	KudaEnv,
	KudaNameEnquiryRequest,
	KudaNameEnquiryResponse,
	KudaServiceType,
	KudaTokenResponse,
	KudaTransferRequest,
	KudaTransferResponse,
	KudaTransactionStatusRequest,
	KudaTransactionStatusResponse,
} from "./types";

const BASE_URLS: Record<KudaEnv, string> = {
	uat: "https://kuda-openapi-uat.kudabank.com/v2.1",
	production: "https://kuda-openapi.kuda.com/v2.1",
};

export class KudaProviderError extends Error {
	constructor(
		public readonly operation: "get_token" | "request",
		public readonly providerStatus: number,
		public readonly providerCode: string,
	) {
		super("Kuda provider request failed");
		this.name = "KudaProviderError";
	}
}

function parseKudaResponse(
	raw: string,
	operation: "get_token" | "request",
	providerStatus: number,
) {
	try {
		return JSON.parse(raw.replace(/^\uFEFF/, "").trim()) as Record<string, unknown>;
	} catch {
		throw new KudaProviderError(operation, providerStatus, "INVALID_PROVIDER_RESPONSE");
	}
}

let cachedToken: { key: string; token: string; expiresAt: number } | null = null;

/**
 * Kuda access token
 */
export async function getKudaAccessToken(
	env: CloudflareBindings,
): Promise<string> {
	const apiKey = env.KUDA_API_KEY;
	const businessEmail = env.KUDA_BUSINESS_EMAIL;
	const envType = env.KUDA_ENV === "production" ? "production" : "uat";

	if (!apiKey || !businessEmail) {
		throw new Error("Kuda API credentials not configured");
	}
	const cacheKey = `${envType}:${businessEmail}`;
	if (cachedToken?.key === cacheKey && cachedToken.expiresAt > Date.now() + 60000) return cachedToken.token;

	const baseUrl = BASE_URLS[envType];

	const response = await fetch(`${baseUrl}/Account/GetToken`, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			apiKey,
			email: businessEmail,
		}),
	});

	const raw = await response.text();
	if (!response.ok) {
		throw new KudaProviderError("get_token", response.status, "HTTP_ERROR");
	}

	const tokenResponse = raw.replace(/^\uFEFF/, "").trim();
	let token = tokenResponse;
	let expiresIn = 300;
	if (tokenResponse.startsWith("{")) {
		const data = parseKudaResponse(tokenResponse, "get_token", response.status) as KudaTokenResponse;
		token = data.accessToken?.trim() ?? "";
		expiresIn = data.expiresIn || expiresIn;
	}
	if (!token) throw new KudaProviderError("get_token", response.status, "MISSING_ACCESS_TOKEN");

	cachedToken = {
		key: cacheKey,
		token,
		expiresAt: Date.now() + Math.max(60, expiresIn) * 1000,
	};

	return token;
}

/**
 * Generate unique reference
 */
export function generateRequestRef(prefix: string = "REQ"): string {
	const timestamp = Date.now().toString(36).toUpperCase();
	const random = Math.random().toString(36).substring(2, 8).toUpperCase();
	return `${prefix}${timestamp}${random}`;
}

/**
 * Make API request
 */
export async function kudaRequest<T = KudaBaseResponse>(
	env: CloudflareBindings,
	serviceType: KudaServiceType,
	data?: Record<string, unknown>,
	requestRef = generateRequestRef(),
): Promise<T> {
	const token = await getKudaAccessToken(env);
	const envType = env.KUDA_ENV === "production" ? "production" : "uat";
	const baseUrl = BASE_URLS[envType];

	const payload: KudaBaseRequest = {
		serviceType,
		requestRef,
		data,
	};

	const response = await fetch(baseUrl, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify(payload),
	});

	const rawResponse = await response.text();
	if (!response.ok) {
		throw new KudaProviderError("request", response.status, "HTTP_ERROR");
	}

	const jsonResponse = parseKudaResponse(rawResponse, "request", response.status) as T;

	const baseResponse = jsonResponse as unknown as KudaBaseResponse;
	if (baseResponse.status === false) {
		throw new KudaProviderError("request", response.status, "REQUEST_REJECTED");
	}

	return jsonResponse;
}


export async function createDynamicCollectionAccount(
	env: CloudflareBindings,
	params: { requestRef: string; amount: number; accountName: string },
): Promise<{ accountNumber: string; accountName: string }> {
	const response = await kudaRequest<{
		status: boolean;
		message: string;
		data: { accountNumber: string; accountName: string };
	}>(env, "ADMIN_CREATE_DYNAMIC_COLLECTION_ACCOUNT", {
		amount: params.amount,
		isFlexiblePayment: false,
		accountName: params.accountName,
	}, params.requestRef);
	if (!response.data?.accountNumber || !response.data.accountName) throw new Error("Kuda did not return a collection account");
	return response.data;
}

export async function queryDynamicCollectionStatus(
	env: CloudflareBindings,
	params: { accountCreationRequestRef: string; accountNumber: string },
): Promise<Record<string, unknown>> {
	const response = await kudaRequest<{
		status: boolean;
		message: string;
		data: Record<string, unknown>;
	}>(env, "DYNAMIC_COLLECTION_ACCOUNT_TSQ", {
		accountCreationRequestRef: params.accountCreationRequestRef,
		accountNumber: params.accountNumber,
	});
	return response.data ?? {};
}

/**
 * Get bank list
 */
export async function getBankList(env: CloudflareBindings): Promise<KudaBank[]> {
	const response = await kudaRequest<{
		status: boolean;
		message: string;
		data: { banks: KudaBank[] };
	}>(env, "BANK_LIST");

	return response.data?.banks || [];
}


/**
 * verify account details
 */
export async function nameEnquiry(
	env: CloudflareBindings,
	params: KudaNameEnquiryRequest,
): Promise<KudaNameEnquiryResponse> {
	const response = await kudaRequest<{
		status: boolean;
		message: string;
		data: KudaNameEnquiryResponse;
	}>(env, "NAME_ENQUIRY", {
		beneficiaryAccountNumber: params.beneficiaryAccountNumber,
		beneficiaryBankCode: params.beneficiaryBankCode,
	});

	return response.data;
}

/**
 * Single fund transfer
 */
export async function singleFundTransfer(
	env: CloudflareBindings,
	params: KudaTransferRequest,
): Promise<KudaTransferResponse> {
	const response = await kudaRequest<{
		status: boolean;
		message: string;
		data: KudaTransferResponse;
	}>(env, "SINGLE_FUND_TRANSFER", {
		beneficiaryAccountNumber: params.beneficiaryAccountNumber,
		beneficiaryBankCode: params.beneficiaryBankCode,
		beneficiaryName: params.beneficiaryName,
		amount: params.amount,
		transactionReference: params.transactionReference,
		narration: params.narration,
		sourceAccountNumber: params.sourceAccountNumber,
	});

	return response.data;
}

/**
 * Query transaction status
 */
export async function queryTransactionStatus(
	env: CloudflareBindings,
	params: KudaTransactionStatusRequest,
): Promise<KudaTransactionStatusResponse> {
	const response = await kudaRequest<{
		status: boolean;
		message: string;
		data: KudaTransactionStatusResponse;
	}>(env, "TRANSACTION_STATUS_QUERY", {
		transactionReference: params.transactionReference,
	});

	return response.data;
}

/**
 * Get account balance
 */
export async function getAccountBalance(
	env: CloudflareBindings,
	accountNumber?: string,
): Promise<KudaBalanceResponse> {
	const response = await kudaRequest<{
		status: boolean;
		message: string;
		data: KudaBalanceResponse;
	}>(env, "ADMIN_RETRIEVE_MAIN_ACCOUNT_BALANCE", {
		accountNumber,
	});

	return response.data;
}
