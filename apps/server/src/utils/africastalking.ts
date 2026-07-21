type AfricaTalkingRecipient = {
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

const ACCEPTED_STATUS_CODES = new Set([100, 101, 102]);

export async function sendOtpWithAfricaTalking(opts: {
	apiKey: string;
	username: string;
	senderId?: string;
	phoneNumber: string;
	message: string;
}) {
	const response = await fetch(
		"https://api.africastalking.com/version1/messaging/bulk",
		{
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
				apiKey: opts.apiKey,
			},
			body: JSON.stringify({
				username: opts.username,
				message: opts.message,
				senderId: opts.senderId,
				phoneNumbers: [opts.phoneNumber],
			}),
		},
	);

	const text = await response.text();
	let body: AfricaTalkingResponse | null = null;

	if (text) {
		try {
			body = JSON.parse(text) as AfricaTalkingResponse;
		} catch {
			console.error("Africa's Talking non-JSON response:", response.status, text);
			return {
				ok: false,
				status: response.status,
				recipients: [] as AfricaTalkingRecipient[],
				raw: null,
				error: text.trim() || `Africa's Talking request failed (${response.status})`,
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
