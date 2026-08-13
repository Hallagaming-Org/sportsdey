import { z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import { requirePermission } from "@/middleware/admin-permissions";
import { CreateExportSchema, JobResponseSchema } from "@/schemas/admin-exports";
import type { CloudflareBindings } from "@/types";
import {
	createExportJob,
	exportBucket,
	getOwnedExportJob,
	retryExportJob,
} from "./service";
import { exportFormats, exportSources } from "@/types/exports";
import { createZipStream } from "./writer";

type AdminExportContext = Context<{ Bindings: CloudflareBindings }>;
type AdminSession = Awaited<ReturnType<typeof validateAdminSession>>;

async function sessionFor(c: AdminExportContext): Promise<AdminSession> {
	const token = getSessionToken(c.req.raw.headers);
	return token ? validateAdminSession(c.env, token) : null;
}

function permissionForSource(source: (typeof exportSources)[number]) {
	switch (source) {
		case "users":
			return "user_management" as const;
		case "transactions":
			return "transaction_read" as const;
		case "ticket-history":
			return "view_ticket_history" as const;
		case "cms":
			return "post_upload_content" as const;
		case "admins":
			return "view_other_admins" as const;
	}
}

function canExport(
	session: NonNullable<AdminSession>,
	source: (typeof exportSources)[number],
) {
	return requirePermission(session, permissionForSource(source));
}

export async function createAdminExport(c: AdminExportContext) {
	const session = await sessionFor(c);
	if (!session)
		return c.json(
			{ success: false, error: "Unauthorized", details: null },
			401,
		);
	const body = CreateExportSchema.safeParse(await c.req.json());
	if (!body.success)
		return c.json(
			{ success: false, error: "Invalid export request", details: null },
			400,
		);
	if (!canExport(session, body.data.source))
		return c.json(
			{ success: false, error: "Export permission required", details: null },
			403,
		);
	try {
		const job = await createExportJob(c.env, {
			...body.data,
			requestedBy: session.adminId,
		});
		return c.json({ success: true, data: job }, 202);
	} catch (error) {
		console.error("Failed to create export job", error);
		return c.json(
			{ success: false, error: "Unable to create export job", details: null },
			500,
		);
	}
}

export async function getAdminExport(c: AdminExportContext) {
	const session = await sessionFor(c);
	if (!session)
		return c.json(
			{ success: false, error: "Unauthorized", details: null },
			401,
		);
	const owned = await getOwnedExportJob(
		c.env,
		c.req.param("id") as string,
		session.adminId,
	);
	if (!owned)
		return c.json(
			{ success: false, error: "Export not found", details: null },
			404,
		);
	const { job, chunks } = owned;
	return c.json({
		success: true,
		data: {
			jobId: job.id,
			source: job.source as (typeof exportSources)[number],
			format: job.format as (typeof exportFormats)[number],
			status: job.status as z.infer<typeof JobResponseSchema>["status"],
			rowCount: job.rowCount,
			chunkCount: job.chunkCount,
			chunksDone: job.chunksDone,
			chunksFailed: job.chunksFailed,
			failedChunks: chunks
				.filter((chunk) => chunk.status === "failed")
				.map((chunk) => ({ index: chunk.chunkIndex, error: chunk.error })),
			zipUrl: `/admin/exports/${job.id}/zip`,
			expiresAt: job.expiresAt?.toISOString() ?? null,
		},
	});
}

export async function downloadAdminExportZip(
	c: AdminExportContext,
): Promise<Response> {
	const session = await sessionFor(c);
	if (!session)
		return c.json(
			{ success: false, error: "Unauthorized", details: null },
			401,
		);
	const owned = await getOwnedExportJob(
		c.env,
		c.req.param("id") as string,
		session.adminId,
	);
	if (!owned)
		return c.json(
			{ success: false, error: "Export not found", details: null },
			404,
		);
	const completed = owned.chunks.filter(
		(chunk): chunk is typeof chunk & { r2Key: string } =>
			chunk.status === "completed" && typeof chunk.r2Key === "string",
	);
	if (completed.length === 0)
		return c.json(
			{ success: false, error: "Export has no completed files", details: null },
			409,
		);
	const bucket = exportBucket(c.env);
	const files: Array<{ name: string; body: ReadableStream }> = [];
	if (owned.job.status === "completed_with_errors") {
		const failed = owned.chunks
			.filter((chunk) => chunk.status === "failed")
			.map(
				(chunk) => `part-${chunk.chunkIndex + 1}: ${chunk.error ?? "failed"}`,
			)
			.join("\n");
		files.push({
			name: "INCOMPLETE_EXPORT.txt",
			body: new Blob([
				"This export completed with errors. The following chunks are missing:\n\n",
				failed,
			]).stream(),
		});
	}
	for (const chunk of completed) {
		const object = await bucket.get(chunk.r2Key);
		if (!object?.body)
			return c.json(
				{ success: false, error: "An export file is missing", details: null },
				500,
			);
		files.push({
			name: chunk.r2Key.split("/").pop() ?? `part-${chunk.chunkIndex + 1}`,
			body: object.body as unknown as ReadableStream,
		});
	}
	return new Response(createZipStream(files), {
		status: 200,
		headers: {
			"Content-Type": "application/zip",
			"Content-Disposition": `attachment; filename="sportsdey-${owned.job.source}-${owned.job.id}.zip"`,
			"Cache-Control": "private, no-store",
		},
	});
}

export async function retryAdminExport(c: AdminExportContext) {
	const session = await sessionFor(c);
	if (!session)
		return c.json(
			{ success: false, error: "Unauthorized", details: null },
			401,
		);
	const owned = await getOwnedExportJob(
		c.env,
		c.req.param("id") as string,
		session.adminId,
	);
	if (!owned)
		return c.json(
			{ success: false, error: "Export not found", details: null },
			404,
		);
	if (!canExport(session, owned.job.source as (typeof exportSources)[number]))
		return c.json(
			{ success: false, error: "Export permission required", details: null },
			403,
		);
	try {
		const job = await retryExportJob(c.env, owned.job.id, session.adminId);
		if (!job)
			return c.json(
				{ success: false, error: "Export not found", details: null },
				404,
			);
		return c.json({ success: true, data: job }, 202);
	} catch (error) {
		return c.json(
			{
				success: false,
				error:
					error instanceof Error ? error.message : "Export cannot be retried",
				details: null,
			},
			400,
		);
	}
}
