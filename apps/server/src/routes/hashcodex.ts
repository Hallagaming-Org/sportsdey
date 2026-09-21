import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import {
	BONUS_ENGINE_NATIVE_PROVIDER_ID,
	casinoBetAmountFromKobo,
	optionalExecutionCtx,
	reportCasinoBetInBackground,
	reportCasinoBetResultInBackground,
} from "@/services/bonus-engine";
import {
	type PocketsSettleResult,
	settlePocketsTransaction,
} from "@/services/pockets-settlement";
import { CasinoMoneyError, toKobo } from "@/utils/casino-money";
import {
	buildHashcodexLaunchUrl,
	HASHCODEX_GAME_CODES,
	isHashcodexGameCode,
} from "@/utils/hashcodex-launch";
import {
	HASHCODEX_SIGNATURE_HEADER,
	HashcodexSignatureError,
	verifyHashcodexSignature,
} from "@/utils/hashcodex-security";
import type { CloudflareBindings } from "../types";

const hashcodexRoute = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const SPORTSDEY_CRASH_GAME_CODE = "sportsdey-crash";

/**
 * SECURITY: POST /deposit stays disabled. It was a user-session self-credit.
 *
 * Real-money Crash / Spin and Win must use POST /wallet — HMAC from the
 * Hashcodex backend, unique transactionId, claim-first settlement.
 */

const DepositSchema = z
	.object({
		action: z
			.enum(["credit", "debit"])
			.openapi({ description: "credit to add funds, debit to remove funds" }),
		amount: z.number().positive().openapi({ description: "Amount in kobo" }),
	})
	.openapi("HashcodexDepositSchema");

const DepositErrorSchema = z
	.object({
		success: z.literal(false).openapi({ description: "Error status" }),
		error: z.string().openapi({ description: "Error message" }),
		details: z.nullable(z.any()).openapi({ description: "Error details" }),
	})
	.openapi("HashcodexDepositErrorSchema");

const WalletRequestSchema = z
	.object({
		playerId: z.string().min(1).openapi({ description: "SportsDey user id" }),
		action: z
			.enum(["debit", "credit", "refund"])
			.openapi({ description: "debit = bet, credit = win, refund = rollback" }),
		amount: z
			.number()
			.positive()
			.openapi({ description: "Amount in Naira (converted to kobo once)" }),
		transactionId: z
			.string()
			.min(1)
			.openapi({ description: "Hashcodex unique transaction id" }),
		roundId: z
			.string()
			.min(1)
			.optional()
			.openapi({ description: "Round / game round id" }),
		originalTransactionId: z.string().min(1).optional().openapi({
			description:
				"Required for credit and refund — the debit transactionId to pair against",
		}),
		gameCode: z
			.enum(HASHCODEX_GAME_CODES)
			.optional()
			.openapi({ description: "sportsdey-crash (default) or spin_and_win" }),
	})
	.openapi("HashcodexWalletRequestSchema");

const WalletSuccessSchema = z
	.object({
		success: z.literal(true),
		data: z.object({
			balance: z.number().openapi({ description: "Wallet balance in Naira" }),
			amount: z.number().openapi({ description: "Settled amount in Naira" }),
			action: z.string(),
			transactionId: z.string(),
		}),
	})
	.openapi("HashcodexWalletSuccessSchema");

const BalanceRequestSchema = z
	.object({
		playerId: z.string().min(1),
	})
	.openapi("HashcodexBalanceRequestSchema");

const BalanceSuccessSchema = z
	.object({
		success: z.literal(true),
		data: z.object({
			balance: z.number().openapi({ description: "Wallet balance in Naira" }),
			playerId: z.string(),
		}),
	})
	.openapi("HashcodexBalanceSuccessSchema");

const LaunchRequestSchema = z
	.object({
		gameCode: z
			.enum(HASHCODEX_GAME_CODES)
			.optional()
			.openapi({ description: "sportsdey-crash (default) or spin_and_win" }),
	})
	.openapi("HashcodexLaunchRequestSchema");

const LaunchSuccessSchema = z
	.object({
		success: z.literal(true),
		data: z.object({
			url: z.string().openapi({ description: "Hashcodex game URL" }),
		}),
	})
	.openapi("HashcodexLaunchSuccessSchema");

const depositRoute = createRoute({
	method: "post",
	path: "/deposit",
	tags: ["Hashcodex"],
	summary: "Disabled — user-session Crash wallet mutate",
	description:
		"Disabled. Use POST /hashcodex/wallet with HMAC from the Hashcodex server.",
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
		503: {
			description: "Route disabled for security rework",
			content: {
				"application/json": {
					schema: DepositErrorSchema,
				},
			},
		},
	},
});

const launchRoute = createRoute({
	method: "post",
	path: "/launch",
	tags: ["Hashcodex"],
	summary: "Launch Sportsdey Crash or Spin and Win",
	description:
		"Authenticated player launch. Returns a Hashcodex URL with playerId, gameCode, and wallet/balance callback URLs for their server to POST /hashcodex/wallet.",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: LaunchRequestSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Launch URL",
			content: {
				"application/json": { schema: LaunchSuccessSchema },
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": { schema: DepositErrorSchema },
			},
		},
		400: {
			description: "Invalid request",
			content: {
				"application/json": { schema: DepositErrorSchema },
			},
		},
	},
});

const walletRoute = createRoute({
	method: "post",
	path: "/wallet",
	tags: ["Hashcodex"],
	summary: "Signed Crash / Spin and Win wallet callback",
	description:
		"Server-to-server only. HMAC-SHA256 hex of the raw JSON body in X-Hashcodex-Signature. Amounts are Naira. Credits and refunds must cite the original debit transactionId. Body is not OpenAPI-parsed so the HMAC can use the raw bytes.",
	responses: {
		200: {
			description: "Settled or idempotent replay",
			content: {
				"application/json": { schema: WalletSuccessSchema },
			},
		},
		400: {
			description: "Invalid request",
			content: {
				"application/json": { schema: DepositErrorSchema },
			},
		},
		401: {
			description: "Invalid or missing signature",
			content: {
				"application/json": { schema: DepositErrorSchema },
			},
		},
		403: {
			description: "Insufficient balance or unpaired win/refund",
			content: {
				"application/json": { schema: DepositErrorSchema },
			},
		},
		503: {
			description: "Secret not configured",
			content: {
				"application/json": { schema: DepositErrorSchema },
			},
		},
		500: {
			description: "Wallet update failed",
			content: {
				"application/json": { schema: DepositErrorSchema },
			},
		},
	},
});

const balanceRoute = createRoute({
	method: "post",
	path: "/balance",
	tags: ["Hashcodex"],
	summary: "Signed player balance lookup",
	description:
		"Server-to-server only. Same HMAC as /wallet. Returns main wallet in Naira. Body is not OpenAPI-parsed so the HMAC can use the raw bytes.",
	responses: {
		200: {
			description: "Balance",
			content: {
				"application/json": { schema: BalanceSuccessSchema },
			},
		},
		400: {
			description: "Invalid request",
			content: {
				"application/json": { schema: DepositErrorSchema },
			},
		},
		401: {
			description: "Invalid or missing signature",
			content: {
				"application/json": { schema: DepositErrorSchema },
			},
		},
		404: {
			description: "Wallet not found",
			content: {
				"application/json": { schema: DepositErrorSchema },
			},
		},
		503: {
			description: "Secret not configured",
			content: {
				"application/json": { schema: DepositErrorSchema },
			},
		},
	},
});

function errorBody(error: string, details: unknown = null) {
	return { success: false as const, error, details };
}

async function readSignedJson<T>(
	c: {
		req: {
			text: () => Promise<string>;
			header: (name: string) => string | undefined;
		};
		env: CloudflareBindings;
	},
	schema: z.ZodType<T>,
): Promise<
	| { ok: true; data: T; raw: string }
	| { ok: false; status: 400 | 401 | 503; error: string }
> {
	const secret = c.env.HASHCODEX_SERVER_SECRET;
	const raw = await c.req.text();
	try {
		verifyHashcodexSignature(
			raw,
			c.req.header(HASHCODEX_SIGNATURE_HEADER),
			secret,
		);
	} catch (error) {
		if (
			error instanceof HashcodexSignatureError &&
			error.message.includes("not configured")
		) {
			return { ok: false, status: 503, error: error.message };
		}
		return {
			ok: false,
			status: 401,
			error:
				error instanceof HashcodexSignatureError
					? error.message
					: "Invalid signature",
		};
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw) as unknown;
	} catch {
		return { ok: false, status: 400, error: "Invalid JSON body" };
	}

	const result = schema.safeParse(parsed);
	if (!result.success) {
		return { ok: false, status: 400, error: "Invalid request" };
	}
	return { ok: true, data: result.data, raw };
}

function koboToNaira(kobo: number): number {
	return kobo / 100;
}

function settleHttp(result: PocketsSettleResult): {
	status: 200 | 400 | 403 | 500;
	error?: string;
	balanceKobo?: number;
} {
	switch (result.status) {
		case "settled":
		case "duplicate":
			return { status: 200, balanceKobo: result.newBalanceKobo };
		case "invalid_amount":
			return { status: 400, error: "Amount must be a positive kobo integer" };
		case "wallet_missing":
			return { status: 400, error: "Wallet not found" };
		case "insufficient":
			return { status: 403, error: "Insufficient balance" };
		default:
			return { status: 500, error: "Failed to update wallet" };
	}
}

hashcodexRoute.openapi(depositRoute, async (c) => {
	console.warn(
		JSON.stringify({
			tag: "money_movement",
			provider: "hashcodex",
			action: "rejected_disabled_route",
			userId: c.get("user")?.id ?? null,
		}),
	);
	return c.json(
		errorBody(
			"Sportsdey Crash wallet transactions are temporarily disabled for maintenance.",
		),
		503,
	);
});

hashcodexRoute.openapi(launchRoute, async (c) => {
	const user = c.get("user");
	if (!user) {
		return c.json(errorBody("Unauthorized"), 401);
	}

	const body = c.req.valid("json");
	const gameCode = body.gameCode ?? SPORTSDEY_CRASH_GAME_CODE;
	if (!isHashcodexGameCode(gameCode)) {
		return c.json(errorBody("Invalid gameCode"), 400);
	}

	const apiUrl = (c.env.SERVER_URL || "").replace(/\/$/, "");
	if (!apiUrl) {
		return c.json(errorBody("SERVER_URL is not configured"), 400);
	}

	const url = buildHashcodexLaunchUrl({
		launchBase: c.env.HASHCODEX_LAUNCH_URL,
		playerId: user.id,
		gameCode,
		apiUrl,
	});

	return c.json({ success: true as const, data: { url } }, 200);
});

hashcodexRoute.openapi(balanceRoute, async (c) => {
	const signed = await readSignedJson(c, BalanceRequestSchema);
	if (!signed.ok) {
		return c.json(errorBody(signed.error), signed.status);
	}

	const db = drizzle(c.env.DB, { schema });
	const [wallet] = await db
		.select({ balance: schema.wallet.balance })
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, signed.data.playerId))
		.limit(1);

	if (!wallet) {
		return c.json(errorBody("Wallet not found"), 404);
	}

	return c.json(
		{
			success: true as const,
			data: {
				playerId: signed.data.playerId,
				balance: koboToNaira(wallet.balance),
			},
		},
		200,
	);
});

hashcodexRoute.openapi(walletRoute, async (c) => {
	const signed = await readSignedJson(c, WalletRequestSchema);
	if (!signed.ok) {
		return c.json(errorBody(signed.error), signed.status);
	}

	const body = signed.data;
	const gameCode = body.gameCode ?? SPORTSDEY_CRASH_GAME_CODE;
	const db = drizzle(c.env.DB, { schema });

	let amountKobo: number;
	try {
		amountKobo = toKobo(body.amount, "naira");
	} catch (error) {
		return c.json(
			errorBody(
				error instanceof CasinoMoneyError ? error.message : "Invalid amount",
			),
			400,
		);
	}

	if (body.action === "credit" || body.action === "refund") {
		if (!body.originalTransactionId) {
			return c.json(
				errorBody("originalTransactionId is required for credit and refund"),
				400,
			);
		}

		const debitClaimId = `hashcodex:debit:${body.originalTransactionId}`;
		const [priorDebit] = await db
			.select()
			.from(schema.pocketsTransactions)
			.where(eq(schema.pocketsTransactions.id, debitClaimId))
			.limit(1);

		if (!priorDebit || priorDebit.userId !== body.playerId) {
			return c.json(
				errorBody("No matching debit for originalTransactionId"),
				403,
			);
		}

		if (body.action === "refund") {
			amountKobo = priorDebit.amount;
		}
	}

	const claimTxId =
		body.action === "debit"
			? body.transactionId
			: (body.originalTransactionId as string);

	const settled = await settlePocketsTransaction({
		db,
		provider: "hashcodex",
		paymentMethod: "hashcodex",
		action: body.action,
		playerId: body.playerId,
		providerTxId: claimTxId,
		amountKobo,
		currency: "NGN",
		gameCode,
		roundId: body.roundId,
		metadata: {
			source: "hashcodex",
			gameCode,
			roundId: body.roundId ?? null,
			transactionId: body.transactionId,
			originalTransactionId: body.originalTransactionId ?? null,
		},
	});

	const http = settleHttp(settled);
	if (http.status !== 200) {
		return c.json(
			errorBody(http.error ?? "Failed to update wallet"),
			http.status,
		);
	}

	if (settled.status === "settled") {
		if (body.action === "debit") {
			await reportCasinoBetInBackground({
				env: c.env,
				executionCtx: optionalExecutionCtx(c),
				userId: body.playerId,
				betId: body.transactionId,
				amount: casinoBetAmountFromKobo(amountKobo),
				gameRef: gameCode,
				fallbackProviderId: BONUS_ENGINE_NATIVE_PROVIDER_ID.SPORTSDEY_ORIGINALS,
			});
		} else if (body.action === "credit") {
			await reportCasinoBetResultInBackground({
				env: c.env,
				executionCtx: optionalExecutionCtx(c),
				userId: body.playerId,
				betId: body.originalTransactionId as string,
				totalWinAmount: casinoBetAmountFromKobo(amountKobo),
				isWin: 1,
			});
		} else {
			await reportCasinoBetResultInBackground({
				env: c.env,
				executionCtx: optionalExecutionCtx(c),
				userId: body.playerId,
				betId: body.originalTransactionId as string,
				totalWinAmount: casinoBetAmountFromKobo(amountKobo),
				isWin: 0,
				isRollback: 1,
			});
		}
	}

	return c.json(
		{
			success: true as const,
			data: {
				balance: koboToNaira(http.balanceKobo ?? 0),
				amount: koboToNaira(amountKobo),
				action: body.action,
				transactionId: body.transactionId,
			},
		},
		200,
	);
});

export default hashcodexRoute;
