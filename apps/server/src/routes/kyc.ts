import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { alias } from "drizzle-orm/sqlite-core";
import { getSessionToken, validateAdminSession } from "@/auth/admin";
import * as schema from "@/db/schema";
import { filePurpose } from "@/db/schema";
import { setWebengageUserAttributes } from "@/lib/webengage";
import { requirePermission } from "@/middleware/admin-permissions";
import { toWAT } from "@/utils";
import {
	adminActivityActions,
	recordActivityForSession,
} from "@/utils/admin-activity-log";
import type { CloudflareBindings } from "../types";

type R2Bucket = CloudflareBindings["PRODUCTION_BUCKET"];

const kycRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

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
			.enum(IDENTIFICATION_TYPES)
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

const KycAdminListItemSchema = z
	.object({
		id: z.string().openapi({ description: "KYC ID" }),
		playername: z.string().openapi({ description: "Player name" }),
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

	const url = `${baseUrl}/${r2Key}`;

	return { id, url, r2Key };
}

async function deleteFileFromR2(
	bucket: R2Bucket,
	r2Key: string,
): Promise<void> {
	await bucket.delete(r2Key);
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
						frontDocument: z.instanceof(File).openapi({
							type: "string",
							format: "binary",
							description: "Front document file",
						}),
						backDocument: z.instanceof(File).openapi({
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
	},
});

kycRoute.openapi(submitKycRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const formData = await c.req.parseBody();
	const fullName = formData.fullName as string;
	const identificationType = formData.identificationType as string;
	const frontDocument = formData.frontDocument as File | undefined;
	const backDocument = formData.backDocument as File | undefined;

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

	if (!frontDocument || !(frontDocument instanceof File)) {
		return c.json({ success: false, error: "Front document is required" }, 400);
	}

	if (!backDocument || !(backDocument instanceof File)) {
		return c.json({ success: false, error: "Back document is required" }, 400);
	}

	if (frontDocument.size > MAX_FILE_SIZE || backDocument.size > MAX_FILE_SIZE) {
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

	const bucket =
		c.env.NODE_ENV === "production"
			? c.env.PRODUCTION_BUCKET
			: c.env.STAGING_BUCKET;

	const baseUrl =
		c.env.NODE_ENV === "production"
			? "https://bucket.sportsdey.com"
			: "https://pub-2ef563970bc84434915fff03aa5f0dbf.r2.dev";

	if (!bucket) {
		return c.json({ success: false, error: "Storage not configured" }, 500);
	}

	const db = drizzle(c.env.DB, { schema });

	const existingKyc = await db
		.select()
		.from(schema.kyc)
		.where(eq(schema.kyc.userId, user.id))
		.limit(1);

	if (existingKyc.length > 0) {
		const kycRecord = existingKyc[0]!;
		const status = kycRecord.status;
		if (status === "pending_review" || status === "approved") {
			return c.json({ success: false, error: "KYC already submitted" }, 409);
		}
	}

	const submittedAt = new Date();
	const kycId = `kyc_${crypto.randomUUID()}`;

	const frontUpload = await uploadFileToR2(
		bucket,
		user.id,
		frontDocument,
		filePurpose.ID_CARD_FRONT,
		baseUrl,
	);

	if (!frontUpload) {
		return c.json(
			{ success: false, error: "Failed to upload front document" },
			500,
		);
	}

	let frontFileId: string | null = null;
	let frontR2Key: string | null = null;

	const frontFiles = await db
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

	if (!frontFiles[0]) {
		throw new Error("Failed to save front document");
	}

	frontFileId = frontFiles[0].id;
	frontR2Key = frontFiles[0].r2Key;

	const backUpload = await uploadFileToR2(
		bucket,
		user.id,
		backDocument,
		filePurpose.ID_CARD_BACK,
		baseUrl,
	);

	if (!backUpload) {
		await deleteFileFromR2(bucket, frontR2Key!);
		await db
			.delete(schema.userFile)
			.where(eq(schema.userFile.id, frontFileId!));
		return c.json(
			{ success: false, error: "Failed to upload back document" },
			500,
		);
	}

	let backFileId: string | null = null;
	let backR2Key: string | null = null;

	const backFiles = await db
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

	if (!backFiles[0]) {
		throw new Error("Failed to save back document");
	}

	backFileId = backFiles[0].id;
	backR2Key = backFiles[0].r2Key;

	const [kycRecord] = await db
		.insert(schema.kyc)
		.values({
			id: kycId,
			userId: user.id,
			fullName,
			identificationType,
			frontDocumentId: frontFileId,
			backDocumentId: backFileId,
			status: "pending_review",
			submittedAt,
		})
		.returning();

	if (!kycRecord?.id) {
		throw new Error("Failed to create KYC record");
	}

	await db
		.update(schema.user)
		.set({ verificationStatus: "pending_review" })
		.where(eq(schema.user.id, user.id));

	return c.json(
		{
			success: true,
			data: {
				id: kycId,
				status: "pending_review" as const,
				fullName,
				identificationType:
					identificationType as (typeof IDENTIFICATION_TYPES)[number],
				submittedAt: toWAT(submittedAt),
				rejectionReason: null,
				documents: {
					front: { id: frontFileId!, url: frontUpload.url },
					back: { id: backFileId!, url: backUpload.url },
				},
			},
		},
		201,
	);
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
	},
});

kycRoute.openapi(getKycRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json({ success: false, error: "Unauthorized" }, 401);
	}

	const db = drizzle(c.env.DB, { schema });

	const [kycRecord] = await db
		.select()
		.from(schema.kyc)
		.where(eq(schema.kyc.userId, user.id))
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
				identificationType:
					kycRecord.identificationType as (typeof IDENTIFICATION_TYPES)[number],
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

	return c.json(
		{
			success: true,
			data: {
				frontDocument,
				backDocument,
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
		.set({ status: "approved", updatedAt: new Date() })
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

	setWebengageUserAttributes(
		c.env,
		{
			userId: kycRecord.userId,
			kyc_status: true,
		},
		c.executionCtx,
	);

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
		.set({ status: "rejected", rejectionReason: reason, updatedAt: new Date() })
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

	setWebengageUserAttributes(
		c.env,
		{
			userId: kycRecord.userId,
			kyc_status: false,
		},
		c.executionCtx,
	);

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
