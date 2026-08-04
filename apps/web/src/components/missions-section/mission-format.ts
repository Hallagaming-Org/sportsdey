/**
 * Formats a mission end time for the search placeholder (e.g. "Ends Jul 30, 6:00 PM").
 */
export function formatShortDate(value: string): string {
	return new Date(value).toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

/**
 * Formats a completion timestamp for the completed-missions list.
 */
export function formatCompletedAt(value: string): string {
	return new Date(value).toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}
