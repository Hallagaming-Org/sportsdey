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

	let body: AfricaTalkingResponse | null = null;
	body = (await response.json()) as AfricaTalkingResponse;

	const recipients = body?.SMSMessageData?.Recipients ?? [];
	const accepted = recipients.some((r) =>
		ACCEPTED_STATUS_CODES.has(r.statusCode),
	);

	return {
		ok: response.ok && accepted,
		status: response.status,
		recipients,
		raw: body,
	};
}
