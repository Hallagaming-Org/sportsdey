import {
	fetchWithTimeout,
	isTimeoutError,
} from "./fetch-with-timeout";

export type AfricaTalkingRecipient = {
	statusCode: number;
	number: string;
	status: string;
	cost?: string;
	messageId?: string;
};

type AfricaTalkingResponse = {
	SMSMessageData?: {
		Message?: string;
		Recipients?: AfricaTalkingRecipient[];
	};
};

export type AfricaTalkingSendResult = {
	ok: boolean;
	status: number;
	recipients: AfricaTalkingRecipient[];
	raw: AfricaTalkingResponse | null;
	error?: string;
};

const ACCEPTED_STATUS_CODES = new Set([100, 101, 102]);
const AFRICASTALKING_BULK_URL =
	"https://api.africastalking.com/version1/messaging/bulk";
/** Align with other upstream helpers; Workers should not hang on AT. */
const AFRICASTALKING_TIMEOUT_MS = 10_000;

/** Normalize MSISDN to E.164 (+…). Accepts local NG or digits with/without +. */
export function normalizeSmsPhoneNumber(raw: string): string | null {
	const trimmed = raw.trim().replace(/[\s()-]/g, "");
	if (!trimmed) return null;

	if (trimmed.startsWith("+") && /^\+\d{8,15}$/.test(trimmed)) {
		return trimmed;
	}

	const digits = trimmed.replace(/\D/g, "");
	if (!digits) return null;

	if (/^0[789][01]\d{8}$/.test(digits)) {
		return `+234${digits.slice(1)}`;
	}
	if (/^234[789][01]\d{8}$/.test(digits)) {
		return `+${digits}`;
	}
	if (/^\d{8,15}$/.test(digits)) {
		return `+${digits}`;
	}
	return null;
}

export async function sendBulkSmsWithAfricaTalking(opts: {
	apiKey: string;
	username: string;
	senderId?: string;
	phoneNumbers: string[];
	message: string;
}): Promise<AfricaTalkingSendResult> {
	const phoneNumbers = opts.phoneNumbers
		.map((n) => normalizeSmsPhoneNumber(n))
		.filter((n): n is string => Boolean(n));

	if (phoneNumbers.length === 0) {
		return {
			ok: false,
			status: 400,
			recipients: [],
			raw: null,
			error: "No valid phone numbers",
		};
	}

	const payload: Record<string, unknown> = {
		username: opts.username,
		message: opts.message,
		phoneNumbers,
	};

	if (opts.senderId?.trim()) {
		payload.senderId = opts.senderId.trim();
	}

	let response: Response;
	try {
		response = await fetchWithTimeout(
			AFRICASTALKING_BULK_URL,
			{
				method: "POST",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
					apiKey: opts.apiKey,
				},
				body: JSON.stringify(payload),
			},
			AFRICASTALKING_TIMEOUT_MS,
		);
	} catch (error) {
		const timedOut = isTimeoutError(error);
		console.error(
			timedOut
				? "Africa's Talking request timed out"
				: "Africa's Talking request failed",
			error,
		);
		return {
			ok: false,
			status: timedOut ? 504 : 502,
			recipients: [],
			raw: null,
			error: timedOut
				? "Africa's Talking request timed out"
				: error instanceof Error
					? error.message
					: "Africa's Talking request failed",
		};
	}

	const text = await response.text();
	let body: AfricaTalkingResponse | null = null;

	if (text) {
		try {
			body = JSON.parse(text) as AfricaTalkingResponse;
		} catch {
			console.error(
				"Africa's Talking non-JSON response:",
				response.status,
				text,
			);
			return {
				ok: false,
				status: response.status,
				recipients: [],
				raw: null,
				error:
					text.trim() ||
					`Africa's Talking request failed (${response.status})`,
			};
		}
	}

	const recipients = body?.SMSMessageData?.Recipients ?? [];
	const accepted = recipients.some((r) =>
		ACCEPTED_STATUS_CODES.has(r.statusCode),
	);

	return {
		ok: response.ok && accepted,
		status: response.status,
		recipients,
		raw: body,
		error:
			response.ok && accepted
				? undefined
				: body?.SMSMessageData?.Message ||
					`Africa's Talking request failed (${response.status})`,
	};
}

/** OTP convenience wrapper around bulk SMS (single recipient). */
export async function sendOtpWithAfricaTalking(opts: {
	apiKey: string;
	username: string;
	senderId?: string;
	phoneNumber: string;
	message: string;
}): Promise<AfricaTalkingSendResult> {
	return sendBulkSmsWithAfricaTalking({
		apiKey: opts.apiKey,
		username: opts.username,
		senderId: opts.senderId,
		phoneNumbers: [opts.phoneNumber],
		message: opts.message,
	});
}
