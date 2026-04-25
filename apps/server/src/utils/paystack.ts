export interface PaystackTransaction {
	reference: string;
	amount: number;
	currency: string;
	status: string;
	metadata: Record<string, unknown>;
	customer: {
		email: string;
	};
}

export interface InitializeTransactionResponse {
	reference: string;
	authorizationUrl: string;
}

export async function initializeTransaction(
	secretKey: string,
	amount: number,
	email: string,
	metadata?: Record<string, unknown>,
	callbackUrl?: string,
	proxyUrl?: string,
	proxySecret?: string,
): Promise<InitializeTransactionResponse> {
	const baseUrl = proxyUrl || "https://api.paystack.co";
	const endpoint = proxyUrl
		? "/paystack/transaction/initialize"
		: "/transaction/initialize";
	const headers: Record<string, string> = proxyUrl
		? {
				"X-Proxy-Auth": proxySecret || "",
				Authorization: `Bearer ${secretKey}`,
				"Content-Type": "application/json",
			}
		: {
				Authorization: `Bearer ${secretKey}`,
				"Content-Type": "application/json",
			};
	const response = await fetch(`${baseUrl}${endpoint}`, {
		method: "POST",
		headers,
		body: JSON.stringify({
			amount: amount * 100,
			email,
			currency: "NGN",
			metadata,
			callback_url: callbackUrl,
		}),
	});

	const data = (await response.json()) as {
		status: boolean;
		message: string;
		data: { reference: string; authorization_url: string };
	};

	if (!response.ok) {
		throw new Error(data.message || "Failed to initialize transaction");
	}

	return {
		reference: data.data.reference,
		authorizationUrl: data.data.authorization_url,
	};
}

export async function verifyTransaction(
	secretKey: string,
	reference: string,
	proxyUrl?: string,
	proxySecret?: string,
): Promise<PaystackTransaction> {
	const baseUrl = proxyUrl || "https://api.paystack.co";
	const endpoint = proxyUrl
		? `/paystack/transaction/verify/${reference}`
		: `/transaction/verify/${reference}`;
	const headers: Record<string, string> = proxyUrl
		? {
				"X-Proxy-Auth": proxySecret || "",
				Authorization: `Bearer ${secretKey}`,
			}
		: {
				Authorization: `Bearer ${secretKey}`,
			};
	const response = await fetch(`${baseUrl}${endpoint}`, { headers });

	const data = (await response.json()) as {
		status: boolean;
		message: string;
		data: PaystackTransaction;
	};

	if (!response.ok) {
		throw new Error(data.message || "Failed to verify transaction");
	}

	return data.data;
}

export async function verifyWebhookSignature(
	secretKey: string,
	payload: string,
	signature: string,
): Promise<boolean> {
	const crypto = await import("crypto");
	const hash = crypto
		.createHmac("sha512", secretKey)
		.update(payload)
		.digest("hex");
	return hash === signature;
}

export interface TransferRecipient {
	id: string;
	reference: string;
	recipient_code: string;
}

export async function createTransferRecipient(
	secretKey: string,
	bankCode: string,
	accountNumber: string,
	name: string,
	currency = "NGN",
	proxyUrl?: string,
	proxySecret?: string,
): Promise<TransferRecipient> {
	const baseUrl = proxyUrl || "https://api.paystack.co";
	const endpoint = proxyUrl ? "/paystack/transferrecipient" : "/transferrecipient";
	const headers: Record<string, string> = proxyUrl
		? {
				"X-Proxy-Auth": proxySecret || "",
				Authorization: `Bearer ${secretKey}`,
				"Content-Type": "application/json",
			}
		: {
				Authorization: `Bearer ${secretKey}`,
				"Content-Type": "application/json",
			};
	const body = {
		type: "nuban",
		bank_code: bankCode,
		account_number: accountNumber,
		name,
		currency,
	};
	console.log("Paystack create recipient:", body);

	const response = await fetch(`${baseUrl}${endpoint}`, {
		method: "POST",
		headers,
		body: JSON.stringify(body),
	});

	const data = await response.json();
	console.log("Paystack create recipient response:", data);

	const responseData = data as {
		status: boolean;
		message?: string;
		data?: { id: string; reference: string; recipient_code: string };
	};

	if (!response.ok || !responseData.status) {
		console.log("response message", responseData.message);
		throw new Error(responseData.message);
	}

	return {
		id: responseData.data!.id,
		reference: responseData.data!.reference,
		recipient_code: responseData.data!.recipient_code,
	};
}

export async function initiateTransfer(
	secretKey: string,
	amount: number,
	recipientCode: string,
	source = "balance",
	reason = "Withdrawal",
	proxyUrl?: string,
	proxySecret?: string,
): Promise<{ reference: string; status: string }> {
	const baseUrl = proxyUrl || "https://api.paystack.co";
	const endpoint = proxyUrl ? "/paystack/transfer" : "/transfer";
	const headers: Record<string, string> = proxyUrl
		? {
				"X-Proxy-Auth": proxySecret || "",
				Authorization: `Bearer ${secretKey}`,
				"Content-Type": "application/json",
			}
		: {
				Authorization: `Bearer ${secretKey}`,
				"Content-Type": "application/json",
			};
	const body = {
		amount: amount * 100,
		recipient: recipientCode,
		source,
		reason,
	};
	console.log("Paystack initiate transfer:", body);

	const response = await fetch(`${baseUrl}${endpoint}`, {
		method: "POST",
		headers,
		body: JSON.stringify(body),
	});

	const data = (await response.json()) as {
		status: boolean;
		message: string;
		data: { reference: string; status: string };
	};

	console.log("Paystack initiate transfer response:", data);

	if (!response.ok) {
		throw new Error(data.message || "Failed to initiate transfer");
	}

	return {
		reference: data.data.reference,
		status: data.data.status,
	};
}

export interface AccountVerification {
	isValid: boolean;
	accountName: string;
	accountNumber: string;
	bankId: number;
}

export interface NigerianBank {
	name: string;
	code: string;
	id: number;
}

export async function verifyAccountNumber(
	secretKey: string,
	accountNumber: string,
	bankCode: string,
	proxyUrl?: string,
	proxySecret?: string,
): Promise<AccountVerification> {
	const baseUrl = proxyUrl || "https://api.paystack.co";
	const endpoint = proxyUrl
		? `/paystack/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`
		: `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`;
	const headers: Record<string, string> = proxyUrl
		? {
				"X-Proxy-Auth": proxySecret || "",
				Authorization: `Bearer ${secretKey}`,
			}
		: {
				Authorization: `Bearer ${secretKey}`,
			};
	const url = `${baseUrl}${endpoint}`;
	console.log("Paystack verify account:", { url, accountNumber, bankCode });

	const response = await fetch(url, { headers });

	const data = (await response.json()) as {
		status: boolean;
		message: string;
		data: {
			account_number: string;
			account_name: string;
			bank_id: number;
		};
	};

	console.log("Paystack verify response:", data);

	if (!response.ok || !data.status) {
		return {
			isValid: false,
			accountName: "",
			accountNumber: "",
			bankId: 0,
		};
	}

	return {
		isValid: true,
		accountName: data.data.account_name,
		accountNumber: data.data.account_number,
		bankId: data.data.bank_id,
	};
}

export async function getNigerianBanks(
	secretKey: string,
	proxyUrl?: string,
	proxySecret?: string,
): Promise<NigerianBank[]> {
	const baseUrl = proxyUrl || "https://api.paystack.co";
	const endpoint = proxyUrl
		? "/paystack/bank?country=nigeria&use_cursor=false&perPage=500"
		: "/bank?country=nigeria&use_cursor=false&perPage=500";
	const headers: Record<string, string> = proxyUrl
		? {
				"X-Proxy-Auth": proxySecret || "",
				Authorization: `Bearer ${secretKey}`,
			}
		: {
				Authorization: `Bearer ${secretKey}`,
			};
	const response = await fetch(`${baseUrl}${endpoint}`, { headers });

	const data = (await response.json()) as {
		status: boolean;
		message: string;
		data: Array<{ name: string; code: string; id: number }>;
	};

	if (!response.ok || !data.status) {
		throw new Error(data.message || "Failed to fetch banks");
	}

	return data.data.map((bank) => ({
		name: bank.name,
		code: bank.code,
		id: bank.id,
	}));
}
