import { z } from "@hono/zod-openapi";

export const getBillersQuery = z
	.object({
		categoryCode: z.string().optional().openapi({
			description: "Category code to filter billers",
			example: "DATA",
		}),
	})
	.openapi({ description: "Get billers request" });

export const getProductsQuery = z
	.object({
		billerCode: z.string().openapi({
			description: "Biller code",
			example: "MTN_DATA",
		}),
		categoryCode: z.string().optional().openapi({
			description: "Category code to filter products",
			example: "DATA",
		}),
	})
	.openapi({ description: "Get products request" });

export const validateCustomerBody = z
	.object({
		productCode: z.string().openapi({
			description: "Product code",
			example: "MTN_DATA_500MB",
		}),
		customerId: z.string().openapi({
			description: "Customer ID (phone, meter, smartcard)",
			example: "08031234567",
		}),
	})
	.openapi({ description: "Validate customer request" });

export const vendBillBody = z
	.object({
		productCode: z.string().openapi({
			description: "Product code",
			example: "MTN_DATA_500MB",
		}),
		customerId: z.string().openapi({
			description: "Customer ID",
			example: "08031234567",
		}),
		amount: z.number().min(1).openapi({
			description: "Amount to vend",
			example: 500,
		}),
		customerName: z.string().optional().openapi({
			description: "Customer name",
		}),
	})
	.openapi({ description: "Vend bill request" });

export const requeryTransactionQuery = z
	.object({
		transactionReference: z.string().openapi({
			description: "Monnify transaction reference",
			example: "MFY123456789",
		}),
	})
	.openapi({ description: "Requery transaction request" });

export const historyQuery = z
	.object({
		limit: z
			.number()
			.min(1)
			.max(50)
			.default(20)
			.optional()
			.openapi({ description: "Limit", example: 20 }),
		serviceCategory: z
			.enum(["airtime", "data", "electricity", "cable_tv"])
			.optional()
			.openapi({ description: "Service category" }),
	})
	.openapi({ description: "Get history request" });
