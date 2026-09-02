import crypto from "node:crypto";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { createPalmPayOrder, queryPalmPayOrder, verifyPalmPay } from "@/lib/palmpay/client";
import type { CloudflareBindings } from "../types";

const route = new OpenAPIHono<{ Bindings: CloudflareBindings }>();
const Input = z.object({ amount: z.number().finite().min(100).max(9_999_999) });
const ErrorSchema = z.object({ success: z.literal(false), error: z.string() });

route.openapi(createRoute({ method: "post", path: "/initiate", tags: ["PalmPay"], summary: "Initiate a PalmPay bank-transfer deposit", security: [{ BearerAuth: [] }], request: { body: { content: { "application/json": { schema: Input } } } }, responses: { 200: { description: "Order created" }, 400: { description: "Invalid request" }, 401: { description: "Unauthorized" }, 500: { description: "Provider error", content: { "application/json": { schema: ErrorSchema } } } } }), async (c) => {
	const user = c.get("user"); if (!user) return c.json({ success: false as const, error: "Unauthorized" }, 401);
	const input = Input.safeParse(await c.req.json()); if (!input.success) return c.json({ success: false as const, error: "Minimum PalmPay deposit is ₦100" }, 400);
	if (!c.env.PALMPAY_APP_ID || !c.env.PALMPAY_MERCHANT_PRIVATE_KEY || !c.env.PALMPAY_PLATFORM_PUBLIC_KEY) return c.json({ success: false as const, error: "PalmPay is not configured" }, 500);
	const db = drizzle(c.env.DB, { schema }); const reference = `palm_${crypto.randomUUID()}`; const amount = Math.round(input.data.amount * 100);
	try {
		await db.insert(schema.palmpayTransaction).values({ id: `palmtxn_${crypto.randomUUID()}`, userId: user.id, reference, amount, status: "initiated", createdAt: new Date(), updatedAt: new Date() });
		await db.insert(schema.walletTransaction).values({ id: `wtxn_${crypto.randomUUID()}`, userId: user.id, amount, type: "credit", reference, status: "pending", paymentMethod: "palmpay", createdAt: new Date() });
		const order = await createPalmPayOrder(c.env, { reference, amount, userId: user.id, mobile: user.mobileNumber ?? undefined });
		await db.update(schema.palmpayTransaction).set({ status: "pending", orderNo: order.orderNo, checkoutUrl: order.checkoutUrl, updatedAt: new Date() }).where(eq(schema.palmpayTransaction.reference, reference));
		return c.json({ success: true as const, data: { checkoutUrl: order.checkoutUrl, reference } }, 200);
	} catch (error) {
		console.error("PalmPay deposit initiation failed", { operation: "create_order", reason: error instanceof Error ? error.name : "UnknownError" });
		await db.update(schema.palmpayTransaction).set({ status: "failed", updatedAt: new Date() }).where(eq(schema.palmpayTransaction.reference, reference));
		await db.update(schema.walletTransaction).set({ status: "failed" }).where(eq(schema.walletTransaction.reference, reference));
		return c.json({ success: false as const, error: "Unable to start PalmPay deposit" }, 500);
	}
});

route.openapi(createRoute({ method: "post", path: "/webhook", tags: ["PalmPay"], summary: "PalmPay payment callback", responses: { 200: { description: "Acknowledged" }, 400: { description: "Invalid callback" } } }), async (c) => {
	const payload = await c.req.json().catch(() => null) as Record<string, unknown> | null;
	if (!payload || typeof payload.sign !== "string" || !c.env.PALMPAY_PLATFORM_PUBLIC_KEY) return c.text("invalid", 400);
	const { sign, ...signedFields } = payload;
	if (!verifyPalmPay(signedFields as Record<string, string | number | undefined>, sign, c.env.PALMPAY_PLATFORM_PUBLIC_KEY)) return c.text("invalid", 400);
	const reference = typeof payload.orderId === "string" ? payload.orderId : ""; if (!reference) return c.text("invalid", 400);
	const db = drizzle(c.env.DB, { schema }); const [txn] = await db.select().from(schema.palmpayTransaction).where(eq(schema.palmpayTransaction.reference, reference)).limit(1);
	if (!txn || txn.status === "success") return c.text("success");
	try {
		const current = await queryPalmPayOrder(c.env, reference);
		if (current.orderStatus !== 2 || current.amount !== txn.amount) return c.text("success");
		await c.env.DB.batch([
			c.env.DB.prepare("UPDATE wallet SET balance = balance + ? WHERE user_id = ? AND EXISTS (SELECT 1 FROM palmpay_transaction WHERE id = ? AND status != 'success')").bind(txn.amount, txn.userId, txn.id),
			c.env.DB.prepare("UPDATE wallet_transaction SET status = 'success', balance = (SELECT balance FROM wallet WHERE user_id = ?) WHERE reference = ? AND status = 'pending'").bind(txn.userId, reference),
			c.env.DB.prepare("UPDATE palmpay_transaction SET status = 'success', raw_callback_payload = ?, updated_at = ? WHERE id = ? AND status != 'success'").bind(JSON.stringify({ orderId: payload.orderId, orderNo: payload.orderNo, orderStatus: payload.orderStatus }), Date.now(), txn.id),
		]);
	} catch (error) { console.error("PalmPay callback confirmation failed", { operation: "query_order_status", reason: error instanceof Error ? error.name : "UnknownError" }); return c.text("retry", 500); }
	return c.text("success");
});

export default route;
