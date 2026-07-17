import type { Context } from "hono";

export function jsonZodErrorFormatter(result: any, c: Context) {
	if (result.success === true) {
		return;
	}
	if (!result || !result.error) {
		return c.json(
			{
				success: false,
				error: "Validation failed",
				details: [],
			},
			400,
		);
	}

	const zodError = result.error;
	let issues: any[] = [];

	if (zodError.message && typeof zodError.message === "string") {
		const parsedMessage = JSON.parse(zodError.message);
		if (Array.isArray(parsedMessage)) {
			issues = parsedMessage;
		}
	}

	// Fallback: try to get issues directly from the error object
	if (
		issues.length === 0 &&
		zodError.issues &&
		Array.isArray(zodError.issues)
	) {
		issues = zodError.issues;
	}

	// If we still don't have issues, return a generic error
	if (issues.length === 0) {
		return c.json(
			{
				success: false,
				error: "Validation failed",
				details: [
					{
						field: "unknown",
						message: "Validation error occurred",
						code: "validation_error",
					},
				],
			},
			400,
		);
	}

	const formattedDetails = issues.map((issue: any) => {
		const detail: any = {
			field:
				issue.path && issue.path.length > 0 ? issue.path.join(".") : "root",
			message: issue.message || "Validation error",
			code: issue.code || "unknown",
		};

		if (issue.expected !== undefined) detail.expected = issue.expected;
		if (issue.received !== undefined) detail.received = issue.received;

		return detail;
	});

	return c.json(
		{
			success: false,
			error: "Validation failed",
			details: formattedDetails,
		},
		400,
	);
}
