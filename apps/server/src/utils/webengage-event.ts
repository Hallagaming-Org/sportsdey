export function asEventNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim()) {
		const parsed = Number.parseFloat(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

export function buildWebengageUserPayload(params: {
	userId: string;
	email?: string;
	firstName?: string;
	lastName?: string;
	phone?: string;
	[key: string]: unknown;
}): Record<string, unknown> {
	const { userId, email, firstName, lastName, phone, ...custom } = params;
	const payload: Record<string, unknown> = { userId };
	if (email) payload.email = email;
	if (firstName) payload.firstName = firstName;
	if (lastName) payload.lastName = lastName;
	if (phone) payload.phone = phone;
	const customAttributes: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(custom)) {
		if (value !== undefined) customAttributes[key] = value;
	}
	if (Object.keys(customAttributes).length > 0) {
		payload.attributes = customAttributes;
	}
	return payload;
}
