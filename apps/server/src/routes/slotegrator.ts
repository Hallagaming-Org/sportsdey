import { OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { Context } from "hono";
import * as schema from "@/db/schema";
import type { CloudflareBindings } from "../types";

type SlotitegrationContext = {
	Bindings: CloudflareBindings;
};

const slotegratorRoute = new OpenAPIHono<SlotitegrationContext>();

/**
 * @openapi
 * /slotegrator/launch:
 *   post:
 *     summary: Initialize a Slotegrator game session
 *     description: Creates a game session and returns a launch URL for the player
 *     tags:
 *       - Slotegrator
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - game_uuid
 *             properties:
 *               game_uuid:
 *                 type: string
 *               device:
 *                 type: string
 *               return_url:
 *                 type: string
 *               language:
 *                 type: string
 *               lobby_data:
 *                 type: string
 *     responses:
 *       200:
 *         description: Game launch URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error
 */
slotegratorRoute.post("/launch", async (c) => {
	const rawBody = await c.req.text();

	const merchantKey = c.env.SLOTITEGRATION_MERCHANT_KEY;
	const merchantId = c.env.SLOTITEGRATION_MERCHANT_ID;

	if (!merchantKey || !merchantId) {
		return c.json(
			{
				name: "Validation Exception",
				message: "Server configuration error",
				code: 0,
				status: 500,
			},
			500,
		);
	}

	const user = c.get("user");
	if (!user) {
		return c.json(
			{
				name: "Validation Exception",
				message: "Unauthorized",
				code: 0,
				status: 401,
			},
			401,
		);
	}

	let body: Record<string, unknown>;
	try {
		body = JSON.parse(rawBody);
	} catch {
		return c.json(
			{
				name: "Validation Exception",
				message: "Invalid JSON body",
				code: 0,
				status: 422,
			},
			422,
		);
	}

	const gameUuid = body.game_uuid as string;
	const device = body.device as string | undefined;
	const returnUrl = body.return_url as string | undefined;
	const language = body.language as string | undefined;
	const lobbyData = body.lobby_data as string | undefined;

	if (!gameUuid) {
		return c.json(
			{
				name: "Validation Exception",
				message: "Invalid request parameters",
				code: 0,
				status: 422,
			},
			422,
		);
	}

	const db = drizzle(c.env.DB, { schema });

	const [wallet] = await db
		.select()
		.from(schema.wallet)
		.where(eq(schema.wallet.userId, user.id))
		.limit(1);

	const currency = "NGN";

	const sessionToken = crypto.randomUUID();

	await db.insert(schema.slotitegrationSessions).values({
		sessionId: sessionToken,
		userId: user.id,
		currency: currency,
		status: "active",
	});

	const slotegratorApiUrl = c.env.SLOTEGRATOR_API_URL;
	if (!slotegratorApiUrl) {
		return c.json(
			{
				name: "Validation Exception",
				message: "API URL not configured",
				code: 0,
				status: 500,
			},
			500,
		);
	}

	const requestBody: Record<string, string> = {
		game_uuid: gameUuid,
		player_id: user.id,
		player_name: user.name || user.id,
		currency: currency,
		session_id: sessionToken,
	};
	if (device) requestBody.device = device;
	if (returnUrl) requestBody.return_url = returnUrl;
	if (language) requestBody.language = language;
	if (lobbyData) requestBody.lobby_data = lobbyData;

	const timestamp = Math.floor(Date.now() / 1000).toString();
	const nonce = crypto.randomUUID();

	const allParams: Record<string, string> = {
		...requestBody,
		"X-Merchant-Id": merchantId,
		"X-Timestamp": timestamp,
		"X-Nonce": nonce,
	};

	const sortedKeys = Object.keys(allParams).sort();
	const queryString = sortedKeys
		.map((key) => `${key}=${allParams[key]}`)
		.join("&");

	const cryptoMod = await import("crypto");
	const computedSign = cryptoMod
		.createHmac("sha1", merchantKey)
		.update(queryString)
		.digest("hex");

	const response = await fetch(slotegratorApiUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			"X-Merchant-Id": merchantId,
			"X-Timestamp": timestamp,
			"X-Nonce": nonce,
			"X-Sign": computedSign,
		},
		body: requestBody.toString(),
	});

	const data = await response.json();
	return c.json(data, response.status);
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
	if (!verification.valid) {
		return c.json(
			{
				error: verification.error || "Invalid signature",
				code: "SIGNATURE_ERROR",
			},
			403,
		);
	}

	const receivedMerchantId = c.req.header("X-Merchant-Id");
	if (receivedMerchantId !== merchantId) {
		return c.json(
			{ error: "Invalid merchant ID", code: "MERCHANT_ERROR" },
			403,
		);
	}

	let body: Record<string, unknown>;
	try {
		body = JSON.parse(rawBody);
	} catch {
		return c.json({ error: "Invalid JSON body", code: "PARSE_ERROR" }, 400);
	}

	const action = body.action as string;

	if (action === "balance") {
		const playerId = body.player_id as string;

		if (!playerId) {
			return c.json(
				{ error: "Missing player_id", code: "INVALID_REQUEST" },
				400,
			);
		}

		const db = drizzle(c.env.DB, { schema });

		const [wallet] = await db
			.select()
			.from(schema.wallet)
			.where(eq(schema.wallet.userId, playerId))
			.limit(1);

		const balance = wallet?.balance ?? 0;

		return c.json(balance, 200);
	}

	if (action === "bet") {
		const playerId = body.player_id as string;
		const amount = body.amount as number;
		const currency = (body.currency as string) || "NGN";
		const gameUuid = body.game_uuid as string;
		const transactionId = body.transaction_id as string;
		const sessionId = body.session_id as string;
		const type = (body.type as string) || "bet";

		if (!playerId || !amount || !transactionId || !sessionId) {
			return c.json(
				{ error: "Missing required fields", code: "INVALID_REQUEST" },
				400,
			);
		}

		const db = drizzle(c.env.DB, { schema });

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
			return c.json({ balance, transaction_id: transactionId }, 200);
		}

		const [wallet] = await db
			.select()
			.from(schema.wallet)
			.where(eq(schema.wallet.userId, playerId))
			.limit(1);

		const amountInKobo = Math.round(amount * 100);

		if (!wallet || wallet.balance < amountInKobo) {
			return c.json(
				{ error: "Insufficient balance", code: "INSUFFICIENT_BALANCE" },
				403,
			);
		}

		const newBalance = wallet.balance - amountInKobo;

		await db
			.update(schema.wallet)
			.set({ balance: newBalance })
			.where(eq(schema.wallet.userId, playerId));

		const txId = crypto.randomUUID();

		await db.insert(schema.slotitegrationTransactions).values({
			id: txId,
			transactionId,
			userId: playerId,
			type: type,
			amount: amountInKobo,
			currency,
			gameId: gameUuid,
			sessionId,
		});

		const balance = newBalance / 100;

		return c.json({ balance, transaction_id: transactionId }, 200);
	}

	return c.json({ error: "Unknown action", code: "UNKNOWN_ACTION" }, 400);
});

export default slotegratorRoute;
