
export type KudaEnv = "uat" | "production";

export interface KudaConfig {
	env: KudaEnv;
	apiKey: string;
	businessEmail: string;
}

export interface KudaTokenResponse {
	accessToken: string;
	expiresIn: number;
	tokenType: string;
}

export interface KudaBaseRequest {
	serviceType: string;
	requestRef: string;
	data?: Record<string, unknown>;
}

export interface KudaBaseResponse {
	status: boolean;
	message: string;
	data?: Record<string, unknown>;
}

// ===== Service Types =====
export type KudaServiceType =
	| "ADMIN_RETRIEVE_MAIN_ACCOUNT_BALANCE"
	| "BANK_LIST"
	| "NAME_ENQUIRY"
	| "SINGLE_FUND_TRANSFER"
	| "TRANSACTION_STATUS_QUERY"
	| "WITHDRAW_VIRTUAL_ACCOUNT"
	| "FUND_VIRTUAL_ACCOUNT"
	| "RETRIEVE_SINGLE_TRANSACTION"
	| "RETRIEVE_TRANSACTIONS";

// ===== Bank List =====
export interface KudaBank {
	bankCode: string;
	bankName: string;
	country: string;
}

// ===== Name Enquiry =====
export interface KudaNameEnquiryRequest {
	beneficiaryAccountNumber: string;
	beneficiaryBankCode: string;
}

export interface KudaNameEnquiryResponse {
	accountNumber: string;
	accountName: string;
	bankCode: string;
	bankName: string;
}

// ===== Single Fund Transfer =====
export interface KudaTransferRequest {
	beneficiaryAccountNumber: string;
	beneficiaryBankCode: string;
	beneficiaryName: string;
	amount: number;
	transactionReference: string;
	narration: string;
	sourceAccountNumber?: string;
}

export interface KudaTransferResponse {
	transactionReference: string;
	status: "PENDING" | "SUCCESS" | "FAILED";
	amount: number;
	beneficiaryAccountNumber: string;
	beneficiaryName: string;
	transactionDate: string;
}

// ===== Transaction Status =====
export interface KudaTransactionStatusRequest {
	transactionReference: string;
}

export interface KudaTransactionStatusResponse {
	transactionReference: string;
	status: "PENDING" | "SUCCESS" | "FAILED" | "REVERSED";
	amount: number;
	transactionDate: string;
	narration: string;
	beneficiaryAccountNumber: string;
	beneficiaryName: string;
}

// ===== Balance =====
export interface KudaBalanceResponse {
	accountNumber: string;
	availableBalance: number;
	ledgerBalance: number;
	currency: string;
}

// ===== Webhook =====
export interface KudaWebhookPayload {
	transactionReference: string;
	transactionDate: string;
	amount: number;
	narration: string;
	beneficiaryAccountNumber: string;
	beneficiaryName: string;
	status: "SUCCESS" | "FAILED";
	sourceAccountNumber: string;
	transactionType: "CREDIT" | "DEBIT";
}

// ===== Database Types =====
export interface KudaTransaction {
	id: string;
	userId: string;
	reference: string;
	amount: number;
	status: "initiated" | "pending" | "success" | "failed" | "reversed";
	type: "deposit" | "withdrawal";
	beneficiaryAccount?: string;
	beneficiaryBank?: string;
	beneficiaryName?: string;
	narration?: string;
	kudaReference?: string;
	rawCallbackPayload?: string;
	createdAt: Date;
	updatedAt: Date;
}