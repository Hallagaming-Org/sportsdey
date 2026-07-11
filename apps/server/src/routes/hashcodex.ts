import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import type { CloudflareBindings } from "../types";

const hashcodexRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const DepositSchema = z
	.object({
		action: z
			.enum(["credit", "debit"])
			.openapi({ description: "credit to add funds, debit to remove funds" }),
		amount: z.number().positive().openapi({ description: "Amount in kobo" }),
	})
	.openapi("HashcodexDepositSchema");

const DepositResponseSchema = z
	.object({
		success: z.literal(true).openapi({ description: "Success status" }),
		data: z
			.object({
				balance: z
					.number()
					.openapi({ description: "New wallet balance in kobo" }),
				amount: z
					.number()
					.openapi({ description: "Transaction amount in kobo" }),
				action: z.string().openapi({ description: "credit or debit" }),
			})
			.openapi({ description: "Response data" }),
	})
	.openapi("HashcodexDepositResponseSchema");

const DepositErrorSchema = z
	.object({
		success: z.literal(false).openapi({ description: "Error status" }),
		error: z.string().openapi({ description: "Error message" }),
		details: z.nullable(z.any()).openapi({ description: "Error details" }),
	})
	.openapi("HashcodexDepositErrorSchema");

const depositRoute = createRoute({
	method: "post",
	path: "/deposit",
	tags: ["Hashcodex"],
	summary: "Deposit or withdraw from wallet via Hashcodex",
	description:
		"Add (credit) or remove (debit) funds from the authenticated user's wallet. Debit only succeeds if sufficient balance exists.",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: DepositSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Transaction successful",
			content: {
				"application/json": {
					schema: DepositResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid request or insufficient balance",
			content: {
				"application/json": {
					schema: DepositErrorSchema,
				},
			},
		},
		401: {
			description: "Unauthorized - user not authenticated",
			content: {
				"application/json": {
					schema: DepositErrorSchema,
				},
			},
		},
	},
});

hashcodexRoute.openapi(depositRoute, async (c) => {
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

	const result = DepositSchema.safeParse(await c.req.json());
	if (!result.success) {
		return c.json(
			{
				success: false as const,
				error: "Invalid request",
				details: result.error.issues,
			},
			400,
		);
	}

	const { action, amount } = result.data;
	const db = drizzle(c.env.DB, { schema });
	const amountInKobo = amount * 100;

	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, user.id))
		.limit(1);

	if (!wallet) {
		return c.json(
			{
				success: false as const,
				error: "Wallet not found. Please fund your wallet first.",
				details: null,
			},
			400,
		);
	}

	if (action === "debit" && wallet.balance < amountInKobo) {
		return c.json(
			{
				success: false as const,
				error: "Insufficient balance",
				details: null,
			},
			400,
		);
	}

	const reference = `hcx_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
	const newBalance =
		action === "credit"
			? wallet.balance + amountInKobo
			: wallet.balance - amountInKobo;

	try {
		await db
			.update(schema.wallet)
			.set({
				balance: newBalance,
				updatedAt: new Date(),
			})
			.where(eq(schema.wallet.id, wallet.id));

		const [txn] = await db
			.insert(schema.walletTransaction)
			.values({
				id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
				userId: user.id,
				amount: amountInKobo,
				type: action,
				reference,
				status: "completed",
				paymentMethod: "hashcodex",
				balance: newBalance,
				metadata: JSON.stringify({
					source: "hashcodex",
				}),
			})
			.returning();

		if (!txn?.id) {
			return c.json(
				{ success: false, error: "Failed to record transaction" },
				500,
			);
		}

		return c.json(
			{
				success: true as const,
				data: {
					balance: newBalance / 100,
					amount,
					action,
				},
			},
			200,
		);
	} catch (error) {
		return c.json(
			{
				success: false as const,
				error:
					error instanceof Error
						? error.message
						: "Failed to process transaction",
				details: null,
			},
			400,
		);
	}
});

export default hashcodexRoute;
