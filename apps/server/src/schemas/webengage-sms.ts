import { z } from "@hono/zod-openapi";

/** WebEngage SSP SMS request (v1 / v2). Extra metadata fields are allowed. */
export const WebEngageSmsRequestSchema = z
	.object({
		version: z.string().openapi({ example: "1.0" }),
		smsData: z
			.object({
				toNumber: z.string().min(1).openapi({ example: "2348012345678" }),
				fromNumber: z.string().optional().openapi({ example: "SPORTSDEY" }),
				body: z.string().openapi({ example: "Your Sportsdey promo code is READY" }),
			})
			.openapi("WebEngageSmsData"),
		metadata: z
			.object({
				campaignType: z.string().optional(),
				timestamp: z.string().optional(),
				messageId: z.string().optional(),
				custom: z.record(z.string(), z.unknown()).optional(),
				indiaDLT: z
					.object({
						contentTemplateId: z.string().optional(),
						principalEntityId: z.string().optional(),
						telemarketerId: z.string().optional(),
					})
					.optional(),
			})
			.passthrough()
			.optional(),
	})
	.openapi("WebEngageSmsRequest");

export type WebEngageSmsRequest = z.infer<typeof WebEngageSmsRequestSchema>;

export const WebEngageSmsAcceptedSchema = z
	.object({
		status: z.literal("sms_accepted"),
	})
	.openapi("WebEngageSmsAccepted");

export const WebEngageSmsRejectedSchema = z
	.object({
		status: z.literal("sms_rejected"),
		statusCode: z.number(),
		message: z.string(),
		supportedVersion: z.string().optional(),
	})
	.openapi("WebEngageSmsRejected");
