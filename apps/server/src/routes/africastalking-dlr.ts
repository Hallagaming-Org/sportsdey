import { OpenAPIHono } from "@hono/zod-openapi";
import {
	buildWebengageDsn,
	dsnSentKey,
	getSmsKv,
	getWebengageSmsMapping,
	isFinalAtStatus,
	parseAtDeliveryReport,
	sendWebengageDsn,
	SMS_MAPPING_TTL_SECONDS,
} from "@/utils/webengage-dlr";
import { timingSafeEqualString } from "@/utils/webengage-sms-auth";
import type { CloudflareBindings } from "../types";

const africastalkingDlrRoute = new OpenAPIHono<{
	Bindings: CloudflareBindings;
}>();

/**
 * Africa's Talking SMS delivery-report callback.
 *
 * AT POSTs form-urlencoded {id, status, phoneNumber, networkCode,
 * failureReason, retryCount} and retries on non-2xx. AT has no signed
 * callbacks, so the dashboard callback URL must embed our shared secret:
 *   https://<api-host>/webhooks/africastalking/dlr?secret=<AT_DLR_SECRET>
 *
 * We relay final statuses to WebEngage as DSNs (see utils/webengage-dlr.ts)
 * and answer 200 for everything we consciously drop, so AT only retries
 * when a retry can actually help (WebEngage temporarily unreachable).
 */
africastalkingDlrRoute.post("/dlr", async (c) => {
	const expectedSecret = c.env.AT_DLR_SECRET?.trim();
	if (!expectedSecret) {
		console.error("AT DLR webhook: AT_DLR_SECRET is not configured");
		return c.text("Unauthorized", 401);
	}
	const providedSecret =
		c.req.query("secret")?.trim() ||
		c.req.header("X-Callback-Secret")?.trim() ||
		"";
	if (!providedSecret || !timingSafeEqualString(providedSecret, expectedSecret)) {
		return c.text("Unauthorized", 401);
	}

	let form: Record<string, unknown>;
	try {
		form = await c.req.parseBody();
	} catch (error) {
		console.error("AT DLR webhook: unparsable body", error);
		return c.text("OK", 200);
	}

	const report = parseAtDeliveryReport(form);
	if (!report) {
		console.error("AT DLR webhook: missing id/status in payload", form);
		return c.text("OK", 200);
	}

	if (!isFinalAtStatus(report.status)) {
		// Sent/Submitted/Buffered/Queued: a final report follows.
		return c.text("OK", 200);
	}

	const kv = getSmsKv(c.env);
	if (!kv) {
		console.error(
			"AT DLR webhook: no KV binding available; cannot map AT id",
			{ atMessageId: report.id, status: report.status },
		);
		return c.text("OK", 200);
	}

	// AT retries callbacks; skip if this report was already relayed.
	const alreadySent = await kv.get(dsnSentKey(report.id));
	if (alreadySent) {
		return c.text("OK", 200);
	}

	const mapping = await getWebengageSmsMapping(kv, report.id);
	if (!mapping) {
		console.warn("AT DLR webhook: no WebEngage mapping for AT message", {
			atMessageId: report.id,
			status: report.status,
			phoneNumber: report.phoneNumber,
		});
		return c.text("OK", 200);
	}

	const dsn = buildWebengageDsn(report, mapping);
	if (!dsn) {
		return c.text("OK", 200);
	}

	const dsnUrl = c.env.WEBENGAGE_DSN_URL?.trim();
	if (!dsnUrl) {
		console.error(
			"AT DLR webhook: WEBENGAGE_DSN_URL is not configured; DSN dropped",
			{ atMessageId: report.id, weMessageId: mapping.weMessageId },
		);
		return c.text("OK", 200);
	}

	const result = await sendWebengageDsn(dsnUrl, dsn);
	if (!result.ok) {
		console.error("AT DLR webhook: WebEngage DSN relay failed", {
			atMessageId: report.id,
			weMessageId: mapping.weMessageId,
			status: result.status,
			error: result.error,
		});
		// Non-2xx makes AT retry the callback later; dedupe marker is not
		// written, so the retry will attempt the relay again.
		return c.text("DSN relay failed", 502);
	}

	await kv.put(dsnSentKey(report.id), "1", {
		expirationTtl: SMS_MAPPING_TTL_SECONDS,
	});
	return c.text("OK", 200);
});

export default africastalkingDlrRoute;
