import { z } from "@hono/zod-openapi";

export const MonnifyCategorySchema = z.object({
	categoryCode: z.string().openapi({ description: "Category code" }),
	categoryName: z.string().openapi({ description: "Category name" }),
	categoryDescription: z
		.string()
		.openapi({ description: "Category description" }),
});

export const MonnifyBillerSchema = z.object({
	billerCode: z.string().openapi({ description: "Biller code" }),
	billerName: z.string().openapi({ description: "Biller name" }),
	categoryCode: z.string().openapi({ description: "Category code" }),
	categoryName: z.string().openapi({ description: "Category name" }),
	billerType: z.string().openapi({ description: "Biller type" }),
	website: z.string().openapi({ description: "Website" }),
	contactPhone: z.string().openapi({ description: "Contact phone" }),
	contactEmail: z.string().openapi({ description: "Contact email" }),
	country: z.string().openapi({ description: "Country" }),
	isActive: z.number().openapi({ description: "Is active" }),
});

export const MonnifyProductSchema = z.object({
	code: z.string().openapi({ description: "Product code" }),
	name: z.string().openapi({ description: "Product name" }),
	category: z.object({ 
		code: z.string().openapi({ description: "Category code" }), 
		name: z.string().openapi({ description: "Category name" }) 
	}).openapi({ description: "Category" }),
	billers: z
		.array(z.object({ code: z.string().openapi({ description: "Biller code" }), name: z.string().openapi({ description: "Biller name" }) }))
		.openapi({ description: "Billers" }),
	minAmount: z.number().nullable().openapi({ description: "Minimum amount" }),
	maxAmount: z.number().nullable().openapi({ description: "Maximum amount" }),
	price: z.number().nullable().openapi({ description: "Price" }),
	priceType: z.enum(["OPEN", "FIXED"]).openapi({ description: "Price type" }),
	metadata: z
		.object({
			volume: z.number().openapi({ description: "Volume" }),
			duration: z.number().openapi({ description: "Duration" }),
			productType: z.object({ code: z.string().openapi({ description: "Product type code" }), name: z.string().openapi({ description: "Product type name" }) }).openapi({ description: "Product type" }),
			durationUnit: z.string().nullable().openapi({ description: "Duration unit" }),
			productCategory: z.string().nullable().openapi({ description: "Product category" }),
		})
		.openapi({ description: "Metadata" }),
}).openapi("MonnifyProduct");

export const MonnifyProductsResponseSchema = z.object({
	content: z.array(MonnifyProductSchema).openapi({ description: "Products" }),
	totalElements: z.number().openapi({ description: "Total elements" }),
	size: z.number().openapi({ description: "Size" }),
	number: z.number().openapi({ description: "Page number" }),
	empty: z.boolean().openapi({ description: "Is empty" }),
	nextPage: z.number().nullable().openapi({ description: "Next page" }),
}).openapi("MonnifyProductsResponse");

export const MonnifyValidationSchema = z.object({
	customerName: z.string().openapi({ description: "Customer name" }),
	customerId: z.string().openapi({ description: "Customer ID" }),
	validationReference: z
		.string()
		.openapi({ description: "Validation reference" }),
	exists: z.boolean().openapi({ description: "Customer exists" }),
	commission: z.number().nullable().openapi({ description: "Commission" }),
	billerName: z.string().openapi({ description: "Biller name" }),
	billerCode: z.string().openapi({ description: "Biller code" }),
	productCode: z.string().openapi({ description: "Product code" }),
	productName: z.string().openapi({ description: "Product name" }),
	vendInstruction: z.object({
		requireValidationRef: z.boolean().openapi({
			description: "Whether validation reference is required",
		}),
		message: z.string().openapi({ description: "Message" }),
	}).openapi({ description: "Vend instruction" }),
}).openapi("MonnifyValidation");

export const MonnifyVendResponseSchema = z.object({
	transactionReference: z.string().openapi({
		description: "Monnify transaction reference",
	}),
	paymentReference: z.string().openapi({ description: "Payment reference" }),
	vendReference: z.string().openapi({ description: "Vendor reference" }),
	vendStatus: z
		.enum(["SUCCESS", "FAILED", "IN_PROGRESS"])
		.openapi({ description: "Vend status" }),
	merchantName: z.string().openapi({ description: "Merchant name" }),
	billerName: z.string().openapi({ description: "Biller name" }),
	productName: z.string().openapi({ description: "Product name" }),
	customerId: z.string().openapi({ description: "Customer ID" }),
	customerName: z.string().openapi({ description: "Customer name" }),
	amountPaid: z.number().openapi({ description: "Amount paid" }),
	vendAmount: z.number().openapi({ description: "Vend amount" }),
	totalAmount: z.number().openapi({ description: "Total amount" }),
	commission: z.number().openapi({ description: "Commission" }),
	additionalData: z.record(z.string(), z.unknown()).openapi({
		description: "Additional data" }),
}).openapi("MonnifyVendResponse");

export const MonnifyRequerySchema = z.object({
	transactionReference: z.string().openapi({
		description: "Monnify transaction reference",
	}),
	paymentReference: z.string().openapi({ description: "Payment reference" }),
	vendReference: z.string().openapi({ description: "Vendor reference" }),
	vendStatus: z
		.enum(["SUCCESS", "FAILED", "IN_PROGRESS"])
		.openapi({ description: "Vend status" }),
	merchantName: z.string().openapi({ description: "Merchant name" }),
	billerName: z.string().openapi({ description: "Biller name" }),
	productName: z.string().openapi({ description: "Product name" }),
	customerId: z.string().openapi({ description: "Customer ID" }),
	customerName: z.string().openapi({ description: "Customer name" }),
	amountPaid: z.number().openapi({ description: "Amount paid" }),
	vendAmount: z.number().openapi({ description: "Vend amount" }),
	totalAmount: z.number().openapi({ description: "Total amount" }),
	commission: z.number().openapi({ description: "Commission" }),
}).openapi("MonnifyRequery");

export type MonnifyCategory = z.infer<typeof MonnifyCategorySchema>;
export type MonnifyBiller = z.infer<typeof MonnifyBillerSchema>;
export type MonnifyProduct = z.infer<typeof MonnifyProductSchema>;
export type MonnifyProductsResponse = z.infer<
	typeof MonnifyProductsResponseSchema
>;
export type MonnifyValidation = z.infer<typeof MonnifyValidationSchema>;
export type MonnifyVendResponse = z.infer<typeof MonnifyVendResponseSchema>;
export type MonnifyRequery = z.infer<typeof MonnifyRequerySchema>;
