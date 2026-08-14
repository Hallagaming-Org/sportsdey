import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
	CreateExportSchema,
	ErrorResponseSchema,
	JobParamsSchema,
	JobResponseSchema,
	successResponseSchema,
} from "@/schemas";
import type { CloudflareBindings } from "@/types";
import {
	createAdminExport,
	downloadAdminExportZip,
	getAdminExport,
	retryAdminExport,
} from "@/utils/exports/admin-export-handlers";

const route = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const createRouteDefinition = createRoute({
	method: "post",
	path: "/exports",
	tags: ["Admin - Exports"],
	summary: "Create an asynchronous admin export",
	security: [{ BearerAuth: [] }],
	request: {
		body: { content: { "application/json": { schema: CreateExportSchema } } },
	},
	responses: {
		202: {
			description: "Export queued",
			content: {
				"application/json": {
					schema: successResponseSchema(
						z.object({
							jobId: z.string(),
							rowCount: z.number(),
							chunkCount: z.number(),
						}),
					),
				},
			},
		},
		400: {
			description: "Invalid export request",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		403: {
			description: "Forbidden",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

const getRouteDefinition = createRoute({
	method: "get",
	path: "/exports/{id}",
	tags: ["Admin - Exports"],
	summary: "Get export status",
	security: [{ BearerAuth: [] }],
	request: { params: JobParamsSchema },
	responses: {
		200: {
			description: "Export status",
			content: {
				"application/json": {
					schema: successResponseSchema(JobResponseSchema),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		404: {
			description: "Export not found",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

const zipRouteDefinition = createRoute({
	method: "get",
	path: "/exports/{id}/zip",
	tags: ["Admin - Exports"],
	summary: "Download export ZIP",
	security: [{ BearerAuth: [] }],
	request: { params: JobParamsSchema },
	responses: {
		200: { description: "Export ZIP" },
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		404: {
			description: "Export not found",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		409: {
			description: "Export has no completed chunks",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		500: {
			description: "Export file missing",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

const retryRouteDefinition = createRoute({
	method: "post",
	path: "/exports/{id}/retry",
	tags: ["Admin - Exports"],
	summary: "Retry an export with a fresh snapshot",
	security: [{ BearerAuth: [] }],
	request: { params: JobParamsSchema },
	responses: {
		202: {
			description: "Retry queued",
			content: {
				"application/json": {
					schema: successResponseSchema(
						z.object({
							jobId: z.string(),
							rowCount: z.number(),
							chunkCount: z.number(),
						}),
					),
				},
			},
		},
		400: {
			description: "Export cannot be retried",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		401: {
			description: "Unauthorized",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
		404: {
			description: "Export not found",
			content: { "application/json": { schema: ErrorResponseSchema } },
		},
	},
});

route.openapi(createRouteDefinition, createAdminExport as never);
route.openapi(getRouteDefinition, getAdminExport as never);
route.openapi(zipRouteDefinition, downloadAdminExportZip as never);
route.openapi(retryRouteDefinition, retryAdminExport as never);

export default route;
