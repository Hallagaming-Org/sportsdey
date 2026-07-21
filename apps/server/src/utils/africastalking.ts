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
	const baseUrl =
		opts.username === "sandbox"
			? "https://api.sandbox.africastalking.com/version1/messaging"
			: "https://api.africastalking.com/version1/messaging";

	const params = new URLSearchParams();
	params.append("username", opts.username);
	params.append("to", opts.phoneNumber);
	params.append("message", opts.message);
	if (opts.senderId) {
		params.append("from", opts.senderId);
	}

	const response = await fetch(baseUrl, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded",
			apiKey: opts.apiKey,
		},
		body: params.toString(),
	});

	const rawText = await response.text();
	let body: AfricaTalkingResponse | null = null;
	try {
		body = JSON.parse(rawText) as AfricaTalkingResponse;
	} catch {
		console.error("Africa's Talking non-JSON response:", response.status, rawText);
		return {
			ok: false,
			status: response.status,
			recipients: [],
			raw: rawText,
		};
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
	};
}