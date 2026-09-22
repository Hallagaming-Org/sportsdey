export const exportSources = [
	"admins",
	"users",
	"transactions",
	"ticket-history",
	"cms",
	"kyc",
] as const;

export const exportFormats = ["xlsx", "docx", "pdf"] as const;

export type ExportSource = (typeof exportSources)[number];
export type ExportFormat = (typeof exportFormats)[number];
export type ExportStatus =
	| "queued"
	| "processing"
	| "completed"
	| "completed_with_errors"
	| "failed";
export type ExportChunkStatus =
	| "queued"
	| "processing"
	| "completed"
	| "failed";

export type ExportFilters = Record<
	string,
	string | number | boolean | undefined
>;

export interface ExportQueueMessage {
	jobId: string;
	chunkId: string;
}

export interface ExportTable {
	headers: string[];
	rows: Array<Array<string | number | null>>;
}
