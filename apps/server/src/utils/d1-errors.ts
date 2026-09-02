function collectErrorText(error: unknown): string {
	const parts: string[] = [];
	let current: unknown = error;
	for (let depth = 0; depth < 4 && current; depth += 1) {
		if (current instanceof Error) {
			parts.push(current.message);
			current = "cause" in current ? current.cause : undefined;
			continue;
		}
		parts.push(String(current));
		break;
	}
	return parts.join(" ").toLowerCase();
}

/** Detect Cloudflare D1 quota / capacity failures (not schema drift or SQL bugs). */
export function isD1CapacityError(error: unknown): boolean {
	const combined = collectErrorText(error);

	if (
		combined.includes("no such column") ||
		combined.includes("no such table") ||
		combined.includes("unique constraint failed") ||
		combined.includes("foreign key constraint failed")
	) {
		return false;
	}

	return (
		combined.includes("daily row read limit") ||
		combined.includes("daily row write limit") ||
		combined.includes("exceeded d1") ||
		combined.includes("[code: 7500]")
	);
}
