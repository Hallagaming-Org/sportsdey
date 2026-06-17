const resolveApiBaseUrl = () => {
	if (typeof window !== "undefined") {
		const hostname = window.location.hostname;
		if (hostname === "stagingweb.sportsdey.com") {
			return "https://staging-api.sportsdey.com/";
		}
		if (hostname === "sportsdey.com" || hostname === "www.sportsdey.com") {
			return "https://api.sportsdey.com/";
		}
	}
	return import.meta.env.VITE_SERVER_URL || "";
};

const API_BASE_URL = resolveApiBaseUrl();

export type KycStatus =
	| "not_verified"
	| "pending_review"
	| "approved"
	| "rejected";

export type IdentificationType =
	| "nin"
	| "drivers_license"
	| "passport"
	| "voters_card";

export interface KycDocument {
	id: string;
	url: string;
}

export interface KycInfo {
	id: string;
	status: KycStatus;
	fullName: string;
	identificationType: IdentificationType;
	submittedAt: string;
	rejectionReason: string | null;
	documents: {
		front: KycDocument | null;
		back: KycDocument | null;
	};
}

export interface KycSubmitParams {
	fullName: string;
	identificationType: IdentificationType;
	frontDocument: File;
	backDocument: File;
}

export class KycError extends Error {
	status?: number;

	constructor(message: string, status?: number) {
		super(message);
		this.name = "KycError";
		this.status = status;
	}
}

export async function getKycStatus(): Promise<KycInfo | null> {
	const response = await fetch(`${API_BASE_URL}kyc`, {
		method: "GET",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
		},
	});

	if (!response.ok) {
		const data = (await response.json()) as { error?: string };
		throw new KycError(
			data.error || "Failed to get KYC status",
			response.status,
		);
	}

	const json = (await response.json()) as { data: KycInfo | null };
	return json.data;
}

export async function submitKyc(params: KycSubmitParams): Promise<KycInfo> {
	const formData = new FormData();
	formData.append("fullName", params.fullName);
	formData.append("identificationType", params.identificationType);
	formData.append("frontDocument", params.frontDocument);
	formData.append("backDocument", params.backDocument);

	const response = await fetch(`${API_BASE_URL}kyc`, {
		method: "POST",
		credentials: "include",
		body: formData,
	});

	if (!response.ok) {
		const data = (await response.json()) as { error?: string };
		throw new KycError(data.error || "Failed to submit KYC", response.status);
	}

	const json = (await response.json()) as { data: KycInfo };
	return json.data;
}
