import { z } from "@hono/zod-openapi";

export const TicketStatusNotificationSchema = z
	.object({
		type: z.literal("ticket_status").openapi({
			description: "Notification type indicator",
			example: "ticket_status",
		}),
		data: z
			.object({
				ticket_id: z.string().openapi({
					description: "The unique ticket identifier",
					example: "66a62424b1770731244c1f3f",
				}),
				ticket_code: z.string().openapi({
					description: "The unique ticket code",
					example: "AB1234",
				}),
				msisdn: z.string().openapi({
					description: "The reciepient phone number",
					example: "213456451",
				}),
				status: z.string().openapi({
					description: 'Ticket status (e.g., "open" for reserved tickets)',
					example: "open",
				}),
				result: z.string().openapi({
					description: "Ticket result status",
					example: "pending",
				}),
			})
			.openapi({
				description: "Notification data containing ticket information",
			}),
	})
	.openapi("TicketStatusNotification");

export const NotificationAcknowledgementSchema = z
	.object({
		message: z.string().openapi({
			description: "Acknowledgement message",
			example: "Notification received",
		}),
	})
	.openapi("NotificationAcknowledgement");

export const CreateUserNotificationSchema = z
	.object({
		title: z.string().min(1).openapi({
			description: "Notification title",
			example: "Account Update",
		}),
		message: z.string().min(1).openapi({
			description: "Notification message",
			example: "Your account has been verified successfully",
		}),
		userId: z.string().min(1).openapi({
			description: "User ID of the recipient",
			example: "user_123",
		}),
	})
	.openapi("CreateUserNotification");

export const UserNotificationResponseSchema = z
	.object({
		id: z.string().openapi({ description: "Notification ID" }),
		userId: z.string().openapi({ description: "User ID" }),
		title: z.string().openapi({ description: "Notification title" }),
		message: z.string().openapi({ description: "Notification message" }),
		createdAt: z.number().openapi({ description: "Creation timestamp" }),
	})
	.openapi("UserNotificationResponse");

export const UserNotificationListResponseSchema = z
	.object({
		success: z.literal(true).openapi({ description: "Success status" }),
		data: z
			.object({
				notifications: z
					.array(UserNotificationResponseSchema)
					.openapi({ description: "Notifications" }),
				total: z
					.number()
					.openapi({ description: "Total number of notifications" }),
				page: z.number().openapi({ description: "Current page" }),
				limit: z.number().openapi({ description: "Items per page" }),
				totalPages: z
					.number()
					.openapi({ description: "Total number of pages" }),
			})
			.openapi({ description: "Response data" }),
	})
	.openapi("UserNotificationListResponse");

export const UserNotificationSingleResponseSchema = z
	.object({
		success: z.literal(true).openapi({ description: "Success status" }),
		data: UserNotificationResponseSchema.openapi({
			description: "Notification",
		}),
	})
	.openapi("UserNotificationSingleResponse");
