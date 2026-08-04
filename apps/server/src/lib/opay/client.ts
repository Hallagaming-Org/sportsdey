import { signRequestBody } from "./signature";


type OpayEnv = "sandbox" | "production";

const BASE_URLS: Record<OpayEnv, string> = {
	sandbox: "https://sandboxapi.opaycheckout.com",
	production: "https://api.opaycheckout.com",
};

export type OpayConfig = {
	env: OpayEnv;
	merchantId: string;
	publicKey: string;
	privateKey: string;
};

export type CreateCashierOrderParams = {
	reference: string; // sportdey unique reference 
	amountKobo: number;
	returnUrl: string;
	callbackUrl: string;
	cancelUrl: string;
	userEmail: string;
	userMobile: string;
	userName: string;
};

export type CreateCashierOrderResult = {
	reference: string;
	orderNo: string;
	cashierUrl: string;
	status: string;
};

export async function createCashierOrder(
	config: OpayConfig,
	params: CreateCashierOrderParams,
): Promise<CreateCashierOrderResult> {
	const baseUrl = BASE_URLS[config.env];

	const body = {
		country: "NG",
		reference: params.reference,
		amount: {
			total: params.amountKobo,
			currency: "NGN",
		},
		returnUrl: params.returnUrl,
		callbackUrl: params.callbackUrl,
		cancelUrl: params.cancelUrl,
		expireAt: 30, 
		userInfo: {
			userEmail: params.userEmail,
			userMobile: params.userMobile,
			userName: params.userName,
		},
		product: {
			name: "Wallet top-up",
			description: "SportsDey wallet deposit",
		},
	};


	const response = await fetch(`${baseUrl}/api/v1/international/cashier/create`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${config.publicKey}`,
			MerchantId: config.merchantId,
		},
		body: JSON.stringify(body),
	});

	const rawText = await response.text();
	let json: {
		code?: string;
		message?: string;
		data?: { reference: string; orderNo: string; cashierUrl: string; status: string };
	};
	try {
		json = JSON.parse(rawText);
	} catch {
		throw new Error(`OPay returned non-JSON response (${response.status}): ${rawText}`);
	}

	if (json.code !== "00000" || !json.data) {
		throw new Error(`OPay cashier create failed: ${json.code} ${json.message}`);
	}

	return {
		reference: json.data.reference,
		orderNo: json.data.orderNo,
		cashierUrl: json.data.cashierUrl,
		status: json.data.status,
	};
}

export async function queryCashierOrderStatus(
	config: OpayConfig,
	params: { reference: string; orderNo: string },
): Promise<{ status: string }> {
	const baseUrl = BASE_URLS[config.env];
	const body = { reference: params.reference, orderNo: params.orderNo };


	const signature = await signRequestBody(body, config.privateKey);

	const response = await fetch(`${baseUrl}/api/v1/international/cashier/status`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${signature}`,
			MerchantId: config.merchantId,
		},
		body: JSON.stringify(body),
	});

	const rawText = await response.text();
	let json: { code?: string; message?: string; data?: { status: string } };
	try {
		json = JSON.parse(rawText);
	} catch {
		throw new Error(`OPay returned non-JSON response (${response.status}): ${rawText}`);
	}

	if (json.code !== "00000" || !json.data) {
		throw new Error(`OPay status query failed: ${json.code} ${json.message}`);
	}

	return { status: json.data.status };
}