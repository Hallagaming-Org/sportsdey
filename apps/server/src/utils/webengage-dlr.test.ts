import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import africastalkingDlrRoute from "../routes/africastalking-dlr";
import type { SmsKvNamespace } from "./webengage-dlr";
import {
	buildWebengageDsn,
	dsnSentKey,
	getWebengageSmsMapping,
	isFinalAtStatus,
	mapAtFailureToWebengageStatusCode,
	parseAtDeliveryReport,
	smsMappingKey,
	storeWebengageSmsMapping,
} from "./webengage-dlr";

const DLR_SECRET = "test-at-dlr-secret";
const DSN_URL = "https://st.example.webengage.com/tracking/privatessp-events";

/** Minimal in-memory stand-in for a KVNamespace. */
function fakeKv() {
	const store = new Map<string, string>();
	return {
		store,
		get: async (key: string, type?: string) => {
			const value = store.get(key) ?? null;
			if (value === null) return null;
			return type === "json" ? JSON.parse(value) : value;
		},
		put: async (key: string, value: string) => {
			store.set(key, value);
		},
	} as unknown as SmsKvNamespace & { store: Map<string, string> };
}

function testEnv(overrides: Record<string, unknown> = {}) {
	return {
		AT_DLR_SECRET: DLR_SECRET,
		WEBENGAGE_DSN_URL: DSN_URL,
		sportsdey_ns: fakeKv(),
		...overrides,
	};
}

function mountApp() {
	const app = new OpenAPIHono();
	app.route("/webhooks/africastalking", africastalkingDlrRoute);
	return app;
}

const mapping = {
	weMessageId: "we-msg-1",
	toNumber: "2348012345678",
	version: "1.0",
};

function dlrRequest(
	form: Record<string, string>,
	opts: { secret?: string } = {},
) {
	const secret = opts.secret ?? DLR_SECRET;
	const qs = secret ? `?secret=${encodeURIComponent(secret)}` : "";
	return new Request(`http://local/webhooks/africastalking/dlr${qs}`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(form).toString(),
	});
}

describe("parseAtDeliveryReport", () => {
	it("parses the documented AT form fields", () => {
		const report = parseAtDeliveryReport({
			id: "ATXid_1",
			status: "Success",
			phoneNumber: "+2348012345678",
			networkCode: "62120",
			failureReason: "",
			retryCount: "0",
		});
		assert.ok(report);
		assert.equal(report.id, "ATXid_1");
		assert.equal(report.status, "Success");
		assert.equal(report.failureReason, undefined);
	});

	it("returns null when id or status is missing", () => {
		assert.equal(parseAtDeliveryReport({ status: "Success" }), null);
		assert.equal(parseAtDeliveryReport({ id: "ATXid_1" }), null);
	});
});

describe("buildWebengageDsn", () => {
	it("maps Success to documented SMS Sent DSN (statusCode 0, no smsCount)", () => {
		const dsn = buildWebengageDsn(
			{ id: "ATXid_1", status: "Success" },
			mapping,
		);
		assert.deepEqual(dsn, {
			version: "1.0",
			messageId: "we-msg-1",
			toNumber: "2348012345678",
			status: "sms_sent",
			statusCode: 0,
		});
		assert.equal(
			dsn && "smsCount" in dsn,
			false,
			"smsCount must be omitted when AT does not provide a segment count",
		);
	});

	it("maps AT InvalidPhoneNumber failure to DSN statusCode 2003", () => {
		const dsn = buildWebengageDsn(
			{
				id: "ATXid_1",
				status: "Failed",
				failureReason: "InvalidPhoneNumber",
			},
			mapping,
		);
		assert.ok(dsn);
		assert.equal(dsn.status, "sms_failed");
		assert.equal(dsn.statusCode, 2003);
		assert.equal(dsn.message, "InvalidPhoneNumber");
	});

	it("maps AT ExceededMaxLength-style failure to DSN statusCode 2007", () => {
		const dsn = buildWebengageDsn(
			{
				id: "ATXid_1",
				status: "Failed",
				failureReason: "MessageTooLong",
			},
			mapping,
		);
		assert.ok(dsn);
		assert.equal(dsn.statusCode, 2007);
	});

	it("maps unknown AT failure to DSN statusCode 9988 with populated message", () => {
		const dsn = buildWebengageDsn(
			{
				id: "ATXid_1",
				status: "Failed",
				failureReason: "AbsentSubscriber",
			},
			mapping,
		);
		assert.ok(dsn);
		assert.equal(dsn.status, "sms_failed");
		assert.equal(dsn.statusCode, 9988);
		assert.ok(dsn.message && dsn.message.length > 0);
		assert.match(dsn.message, /AbsentSubscriber/);
	});

	it("DSN status is only sms_sent or sms_failed for every final AT status", () => {
		const allowed = new Set(["sms_sent", "sms_failed"]);
		for (const status of ["Success", "Failed", "Rejected"]) {
			const dsn = buildWebengageDsn({ id: "ATXid_1", status }, mapping);
			assert.ok(dsn);
			assert.ok(allowed.has(dsn.status), `unexpected DSN status ${dsn.status}`);
			assert.notEqual(dsn.status, "sms_rejected");
		}
	});

	it("returns null for intermediate statuses", () => {
		for (const status of ["Sent", "Submitted", "Buffered", "Queued"]) {
			assert.equal(
				buildWebengageDsn({ id: "ATXid_1", status }, mapping),
				null,
			);
			assert.equal(isFinalAtStatus(status), false);
		}
	});
});

describe("mapAtFailureToWebengageStatusCode", () => {
	it("maps blacklist and insufficient credit to specific codes", () => {
		assert.equal(
			mapAtFailureToWebengageStatusCode({
				status: "Failed",
				failureReason: "UserInBlacklist",
			}).statusCode,
			3000,
		);
		assert.equal(
			mapAtFailureToWebengageStatusCode({
				status: "Failed",
				failureReason: "InsufficientCredit",
			}).statusCode,
			2000,
		);
	});
});

describe("SMS mapping KV round-trip", () => {
	it("stores and retrieves a mapping", async () => {
		const kv = fakeKv();
		await storeWebengageSmsMapping(kv, "ATXid_1", mapping);
		assert.ok(kv.store.has(smsMappingKey("ATXid_1")));
		const loaded = await getWebengageSmsMapping(kv, "ATXid_1");
		assert.deepEqual(loaded, mapping);
	});

	it("returns null for unknown or malformed records", async () => {
		const kv = fakeKv();
		assert.equal(await getWebengageSmsMapping(kv, "missing"), null);
		kv.store.set(smsMappingKey("bad"), JSON.stringify({ nope: true }));
		assert.equal(await getWebengageSmsMapping(kv, "bad"), null);
	});
});

describe("POST /webhooks/africastalking/dlr", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
		mock.restoreAll();
	});

	it("returns 401 for missing or wrong secret", async () => {
		const app = mountApp();
		const wrong = await app.request(
			dlrRequest({ id: "ATXid_1", status: "Success" }, { secret: "nope" }),
			undefined,
			testEnv(),
		);
		assert.equal(wrong.status, 401);

		const missing = await app.request(
			dlrRequest({ id: "ATXid_1", status: "Success" }, { secret: "" }),
			undefined,
			testEnv(),
		);
		assert.equal(missing.status, 401);
	});

	it("returns 401 when AT_DLR_SECRET is unset", async () => {
		const app = mountApp();
		const res = await app.request(
			dlrRequest({ id: "ATXid_1", status: "Success" }),
			undefined,
			testEnv({ AT_DLR_SECRET: "" }),
		);
		assert.equal(res.status, 401);
	});

	it("relays a Success report to WebEngage as sms_sent DSN", async () => {
		globalThis.fetch = mock.fn(
			async () => new Response("", { status: 200 }),
		) as typeof fetch;

		const env = testEnv();
		await storeWebengageSmsMapping(
			env.sportsdey_ns as SmsKvNamespace,
			"ATXid_1",
			mapping,
		);

		const app = mountApp();
		const res = await app.request(
			dlrRequest({
				id: "ATXid_1",
				status: "Success",
				phoneNumber: "+2348012345678",
				retryCount: "0",
			}),
			undefined,
			env,
		);
		assert.equal(res.status, 200);

		const fetchMock = globalThis.fetch as unknown as {
			mock: { callCount: () => number; calls: Array<{ arguments: unknown[] }> };
		};
		assert.equal(fetchMock.mock.callCount(), 1);
		const call = fetchMock.mock.calls[0];
		assert.ok(call);
		assert.equal(String(call.arguments[0]), DSN_URL);
		const init = call.arguments[1] as RequestInit;
		const body = JSON.parse(String(init.body)) as Record<string, unknown>;
		assert.deepEqual(body, {
			version: "1.0",
			messageId: "we-msg-1",
			toNumber: "2348012345678",
			status: "sms_sent",
			statusCode: 0,
		});
		assert.notEqual(body.status, "sms_rejected");
	});

	it("relays a Failed report to WebEngage as sms_failed DSN (never sms_rejected)", async () => {
		globalThis.fetch = mock.fn(
			async () => new Response("", { status: 200 }),
		) as typeof fetch;

		const env = testEnv();
		await storeWebengageSmsMapping(
			env.sportsdey_ns as SmsKvNamespace,
			"ATXid_fail",
			mapping,
		);

		const app = mountApp();
		const res = await app.request(
			dlrRequest({
				id: "ATXid_fail",
				status: "Failed",
				failureReason: "AbsentSubscriber",
			}),
			undefined,
			env,
		);
		assert.equal(res.status, 200);

		const fetchMock = globalThis.fetch as unknown as {
			mock: { callCount: () => number; calls: Array<{ arguments: unknown[] }> };
		};
		assert.equal(fetchMock.mock.callCount(), 1);
		const call = fetchMock.mock.calls[0];
		assert.ok(call);
		const init = call.arguments[1] as RequestInit;
		const body = JSON.parse(String(init.body)) as {
			status: string;
			statusCode: number;
			message?: string;
		};
		assert.equal(body.status, "sms_failed");
		assert.notEqual(body.status, "sms_rejected");
		assert.equal(body.statusCode, 9988);
		assert.ok(body.message && body.message.length > 0);
		assert.match(String(body.message), /AbsentSubscriber|Failed/);
	});

	it("deduplicates retried delivery reports", async () => {
		globalThis.fetch = mock.fn(
			async () => new Response("", { status: 200 }),
		) as typeof fetch;

		const env = testEnv();
		await storeWebengageSmsMapping(
			env.sportsdey_ns as SmsKvNamespace,
			"ATXid_1",
			mapping,
		);

		const app = mountApp();
		const first = await app.request(
			dlrRequest({ id: "ATXid_1", status: "Success" }),
			undefined,
			env,
		);
		assert.equal(first.status, 200);
		const second = await app.request(
			dlrRequest({ id: "ATXid_1", status: "Success" }),
			undefined,
			env,
		);
		assert.equal(second.status, 200);

		const fetchMock = globalThis.fetch as unknown as {
			mock: { callCount: () => number };
		};
		assert.equal(fetchMock.mock.callCount(), 1);
		assert.ok(
			(env.sportsdey_ns as unknown as { store: Map<string, string> }).store.has(
				dsnSentKey("ATXid_1"),
			),
		);
	});

	it("returns 200 and does not call WebEngage when no mapping exists", async () => {
		globalThis.fetch = mock.fn(
			async () => new Response("", { status: 200 }),
		) as typeof fetch;

		const app = mountApp();
		const res = await app.request(
			dlrRequest({ id: "ATXid_unknown", status: "Success" }),
			undefined,
			testEnv(),
		);
		assert.equal(res.status, 200);

		const fetchMock = globalThis.fetch as unknown as {
			mock: { callCount: () => number };
		};
		assert.equal(fetchMock.mock.callCount(), 0);
	});

	it("ignores intermediate statuses without calling WebEngage", async () => {
		globalThis.fetch = mock.fn(
			async () => new Response("", { status: 200 }),
		) as typeof fetch;

		const env = testEnv();
		await storeWebengageSmsMapping(
			env.sportsdey_ns as SmsKvNamespace,
			"ATXid_1",
			mapping,
		);

		const app = mountApp();
		const res = await app.request(
			dlrRequest({ id: "ATXid_1", status: "Buffered" }),
			undefined,
			env,
		);
		assert.equal(res.status, 200);
		const fetchMock = globalThis.fetch as unknown as {
			mock: { callCount: () => number };
		};
		assert.equal(fetchMock.mock.callCount(), 0);
	});

	it("returns 502 when the WebEngage DSN post fails so AT retries", async () => {
		globalThis.fetch = mock.fn(
			async () => new Response("boom", { status: 500 }),
		) as typeof fetch;

		const env = testEnv();
		await storeWebengageSmsMapping(
			env.sportsdey_ns as SmsKvNamespace,
			"ATXid_1",
			mapping,
		);

		const app = mountApp();
		const res = await app.request(
			dlrRequest({ id: "ATXid_1", status: "Failed", failureReason: "AbsentSubscriber" }),
			undefined,
			env,
		);
		assert.equal(res.status, 502);
		// Dedupe marker must NOT be written, so the AT retry relays again.
		assert.equal(
			(env.sportsdey_ns as unknown as { store: Map<string, string> }).store.has(
				dsnSentKey("ATXid_1"),
			),
			false,
		);
	});
});
