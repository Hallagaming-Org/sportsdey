import { and, asc, eq, isNotNull, lt, notInArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import type { CloudflareBindings } from "@/types";
import { rowsForSource } from "./sources";
import type {
	ExportFilters,
	ExportFormat,
	ExportQueueMessage,
	ExportSource,
	ExportStatus,
} from "@/types/exports";
import { renderExportChunk } from "./writer";

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_QUEUE_ATTEMPTS = 3;
const STALE_CHUNK_MS = 15 * 60 * 1000;

export function chunkSizeFor(format: ExportFormat): number {
	return format === "pdf" ? 2_000 : 10_000;
}

export function exportBucket(
	env: CloudflareBindings,
): CloudflareBindings["PRODUCTION_BUCKET"] {
	const bucket =
		env.NODE_ENV === "production" ? env.PRODUCTION_BUCKET : env.STAGING_BUCKET;
	if (!bucket) throw new Error("Export storage is not configured");
	return bucket;
}

function parseFilters(value: string): ExportFilters {
	try {
		const parsed = JSON.parse(value);
		return parsed && typeof parsed === "object" ? parsed : {};
	} catch {
		return {};
	}
}

function safeError(error: unknown): string {
	const message =
		error instanceof Error ? error.message : "Export chunk failed";
	return message.slice(0, 500);
}

function terminalStatus(
	done: number,
	failed: number,
	total: number,
): ExportStatus {
	if (done + failed < total) return "processing";
	if (failed === 0) return "completed";
	if (done === 0) return "failed";
	return "completed_with_errors";
}

export async function createExportJob(
	env: CloudflareBindings,
	input: {
		source: ExportSource;
		format: ExportFormat;
		filters: ExportFilters;
		requestedBy: string;
	},
): Promise<{ jobId: string; rowCount: number; chunkCount: number }> {
	const db = drizzle(env.DB, { schema });
	const jobId = crypto.randomUUID();
	const snapshotAt = new Date();
	const size = chunkSizeFor(input.format);
	const filters = { ...input.filters, snapshotAt: snapshotAt.toISOString() };
	const snapshot = await rowsForSource(input.source, env, filters, 0, 0);
	const chunkCount = Math.ceil(snapshot.total / size);

	const insertedJob = await db
		.insert(schema.exportJob)
		.values({
			id: jobId,
			source: input.source,
			format: input.format,
			filters: JSON.stringify(filters),
			status: chunkCount === 0 ? "completed" : "queued",
			requestedBy: input.requestedBy,
			rowCount: snapshot.total,
			chunkCount,
			chunksDone: 0,
			chunksFailed: 0,
			snapshotAt,
			completedAt: chunkCount === 0 ? snapshotAt : null,
			expiresAt:
				chunkCount === 0 ? new Date(snapshotAt.getTime() + RETENTION_MS) : null,
		})
		.returning({ id: schema.exportJob.id })
		.get();
	if (!insertedJob) throw new Error("Failed to create export job");

	if (chunkCount === 0) return { jobId, rowCount: 0, chunkCount: 0 };
	const chunks = Array.from({ length: chunkCount }, (_, chunkIndex) => ({
		id: crypto.randomUUID(),
		jobId,
		chunkIndex,
		startOffset: chunkIndex * size,
		rowLimit: size,
		status: "queued" as const,
	}));
	for (let offset = 0; offset < chunks.length; offset += 50) {
		const insertedChunks = await db
			.insert(schema.exportChunk)
			.values(chunks.slice(offset, offset + 50))
			.returning({ id: schema.exportChunk.id });
		if (insertedChunks.length !== chunks.slice(offset, offset + 50).length) {
			throw new Error("Failed to create all export chunks");
		}
	}
	try {
		for (let offset = 0; offset < chunks.length; offset += 100) {
			await env.EXPORT_QUEUE.sendBatch(
				chunks
					.slice(offset, offset + 100)
					.map((chunk) => ({ body: { jobId, chunkId: chunk.id } })),
			);
		}
	} catch (error) {
		const completedAt = new Date();
		await db
			.update(schema.exportChunk)
			.set({ status: "failed", error: safeError(error), completedAt })
			.where(eq(schema.exportChunk.jobId, jobId));
		await db
			.update(schema.exportJob)
			.set({
				status: "failed",
				chunksFailed: chunkCount,
				completedAt,
				expiresAt: new Date(completedAt.getTime() + RETENTION_MS),
			})
			.where(eq(schema.exportJob.id, jobId));
		throw error;
	}
	return { jobId, rowCount: snapshot.total, chunkCount };
}

async function refreshJobStatus(
	env: CloudflareBindings,
	jobId: string,
): Promise<void> {
	const db = drizzle(env.DB, { schema });
	const chunks = await db
		.select({ status: schema.exportChunk.status })
		.from(schema.exportChunk)
		.where(eq(schema.exportChunk.jobId, jobId));
	const done = chunks.filter((chunk) => chunk.status === "completed").length;
	const failed = chunks.filter((chunk) => chunk.status === "failed").length;
	const status = terminalStatus(done, failed, chunks.length);
	const completedAt =
		status === "completed" ||
		status === "completed_with_errors" ||
		status === "failed"
			? new Date()
			: null;
	const statusWhere =
		status === "processing"
			? and(
					eq(schema.exportJob.id, jobId),
					notInArray(schema.exportJob.status, [
						"completed",
						"completed_with_errors",
						"failed",
					]),
				)
			: eq(schema.exportJob.id, jobId);
	await db
		.update(schema.exportJob)
		.set({
			status,
			chunksDone: done,
			chunksFailed: failed,
			completedAt,
			expiresAt: completedAt
				? new Date(completedAt.getTime() + RETENTION_MS)
				: null,
		})
		.where(statusWhere);
}

export async function processExportMessage(
	env: CloudflareBindings,
	message: ExportQueueMessage,
	attempts: number,
): Promise<"success" | "retry" | "failed"> {
	const db = drizzle(env.DB, { schema });
	const chunk = await db
		.select()
		.from(schema.exportChunk)
		.where(eq(schema.exportChunk.id, message.chunkId))
		.get();
	if (!chunk || chunk.jobId !== message.jobId || chunk.status === "completed")
		return "success";
	const job = await db
		.select()
		.from(schema.exportJob)
		.where(eq(schema.exportJob.id, chunk.jobId))
		.get();
	if (
		!job ||
		job.status === "completed" ||
		job.status === "completed_with_errors" ||
		job.status === "failed"
	)
		return "success";

	const claimed = await db
		.update(schema.exportChunk)
		.set({ status: "processing", attempts, error: null, claimedAt: new Date() })
		.where(
			and(
				eq(schema.exportChunk.id, chunk.id),
				eq(schema.exportChunk.status, "queued"),
				lt(schema.exportChunk.attempts, attempts),
			),
		)
		.returning({ id: schema.exportChunk.id })
		.get();
	if (!claimed) return "success";
	await db
		.update(schema.exportJob)
		.set({ status: "processing" })
		.where(
			and(
				eq(schema.exportJob.id, job.id),
				notInArray(schema.exportJob.status, [
					"completed",
					"completed_with_errors",
					"failed",
				]),
			),
		);

	try {
		const source = job.source as ExportSource;
		const format = job.format as ExportFormat;
		const table = await rowsForSource(
			source,
			env,
			parseFilters(job.filters),
			chunk.startOffset,
			chunk.rowLimit,
		);
		const rendered = await renderExportChunk(format, table.table);
		const r2Key = `exports/${job.id}/part-${String(chunk.chunkIndex + 1).padStart(3, "0")}.${format}`;
		await exportBucket(env).put(r2Key, rendered.bytes, {
			httpMetadata: { contentType: rendered.contentType },
			customMetadata: { jobId: job.id, chunkIndex: String(chunk.chunkIndex) },
		});
		await db
			.update(schema.exportChunk)
			.set({
				status: "completed",
				r2Key,
				rowCount: table.table.rows.length,
				completedAt: new Date(),
				claimedAt: null,
				error: null,
			})
			.where(eq(schema.exportChunk.id, chunk.id));
		await refreshJobStatus(env, job.id);
		return "success";
	} catch (error) {
		const failure = safeError(error);
		if (attempts < MAX_QUEUE_ATTEMPTS) {
			await db
				.update(schema.exportChunk)
				.set({ status: "queued", attempts, error: failure, claimedAt: null })
				.where(eq(schema.exportChunk.id, chunk.id));
			return "retry";
		}
		await db
			.update(schema.exportChunk)
			.set({
				status: "failed",
				attempts,
				error: failure,
				completedAt: new Date(),
				claimedAt: null,
			})
			.where(eq(schema.exportChunk.id, chunk.id));
		await refreshJobStatus(env, job.id);
		return "failed";
	}
}

export async function getOwnedExportJob(
	env: CloudflareBindings,
	jobId: string,
	adminId: string,
) {
	const db = drizzle(env.DB, { schema });
	const job = await db
		.select()
		.from(schema.exportJob)
		.where(
			and(
				eq(schema.exportJob.id, jobId),
				eq(schema.exportJob.requestedBy, adminId),
			),
		)
		.get();
	if (!job) return null;
	if (job.expiresAt && job.expiresAt.getTime() <= Date.now()) {
		await deleteExpiredExport(env, job.id);
		return null;
	}
	const chunks = await db
		.select({
			chunkIndex: schema.exportChunk.chunkIndex,
			status: schema.exportChunk.status,
			error: schema.exportChunk.error,
			r2Key: schema.exportChunk.r2Key,
		})
		.from(schema.exportChunk)
		.where(eq(schema.exportChunk.jobId, job.id))
		.orderBy(asc(schema.exportChunk.chunkIndex));
	return { job, chunks };
}

export async function retryExportJob(
	env: CloudflareBindings,
	jobId: string,
	adminId: string,
) {
	const owned = await getOwnedExportJob(env, jobId, adminId);
	if (!owned) return null;
	if (
		owned.job.status !== "completed_with_errors" &&
		owned.job.status !== "failed"
	) {
		throw new Error("Only failed exports can be retried");
	}
	return createExportJob(env, {
		source: owned.job.source as ExportSource,
		format: owned.job.format as ExportFormat,
		filters: parseFilters(owned.job.filters),
		requestedBy: adminId,
	});
}

export async function deleteExpiredExport(
	env: CloudflareBindings,
	jobId: string,
): Promise<void> {
	const db = drizzle(env.DB, { schema });
	const bucket = exportBucket(env);
	let cursor: string | undefined;
	do {
		const listed = await bucket.list({ prefix: `exports/${jobId}/`, cursor });
		if (listed.objects.length)
			await bucket.delete(listed.objects.map((object) => object.key));
		cursor = listed.truncated ? listed.cursor : undefined;
	} while (cursor);
	await db.delete(schema.exportJob).where(eq(schema.exportJob.id, jobId));
}

export async function deleteExpiredExports(
	env: CloudflareBindings,
): Promise<number> {
	const db = drizzle(env.DB, { schema });
	const expired = await db
		.select({ id: schema.exportJob.id })
		.from(schema.exportJob)
		.where(
			and(
				isNotNull(schema.exportJob.expiresAt),
				lt(schema.exportJob.expiresAt, new Date()),
			),
		);
	for (const job of expired) await deleteExpiredExport(env, job.id);
	return expired.length;
}

export async function requeueStaleChunks(
	env: CloudflareBindings,
): Promise<number> {
	const db = drizzle(env.DB, { schema });
	const stale = await db
		.select({ id: schema.exportChunk.id, jobId: schema.exportChunk.jobId })
		.from(schema.exportChunk)
		.where(
			and(
				eq(schema.exportChunk.status, "processing"),
				lt(schema.exportChunk.claimedAt, new Date(Date.now() - STALE_CHUNK_MS)),
			),
		);
	for (const chunk of stale) {
		await db
			.update(schema.exportChunk)
			.set({
				status: "queued",
				attempts: 0,
				error: "Previous Worker invocation expired",
				claimedAt: null,
			})
			.where(eq(schema.exportChunk.id, chunk.id));
		await env.EXPORT_QUEUE.send({ jobId: chunk.jobId, chunkId: chunk.id });
	}
	return stale.length;
}
