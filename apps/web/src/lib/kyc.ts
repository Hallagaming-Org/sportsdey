import { resolveServerUrl } from "@/lib/server-url";

function apiBaseUrl(): string {
	return `${resolveServerUrl()}/`;
}

function readKycErrorMessage(data: unknown, fallback: string): string {
	if (!data || typeof data !== "object") {
		return fallback;
	}

	const record = data as Record<string, unknown>;
	if (typeof record.error === "string" && record.error.trim()) {
		return record.error === "Internal server error" ? fallback : record.error;
	}

	const nested = record.error;
	if (nested && typeof nested === "object") {
		const errorObject = nested as Record<string, unknown>;
		if (typeof errorObject.message === "string" && errorObject.message.trim()) {
			return errorObject.message === "Internal server error"
				? fallback
				: errorObject.message;
		}
		const inner = errorObject.data;
		if (inner && typeof inner === "object") {
			const message = (inner as Record<string, unknown>).message;
			if (typeof message === "string" && message.trim()) {
				return message === "Internal server error" ? fallback : message;
			}
		}
	}

	return fallback;
}

async function readKycErrorResponse(
	response: Response,
	fallback: string,
): Promise<string> {
	try {
		const data: unknown = await response.json();
		return readKycErrorMessage(data, fallback);
	} catch {
		return fallback;
	}
}

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
	const response = await fetch(`${apiBaseUrl()}kyc`, {
		method: "GET",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
		},
	});

	if (!response.ok) {
		throw new KycError(
			await readKycErrorResponse(response, "Failed to get KYC status"),
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

	const response = await fetch(`${apiBaseUrl()}kyc`, {
		method: "POST",
		credentials: "include",
		body: formData,
	});

	if (!response.ok) {
		throw new KycError(
			await readKycErrorResponse(
				response,
				"We could not submit your KYC right now. Please try again.",
			),
			response.status,
		);
	}

	const json = (await response.json()) as { data: KycInfo };
	return json.data;
}
