import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { debitWallet } from "@/db/atomic-wallet";
import {
	MonnifyBillerSchema,
	MonnifyCategorySchema,
	MonnifyProductSchema,
	MonnifyProductsResponseSchema,
	MonnifyRequerySchema,
	MonnifyVendResponseSchema,
} from "@/schemas";
import {
	getBillers,
	getCategories,
	getProducts,
	requeryTransaction,
	validateCustomer,
	vendBill,
} from "@/utils/monnify";
import {
	getBillersQuery,
	getProductsQuery,
	historyQuery,
	requeryTransactionQuery,
	vendBillBody,
} from "@/validators/monnify";
import type { CloudflareBindings } from "../types";

const monnifyRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const categoriesRoute = createRoute({
	method: "get",
	path: "/categories",
	tags: ["Bills"],
	summary: "Get bill categories",
	description: "Get all available bill categories",
	security: [],
	responses: {
		200: {
			description: "Categories retrieved successfully",
			content: {
				"application/json": {
					schema: z
						.object({
							success: z
								.literal(true)
								.openapi({ description: "Success status" }),
							data: z
								.array(MonnifyCategorySchema)
								.openapi({ description: "Categories" }),
						})
						.openapi("CategoriesResponse200"),
				},
			},
		},
		500: {
			description: "Server error",
			content: {
				"application/json": {
					schema: z
						.object({
							success: z
								.literal(false)
								.openapi({ description: "Success status" }),
							error: z.string().openapi({ description: "Error message" }),
							details: z.null().openapi({ description: "Error details" }),
						})
						.openapi("CategoriesResponse500"),
				},
			},
		},
	},
});

monnifyRoute.openapi(categoriesRoute, async (c) => {
	const env = {
		MONNIFY_API_KEY: c.env.MONNIFY_API_KEY,
		MONNIFY_CLIENT_SECRET: c.env.MONNIFY_CLIENT_SECRET,
		MONNIFY_CONTRACT_CODE: c.env.MONNIFY_CONTRACT_CODE,
	};

	if (!env.MONNIFY_API_KEY || !env.MONNIFY_CLIENT_SECRET) {
		return c.json(
			{
				success: false as const,
				error: "Configuration error",
				details: null,
			},
			500,
		);
	}

	const result = await getCategories(env);

	if (!result.ok || !result.data) {
		return c.json(
			{
				success: false as const,
				error: result.error || "Failed to fetch categories",
				details: null,
			},
			500,
		);
	}

	return c.json({ success: true as const, data: result.data }, 200);
});

const billersRoute = createRoute({
	method: "get",
	path: "/billers",
	tags: ["Bills"],
	summary: "Get billers",
	description: "Get billers by category",
	security: [],
	request: {
		query: getBillersQuery,
	},
	responses: {
		200: {
			description: "Billers retrieved successfully",
			content: {
				"application/json": {
					schema: z
						.object({
							success: z
								.literal(true)
								.openapi({ description: "Success status" }),
							data: z
								.array(MonnifyBillerSchema)
								.openapi({ description: "Billers" }),
						})
						.openapi("BillersResponse200"),
				},
			},
		},
		500: {
			description: "Server error",
			content: {
				"application/json": {
					schema: z
						.object({
							success: z
								.literal(false)
								.openapi({ description: "Success status" }),
							error: z.string().openapi({ description: "Error message" }),
							details: z.null().openapi({ description: "Error details" }),
						})
						.openapi("BillersResponse500"),
				},
			},
		},
	},
});

monnifyRoute.openapi(billersRoute, async (c) => {
	const { categoryCode } = c.req.valid("query");
	const env = {
		MONNIFY_API_KEY: c.env.MONNIFY_API_KEY,
		MONNIFY_CLIENT_SECRET: c.env.MONNIFY_CLIENT_SECRET,
		MONNIFY_CONTRACT_CODE: c.env.MONNIFY_CONTRACT_CODE,
	};

	if (!env.MONNIFY_API_KEY || !env.MONNIFY_CLIENT_SECRET) {
		return c.json(
			{
				success: false as const,
				error: "Configuration error",
				details: null,
			},
			500,
		);
	}

	const result = await getBillers(env, categoryCode);

	if (!result.ok || !result.data) {
		return c.json(
			{
				success: false as const,
				error: result.error || "Failed to fetch billers",
				details: null,
			},
			500,
		);
	}

	return c.json({ success: true as const, data: result.data }, 200);
});

const productsRoute = createRoute({
	method: "get",
	path: "/products",
	tags: ["Bills"],
	summary: "Get products",
	description: "Get products for a biller",
	security: [],
	request: {
		query: getProductsQuery,
	},
	responses: {
		200: {
			description: "Products retrieved successfully",
			content: {
				"application/json": {
					schema: z
						.object({
							success: z
								.literal(true)
								.openapi({ description: "Success status" }),
							data: MonnifyProductsResponseSchema.openapi({
								description: "Products",
							}),
						})
						.openapi("ProductsResponse200"),
				},
			},
		},
		500: {
			description: "Server error",
			content: {
				"application/json": {
					schema: z
						.object({
							success: z
								.literal(false)
								.openapi({ description: "Success status" }),
							error: z.string().openapi({ description: "Error message" }),
							details: z.null().openapi({ description: "Error details" }),
						})
						.openapi("ProductsResponse500"),
				},
			},
		},
	},
});

monnifyRoute.openapi(productsRoute, async (c) => {
	const { billerCode, categoryCode } = c.req.valid("query");
	const env = {
		MONNIFY_API_KEY: c.env.MONNIFY_API_KEY,
		MONNIFY_CLIENT_SECRET: c.env.MONNIFY_CLIENT_SECRET,
		MONNIFY_CONTRACT_CODE: c.env.MONNIFY_CONTRACT_CODE,
	};

	if (!env.MONNIFY_API_KEY || !env.MONNIFY_CLIENT_SECRET) {
		return c.json(
			{
				success: false as const,
				error: "Configuration error",
				details: null,
			},
			500,
		);
	}

	const result = await getProducts(env, billerCode, categoryCode);

	if (!result.ok || !result.data) {
		return c.json(
			{
				success: false as const,
				error: result.error || "Failed to fetch products",
				details: null,
			},
			500,
		);
	}

	return c.json({ success: true as const, data: result.data }, 200);
});

const vendRoute = createRoute({
	method: "post",
	path: "/vend",
	tags: ["Bills"],
	summary: "Vend a bill",
	description: "Validate customer and process bill payment",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: vendBillBody,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Vend initiated",
			content: {
				"application/json": {
					schema: z
						.object({
							success: z
								.literal(true)
								.openapi({ description: "Success status" }),
							data: MonnifyVendResponseSchema.openapi({
								description: "Vend response",
							}),
						})
						.openapi("VendResponse200"),
				},
			},
		},
		400: {
			description: "Vend failed",
			content: {
				"application/json": {
					schema: z
						.object({
							success: z
								.literal(false)
								.openapi({ description: "Success status" }),
							error: z.string().openapi({ description: "Error message" }),
							details: z.null().openapi({ description: "Error details" }),
						})
						.openapi("VendResponse400"),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: z
						.object({
							success: z
								.literal(false)
								.openapi({ description: "Success status" }),
							error: z.string().openapi({ description: "Error message" }),
							details: z.null().openapi({ description: "Error details" }),
						})
						.openapi("VendResponse401"),
				},
			},
		},
		500: {
			description: "Server error",
			content: {
				"application/json": {
					schema: z
						.object({
							success: z
								.literal(false)
								.openapi({ description: "Success status" }),
							error: z.string().openapi({ description: "Error message" }),
							details: z.null().openapi({ description: "Error details" }),
						})
						.openapi("VendResponse500"),
				},
			},
		},
	},
});

monnifyRoute.openapi(vendRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
				details: null,
			},
			401,
		);
	}
	const userId: string = user.id as string;
	const {
		productCode,
		customerId,
		amount,
		customerName,
	}: {
		productCode: string;
		customerId: string;
		amount: number;
		customerName?: string;
	} = c.req.valid("json");
	const env = {
		MONNIFY_API_KEY: c.env.MONNIFY_API_KEY,
		MONNIFY_CLIENT_SECRET: c.env.MONNIFY_CLIENT_SECRET,
		MONNIFY_CONTRACT_CODE: c.env.MONNIFY_CONTRACT_CODE,
	};

	console.log("productCode", productCode);

	if (!env.MONNIFY_API_KEY || !env.MONNIFY_CLIENT_SECRET) {
		return c.json(
			{
				success: false as const,
				error: "Configuration error",
				details: null,
			},
			500,
		);
	}

	const db = drizzle(c.env.DB, { schema });

	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, userId))
		.limit(1);

	if (!wallet) {
		return c.json(
			{
				success: false as const,
				error: "Wallet not found",
				details: null,
			},
			400,
		);
	}

	const amountInKobo = amount * 100;

	if (wallet.balance < amountInKobo) {
		return c.json(
			{
				success: false as const,
				error: "Insufficient balance",
				details: null,
			},
			400,
		);
	}

	const validationResult = await validateCustomer(env, productCode, customerId);
	if (!validationResult.ok || !validationResult.data) {
		return c.json(
			{
				success: false as const,
				error: validationResult.error || "Customer validation failed",
				details: null,
			},
			400,
		);
	}
	const validationReference = validationResult.data.validationReference;
	const validatedCustomerName =
		validationResult.data.customerName || customerName;
	const vendReference = `VND_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

	const transactionId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

	const upperProductCode = productCode.toUpperCase();
	const serviceCategory = upperProductCode.includes("AIRTIME")
		? "airtime"
		: upperProductCode.includes("DATA_BUNDLE")
			? "data"
			: upperProductCode.includes("ELECTRICITY")
				? "electricity"
				: upperProductCode.includes("CABLE_TV")
					? "cable_tv"
					: "data";

	const txValues: typeof schema.utilityTransaction.$inferInsert = {
		id: transactionId,
		userId,
		amount,
		serviceCategory,
		billerCode: productCode.split("_")[0]!,
		billerName: "",
		customerId,
		customerName: validatedCustomerName ?? null,
		productCode,
		productName: "",
		vendReference,
		validationReference: validationReference ?? null,
		status: "pending",
	};

	const [utilityTx] = await db
		.insert(schema.utilityTransaction)
		.values(txValues)
		.returning();

	if (!utilityTx?.id) {
		return c.json(
			{
				success: false as const,
				error: "Failed to record transaction",
				details: null,
			},
			500,
		);
	}

	const result = await vendBill(env, {
		productCode,
		customerId,
		vendAmount: amount,
		vendReference,
		validationReference,
		customerName: validatedCustomerName,
	});

	if (!result.ok || !result.data) {
		await db
			.update(schema.utilityTransaction)
			.set({ status: "failed" })
			.where(eq(schema.utilityTransaction.id, transactionId));

		return c.json(
			{
				success: false as const,
				error: result.error || "Vend failed",
				details: null,
			},
			400,
		);
	}

	const status =
		result.data.vendStatus === "SUCCESS"
			? "success"
			: result.data.vendStatus === "FAILED"
				? "failed"
				: "in_progress";

	await db
		.update(schema.utilityTransaction)
		.set({
			monnifyTransactionReference: result.data.transactionReference,
			billerName: result.data.billerName,
			productName: result.data.productName,
			customerName: result.data.customerName || validatedCustomerName || null,
			status,
		})
		.where(eq(schema.utilityTransaction.id, transactionId));

	if (status === "success") {
		const updatedWallet = await debitWallet(db, userId, amountInKobo);
		if (!updatedWallet) {
			await db
				.update(schema.utilityTransaction)
				.set({ status: "failed" })
				.where(eq(schema.utilityTransaction.id, transactionId));
			return c.json({ success: false, error: "Insufficient balance" }, 400);
		}
		const newBalance = updatedWallet.balance;

		await db.insert(schema.walletTransaction).values({
			id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
			userId,
			amount: amountInKobo,
			type: "debit",
			reference: vendReference,
			status: "completed",
			paymentMethod: "bill_payment",
			balance: newBalance,
			metadata: JSON.stringify({
				serviceCategory,
				billerName: result.data.billerName,
				productName: result.data.productName,
				customerId,
				vendReference,
				utilityTransactionId: transactionId,
			}),
		});

	}

	return c.json(
		{
			success: true as const,
			data: result.data,
		},
		200,
	);
});

const requeryRoute = createRoute({
	method: "get",
	path: "/requery",
	tags: ["Bills"],
	summary: "Requery transaction",
	description: "Check the status of a bill payment",
	security: [{ BearerAuth: [] }],
	request: {
		query: requeryTransactionQuery,
	},
	responses: {
		200: {
			description: "Transaction status retrieved",
			content: {
				"application/json": {
					schema: z
						.object({
							success: z
								.literal(true)
								.openapi({ description: "Success status" }),
							data: MonnifyRequerySchema.openapi({
								description: "Transaction data",
							}),
						})
						.openapi("RequeryResponse200"),
				},
			},
		},
		400: {
			description: "Requery failed",
			content: {
				"application/json": {
					schema: z
						.object({
							success: z
								.literal(false)
								.openapi({ description: "Success status" }),
							error: z.string().openapi({ description: "Error message" }),
							details: z.null().openapi({ description: "Error details" }),
						})
						.openapi("RequeryResponse400"),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: z
						.object({
							success: z
								.literal(false)
								.openapi({ description: "Success status" }),
							error: z.string().openapi({ description: "Error message" }),
							details: z.null().openapi({ description: "Error details" }),
						})
						.openapi("RequeryResponse401"),
				},
			},
		},
		404: {
			description: "Transaction not found",
			content: {
				"application/json": {
					schema: z
						.object({
							success: z
								.literal(false)
								.openapi({ description: "Success status" }),
							error: z.string().openapi({ description: "Error message" }),
							details: z.null().openapi({ description: "Error details" }),
						})
						.openapi("RequeryResponse404"),
				},
			},
		},
		500: {
			description: "Server error",
			content: {
				"application/json": {
					schema: z.object({
						success: z
							.literal(false)
							.openapi({ description: "Success status" }),
						error: z.string().openapi({ description: "Error message" }),
						details: z.null(),
					}),
				},
			},
		},
	},
});

monnifyRoute.openapi(requeryRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
				details: null,
			},
			401,
		);
	}

	const { transactionReference } = c.req.valid("query");
	const env = {
		MONNIFY_API_KEY: c.env.MONNIFY_API_KEY,
		MONNIFY_CLIENT_SECRET: c.env.MONNIFY_CLIENT_SECRET,
		MONNIFY_CONTRACT_CODE: c.env.MONNIFY_CONTRACT_CODE,
	};

	if (!env.MONNIFY_API_KEY || !env.MONNIFY_CLIENT_SECRET) {
		return c.json(
			{
				success: false as const,
				error: "Configuration error",
				details: null,
			},
			500,
		);
	}

	const db = drizzle(c.env.DB, { schema });

	const [existing] = await db
		.select()
		.from(schema.utilityTransaction)
		.where(
			eq(
				schema.utilityTransaction.monnifyTransactionReference,
				transactionReference,
			),
		)
		.limit(1);

	if (!existing || existing.userId !== user.id) {
		return c.json(
			{
				success: false as const,
				error: "Transaction not found",
				details: null,
			},
			404,
		);
	}

	const result = await requeryTransaction(env, transactionReference);

	if (!result.ok || !result.data) {
		return c.json(
			{
				success: false as const,
				error: result.error || "Requery failed",
				details: null,
			},
			400,
		);
	}

	const status =
		result.data.vendStatus === "SUCCESS"
			? "success"
			: result.data.vendStatus === "FAILED"
				? "failed"
				: "in_progress";

	await db
		.update(schema.utilityTransaction)
		.set({
			status,
			billerName: result.data.billerName,
			productName: result.data.productName,
		})
		.where(eq(schema.utilityTransaction.id, existing.id));

	return c.json({ success: true as const, data: result.data }, 200);
});

const historyRoute = createRoute({
	method: "get",
	path: "/history",
	tags: ["Bills"],
	summary: "Get transaction history",
	description: "Get user's utility transaction history",
	security: [{ BearerAuth: [] }],
	request: {
		query: historyQuery,
	},
	responses: {
		200: {
			description: "History retrieved",
			content: {
				"application/json": {
					schema: z
						.object({
							success: z
								.literal(true)
								.openapi({ description: "Success status" }),
							data: z
								.array(
									z
										.object({
											id: z.string().openapi({ description: "History ID" }),
											userId: z.string().openapi({ description: "User ID" }),
											amount: z.number().openapi({ description: "Amount" }),
											serviceCategory: z
												.string()
												.openapi({ description: "Service category" }),
											billerCode: z
												.string()
												.openapi({ description: "Biller code" }),
											billerName: z
												.string()
												.openapi({ description: "Biller name" }),
											customerId: z
												.string()
												.openapi({ description: "Customer ID" }),
											customerName: z
												.string()
												.nullable()
												.openapi({ description: "Customer name" }),
											productCode: z
												.string()
												.openapi({ description: "Product code" }),
											productName: z
												.string()
												.openapi({ description: "Product name" }),
											monnifyTransactionReference: z
												.string()
												.nullable()
												.openapi({ description: "Monnify reference" }),
											vendReference: z
												.string()
												.openapi({ description: "Vend reference" }),
											validationReference: z
												.string()
												.nullable()
												.openapi({ description: "Validation reference" }),
											status: z.string().openapi({ description: "Status" }),
											createdAt: z
												.string()
												.openapi({ description: "Created at" }),
										})
										.openapi("HistoryItem"),
								)
								.openapi({ description: "History array" }),
						})
						.openapi("HistoryResponse200"),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: z
						.object({
							success: z
								.literal(false)
								.openapi({ description: "Success status" }),
							error: z.string().openapi({ description: "Error message" }),
							details: z.null().openapi({ description: "Error details" }),
						})
						.openapi("HistoryResponse401"),
				},
			},
		},
	},
});

monnifyRoute.openapi(historyRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(
			{
				success: false as const,
				error: "Unauthorized",
				details: null,
			},
			401,
		);
	}

	const { limit, serviceCategory } = c.req.valid("query");
	const db = drizzle(c.env.DB, { schema });

	const conditions = [eq(schema.utilityTransaction.userId, user.id)];

	if (serviceCategory) {
		conditions.push(
			eq(schema.utilityTransaction.serviceCategory, serviceCategory),
		);
	}

	const transactions = await db
		.select()
		.from(schema.utilityTransaction)
		.where(and(...conditions))
		.orderBy(desc(schema.utilityTransaction.createdAt))
		.limit(limit || 20);

	return c.json({ success: true as const, data: transactions }, 200);
});

export default monnifyRoute;
