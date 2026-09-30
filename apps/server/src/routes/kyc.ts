import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { alias } from "drizzle-orm/sqlite-core";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import * as schema from "@/db/schema";
import { filePurpose } from "@/db/schema";
import { requirePermission } from "@/middleware/admin-permissions";
import { toWAT } from "@/utils";
import {
	adminActivityActions,
	recordActivityForSession,
} from "@/utils/admin-activity-log";
import { isD1CapacityError } from "@/utils/d1-errors";
import { syncWebengageUserProfile } from "@/utils/webengage-user-profile";
import type { CloudflareBindings } from "../types";

type R2Bucket = CloudflareBindings["PRODUCTION_BUCKET"];

function validationErrorMessage(error: unknown): string {
	if (!error || typeof error !== "object" || !("issues" in error)) {
		return "Invalid request";
	}
	const issues = (error as z.ZodError).issues ?? [];
	const first = issues[0];
	if (!first) {
		return "Invalid request";
	}
	const path = first.path.map(String).join(".");
	if (path.includes("frontDocument")) {
		return "Front of ID is required";
	}
	if (path.includes("backDocument")) {
		return "Back of ID is required";
	}
	if (path.includes("fullName")) {
		return "Full name must be between 2 and 100 characters";
	}
	if (path.includes("identificationType")) {
		return "Please select a valid form of identification";
	}
	if (first.message.toLowerCase().includes("instance of file")) {
		return "Please upload a valid ID document (JPG, PNG, or PDF)";
	}
	return first.message || "Invalid request";
}

function isUploadedFile(value: unknown): value is File {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as File).arrayBuffer === "function" &&
		typeof (value as File).size === "number" &&
		typeof (value as File).name === "string"
	);
}

function clientKycFailure(error: unknown): {
	status: 400 | 409 | 500 | 503;
	error: string;
} {
	if (isD1CapacityError(error)) {
		return {
			status: 503,
			error: "Service temporarily unavailable. Please try again shortly.",
		};
	}
	const text = (
		error instanceof Error
			? `${error.message} ${error.cause ?? ""}`
			: String(error)
	).toLowerCase();
	if (text.includes("unique constraint")) {
		return { status: 409, error: "KYC already submitted" };
	}
	if (text.includes("foreign key")) {
		return {
			status: 400,
			error: "Could not save your documents. Please sign in again and retry.",
		};
	}
	return {
		status: 500,
		error: "We could not submit your KYC right now. Please try again.",
	};
}

const kycRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>({
	defaultHook: (result, c) => {
		if (result.success) return;
		return c.json(
			{ success: false, error: validationErrorMessage(result.error) },
			400,
		);
	},
});

const IDENTIFICATION_TYPES = [
	"nin",
	"drivers_license",
	"passport",
	"voters_card",
] as const;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const KycDocumentSchema = z
	.object({
		id: z.string().openapi({ description: "Document ID" }),
		url: z.string().openapi({ description: "Document URL" }),
	})
	.openapi("KycDocument");

const KycResponseSchema = z
	.object({
		id: z.string().openapi({ description: "KYC ID" }),
		status: z
			.enum(["not_verified", "pending_review", "approved", "rejected"])
			.openapi({ description: "KYC status" }),
		fullName: z.string().openapi({ description: "Full name" }),
		identificationType: z
			.string()
			.openapi({ description: "Identification type" }),
		submittedAt: z.string().openapi({ description: "Submitted at" }),
		rejectionReason: z
			.string()
			.nullable()
			.openapi({ description: "Rejection reason" }),
		documents: z
			.object({
				front: KycDocumentSchema.nullable().openapi({
					description: "Front document",
				}),
				back: KycDocumentSchema.nullable().openapi({
					description: "Back document",
				}),
			})
			.openapi({ description: "Documents" }),
	})
	.openapi("KycResponse");

const KycSubmitResponseSchema = z
	.object({
		success: z.literal(true).openapi({ description: "Success status" }),
		data: KycResponseSchema.openapi({ description: "KYC data" }),
	})
	.openapi("KycSubmitResponse");

const KycGetResponseSchema = z
	.object({
		success: z.literal(true).openapi({ description: "Success status" }),
		data: KycResponseSchema.nullable().openapi({ description: "KYC data" }),
	})
	.openapi("KycGetResponse");

const KycErrorSchema = z
	.object({
		success: z.literal(false).openapi({ description: "Success status" }),
		error: z.string().openapi({ description: "Error message" }),
	})
	.openapi("KycError");

const IdentificationTypeEnum = z
	.enum(IDENTIFICATION_TYPES)
	.openapi("IdentificationTypeEnum");

const KycAdminStatusEnum = z
	.enum(["not_verified", "pending_review", "approved", "rejected"])
	.openapi("KycAdminStatusEnum");

const KycReviewerSchema = z
	.object({
		id: z.string().openapi({ description: "Reviewer admin ID" }),
		name: z.string().openapi({ description: "Reviewer admin name" }),
		avatar: z
			.string()
			.nullable()
			.openapi({ description: "Reviewer avatar URL" }),
	})
	.nullable()
	.openapi("KycReviewer");

const KycAdminListItemSchema = z
	.object({
		id: z.string().openapi({ description: "KYC ID" }),
		playername: z.string().openapi({ description: "Player name" }),
		image: z.string().nullable().openapi({ description: "Player avatar URL" }),
		form_of_identification: IdentificationTypeEnum.openapi({
			description: "Identification type",
		}),
		size: z
			.object({
				front: z.number().openapi({ description: "Front size" }),
				back: z.number().openapi({ description: "Back size" }),
			})
			.openapi({ description: "Size" }),
		uploaded_at: z.string().openapi({ description: "Uploaded at" }),
		type: z
			.object({
				front: z.string().openapi({ description: "Front type" }),
				back: z.string().openapi({ description: "Back type" }),
			})
			.openapi({ description: "Type" }),
		status: KycAdminStatusEnum.openapi({ description: "Status" }),
	})
	.openapi("KycAdminListItem");

const KycAdminListResponseSchema = z
	.object({
		success: z.literal(true).openapi({ description: "Success status" }),
		data: z
			.object({
				records: z
					.array(KycAdminListItemSchema)
					.openapi({ description: "KYC records" }),
				page: z.number().openapi({ description: "Page" }),
				limit: z.number().openapi({ description: "Limit" }),
				total: z.number().openapi({ description: "Total" }),
			})
			.openapi({ description: "Response data" }),
	})
	.openapi("KycAdminListResponse");

const KycDocumentResponseSchema = z
	.object({
		success: z.literal(true).openapi({ description: "Success status" }),
		data: z
			.object({
				frontDocument: KycDocumentSchema.nullable().openapi({
					description: "Front document",
				}),
				backDocument: KycDocumentSchema.nullable().openapi({
					description: "Back document",
				}),
				status: KycAdminStatusEnum.openapi({ description: "KYC status" }),
				reviewedBy: KycReviewerSchema.openapi({
					description: "Reviewing admin",
				}),
				reviewedAt: z
					.string()
					.nullable()
					.openapi({ description: "Reviewed at" }),
			})
			.openapi({ description: "Documents" }),
	})
	.openapi("KycDocumentResponse");

async function uploadFileToR2(
	bucket: R2Bucket,
	userId: string,
	file: File,
	purpose: string,
	baseUrl: string,
): Promise<{ id: string; url: string; r2Key: string } | null> {
	try {
		const ext = file.name.split(".").pop() || "";
		const id = `file_${crypto.randomUUID()}`;
		const r2Key = `${userId}/${id}.${ext}`;

		const arrayBuffer = await file.arrayBuffer();
		const r2Object = await bucket.put(r2Key, arrayBuffer, {
			httpMetadata: {
				contentType: file.type || "application/octet-stream",
			},
			customMetadata: {
				originalName: file.name,
				userId,
				purpose,
			},
		});

		if (!r2Object) {
			return null;
		}

		return { id, url: `${baseUrl}/${r2Key}`, r2Key };
	} catch (error) {
		console.error("KYC R2 upload failed", error);
		return null;
	}
}

async function deleteFileFromR2(
	bucket: R2Bucket,
	r2Key: string,
): Promise<void> {
	try {
		await bucket.delete(r2Key);
	} catch (error) {
		console.error("KYC R2 delete failed", error);
	}
}

const submitKycRoute = createRoute({
	method: "post",
	path: "/",
	tags: ["KYC"],
	summary: "Submit KYC",
	description: "Submit KYC application with documents",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"multipart/form-data": {
					schema: z.object({
						fullName: z.string().min(2).max(100),
						identificationType: IdentificationTypeEnum,
						frontDocument: z
							.custom<File>(isUploadedFile, {
								message: "Front of ID is required",
							})
							.openapi({
								type: "string",
								format: "binary",
								description: "Front document file",
							}),
						backDocument: z
							.custom<File>(isUploadedFile, {
								message: "Back of ID is required",
							})
							.openapi({
								type: "string",
								format: "binary",
								description: "Back document file",
							}),
					}),
				},
			},
		},
	},
	responses: {
		201: {
			description: "KYC submitted successfully",
			content: {
				"application/json": {
					schema: KycSubmitResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid request",
			content: {
				"application/json": {
					schema: KycErrorSchema,
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: KycErrorSchema,
				},
			},
		},
		409: {
			description: "KYC already submitted",
			content: {
				"application/json": {
					schema: KycErrorSchema,
				},
			},
		},
		500: {
			description: "Server error",
			content: {
				"application/json": {
					schema: KycErrorSchema,
				},
			},
		},
		503: {
			description: "Storage or database temporarily unavailable",
			content: {
				"application/json": {
					schema: KycErrorSchema,
				},
			},
		},
	},
});

kycRoute.openapi(submitKycRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	let frontUpload: { id: string; url: string; r2Key: string } | null = null;
	let backUpload: { id: string; url: string; r2Key: string } | null = null;
	let frontFileId: string | null = null;
	let backFileId: string | null = null;
	const bucket =
		c.env.NODE_ENV === "production"
			? c.env.PRODUCTION_BUCKET
			: c.env.STAGING_BUCKET;

	try {
		let formData: Record<string, string | File>;
		try {
			formData = await c.req.parseBody();
		} catch (error) {
			console.error("KYC form parse failed", error);
			return c.json(
				{
					success: false,
					error: "Could not read your documents. Please try uploading again.",
				},
				400,
			);
		}

		const fullName = formData.fullName as string;
		const identificationType = formData.identificationType as string;
		const frontDocument = formData.frontDocument;
		const backDocument = formData.backDocument;

		if (!fullName || fullName.length < 2 || fullName.length > 100) {
			return c.json(
				{
					success: false,
					error: "Full name must be between 2 and 100 characters",
				},
				400,
			);
		}

		if (
			!IDENTIFICATION_TYPES.includes(
				identificationType as (typeof IDENTIFICATION_TYPES)[number],
			)
		) {
			return c.json(
				{ success: false, error: "Invalid identification type" },
				400,
			);
		}

		if (!isUploadedFile(frontDocument)) {
			return c.json(
				{ success: false, error: "Front of ID is required" },
				400,
			);
		}

		if (!isUploadedFile(backDocument)) {
			return c.json({ success: false, error: "Back of ID is required" }, 400);
		}

		if (
			frontDocument.size > MAX_FILE_SIZE ||
			backDocument.size > MAX_FILE_SIZE
		) {
			return c.json(
				{ success: false, error: "File size must be less than 5MB" },
				400,
			);
		}

		if (
			!ALLOWED_MIME_TYPES.includes(frontDocument.type) ||
			!ALLOWED_MIME_TYPES.includes(backDocument.type)
		) {
			return c.json(
				{ success: false, error: "File must be JPG, PNG, or PDF" },
				400,
			);
		}

		const baseUrl =
			c.env.NODE_ENV === "production"
				? "https://bucket.sportsdey.com"
				: "https://pub-2ef563970bc84434915fff03aa5f0dbf.r2.dev";

		if (!bucket) {
			return c.json(
				{
					success: false,
					error: "Document storage is not available. Please try again later.",
				},
				503,
			);
		}

		const db = drizzle(c.env.DB, { schema });

		const existingKyc = await db
			.select()
			.from(schema.kyc)
			.where(eq(schema.kyc.userId, user.id))
			.orderBy(desc(schema.kyc.updatedAt), desc(schema.kyc.submittedAt))
			.limit(1);

		const existingRecord = existingKyc[0];
		if (
			existingRecord &&
			(existingRecord.status === "pending_review" ||
				existingRecord.status === "approved")
		) {
			return c.json({ success: false, error: "KYC already submitted" }, 409);
		}

		const submittedAt = new Date();
		const kycId = existingRecord?.id ?? `kyc_${crypto.randomUUID()}`;

		frontUpload = await uploadFileToR2(
			bucket,
			user.id,
			frontDocument,
			filePurpose.ID_CARD_FRONT,
			baseUrl,
		);

		if (!frontUpload) {
			return c.json(
				{
					success: false,
					error: "Could not upload the front of your ID. Please try again.",
				},
				503,
			);
		}

		const [frontFile] = await db
			.insert(schema.userFile)
			.values({
				id: frontUpload.id,
				userId: user.id,
				fileName: `front_document_${kycId}`,
				originalName: frontDocument.name,
				purpose: filePurpose.ID_CARD_FRONT,
				r2Key: frontUpload.r2Key,
				url: frontUpload.url,
				mimeType: frontDocument.type,
				size: frontDocument.size,
			})
			.returning();

		if (!frontFile) {
			await deleteFileFromR2(bucket, frontUpload.r2Key);
			return c.json(
				{
					success: false,
					error: "Could not save the front of your ID. Please try again.",
				},
				500,
			);
		}

		frontFileId = frontFile.id;

		backUpload = await uploadFileToR2(
			bucket,
			user.id,
			backDocument,
			filePurpose.ID_CARD_BACK,
			baseUrl,
		);

		if (!backUpload) {
			await deleteFileFromR2(bucket, frontUpload.r2Key);
			await db
				.delete(schema.userFile)
				.where(eq(schema.userFile.id, frontFileId));
			return c.json(
				{
					success: false,
					error: "Could not upload the back of your ID. Please try again.",
				},
				503,
			);
		}

		const [backFile] = await db
			.insert(schema.userFile)
			.values({
				id: backUpload.id,
				userId: user.id,
				fileName: `back_document_${kycId}`,
				originalName: backDocument.name,
				purpose: filePurpose.ID_CARD_BACK,
				r2Key: backUpload.r2Key,
				url: backUpload.url,
				mimeType: backDocument.type,
				size: backDocument.size,
			})
			.returning();

		if (!backFile) {
			await deleteFileFromR2(bucket, frontUpload.r2Key);
			await deleteFileFromR2(bucket, backUpload.r2Key);
			await db
				.delete(schema.userFile)
				.where(eq(schema.userFile.id, frontFileId));
			return c.json(
				{
					success: false,
					error: "Could not save the back of your ID. Please try again.",
				},
				500,
			);
		}

		backFileId = backFile.id;

		const kycValues = {
			fullName,
			identificationType,
			frontDocumentId: frontFileId,
			backDocumentId: backFileId,
			status: "pending_review" as const,
			rejectionReason: null,
			reviewedByAdminId: null,
			reviewedAt: null,
			submittedAt,
			updatedAt: submittedAt,
		};

		const [kycRecord] = existingRecord
			? await db
					.update(schema.kyc)
					.set(kycValues)
					.where(eq(schema.kyc.id, existingRecord.id))
					.returning()
			: await db
					.insert(schema.kyc)
					.values({
						id: kycId,
						userId: user.id,
						...kycValues,
					})
					.returning();

		if (!kycRecord?.id) {
			await deleteFileFromR2(bucket, frontUpload.r2Key);
			await deleteFileFromR2(bucket, backUpload.r2Key);
			await db
				.delete(schema.userFile)
				.where(eq(schema.userFile.id, frontFileId));
			await db
				.delete(schema.userFile)
				.where(eq(schema.userFile.id, backFileId));
			return c.json(
				{
					success: false,
					error: "Could not create your KYC application. Please try again.",
				},
				500,
			);
		}

		await db
			.update(schema.user)
			.set({ verificationStatus: "pending_review" })
			.where(eq(schema.user.id, user.id));

		return c.json(
			{
				success: true,
				data: {
					id: kycRecord.id,
					status: "pending_review" as const,
					fullName,
					identificationType,
					submittedAt: toWAT(submittedAt),
					rejectionReason: null,
					documents: {
						front: { id: frontFileId, url: frontUpload.url },
						back: { id: backFileId, url: backUpload.url },
					},
				},
			},
			201,
		);
	} catch (error) {
		console.error("KYC submit failed", error);
		if (bucket && frontUpload?.r2Key) {
			await deleteFileFromR2(bucket, frontUpload.r2Key);
		}
		if (bucket && backUpload?.r2Key) {
			await deleteFileFromR2(bucket, backUpload.r2Key);
		}
		const mapped = clientKycFailure(error);
		return c.json({ success: false, error: mapped.error }, mapped.status);
	}
});

const getKycRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["KYC"],
	summary: "Get KYC status",
	description: "Get current KYC status and details",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "KYC status retrieved",
			content: {
				"application/json": {
					schema: KycGetResponseSchema,
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: KycErrorSchema,
				},
			},
		},
		500: {
			description: "Server error",
			content: {
				"application/json": {
					schema: KycErrorSchema,
				},
			},
		},
		503: {
			description: "Database temporarily unavailable",
			content: {
				"application/json": {
					schema: KycErrorSchema,
				},
			},
		},
	},
});

kycRoute.openapi(getKycRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	try {
		const db = drizzle(c.env.DB, { schema });

		const [kycRecord] = await db
			.select()
			.from(schema.kyc)
			.where(eq(schema.kyc.userId, user.id))
			.orderBy(desc(schema.kyc.updatedAt), desc(schema.kyc.submittedAt))
			.limit(1);

		if (!kycRecord) {
			return c.json({ success: true, data: null }, 200);
		}

		let frontDocument: { id: string; url: string } | null = null;
		let backDocument: { id: string; url: string } | null = null;

		if (kycRecord.frontDocumentId) {
			const [front] = await db
				.select({ id: schema.userFile.id, url: schema.userFile.url })
				.from(schema.userFile)
				.where(eq(schema.userFile.id, kycRecord.frontDocumentId))
				.limit(1);

			if (front) {
				frontDocument = { id: front.id, url: front.url };
			}
		}

		if (kycRecord.backDocumentId) {
			const [back] = await db
				.select({ id: schema.userFile.id, url: schema.userFile.url })
				.from(schema.userFile)
				.where(eq(schema.userFile.id, kycRecord.backDocumentId))
				.limit(1);

			if (back) {
				backDocument = { id: back.id, url: back.url };
			}
		}

		return c.json(
			{
				success: true,
				data: {
					id: kycRecord.id,
					status: kycRecord.status as
						| "not_verified"
						| "pending_review"
						| "approved"
						| "rejected",
					fullName: kycRecord.fullName,
					identificationType: kycRecord.identificationType,
					submittedAt: toWAT(kycRecord.submittedAt),
					rejectionReason: kycRecord.rejectionReason,
					documents: {
						front: frontDocument,
						back: backDocument,
					},
				},
			},
			200,
		);
	} catch (error) {
		console.error("KYC status lookup failed", error);
		if (isD1CapacityError(error)) {
			return c.json(
				{
					success: false,
					error: "Service temporarily unavailable. Please try again shortly.",
				},
				503,
			);
		}
		return c.json(
			{
				success: false,
				error: "We could not load your KYC status. Please try again.",
			},
			500,
		);
	}
});

const getAllKycRoute = createRoute({
	method: "get",
	path: "/all",
	tags: ["KYC"],
	summary: "Get all KYC (Admin)",
	description:
		"Get all KYC applications with pagination, search, and status filter",
	security: [{ BearerAuth: [] }],
	responses: {
		200: {
			description: "KYC list retrieved",
			content: {
				"application/json": {
					schema: KycAdminListResponseSchema,
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: KycErrorSchema,
				},
			},
		},
		403: {
			description: "Forbidden",
			content: {
				"application/json": {
					schema: KycErrorSchema,
				},
			},
		},
	},
});

kycRoute.openapi(getAllKycRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false as const, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session) {
		return c.json(
			{ success: false as const, error: "Forbidden - admin only" },
			403,
		);
	}

	if (session.role !== "super_admin" && session.role !== "admin") {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - super admin or admin only",
			},
			403,
		);
	}

	if (
		session.role !== "super_admin" &&
		!requirePermission(session, "view_kyc_document")
	) {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - view_kyc_document permission required",
			},
			403,
		);
	}

	const page = Math.max(1, Number.parseInt(c.req.query("page") || "1", 10));
	const limit = Math.min(
		100,
		Math.max(1, Number.parseInt(c.req.query("limit") || "10", 10)),
	);
	const search = c.req.query("search")?.trim() || undefined;
	const statusFilter = c.req.query("status") as
		| "not_verified"
		| "pending_review"
		| "approved"
		| "rejected"
		| undefined;

	const db = drizzle(c.env.DB, { schema });
	const frontFile = alias(schema.userFile, "front_file");
	const backFile = alias(schema.userFile, "back_file");

	const conditions = [];
	if (statusFilter) {
		conditions.push(eq(schema.kyc.status, statusFilter));
	}
	if (search) {
		const searchPattern = `%${search}%`;
		conditions.push(
			or(
				like(schema.user.name, searchPattern),
				like(schema.user.email, searchPattern),
				like(schema.kyc.fullName, searchPattern),
				like(schema.kyc.identificationType, searchPattern),
			),
		);
	}

	const baseQuery = db
		.select({
			id: schema.kyc.id,
			playername: schema.user.name,
			image: schema.user.image,
			form_of_identification: schema.kyc.identificationType,
			submittedAt: schema.kyc.submittedAt,
			status: schema.kyc.status,
			frontSize: frontFile.size,
			frontMimeType: frontFile.mimeType,
			backSize: backFile.size,
			backMimeType: backFile.mimeType,
		})
		.from(schema.kyc)
		.innerJoin(schema.user, eq(schema.kyc.userId, schema.user.id))
		.leftJoin(frontFile, eq(schema.kyc.frontDocumentId, frontFile.id))
		.leftJoin(backFile, eq(schema.kyc.backDocumentId, backFile.id));

	let query;
	if (conditions.length > 0) {
		query = baseQuery.where(and(...conditions));
	} else {
		query = baseQuery;
	}

	const offset = (page - 1) * limit;

	let total = 0;
	const countQuery = db
		.select({ count: sql<number>`count(*)` })
		.from(schema.kyc)
		.innerJoin(schema.user, eq(schema.kyc.userId, schema.user.id));

	const countResult =
		conditions.length > 0
			? await countQuery.where(and(...conditions))
			: await countQuery;

	total = countResult[0]?.count ?? 0;

	const rawData = await query
		.orderBy(sql`${schema.kyc.submittedAt} desc`)
		.limit(limit)
		.offset(offset);

	const data = rawData.map((kyc) => ({
		id: kyc.id,
		playername: kyc.playername ?? "",
		image: kyc.image ?? null,
		form_of_identification: kyc.form_of_identification as
			| "nin"
			| "drivers_license"
			| "passport"
			| "voters_card",
		size: {
			front: kyc.frontSize ?? 0,
			back: kyc.backSize ?? 0,
		},
		uploaded_at: toWAT(kyc.submittedAt),
		type: {
			front: kyc.frontMimeType ?? "",
			back: kyc.backMimeType ?? "",
		},
		status: kyc.status as
			| "not_verified"
			| "pending_review"
			| "approved"
			| "rejected",
	}));

	return c.json(
		{
			success: true,
			data: {
				records: data,
				page,
				limit,
				total,
			},
		},
		200,
	);
});

const getKycByUserIdRoute = createRoute({
	method: "get",
	path: "/{kycId}",
	tags: ["KYC"],
	summary: "Get KYC documents by KYC ID (Admin)",
	description:
		"Get front and back KYC document links for a specific KYC record. Only accessible to admin and super admin.",
	security: [{ BearerAuth: [] }],
	request: {
		params: z.object({
			kycId: z.string().openapi({
				description: "The KYC ID to fetch documents for",
			}),
		}),
	},
	responses: {
		200: {
			description: "KYC documents retrieved",
			content: {
				"application/json": {
					schema: KycDocumentResponseSchema,
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: KycErrorSchema,
				},
			},
		},
		403: {
			description: "Forbidden",
			content: {
				"application/json": {
					schema: KycErrorSchema,
				},
			},
		},
		404: {
			description: "KYC not found",
			content: {
				"application/json": {
					schema: KycErrorSchema,
				},
			},
		},
	},
});

kycRoute.openapi(getKycByUserIdRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false as const, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session) {
		return c.json(
			{ success: false as const, error: "Forbidden - admin only" },
			403,
		);
	}

	if (session.role !== "super_admin" && session.role !== "admin") {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - super admin or admin only",
			},
			403,
		);
	}

	if (
		session.role !== "super_admin" &&
		!requirePermission(session, "view_kyc_document")
	) {
		return c.json(
			{
				success: false as const,
				error: "Forbidden - view_kyc_document permission required",
			},
			403,
		);
	}

	const { kycId } = c.req.valid("param");

	const db = drizzle(c.env.DB, { schema });

	const [kycRecord] = await db
		.select()
		.from(schema.kyc)
		.where(eq(schema.kyc.id, kycId))
		.limit(1);

	if (!kycRecord) {
		return c.json({ success: false as const, error: "KYC not found" }, 404);
	}

	let frontDocument: { id: string; url: string } | null = null;
	let backDocument: { id: string; url: string } | null = null;

	if (kycRecord.frontDocumentId) {
		const [front] = await db
			.select({ id: schema.userFile.id, url: schema.userFile.url })
			.from(schema.userFile)
			.where(eq(schema.userFile.id, kycRecord.frontDocumentId))
			.limit(1);

		if (front) {
			frontDocument = { id: front.id, url: front.url };
		}
	}

	if (kycRecord.backDocumentId) {
		const [back] = await db
			.select({ id: schema.userFile.id, url: schema.userFile.url })
			.from(schema.userFile)
			.where(eq(schema.userFile.id, kycRecord.backDocumentId))
			.limit(1);

		if (back) {
			backDocument = { id: back.id, url: back.url };
		}
	}

	let reviewedBy: { id: string; name: string; avatar: string | null } | null =
		null;
	if (kycRecord.reviewedByAdminId) {
		const [reviewer] = await db
			.select({
				id: schema.admin.id,
				name: schema.admin.name,
				avatar: schema.admin.image,
			})
			.from(schema.admin)
			.where(eq(schema.admin.id, kycRecord.reviewedByAdminId))
			.limit(1);

		if (reviewer) {
			reviewedBy = {
				id: reviewer.id,
				name: reviewer.name,
				avatar: reviewer.avatar ?? null,
			};
		}
	}

	return c.json(
		{
			success: true,
			data: {
				frontDocument,
				backDocument,
				status: kycRecord.status as
					| "not_verified"
					| "pending_review"
					| "approved"
					| "rejected",
				reviewedBy,
				reviewedAt: kycRecord.reviewedAt ? toWAT(kycRecord.reviewedAt) : null,
			},
		},
		200,
	);
});

const approveKycRoute = createRoute({
	method: "post",
	path: "/{kycId}/approve",
	tags: ["KYC"],
	summary: "Approve KYC (Admin)",
	description:
		"Approve a KYC application. Super admin or admin with kyc_approve permission required.",
	security: [{ BearerAuth: [] }],
	request: {
		params: z.object({
			kycId: z.string().openapi({ description: "The KYC ID to approve" }),
		}),
	},
	responses: {
		200: {
			description: "KYC approved successfully",
			content: {
				"application/json": {
					schema: z.object({
						success: z.literal(true),
						data: z.object({ message: z.string() }),
					}),
				},
			},
		},
		400: {
			description: "Bad request",
			content: { "application/json": { schema: KycErrorSchema } },
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: KycErrorSchema } },
		},
		403: {
			description: "Forbidden",
			content: { "application/json": { schema: KycErrorSchema } },
		},
		404: {
			description: "KYC not found",
			content: { "application/json": { schema: KycErrorSchema } },
		},
	},
});

kycRoute.openapi(approveKycRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session) {
		return c.json({ success: false, error: "Forbidden - admin only" }, 403);
	}

	if (session.role !== "super_admin" && session.role !== "admin") {
		return c.json(
			{ success: false, error: "Forbidden - super admin or admin only" },
			403,
		);
	}

	const { kycId } = c.req.valid("param");
	const db = drizzle(c.env.DB, { schema });

	const [kycRecord] = await db
		.select()
		.from(schema.kyc)
		.where(eq(schema.kyc.id, kycId))
		.limit(1);

	if (!kycRecord) {
		return c.json({ success: false, error: "KYC not found" }, 404);
	}

	await db
		.update(schema.kyc)
		.set({
			status: "approved",
			reviewedByAdminId: session.adminId,
			reviewedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(schema.kyc.id, kycId));

	await db
		.update(schema.user)
		.set({ verificationStatus: "approved" })
		.where(eq(schema.user.id, kycRecord.userId));
	await recordActivityForSession(
		c.env,
		session.adminId,
		adminActivityActions.approveDocument,
	);

	await syncWebengageUserProfile(c.env, kycRecord.userId, c.executionCtx);

	return c.json(
		{ success: true, data: { message: "KYC approved successfully" } },
		200,
	);
});

const rejectKycRoute = createRoute({
	method: "post",
	path: "/{kycId}/reject",
	tags: ["KYC"],
	summary: "Reject KYC (Admin)",
	description:
		"Reject a KYC application with a reason. Super admin or admin with kyc_approve permission required.",
	security: [{ BearerAuth: [] }],
	request: {
		params: z.object({
			kycId: z.string().openapi({ description: "The KYC ID to reject" }),
		}),
		body: {
			content: {
				"application/json": {
					schema: z.object({
						reason: z
							.string()
							.min(1)
							.openapi({ description: "Reason for rejection" }),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: "KYC rejected successfully",
			content: {
				"application/json": {
					schema: z.object({
						success: z.literal(true),
						data: z.object({ message: z.string() }),
					}),
				},
			},
		},
		400: {
			description: "Bad request",
			content: { "application/json": { schema: KycErrorSchema } },
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: KycErrorSchema } },
		},
		403: {
			description: "Forbidden",
			content: { "application/json": { schema: KycErrorSchema } },
		},
		404: {
			description: "KYC not found",
			content: { "application/json": { schema: KycErrorSchema } },
		},
	},
});

kycRoute.openapi(rejectKycRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session) {
		return c.json({ success: false, error: "Forbidden - admin only" }, 403);
	}

	if (session.role !== "super_admin" && session.role !== "admin") {
		return c.json(
			{ success: false, error: "Forbidden - super admin or admin only" },
			403,
		);
	}

	const { kycId } = c.req.valid("param");
	const { reason } = c.req.valid("json");
	const db = drizzle(c.env.DB, { schema });

	const [kycRecord] = await db
		.select()
		.from(schema.kyc)
		.where(eq(schema.kyc.id, kycId))
		.limit(1);

	if (!kycRecord) {
		return c.json({ success: false, error: "KYC not found" }, 404);
	}

	await db
		.update(schema.kyc)
		.set({
			status: "rejected",
			rejectionReason: reason,
			reviewedByAdminId: session.adminId,
			reviewedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(schema.kyc.id, kycId));

	await db
		.update(schema.user)
		.set({ verificationStatus: "rejected" })
		.where(eq(schema.user.id, kycRecord.userId));
	await recordActivityForSession(
		c.env,
		session.adminId,
		adminActivityActions.rejectDocument,
	);

	await syncWebengageUserProfile(c.env, kycRecord.userId, c.executionCtx);

	return c.json({ success: true, data: { message: "KYC rejected" } }, 200);
});

const reviewKycRoute = createRoute({
	method: "post",
	path: "/{kycId}/review",
	tags: ["KYC"],
	summary: "Mark KYC as in review (Admin)",
	description:
		"Mark a KYC application as in review/pending_review. Super admin or admin with kyc_approve permission required.",
	security: [{ BearerAuth: [] }],
	request: {
		params: z.object({
			kycId: z
				.string()
				.openapi({ description: "The KYC ID to mark as in review" }),
		}),
	},
	responses: {
		200: {
			description: "KYC marked as in review",
			content: {
				"application/json": {
					schema: z.object({
						success: z.literal(true),
						data: z.object({ message: z.string() }),
					}),
				},
			},
		},
		400: {
			description: "Bad request",
			content: { "application/json": { schema: KycErrorSchema } },
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: KycErrorSchema } },
		},
		403: {
			description: "Forbidden",
			content: { "application/json": { schema: KycErrorSchema } },
		},
		404: {
			description: "KYC not found",
			content: { "application/json": { schema: KycErrorSchema } },
		},
	},
});

kycRoute.openapi(reviewKycRoute, async (c) => {
	const token = getSessionToken(c.req.raw.headers);
	if (!token) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const session = await validateAdminSession(c.env, token);
	if (!session) {
		return c.json({ success: false, error: "Forbidden - admin only" }, 403);
	}

	if (session.role !== "super_admin" && session.role !== "admin") {
		return c.json(
			{ success: false, error: "Forbidden - super admin or admin only" },
			403,
		);
	}

	const { kycId } = c.req.valid("param");
	const db = drizzle(c.env.DB, { schema });

	const [kycRecord] = await db
		.select()
		.from(schema.kyc)
		.where(eq(schema.kyc.id, kycId))
		.limit(1);

	if (!kycRecord) {
		return c.json({ success: false, error: "KYC not found" }, 404);
	}

	await db
		.update(schema.kyc)
		.set({ status: "pending_review", updatedAt: new Date() })
		.where(eq(schema.kyc.id, kycId));

	await db
		.update(schema.user)
		.set({ verificationStatus: "pending_review" })
		.where(eq(schema.user.id, kycRecord.userId));
	await recordActivityForSession(
		c.env,
		session.adminId,
		"Marked document for review",
	);

	return c.json(
		{ success: true, data: { message: "KYC marked as in review" } },
		200,
	);
});

export default kycRoute;
