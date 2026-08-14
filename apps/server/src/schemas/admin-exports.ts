import { z } from "@hono/zod-openapi";
import { exportFormats, exportSources } from "@/types/exports";

export const ExportFiltersSchema = z
	.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
	.default({});

export const CreateExportSchema = z.object({
	source: z.enum(exportSources),
	format: z.enum(exportFormats),
	filters: ExportFiltersSchema,
});

export const JobParamsSchema = z.object({ id: z.string().min(1) });

export const JobResponseSchema = z.object({
	jobId: z.string(),
	source: z.enum(exportSources),
	format: z.enum(exportFormats),
	status: z.enum([
		"queued",
		"processing",
		"completed",
		"completed_with_errors",
		"failed",
	]),
	rowCount: z.number(),
	chunkCount: z.number(),
	chunksDone: z.number(),
	chunksFailed: z.number(),
	failedChunks: z.array(
		z.object({ index: z.number(), error: z.string().nullable() }),
	),
	zipUrl: z.string().nullable(),
	expiresAt: z.string().nullable(),
});
