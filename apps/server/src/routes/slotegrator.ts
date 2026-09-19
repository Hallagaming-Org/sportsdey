import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { creditWallet, debitWallet } from "@/db/atomic-wallet";
import * as schema from "@/db/schema";
import {
	optionalExecutionCtx,
	reportCasinoBetInBackground,
	reportCasinoBetResultInBackground,
} from "@/services/bonus-engine";
import {
	isUniqueConstraintError,
	logMoneyMovement,
	settleWithClaim,
} from "@/services/casino-settlement";
import { verifySlotitegrationSignature } from "@/utils";
import { toKobo } from "@/utils/casino-money";
import {
	initSlotegratorDemo,
	mapSlotegratorUpstreamError,
	resolveSlotegratorReturnUrl,
	SlotegratorApiError,
} from "@/utils/slotegrator";
import type { CloudflareBindings } from "../types";

type SlotitegrationContext = {
	Bindings: CloudflareBindings;
};

const slotegratorRoute = new OpenAPIHono<SlotitegrationContext>();

type SlotDb = ReturnType<typeof drizzle<typeof schema>>;
type SlotTxRow = typeof schema.slotitegrationTransactions.$inferSelect;
type SlotTxInsert = typeof schema.slotitegrationTransactions.$inferInsert;

/**
 * Claim-first settlement against `slotitegration_transactions`.
 * `claim.transactionId` (unique) is inserted BEFORE the wallet moves, so
 * concurrent duplicates and provider retries settle exactly once. Previously
 * this route debited/credited first and inserted the ledger row after —
 * two concurrent identical callbacks both passed the existence check and
 * both moved money.
 */
async function settleSlotTransaction(opts: {
	db: SlotDb;
	direction: "debit" | "credit" | "none";
	playerId: string;
	amountKobo: number;
	currentBalanceKobo: number;
	claim: SlotTxInsert;
	walletTxnType: "debit" | "credit" | "refund";
	walletMetadata: Record<string, unknown>;
}): Promise<
	| { status: "duplicate"; existing: SlotTxRow }
	| { status: "settled"; balanceKobo: number }
	| { status: "wallet_failed" }
> {
	const { db, direction, playerId, amountKobo, claim } = opts;
	const claimTransactionId = claim.transactionId;
	const moveMoney = direction !== "none" && amountKobo > 0;

	const outcome = await settleWithClaim<SlotTxRow>({
		context: {
			provider: "slotegrator",
			action: String(claim.type ?? direction),
			userId: playerId,
			txId: claimTransactionId,
			roundId: claim.roundId ?? null,
			amountKobo,
		},
		insertClaim: () => db.insert(schema.slotitegrationTransactions).values(claim),
		findExisting: () =>
			db.query.slotitegrationTransactions.findFirst({
				where: eq(
					schema.slotitegrationTransactions.transactionId,
					claimTransactionId,
				),
			}),
		releaseClaim: () =>
			db
				.delete(schema.slotitegrationTransactions)
				.where(
					eq(
						schema.slotitegrationTransactions.transactionId,
						claimTransactionId,
					),
				),
		mutateWallet: () => {
			if (!moveMoney) {
				return Promise.resolve({ balance: opts.currentBalanceKobo });
			}
			return direction === "debit"
				? debitWallet(db, playerId, amountKobo)
				: creditWallet(db, playerId, amountKobo);
		},
		finalize: async (balanceAfter) => {
			if (!moveMoney) return;
			const balanceBefore =
				direction === "debit"
					? balanceAfter + amountKobo
					: balanceAfter - amountKobo;
			await db
				.update(schema.slotitegrationTransactions)
				.set({ balanceBefore, balanceAfter })
				.where(
					eq(
						schema.slotitegrationTransactions.transactionId,
						claimTransactionId,
					),
				);
			await db.insert(schema.walletTransaction).values({
				id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
				userId: playerId,
				amount: amountKobo,
				type: opts.walletTxnType,
				reference: `slotegrator:${claimTransactionId}`,
				status: "success",
				paymentMethod: "slotegrator games",
				balance: balanceAfter,
				metadata: JSON.stringify(opts.walletMetadata),
			});
		},
	});

	if (outcome.status === "duplicate") {
		return { status: "duplicate", existing: outcome.existing };
	}
	if (outcome.status === "wallet_failed") {
		return { status: "wallet_failed" };
	}
	return { status: "settled", balanceKobo: outcome.balance };
}

const LaunchGameSchema = z
	.object({
		game_uuid: z.string().openapi({ description: "Game UUID" }),
		device: z.string().optional().openapi({ description: "Device type" }),
		return_url: z
			.string()
			.url()
			.optional()
			.openapi({ description: "URL after the player exits the game" }),
	})
	.openapi("LaunchGame");

const LaunchGameResponseSchema = z
	.object({
		success: z.boolean().openapi({ description: "Success status" }),
		data: z
			.object({
				url: z.string().openapi({ description: "Game launch URL" }),
			})
			.openapi({ description: "Response data" }),
	})
	.openapi("LaunchGameResponse");

const LaunchGameErrorResponseSchema = z
	.object({
		success: z.boolean().openapi({ description: "Success status" }),
		error: z.string().openapi({ description: "Error message" }),
		details: z.any().openapi({ description: "Error details" }),
	})
	.openapi("LaunchGameErrorResponse");

const LaunchDemoGameSchema = z
	.object({
		game_uuid: z.string().openapi({ description: "Game UUID" }),
		device: z.string().optional().openapi({ description: "Device type" }),
		language: z.string().optional().openapi({ description: "UI language" }),
		return_url: z
			.string()
			.url()
			.optional()
			.openapi({ description: "URL after player exits the demo" }),
	})
	.openapi("LaunchDemoGame");

const launchGameRoute = createRoute({
	method: "post",
	path: "/launch",
	tags: ["Slotegrator"],
	summary: "Initialize a Slotegrator game session",
	description: "Creates a game session and returns a launch URL for the player",
	security: [{ BearerAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: LaunchGameSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Game launch URL",
			content: {
				"application/json": {
					schema: LaunchGameResponseSchema,
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: LaunchGameErrorResponseSchema,
				},
			},
		},
		422: {
			description: "Validation error",
			content: {
				"application/json": {
					schema: LaunchGameErrorResponseSchema,
				},
			},
		},
		500: {
			description: "Server configuration error",
			content: {
				"application/json": {
					schema: LaunchGameErrorResponseSchema,
				},
			},
		},
		502: {
			description: "Upstream API error",
			content: {
				"application/json": {
					schema: LaunchGameErrorResponseSchema,
				},
			},
		},
	},
});

const launchDemoGameRoute = createRoute({
	method: "post",
	path: "/launch-demo",
	tags: ["Slotegrator"],
	summary: "Initialize a Slotegrator demo game (no real money)",
	description:
		"Calls Slotegrator POST /games/init-demo and returns a launch URL. No wallet session or user auth required.",
	request: {
		body: {
			content: {
				"application/json": {
					schema: LaunchDemoGameSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Demo game launch URL",
			content: {
				"application/json": {
					schema: LaunchGameResponseSchema,
				},
			},
		},
		404: {
			description: "Game not found",
			content: {
				"application/json": {
					schema: LaunchGameErrorResponseSchema,
				},
			},
		},
		422: {
			description: "Validation error or demo unsupported",
			content: {
				"application/json": {
					schema: LaunchGameErrorResponseSchema,
				},
			},
		},
		500: {
			description: "Server configuration error",
			content: {
				"application/json": {
					schema: LaunchGameErrorResponseSchema,
				},
			},
		},
		502: {
			description: "Upstream API / merchant auth error",
			content: {
				"application/json": {
					schema: LaunchGameErrorResponseSchema,
				},
			},
		},
		503: {
			description: "Upstream rate limited",
			content: {
				"application/json": {
					schema: LaunchGameErrorResponseSchema,
				},
			},
		},
	},
});

slotegratorRoute.openapi(launchDemoGameRoute, async (c) => {
	const result = LaunchDemoGameSchema.safeParse(await c.req.json());
	if (!result.success) {
		return c.json(
			{
				success: false,
				error: "Invalid request parameters",
				details: null,
			},
			422,
		);
	}

	try {
		const returnUrl = resolveSlotegratorReturnUrl(
			c.env,
			result.data.return_url,
		);
		const data = await initSlotegratorDemo(c.env, {
			...result.data,
			return_url: returnUrl,
		});
		return c.json(
			{
				success: true,
				data: { url: data.url },
			},
			200,
		);
	} catch (error) {
		if (error instanceof SlotegratorApiError) {
			const allowed = [404, 422, 500, 502, 503] as const;
			const status = allowed.includes(
				error.status as (typeof allowed)[number],
			)
				? (error.status as (typeof allowed)[number])
				: 502;
			return c.json(
				{
					success: false,
					error: error.message,
					details: error.details,
				},
				status,
			);
		}
		console.error("Slotegrator launch-demo unexpected error", error);
		return c.json(
			{
				success: false,
				error: "Failed to launch demo game",
				details: null,
			},
			502,
		);
	}
});

slotegratorRoute.openapi(launchGameRoute, async (c) => {
	const user = c.get("user");
	const incomingHeaders = Object.fromEntries(c.req.raw.headers.entries());
	const logIncomingHeaders = {
		...incomingHeaders,
		authorization: incomingHeaders.authorization ? "[REDACTED]" : undefined,
		cookie: incomingHeaders.cookie ? "[REDACTED]" : undefined,
	};
	if (!user) {
		console.log("Slotegrator real launch request", {
			body: null,
			params: { route: c.req.param(), query: c.req.query() },
			headers: logIncomingHeaders,
		});
		return c.json(
			{
				success: false,
				error: "Unauthorized",
				details: null,
			},
			401,
		);
	}

	const requestPayload: unknown = await c.req.json();
	const result = LaunchGameSchema.safeParse(requestPayload);
	if (!result.success) {
		console.log("Slotegrator real launch request validation failed", {
			body: requestPayload,
			params: { route: c.req.param(), query: c.req.query() },
			headers: logIncomingHeaders,
			validation: result.error.flatten(),
		});
		return c.json(
			{
				success: false,
				error: "Invalid request parameters",
				details: null,
			},
			422,
		);
	}

	const { game_uuid, device } = result.data;
	const return_url = resolveSlotegratorReturnUrl(c.env, result.data.return_url);

	const merchantKey = c.env.SLOTITEGRATION_MERCHANT_KEY;
	const merchantId = c.env.SLOTITEGRATION_MERCHANT_ID;
	const proxyUrl = c.env.PROXY_URL;
	const proxySecret = c.env.PROXY_SECRET;

	if (!merchantKey || !merchantId || !proxyUrl || !proxySecret) {
		return c.json(
			{
				success: false,
				error: "Server configuration error",
				details: null,
			},
			500,
		);
	}

	const db = drizzle(c.env.DB, { schema });

	const currency = "NGN";

	const sessionToken = crypto.randomUUID();

	const [session] = await db
		.insert(schema.slotitegrationSessions)
		.values({
			sessionId: sessionToken,
			userId: user.id,
			currency: currency,
			status: "active",
		})
		.returning();

	if (!session || !session.sessionId) {
		return c.json(
			{ success: false, error: "Failed to create session", details: null },
			500,
		);
	}

	const requestBody: Record<string, string> = {
		game_uuid: game_uuid,
		player_id: user.id,
		player_name: user.name || user.id,
		currency: currency,
		session_id: sessionToken,
	};
	if (device) requestBody.device = device;
	if (return_url) requestBody.return_url = return_url;

	const timestamp = Math.floor(Date.now() / 1000).toString();
	const nonce = crypto.randomUUID();

	const allParams: Record<string, string> = {
		...requestBody,
		"X-Merchant-Id": merchantId,
		"X-Timestamp": timestamp,
		"X-Nonce": nonce,
	};

	const sortedKeys = Object.keys(allParams).sort();
	const params = new URLSearchParams();
	for (const key of sortedKeys) {
		params.set(key, allParams[key] ?? "");
	}
	const queryString = params.toString();

	const cryptoMod = await import("crypto");
	const computedSign = cryptoMod
		.createHmac("sha1", merchantKey)
		.update(queryString)
		.digest("hex");

	const slotegratorProxyPath =
		c.env.NODE_ENV === "staging" ? "slotegrator-staging" : "slotegrator";
	const proxyRequestUrl = `${proxyUrl}/${slotegratorProxyPath}/games/init`;
	const proxyRequestHeaders = {
		"Content-Type": "application/x-www-form-urlencoded",
		"X-Merchant-Id": merchantId,
		"X-Timestamp": timestamp,
		"X-Nonce": nonce,
		"X-Sign": computedSign,
		"X-Proxy-Auth": proxySecret,
	};

	console.log("Slotegrator real launch request", {
		body: result.data,
		params: {
			route: c.req.param(),
			query: c.req.query(),
			requestBody,
			allParams,
			queryString,
		},
		headers: logIncomingHeaders,
		proxy: {
			url: proxyRequestUrl,
			method: "POST",
			body: requestBody,
			headers: {
				...proxyRequestHeaders,
				"X-Sign": "[REDACTED]",
				"X-Proxy-Auth": "[REDACTED]",
			},
		},
	});

	const response = await fetch(proxyRequestUrl, {
		method: "POST",
		headers: proxyRequestHeaders,
		body: new URLSearchParams(requestBody),
	});

	let upstreamData: unknown = null;
	const upstreamText = await response.text();
	if (upstreamText) {
		try {
			upstreamData = JSON.parse(upstreamText);
		} catch {
			upstreamData = upstreamText;
		}
	}

	console.log("Slotegrator real launch proxy result", {
		url: response.url,
		upstreamUrl: response.headers.get("x-proxy-upstream-url"),
		status: response.status,
		statusText: response.statusText,
		ok: response.ok,
		headers: Object.fromEntries(response.headers.entries()),
		body: upstreamData,
	});

	if (!response.ok) {
		const mapped = mapSlotegratorUpstreamError(response.status, upstreamData);
		const allowed = [404, 422, 500, 502, 503] as const;
		const status = allowed.includes(
			mapped.status as (typeof allowed)[number],
		)
			? (mapped.status as (typeof allowed)[number])
			: 502;
		return c.json(
			{
				success: false,
				error: mapped.message,
				details: mapped.details,
			},
			status,
		);
	}

	const url =
		upstreamData &&
		typeof upstreamData === "object" &&
		typeof (upstreamData as { url?: unknown }).url === "string"
			? (upstreamData as { url: string }).url
			: "";

	if (!url) {
		return c.json(
			{
				success: false,
				error: "Upstream launch response missing URL",
				details: upstreamData,
			},
			502,
		);
	}

	// Do not prefetch `url` — GIS launch tokens are single-use.

	return c.json(
		{
			success: true,
			data: {
				url,
			},
		},
		200,
	);
});

slotegratorRoute.post("/", async (c) => {
	const rawBody = await c.req.text();

	const merchantKey = c.env.SLOTITEGRATION_MERCHANT_KEY;
	const merchantId = c.env.SLOTITEGRATION_MERCHANT_ID;

	if (!merchantKey || !merchantId) {
		return c.json(
			{ error: "Server configuration error", code: "CONFIG_ERROR" },
			500,
		);
	}

	const verification = await verifySlotitegrationSignature(
		c,
		rawBody,
		merchantKey,
	);
	console.log("verification valid", verification.valid);
	if (!verification.valid) {
		// Non-200 so the provider treats this as a failed attempt (a retry),
		// never as a processed transaction.
		return c.json(
			{
				error_description: verification.error || "Invalid signature",
				error_code: "INTERNAL_ERROR",
			},
			403,
		);
	}

	const receivedMerchantId = c.req.header("X-Merchant-Id");
	if (receivedMerchantId !== merchantId) {
		return c.json(
			{
				error_description: "Invalid merchant ID",
				error_code: "INTERNAL_ERROR",
			},
			403,
		);
	}

	const params = new URLSearchParams(rawBody);
	const action = params.get("action") || "";
	const db = drizzle(c.env.DB, { schema });

	async function validatePlayer(playerId: string) {
		const [user] = await db
			.select()
			.from(schema.user)
			.where(eq(schema.user.id, playerId))
			.limit(1);
		if (!user) {
			return false;
		}
		return true;
	}

	if (action === "balance") {
		const playerId = params.get("player_id") || "";

		if (!playerId) {
			return c.json(
				{
					error_description: "Missing player_id",
					error_code: "INTERNAL_ERROR",
				},
				200,
			);
		}

		const playerExists = await validatePlayer(playerId);
		if (!playerExists) {
			return c.json(
				{ error_description: "Player not found", error_code: "INTERNAL_ERROR" },
				200,
			);
		}

		const [wallet] = await db
			.select()
			.from(schema.wallet)
			.where(eq(schema.wallet.userId, playerId))
			.limit(1);

		const balance = (wallet?.balance ?? 0) / 100;

		return c.json({ balance });
	}

	if (action === "bet") {
		const playerId = params.get("player_id") || "";
		const amountRaw = params.get("amount");
		const amount = Number(amountRaw);
		const currency = params.get("currency") || "NGN";
		const gameUuid = params.get("game_uuid") || "";
		const transactionId = params.get("transaction_id") || "";
		const sessionId = params.get("session_id") || "";
		const type = params.get("type") || "bet";
		const round_id = params.get("round_id");

		if (
			!playerId ||
			amountRaw === null ||
			Number.isNaN(amount) ||
			!transactionId ||
			!sessionId
		) {
			console.log("fields", {
				playerId,
				amount,
				transactionId,
				sessionId,
				type,
			});

			return c.json(
				{
					error_description: "Missing required fields",
					error_code: "INTERNAL_ERROR",
				},
				200,
			);
		}

		const playerExists = await validatePlayer(playerId);
		if (!playerExists) {
			return c.json(
				{
					error_description: "Player not found",
					error_code: "INTERNAL_ERROR",
				},
				200,
			);
		}

		const existingTx = await db.query.slotitegrationTransactions.findFirst({
			where: eq(schema.slotitegrationTransactions.transactionId, transactionId),
		});

		if (existingTx) {
			const [wallet] = await db
				.select()
				.from(schema.wallet)
				.where(eq(schema.wallet.userId, playerId))
				.limit(1);
			const balance = (wallet?.balance ?? 0) / 100;
			return c.json({ balance, transaction_id: existingTx.id }, 200);
		}

		const [wallet] = await db
			.select()
			.from(schema.wallet)
			.where(eq(schema.wallet.userId, playerId))
			.limit(1);

		let amountInKobo: number;
		try {
			amountInKobo = toKobo(amount, "naira");
		} catch {
			return c.json(
				{ error_description: "Invalid amount", error_code: "INTERNAL_ERROR" },
				400,
			);
		}

		if (!wallet || wallet.balance < amountInKobo) {
			return c.json(
				{
					error_description: "Insufficient balance",
					error_code: "INSUFFICIENT_FUNDS",
				},
				200,
			);
		}

		const txId = crypto.randomUUID();
		const settle = await settleSlotTransaction({
			db,
			direction: "debit",
			playerId,
			amountKobo: amountInKobo,
			currentBalanceKobo: wallet.balance,
			claim: {
				id: txId,
				transactionId,
				userId: playerId,
				type: type,
				amount: amountInKobo,
				balanceBefore: wallet.balance,
				balanceAfter: wallet.balance,
				currency,
				gameId: gameUuid,
				sessionId,
				roundId: round_id,
			},
			walletTxnType: "debit",
			walletMetadata: {
				game: "slotegrator",
				gameId: gameUuid,
				sessionId,
				action: "bet",
			},
		});

		if (settle.status === "duplicate") {
			const [dupWallet] = await db
				.select()
				.from(schema.wallet)
				.where(eq(schema.wallet.userId, playerId))
				.limit(1);
			const balance = (dupWallet?.balance ?? 0) / 100;
			return c.json({ balance, transaction_id: settle.existing.id }, 200);
		}

		if (settle.status === "wallet_failed") {
			return c.json(
				{
					error_description: "Insufficient balance",
					error_code: "INSUFFICIENT_FUNDS",
				},
				200,
			);
		}

		const balance = settle.balanceKobo / 100;

		await reportCasinoBetInBackground({
			env: c.env,
			executionCtx: optionalExecutionCtx(c),
			userId: playerId,
			betId: transactionId,
			amount,
			currency,
			gameRef: gameUuid,
		});

		return c.json({ balance, transaction_id: txId }, 200);
	}

	if (action === "win") {
		const playerId = params.get("player_id") || "";
		const amount = Number.parseFloat(params.get("amount") || "0");
		const currency = params.get("currency") || "NGN";
		const gameUuid = params.get("game_uuid") || "";
		const transactionId = params.get("transaction_id") || "";
		const sessionId = params.get("session_id") || "";
		const type = params.get("type") || "win";
		const round_id = params.get("round_id");

		if (!playerId || isNaN(amount) || !transactionId || !sessionId) {
			return c.json(
				{
					error_description: "Missing required fields",
					error_code: "INTERNAL_ERROR",
				},
				200,
			);
		}

		const playerExists = await validatePlayer(playerId);
		if (!playerExists) {
			return c.json(
				{ error_description: "Player not found", error_code: "INTERNAL_ERROR" },
				200,
			);
		}

		const existingTx = await db.query.slotitegrationTransactions.findFirst({
			where: eq(schema.slotitegrationTransactions.transactionId, transactionId),
		});

		if (existingTx) {
			const [wallet] = await db
				.select()
				.from(schema.wallet)
				.where(eq(schema.wallet.userId, playerId))
				.limit(1);
			const balance = (wallet?.balance ?? 0) / 100;
			return c.json({ balance, transaction_id: existingTx.id }, 200);
		}

		const [wallet] = await db
			.select()
			.from(schema.wallet)
			.where(eq(schema.wallet.userId, playerId))
			.limit(1);

		let amountInKobo: number;
		try {
			amountInKobo = toKobo(amount, "naira");
		} catch {
			return c.json(
				{ error_description: "Invalid amount", error_code: "INTERNAL_ERROR" },
				400,
			);
		}
		const currentBalance = wallet?.balance ?? 0;

		if (type === "win" && amountInKobo > 0) {
			// A payout must correspond to a bet we actually debited. Free-spin /
			// jackpot types are exempt (they legitimately have no cash bet).
			const priorBet = await db.query.slotitegrationTransactions.findFirst({
				where: round_id
					? and(
							eq(schema.slotitegrationTransactions.userId, playerId),
							eq(schema.slotitegrationTransactions.roundId, round_id),
							eq(schema.slotitegrationTransactions.type, "bet"),
						)
					: and(
							eq(schema.slotitegrationTransactions.userId, playerId),
							eq(schema.slotitegrationTransactions.sessionId, sessionId),
							eq(schema.slotitegrationTransactions.type, "bet"),
						),
			});
			if (!priorBet) {
				return c.json(
					{
						error_description: "No bet found for this win",
						error_code: "INTERNAL_ERROR",
					},
					200,
				);
			}
		}

		const txId = crypto.randomUUID();
		const settle = await settleSlotTransaction({
			db,
			direction: "credit",
			playerId,
			amountKobo: amountInKobo,
			currentBalanceKobo: currentBalance,
			claim: {
				id: txId,
				transactionId,
				userId: playerId,
				type: type,
				amount: amountInKobo,
				balanceBefore: currentBalance,
				balanceAfter: currentBalance,
				currency,
				gameId: gameUuid,
				sessionId,
				roundId: round_id,
			},
			walletTxnType: "credit",
			walletMetadata: {
				game: "slotegrator",
				gameId: gameUuid,
				sessionId,
				action: "win",
			},
		});

		if (settle.status === "duplicate") {
			const [dupWallet] = await db
				.select()
				.from(schema.wallet)
				.where(eq(schema.wallet.userId, playerId))
				.limit(1);
			const balance = (dupWallet?.balance ?? 0) / 100;
			return c.json({ balance, transaction_id: settle.existing.id }, 200);
		}

		if (settle.status === "wallet_failed") {
			return c.json(
				{
					error_description: "Failed to update wallet",
					error_code: "INTERNAL_ERROR",
				},
				200,
			);
		}

		const balance = settle.balanceKobo / 100;

		await reportCasinoBetResultInBackground({
			env: c.env,
			executionCtx: optionalExecutionCtx(c),
			userId: playerId,
			betId: transactionId,
			totalWinAmount: amount,
			isWin: 1,
		});

		return c.json({ balance, transaction_id: txId }, 200);
	}

	if (action === "refund") {
		const playerId = params.get("player_id") || "";
		const amount = Number.parseFloat(params.get("amount") || "0");
		const currency = params.get("currency") || "NGN";
		const gameUuid = params.get("game_uuid") || "";
		const transactionId = params.get("transaction_id") || "";
		const sessionId = params.get("session_id") || "";
		const betTransactionId = params.get("bet_transaction_id") || "";
		const type = params.get("type") || "refund";
		const round_id = params.get("round_id");

		console.log("REFUND");

		if (
			!playerId ||
			isNaN(amount) ||
			!transactionId ||
			!betTransactionId ||
			!sessionId
		) {
			return c.json(
				{
					error_description: "Missing required fields",
					error_code: "INTERNAL_ERROR",
				},
				200,
			);
		}

		const playerExists = await validatePlayer(playerId);
		if (!playerExists) {
			return c.json(
				{ error_description: "Player not found", error_code: "INTERNAL_ERROR" },
				200,
			);
		}

		const existingTx = await db.query.slotitegrationTransactions.findFirst({
			where: eq(schema.slotitegrationTransactions.transactionId, transactionId),
		});
		console.log("existing transaction", JSON.stringify(existingTx));

		if (existingTx) {
			const [wallet] = await db
				.select()
				.from(schema.wallet)
				.where(eq(schema.wallet.userId, playerId))
				.limit(1);
			const balance = (wallet?.balance ?? 0) / 100;
			return c.json({ balance, transaction_id: existingTx.id }, 200);
		}

		const existingRefundForBet =
			await db.query.slotitegrationTransactions.findFirst({
				where: and(
					eq(schema.slotitegrationTransactions.type, "refund"),
					eq(
						schema.slotitegrationTransactions.originalTransactionId,
						betTransactionId,
					),
				),
			});

		if (existingRefundForBet) {
			const [wallet] = await db
				.select()
				.from(schema.wallet)
				.where(eq(schema.wallet.userId, playerId))
				.limit(1);
			const balance = (wallet?.balance ?? 0) / 100;
			return c.json({ balance, transaction_id: existingRefundForBet.id }, 200);
		}

		const originalBet = await db.query.slotitegrationTransactions.findFirst({
			where: eq(
				schema.slotitegrationTransactions.transactionId,
				betTransactionId,
			),
		});

		console.log("originalBet", JSON.stringify(originalBet));

		if (!originalBet || originalBet.type !== "bet") {
			// No cash bet to reverse — record a tracking row (no wallet movement),
			// still claimed on transactionId so retries dedupe.
			const txId = crypto.randomUUID();
			const [walletForRefund] = await db
				.select()
				.from(schema.wallet)
				.where(eq(schema.wallet.userId, playerId))
				.limit(1);
			const refundWalletBalance = walletForRefund?.balance ?? 0;

			const settle = await settleSlotTransaction({
				db,
				direction: "none",
				playerId,
				amountKobo: 0,
				currentBalanceKobo: refundWalletBalance,
				claim: {
					id: txId,
					transactionId,
					userId: playerId,
					type: type,
					amount: 0,
					balanceBefore: refundWalletBalance,
					balanceAfter: refundWalletBalance,
					currency,
					gameId: gameUuid,
					sessionId,
					roundId: round_id,
				},
				walletTxnType: "refund",
				walletMetadata: {},
			});

			const balance = refundWalletBalance / 100;
			const txnId =
				settle.status === "duplicate" ? settle.existing.id : txId;
			return c.json({ balance, transaction_id: txnId }, 200);
		}

		const [wallet] = await db
			.select()
			.from(schema.wallet)
			.where(eq(schema.wallet.userId, playerId))
			.limit(1);

		// SECURITY: refund exactly the stake we debited for the original bet.
		// The request body's amount is caller-controlled and must never set
		// the payout.
		const amountInKobo = originalBet.amount;
		const currentBalance = wallet?.balance ?? 0;

		// Claim key is derived from the ORIGINAL bet id, so a bet can only ever
		// be refunded once even if the provider retries with fresh
		// transaction_ids. Exact retries are echoed by the
		// `existingRefundForBet` lookup above.
		const txId = crypto.randomUUID();
		const settle = await settleSlotTransaction({
			db,
			direction: "credit",
			playerId,
			amountKobo: amountInKobo,
			currentBalanceKobo: currentBalance,
			claim: {
				id: txId,
				transactionId: `refund:${betTransactionId}`,
				userId: playerId,
				type: type,
				amount: amountInKobo,
				balanceBefore: currentBalance,
				balanceAfter: currentBalance,
				currency,
				gameId: gameUuid,
				sessionId,
				originalTransactionId: betTransactionId,
				roundId: round_id,
			},
			walletTxnType: "refund",
			walletMetadata: {
				game: "slotegrator",
				gameId: gameUuid,
				sessionId,
				action: "settlement",
				originalTransactionId: betTransactionId,
				providerTransactionId: transactionId,
			},
		});

		if (settle.status === "duplicate") {
			const [dupWallet] = await db
				.select()
				.from(schema.wallet)
				.where(eq(schema.wallet.userId, playerId))
				.limit(1);
			const balance = (dupWallet?.balance ?? 0) / 100;
			return c.json({ balance, transaction_id: settle.existing.id }, 200);
		}

		if (settle.status === "wallet_failed") {
			return c.json(
				{
					error_description: "Failed to update wallet",
					error_code: "INTERNAL_ERROR",
				},
				200,
			);
		}

		const balance = settle.balanceKobo / 100;

		await reportCasinoBetResultInBackground({
			env: c.env,
			executionCtx: optionalExecutionCtx(c),
			userId: playerId,
			betId: betTransactionId || transactionId,
			totalWinAmount: amountInKobo / 100,
			isWin: 0,
			isRollback: 1,
		});

		return c.json({ balance, transaction_id: txId }, 200);
	}

	if (action === "rollback") {
		console.log("params", params);
		const playerId = params.get("player_id") || "";
		const currency = params.get("currency") || "NGN";
		const gameUuid = params.get("game_uuid") || "";
		const transactionId = params.get("transaction_id") || "";
		const sessionId = params.get("session_id") || "";
		const roundId = params.get("round_id");

		console.log("ROLLBACK");
		console.log("all params entries:", [...params.entries()]);

		const rollbackTransactions: Array<{
			action: string;
			amount: string;
			transaction_id: string;
			type: string;
		}> = [];

		const paramsEntries = [...params.entries()];
		const txKeys = paramsEntries.filter(([key]) =>
			key.startsWith("rollback_transactions["),
		);

		txKeys.forEach(([key]) => {
			const match = key.match(/rollback_transactions\[(\d+)\]\[(\w+)\]/);
			if (match?.[1] !== undefined && match[2] !== undefined) {
				const index = Number.parseInt(match[1], 10);
				const field = match[2];
				if (!rollbackTransactions[index]) {
					rollbackTransactions[index] = {} as never;
				}
				const value = params.get(key);
				if (value !== null) {
					(rollbackTransactions[index] as Record<string, string>)[field] =
						value;
				}
			}
		});

		console.log("rollback transactions parsed:", rollbackTransactions);

		if (
			!playerId ||
			!transactionId ||
			!sessionId ||
			!rollbackTransactions.length
		) {
			return c.json(
				{
					error_description: "Missing required fields",
					error_code: "INTERNAL_ERROR",
				},
				200,
			);
		}

		const playerExists = await validatePlayer(playerId);
		if (!playerExists) {
			return c.json(
				{ error_description: "Player not found", error_code: "INTERNAL_ERROR" },
				200,
			);
		}

		const existingTx = await db.query.slotitegrationTransactions.findFirst({
			where: eq(schema.slotitegrationTransactions.transactionId, transactionId),
		});

		if (existingTx) {
			const [wallet] = await db
				.select()
				.from(schema.wallet)
				.where(eq(schema.wallet.userId, playerId))
				.limit(1);
			const balance = (wallet?.balance ?? 0) / 100;
			return c.json(
				{
					balance,
					transaction_id: existingTx.id,
					rollback_transactions: rollbackTransactions.map(
						(rollbackT) => rollbackT.transaction_id,
					),
				},
				200,
			);
		}

		const [wallet] = await db
			.select()
			.from(schema.wallet)
			.where(eq(schema.wallet.userId, playerId))
			.limit(1);

		if (!wallet) {
			return c.json(
				{ error_description: "Wallet not found", error_code: "INTERNAL_ERROR" },
				200,
			);
		}

		// Claim-first per rolled-back transaction: a unique
		// `rollback:{originalTxId}` marker guarantees each transaction can only
		// be reversed once, even across rollback requests with different
		// transaction_ids. Adjustments use STORED amounts/types — the request
		// body's amounts are caller-controlled and never move money.
		const rolledBackTxIds: string[] = [];
		const claimedMarkerTxIds: string[] = [];
		let netAdjustment = 0;

		for (const tx of rollbackTransactions) {
			const txId = tx.transaction_id;
			const txToRollback = await db.query.slotitegrationTransactions.findFirst({
				where: eq(schema.slotitegrationTransactions.transactionId, txId),
			});

			if (!txToRollback) continue;
			if (
				txToRollback.type !== "bet" &&
				txToRollback.type !== "win" &&
				txToRollback.type !== "refund"
			) {
				continue;
			}

			const markerTransactionId = `rollback:${txId}`;
			try {
				await db.insert(schema.slotitegrationTransactions).values({
					id: crypto.randomUUID(),
					transactionId: markerTransactionId,
					userId: playerId,
					type: "rollback",
					amount: txToRollback.amount,
					balanceBefore: wallet.balance,
					balanceAfter: wallet.balance,
					currency,
					gameId: gameUuid,
					sessionId,
					originalTransactionId: txId,
					roundId,
				});
			} catch (error) {
				if (isUniqueConstraintError(error)) {
					// Already rolled back by an earlier request — skip.
					continue;
				}
				throw error;
			}

			claimedMarkerTxIds.push(markerTransactionId);
			rolledBackTxIds.push(txId);
			netAdjustment +=
				txToRollback.type === "bet"
					? txToRollback.amount
					: -txToRollback.amount;
		}

		const releaseMarkers = async () => {
			for (const markerTransactionId of claimedMarkerTxIds) {
				await db
					.delete(schema.slotitegrationTransactions)
					.where(
						eq(
							schema.slotitegrationTransactions.transactionId,
							markerTransactionId,
						),
					);
			}
		};

		let currentBalance = wallet.balance;
		if (netAdjustment !== 0) {
			const updatedWallet =
				netAdjustment > 0
					? await creditWallet(db, playerId, netAdjustment)
					: await debitWallet(db, playerId, -netAdjustment);

			if (!updatedWallet) {
				await releaseMarkers();
				return c.json(
					{
						error_description: "Failed to update wallet",
						error_code: "INTERNAL_ERROR",
					},
					200,
				);
			}
			currentBalance = updatedWallet.balance;
		}

		logMoneyMovement({
			provider: "slotegrator",
			action: "rollback",
			userId: playerId,
			txId: transactionId,
			roundId,
			amountKobo: netAdjustment,
			claimStatus: "settled",
			balanceBefore: wallet.balance,
			balanceAfter: currentBalance,
		});

		if (netAdjustment !== 0) {
			await db.insert(schema.walletTransaction).values({
				id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
				userId: playerId,
				amount: Math.abs(netAdjustment),
				type: netAdjustment > 0 ? "refund" : "debit",
				reference: `slotegrator:rollback:${transactionId}`,
				status: "success",
				paymentMethod: "slotegrator games",
				balance: currentBalance,
				metadata: JSON.stringify({
					game: "slotegrator",
					action: "reset",
					rolledBackTxIds,
				}),
			});
		}

		const txId = crypto.randomUUID();

		try {
			await db.insert(schema.slotitegrationTransactions).values({
				id: txId,
				transactionId,
				userId: playerId,
				type: "rollback",
				amount: 0,
				balanceBefore: wallet.balance,
				balanceAfter: currentBalance,
				currency,
				gameId: gameUuid,
				sessionId,
				roundId,
			});
		} catch (error) {
			if (!isUniqueConstraintError(error)) {
				throw error;
			}
			// A concurrent identical rollback recorded the summary first; the
			// markers above guarantee no transaction was reversed twice.
		}

		const [finalWallet] = await db
			.select()
			.from(schema.wallet)
			.where(eq(schema.wallet.userId, playerId))
			.limit(1);

		const balance = (finalWallet?.balance ?? 0) / 100;

		await reportCasinoBetResultInBackground({
			env: c.env,
			executionCtx: optionalExecutionCtx(c),
			userId: playerId,
			betId: transactionId,
			totalWinAmount: 0,
			isWin: 0,
			isRollback: 1,
		});

		return c.json(
			{ balance, transaction_id: txId, rollback_transactions: rolledBackTxIds },
			200,
		);
	}

	return c.json(
		{ error_description: "Unknown action", error_code: "UNKNOWN_ACTION" },
		200,
	);
});

export default slotegratorRoute;
