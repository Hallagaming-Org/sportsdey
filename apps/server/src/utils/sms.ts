export async function sendSms(opts: {
	ref_id: string;
	sender_id: string;
	recipients: string;
	telco?: string;
	message: string;
	token: string | undefined;
}) {
	const url = "https://bulkapi.eudormsg.com/v1/sms/send";
	const token = opts.token?.trim();
	if (!token) {
		console.error("Bulk SMS skipped: EUDOR_SMS_TOKEN is not configured");
		return { ok: false, status: 503, body: null };
	}

	const payload = {
		ref_id: opts.ref_id,
		sender_id: opts.sender_id,
		recipient: opts.recipients,
		message: opts.message,
	};

	const res = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	let body = null;
	body = await res.json();

	return { ok: res.ok, status: res.status, body };
}
