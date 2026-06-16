import { z } from "@hono/zod-openapi";

export const FundWalletSchema = z
	.object({
		amount: z.number().int().min(100).max(9_999_999).openapi({
			description:
				"Amount to fund wallet in Naira (minimum 100, maximum 9,999,999.00) - must be a whole number",
			example: 1000,
		}),
	})
	.openapi("FundWallet");

export const WalletResponseSchema = z
	.object({
		id: z.string().openapi({ description: "Wallet ID" }),
		balance: z.number().openapi({
			description: "Wallet balance in Naira (stored as kobo internally)",
		}),
		createdAt: z.string().openapi({ description: "Creation timestamp" }),
		updatedAt: z.string().openapi({ description: "Last update timestamp" }),
	})
	.openapi("WalletResponse");

export const TransactionResponseSchema = z
	.object({
		id: z.string().openapi({ description: "Transaction ID" }),
		userId: z.string().openapi({ description: "User ID" }),
		amount: z.number().openapi({
			description: "Transaction amount in Naira (stored as kobo internally)",
		}),
		type: z
			.string()
			.openapi({ description: "Transaction type (credit/debit)" }),
		reference: z.string().openapi({ description: "Transaction reference" }),
		status: z.string().openapi({ description: "Transaction status" }),
		paymentMethod: z.string().openapi({ description: "Payment method used" }),
		recipientWalletId: z.string().optional().openapi({
			description: "Recipient wallet ID (for wallet_transfer only)",
		}),
		recipientName: z.string().optional().openapi({
			description: "Recipient name (for wallet_transfer only)",
		}),
		balance: z
			.number()
			.openapi({ description: "Wallet balance after transaction" }),
		metadata: z.record(z.string(), z.unknown()).optional().openapi({
			description:
				"Additional context about the transaction (source, destination, game, etc.)",
		}),
		createdAt: z.string().openapi({ description: "Creation timestamp" }),
	})
	.openapi("TransactionResponse");

export const FundWalletErrorSchema = z
	.object({
		success: z.literal(false).openapi({ description: "Success status" }),
		error: z.string().openapi({ description: "Error message" }),
		details: z.null().openapi({ description: "Error details" }),
	})
	.openapi("FundWalletError");

export const FundWalletResponseSchema = z
	.object({
		success: z.literal(true).openapi({ description: "Success status" }),
		data: z
			.object({
				authorizationUrl: z.string().openapi({
					description: "Paystack authorization URL for payment",
				}),
				reference: z.string().openapi({
					description: "Transaction reference",
				}),
				balance: z.number().openapi({
					description: "Expected wallet balance after successful payment",
				}),
			})
			.openapi({ description: "Response data" }),
	})
	.openapi("FundWalletResponse");

export const GetWalletErrorSchema = z
	.object({
		success: z.literal(false).openapi({ description: "Success status" }),
		error: z.string().openapi({ description: "Error message" }),
		details: z.null().openapi({ description: "Error details" }),
	})
	.openapi("GetWalletError");

export const GetWalletResponseSchema = z
	.object({
		success: z.literal(true).openapi({ description: "Success status" }),
		data: WalletResponseSchema.openapi({ description: "Wallet data" }),
	})
	.openapi("GetWalletResponse");

export const GetTransactionsErrorSchema = z
	.object({
		success: z.literal(false).openapi({ description: "Success status" }),
		error: z.string().openapi({ description: "Error message" }),
		details: z.null().openapi({ description: "Error details" }),
	})
	.openapi("GetTransactionsError");

export const GetTransactionsResponseSchema = z
	.object({
		success: z.literal(true).openapi({ description: "Success status" }),
		data: z
			.array(TransactionResponseSchema)
			.openapi({ description: "Transactions" }),
	})
	.openapi("GetTransactionsResponse");

export const BankResponseSchema = z
	.object({
		name: z.string().openapi({ description: "Bank name" }),
		code: z.string().openapi({ description: "Bank code" }),
	})
	.openapi("BankResponse");

export const GetBanksErrorSchema = z
	.object({
		success: z.literal(false).openapi({ description: "Success status" }),
		error: z.string().openapi({ description: "Error message" }),
		details: z.null().openapi({ description: "Error details" }),
	})
	.openapi("GetBanksError");

export const GetBanksResponseSchema = z
	.object({
		success: z.literal(true).openapi({ description: "Success status" }),
		data: z.array(BankResponseSchema).openapi({ description: "Banks" }),
	})
	.openapi("GetBanksResponse");

export const CallbackQuerySchema = z
	.object({
		reference: z
			.string()
			.optional()
			.openapi({ description: "Payment reference" }),
		trxref: z
			.string()
			.optional()
			.openapi({ description: "Transaction reference" }),
		status: z.string().optional().openapi({ description: "Payment status" }),
		type: z
			.enum(["deposit", "withdraw"])
			.optional()
			.openapi({ description: "Transaction type" }),
	})
	.openapi("CallbackQuery");

export const WebhookErrorSchema = z
	.object({
		success: z.literal(false).openapi({ description: "Success status" }),
		error: z.string().openapi({ description: "Error message" }),
		details: z.null().openapi({ description: "Error details" }),
	})
	.openapi("WebhookError");

export const WebhookResponseSchema = z
	.object({
		received: z.literal(true).openapi({ description: "Received status" }),
	})
	.openapi("WebhookResponse");

export const WithdrawSchema = z
	.object({
		amount: z.number().int().min(100).openapi({
			description:
				"Amount to withdraw in Naira (minimum 100) - must be a whole number",
			example: 1000,
		}),
		bankCode: z.string().openapi({
			description: "Bank code (e.g., 058 for GTBank)",
			example: "058",
		}),
		accountNumber: z.string().openapi({
			description: "Bank account number",
			example: "0123456789",
		}),
		accountName: z.string().openapi({
			description: "Account holder name",
			example: "John Doe",
		}),
	})
	.openapi("Withdraw");

export const WithdrawErrorSchema = z
	.object({
		success: z.literal(false).openapi({ description: "Success status" }),
		error: z.string().openapi({ description: "Error message" }),
		details: z.null().openapi({ description: "Error details" }),
	})
	.openapi("WithdrawError");

export const WithdrawResponseSchema = z
	.object({
		success: z.literal(true).openapi({ description: "Success status" }),
		data: z
			.object({
				reference: z.string().openapi({
					description: "Withdrawal reference",
				}),
				amount: z.number().openapi({
					description: "Withdrawal amount",
				}),
				status: z.string().openapi({
					description: "Withdrawal status",
				}),
				balance: z.number().openapi({
					description: "New wallet balance after withdrawal",
				}),
			})
			.openapi({ description: "Response data" }),
	})
	.openapi("WithdrawResponse");

export const WebhookEventSchema = z
	.object({
		event: z.string().openapi({ description: "Webhook event type" }),
		data: z
			.object({
				reference: z.string().openapi({ description: "Payment reference" }),
				amount: z.number().openapi({ description: "Amount" }),
				status: z.string().openapi({ description: "Payment status" }),
				customer: z
					.object({
						email: z.string().openapi({ description: "Customer email" }),
					})
					.openapi({ description: "Customer" }),
				metadata: z
					.record(z.string(), z.unknown())
					.optional()
					.openapi({ description: "Metadata" }),
			})
			.openapi({ description: "Event data" }),
	})
	.openapi("WebhookEvent");

export type FundWallet = z.infer<typeof FundWalletSchema>;
export type WalletResponse = z.infer<typeof WalletResponseSchema>;
export type TransactionResponse = z.infer<typeof TransactionResponseSchema>;
export type Withdraw = z.infer<typeof WithdrawSchema>;

export const CreateWithdrawalAccountSchema = z
	.object({
		bankCode: z.string().openapi({
			description: "Bank code (e.g., 058 for GTBank)",
			example: "058",
		}),
		bankName: z.string().optional().openapi({
			description: "Bank name (optional - validated via Paystack)",
			example: "Guaranty Trust Bank",
		}),
		accountNumber: z.string().openapi({
			description: "Bank account number",
			example: "0123456789",
		}),
		accountName: z.string().openapi({
			description: "Account holder name (must match Paystack verification)",
			example: "John Doe",
		}),
	})
	.openapi("CreateWithdrawalAccount");

export const WithdrawalAccountResponseSchema = z
	.object({
		id: z.string().openapi({ description: "Withdrawal account ID" }),
		bankCode: z.string().openapi({ description: "Bank code" }),
		bankName: z.string().openapi({ description: "Bank name" }),
		accountNumber: z.string().openapi({ description: "Account number" }),
		accountName: z.string().openapi({ description: "Account holder name" }),
		createdAt: z.string().openapi({ description: "Creation timestamp" }),
		updatedAt: z.string().openapi({ description: "Last update timestamp" }),
	})
	.openapi("WithdrawalAccountResponse");

export const CreateWithdrawalAccountErrorSchema = z
	.object({
		success: z.literal(false).openapi({ description: "Success status" }),
		error: z.string().openapi({ description: "Error message" }),
		details: z.null().openapi({ description: "Error details" }),
	})
	.openapi("CreateWithdrawalAccountError");

export const CreateWithdrawalAccountResponseSchema = z
	.object({
		success: z.literal(true).openapi({ description: "Success status" }),
		data: WithdrawalAccountResponseSchema.openapi({
			description: "Withdrawal account",
		}),
	})
	.openapi("CreateWithdrawalAccountResponse");

export const GetWithdrawalAccountsErrorSchema = z
	.object({
		success: z.literal(false).openapi({ description: "Success status" }),
		error: z.string().openapi({ description: "Error message" }),
		details: z.null().openapi({ description: "Error details" }),
	})
	.openapi("GetWithdrawalAccountsError");

export const GetWithdrawalAccountsResponseSchema = z
	.object({
		success: z.literal(true).openapi({ description: "Success status" }),
		data: z
			.array(WithdrawalAccountResponseSchema)
			.openapi({ description: "Withdrawal accounts" }),
	})
	.openapi("GetWithdrawalAccountsResponse");

export type CreateWithdrawalAccount = z.infer<
	typeof CreateWithdrawalAccountSchema
>;
export type WithdrawalAccountResponse = z.infer<
	typeof WithdrawalAccountResponseSchema
>;

export const TransferSchema = z
	.object({
		recipientWalletId: z.string().openapi({
			description: "Wallet ID of the recipient",
			example: "0197a1b2c3d4e5f6",
		}),
		amount: z.number().int().min(100).openapi({
			description: "Amount to transfer in Naira (minimum 100)",
			example: 500,
		}),
	})
	.openapi("Transfer");

export const TransferErrorSchema = z
	.object({
		success: z.literal(false).openapi({ description: "Success status" }),
		error: z.string().openapi({ description: "Error message" }),
		details: z.null().openapi({ description: "Error details" }),
	})
	.openapi("TransferError");

export const TransferResponseSchema = z
	.object({
		success: z.literal(true).openapi({ description: "Success status" }),
		data: z
			.object({
				transactionId: z.string().openapi({ description: "Transaction ID" }),
				amount: z.number().openapi({ description: "Amount transferred" }),
				recipientWalletId: z
					.string()
					.openapi({ description: "Recipient wallet ID" }),
				recipientName: z.string().openapi({ description: "Recipient name" }),
			})
			.openapi({ description: "Response data" }),
	})
	.openapi("TransferResponse");

export const GameWalletResponseSchema = z
	.object({
		id: z.string().openapi({ description: "Game wallet ID" }),
		balance: z
			.number()
			.openapi({ description: "Game wallet balance in Naira" }),
		createdAt: z.string().openapi({ description: "Creation timestamp" }),
		updatedAt: z.string().openapi({ description: "Last update timestamp" }),
	})
	.openapi("GameWalletResponse");

export const GetGameWalletErrorSchema = z
	.object({
		success: z.literal(false).openapi({ description: "Success status" }),
		error: z.string().openapi({ description: "Error message" }),
		details: z.null().openapi({ description: "Error details" }),
	})
	.openapi("GetGameWalletError");

export const GetGameWalletResponseSchema = z
	.object({
		success: z.literal(true).openapi({ description: "Success status" }),
		data: GameWalletResponseSchema.openapi({ description: "Game wallet data" }),
	})
	.openapi("GetGameWalletResponse");

export const TransferToGameWalletSchema = z
	.object({
		amount: z.number().int().min(100).openapi({
			description:
				"Amount to transfer in Naira (minimum 100) - must be a whole number",
			example: 500,
		}),
	})
	.openapi("TransferToGameWallet");

export const TransferToGameWalletErrorSchema = z
	.object({
		success: z.literal(false).openapi({ description: "Success status" }),
		error: z.string().openapi({ description: "Error message" }),
		details: z.null().openapi({ description: "Error details" }),
	})
	.openapi("TransferToGameWalletError");

export const TransferToGameWalletResponseSchema = z
	.object({
		success: z.literal(true).openapi({ description: "Success status" }),
		data: z
			.object({
				transactionId: z.string().openapi({ description: "Transaction ID" }),
				amount: z.number().openapi({ description: "Amount transferred" }),
				gameWalletId: z.string().openapi({ description: "Game wallet ID" }),
				normalWalletBalance: z.number().openapi({
					description: "Remaining normal wallet balance",
				}),
				gameWalletBalance: z.number().openapi({
					description: "New game wallet balance",
				}),
			})
			.openapi({ description: "Response data" }),
	})
	.openapi("TransferToGameWalletResponse");
