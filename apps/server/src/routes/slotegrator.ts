import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { creditWallet, debitWallet } from "@/db/atomic-wallet";
import * as schema from "@/db/schema";
import {
	optionalExecutionCtx,
	reportCasinoBetInBackground,
} from "@/services/bonus-engine";
import { verifySlotitegrationSignature } from "@/utils";
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
		console.log("rawBody", rawBody);
		const urlSearchParams = new URLSearchParams(rawBody);
		const bodyParams: Record<string, string> = Object.fromEntries(
			urlSearchParams.entries(),
		) as Record<string, string>;
		bodyParams.action === "rollback" && console.log("ROLLBACK");
		return c.json(
			{
				error_description: verification.error || "Invalid signature",
				error_code: "INTERNAL_ERROR",
			},
			200,
		);
	}

	const receivedMerchantId = c.req.header("X-Merchant-Id");
	if (receivedMerchantId !== merchantId) {
		return c.json(
			{
				error_description: "Invalid merchant ID",
				error_code: "INTERNAL_ERROR",
			},
			200,
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

		const amountInKobo = Math.round(amount * 100);

		if (!wallet || wallet.balance < amountInKobo) {
			return c.json(
				{
					error_description: "Insufficient balance",
					error_code: "INSUFFICIENT_FUNDS",
				},
				200,
			);
		}

		const updatedWallet = await debitWallet(db, playerId, amountInKobo);

		if (!updatedWallet) {
			return c.json(
				{
					error_description: "Failed to update wallet",
					error_code: "INTERNAL_ERROR",
				},
				200,
			);
		}
		const newBalance = updatedWallet.balance;

		const [walletTxn] = await db
			.insert(schema.walletTransaction)
			.values({
				id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
				userId: playerId,
				amount: amountInKobo,
				type: "debit",
				reference: null,
				status: "success",
				paymentMethod: "slotegrator games",
				balance: newBalance,
				metadata: JSON.stringify({
					game: "slotegrator",
					gameId: gameUuid,
					sessionId,
					action: "bet",
				}),
			})
			.returning();

		if (!walletTxn?.id) {
			return c.json(
				{
					error_description: "Failed to record wallet transaction",
					error_code: "INTERNAL_ERROR",
				},
				200,
			);
		}

		const txId = crypto.randomUUID();

		const [betTxn] = await db
			.insert(schema.slotitegrationTransactions)
			.values({
				id: txId,
				transactionId,
				userId: playerId,
				type: type,
				amount: amountInKobo,
				balanceBefore: wallet.balance,
				balanceAfter: newBalance,
				currency,
				gameId: gameUuid,
				sessionId,
				roundId: round_id,
			})
			.returning();

		if (!betTxn?.id) {
			return c.json(
				{
					error_description: "Failed to record bet transaction",
					error_code: "INTERNAL_ERROR",
				},
				200,
			);
		}

		const balance = newBalance / 100;

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

		const amountInKobo = Math.round(amount * 100);
		const currentBalance = wallet?.balance ?? 0;

		const updatedWallet = await creditWallet(db, playerId, amountInKobo);

		if (!updatedWallet) {
			return c.json(
				{
					error_description: "Failed to update wallet",
					error_code: "INTERNAL_ERROR",
				},
				200,
			);
		}
		const newBalance = updatedWallet.balance;

		const [walletTxn] = await db
			.insert(schema.walletTransaction)
			.values({
				id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
				userId: playerId,
				amount: amountInKobo,
				type: "credit",
				reference: null,
				status: "success",
				paymentMethod: "slotegrator games",
				balance: newBalance,
				metadata: JSON.stringify({
					game: "slotegrator",
					gameId: gameUuid,
					sessionId,
					action: "win",
				}),
			})
			.returning();

		if (!walletTxn?.id) {
			return c.json(
				{
					error_description: "Failed to record wallet transaction",
					error_code: "INTERNAL_ERROR",
				},
				200,
			);
		}

		const txId = crypto.randomUUID();

		const [winTxn] = await db
			.insert(schema.slotitegrationTransactions)
			.values({
				id: txId,
				transactionId,
				userId: playerId,
				type: type,
				amount: amountInKobo,
				balanceBefore: currentBalance,
				balanceAfter: newBalance,
				currency,
				gameId: gameUuid,
				sessionId,
				roundId: round_id,
			})
			.returning();

		if (!winTxn?.id) {
			return c.json(
				{
					error_description: "Failed to record win transaction",
					error_code: "INTERNAL_ERROR",
				},
				200,
			);
		}

		const balance = newBalance / 100;

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
			const txId = crypto.randomUUID();
			const amountInKobo = Math.round(amount * 100);
			const [walletForRefund] = await db
				.select()
				.from(schema.wallet)
				.where(eq(schema.wallet.userId, playerId))
				.limit(1);
			const refundWalletBalance = walletForRefund?.balance ?? 0;

			const [refundTxn] = await db
				.insert(schema.slotitegrationTransactions)
				.values({
					id: txId,
					transactionId,
					userId: playerId,
					type: type,
					amount: amountInKobo,
					balanceBefore: refundWalletBalance,
					balanceAfter: refundWalletBalance,
					currency,
					gameId: gameUuid,
					sessionId,
					roundId: round_id,
				})
				.returning();

			if (!refundTxn?.id) {
				return c.json(
					{
						error_description: "Failed to record refund transaction",
						error_code: "INTERNAL_ERROR",
					},
					200,
				);
			}
			const balance = refundWalletBalance / 100;
			return c.json({ balance, transaction_id: txId }, 200);
		}

		const [wallet] = await db
			.select()
			.from(schema.wallet)
			.where(eq(schema.wallet.userId, playerId))
			.limit(1);

		const amountInKobo = Math.round(amount * 100);
		const currentBalance = wallet?.balance ?? 0;

		const updatedWallet = await creditWallet(db, playerId, amountInKobo);

		if (!updatedWallet) {
			return c.json(
				{
					error_description: "Failed to update wallet",
					error_code: "INTERNAL_ERROR",
				},
				200,
			);
		}
		const newBalance = updatedWallet.balance;

		const [walletTxn] = await db
			.insert(schema.walletTransaction)
			.values({
				id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
				userId: playerId,
				amount: amountInKobo,
				type: "refund",
				reference: null,
				status: "success",
				paymentMethod: "slotegrator games",
				balance: newBalance,
				metadata: JSON.stringify({
					game: "slotegrator",
					gameId: gameUuid,
					sessionId,
					action: "settlement",
					originalTransactionId: betTransactionId,
				}),
			})
			.returning();

		if (!walletTxn?.id) {
			return c.json(
				{
					error_description: "Failed to record wallet transaction",
					error_code: "INTERNAL_ERROR",
				},
				200,
			);
		}

		const txId = crypto.randomUUID();

		const [settlementTxn] = await db
			.insert(schema.slotitegrationTransactions)
			.values({
				id: txId,
				transactionId,
				userId: playerId,
				type: type,
				amount: amountInKobo,
				balanceBefore: currentBalance,
				balanceAfter: newBalance,
				currency,
				gameId: gameUuid,
				sessionId,
				originalTransactionId: betTransactionId,
				roundId: round_id,
			})
			.returning();

		if (!settlementTxn?.id) {
			return c.json(
				{
					error_description: "Failed to record settlement transaction",
					error_code: "INTERNAL_ERROR",
				},
				200,
			);
		}

		const balance = newBalance / 100;
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

		let currentBalance = wallet.balance;
		const rolledBackTxIds: string[] = [];

		for (const tx of rollbackTransactions) {
			const txId = tx.transaction_id;
			const txToRollback = await db.query.slotitegrationTransactions.findFirst({
				where: eq(schema.slotitegrationTransactions.transactionId, txId),
			});

			if (!txToRollback) continue;

			rolledBackTxIds.push(txId);

			if (tx.type === "bet") {
				currentBalance += Math.round(Number.parseFloat(tx.amount) * 100);
			} else if (tx.type === "win" || tx.type === "refund") {
				currentBalance -= Math.round(Number.parseFloat(tx.amount) * 100);
			}
		}

		const netAdjustment = currentBalance - wallet.balance;
		const updatedWallet =
			netAdjustment >= 0
				? await creditWallet(db, playerId, netAdjustment)
				: await debitWallet(db, playerId, -netAdjustment);

		if (!updatedWallet) {
			return c.json(
				{
					error_description: "Failed to update wallet",
					error_code: "INTERNAL_ERROR",
				},
				200,
			);
		}
		currentBalance = updatedWallet.balance;

		const [walletTxn] = await db
			.insert(schema.walletTransaction)
			.values({
				id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
				userId: playerId,
				amount: Math.abs(currentBalance - (wallet?.balance ?? 0)),
				type: "refund",
				reference: null,
				status: "success",
				paymentMethod: "slotegrator games",
				balance: currentBalance,
				metadata: JSON.stringify({ game: "slotegrator", action: "reset" }),
			})
			.returning();

		if (!walletTxn?.id) {
			return c.json(
				{
					error_description: "Failed to record wallet transaction",
					error_code: "INTERNAL_ERROR",
				},
				200,
			);
		}

		const txId = crypto.randomUUID();

		const [rollbackTxn] = await db
			.insert(schema.slotitegrationTransactions)
			.values({
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
			})
			.returning();

		if (!rollbackTxn?.id) {
			return c.json(
				{
					error_description: "Failed to record rollback transaction",
					error_code: "INTERNAL_ERROR",
				},
				200,
			);
		}

		const [finalWallet] = await db
			.select()
			.from(schema.wallet)
			.where(eq(schema.wallet.userId, playerId))
			.limit(1);

		const balance = (finalWallet?.balance ?? 0) / 100;

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
