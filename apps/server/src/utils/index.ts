export async function fetchWithErrorHandling(url: string, apiKey: string) {
	const res = await fetch(url, {
		headers: { "x-api-key": apiKey, Accept: "application/json" },
	});
	if (res.ok) {
		return { ok: true, data: await res.json() };
	}
	if (res.status === 400) {
		return {
			ok: false,
			error: {
				field: "sportradar_api",
				message: "Bad request (400)",
				code: "external_api_error",
				status: res.status,
			},
		};
	}
	if (res.status === 500) {
		return {
			ok: false,
			error: {
				field: "sportradar_api",
				message: "SportRadar Server Error (500)",
				code: "external_api_error",
				status: res.status,
			},
		};
	}
	return {
		ok: false,
		error: {
			field: "sportradar_api",
			message: `SportRadar API returned status ${res.status}`,
			code: "external_api_error",
			status: res.status,
		},
	};
}

export const parseDateString = (dateStr?: string): string => {
	if (!dateStr) return new Date().toISOString();
	// Expecting "DD/MM/YYYY HH:mm:ss"
	const parts = dateStr.split(" ");
	if (parts.length < 1) return new Date().toISOString();

	const dateParts = parts[0]?.split("/");
	if (!dateParts || dateParts.length !== 3) return new Date().toISOString();

	const day = Number.parseInt(dateParts[0] || "0", 10);
	const month = Number.parseInt(dateParts[1] || "0", 10) - 1; // Months are 0-indexed in JS
	const year = Number.parseInt(dateParts[2] || "0", 10);

	let hours = 0;
	let minutes = 0;
	let seconds = 0;

	if (parts.length > 1) {
		const timeParts = parts[1]?.split(":");
		if (timeParts && timeParts.length >= 2) {
			hours = Number.parseInt(timeParts[0] || "0", 10);
			minutes = Number.parseInt(timeParts[1] || "0", 10);
			if (timeParts.length === 3) {
				seconds = Number.parseInt(timeParts[2] || "0", 10);
			}
		}
	}

	return new Date(
		Date.UTC(year, month, day, hours, minutes, seconds),
	).toISOString();
};

export { verifySlotitegrationSignature } from "./slotegrator";
