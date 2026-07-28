import assert from "node:assert/strict";
import { describe, it, mock, afterEach } from "node:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import webengageSmsRoute from "../routes/webengage-sms";
import { WebEngageSmsRequestSchema } from "../schemas/webengage-sms";
import { normalizeSmsPhoneNumber } from "./africastalking";
import { verifyWebengageSmsSecret } from "./webengage-sms-auth";

const SECRET = "test-webengage-secret";

function testEnv(overrides: Record<string, string> = {}) {
	return {
		WEBENGAGE_API_SECRET: SECRET,
		AFRICASTALKING_API_KEY: "at-key",
		AFRICASTALKING_USERNAME: "at-user",
		AFRICASTALKING_SENDER_ID: "SPORTSDEY",
		...overrides,
	};
}

function mountApp() {
	const app = new OpenAPIHono();
	app.route("/webhooks/webengage", webengageSmsRoute);
	return app;
}

const validPayload = {
	version: "1.0",
	smsData: {
		toNumber: "2348012345678",
		fromNumber: "SPORTSDEY",
		body: "Hello from WebEngage test",
	},
	metadata: {
		campaignType: "TRANSACTIONAL",
		messageId: "we-msg-test-1",
		timestamp: "2018-01-25T10:24:16+0000",
	},
};

describe("verifyWebengageSmsSecret", () => {
	it("accepts Bearer and X-WebEngage-Secret", () => {
		assert.equal(
			verifyWebengageSmsSecret({
				expectedSecret: SECRET,
				authorizationHeader: `Bearer ${SECRET}`,
			}),
			true,
		);
		assert.equal(
			verifyWebengageSmsSecret({
				expectedSecret: SECRET,
				xWebEngageSecretHeader: SECRET,
			}),
			true,
		);
	});

	it("rejects missing or wrong secrets", () => {
		assert.equal(
			verifyWebengageSmsSecret({
				expectedSecret: SECRET,
			}),
			false,
		);
		assert.equal(
			verifyWebengageSmsSecret({
				expectedSecret: SECRET,
				authorizationHeader: "Bearer wrong",
			}),
			false,
		);
		assert.equal(
			verifyWebengageSmsSecret({
				expectedSecret: undefined,
				authorizationHeader: `Bearer ${SECRET}`,
			}),
			false,
		);
	});
});

describe("normalizeSmsPhoneNumber", () => {
	it("normalizes Nigerian local and international formats", () => {
		assert.equal(normalizeSmsPhoneNumber("08012345678"), "+2348012345678");
		assert.equal(normalizeSmsPhoneNumber("2348012345678"), "+2348012345678");
		assert.equal(normalizeSmsPhoneNumber("+2348012345678"), "+2348012345678");
	});

	it("rejects empty or invalid values", () => {
		assert.equal(normalizeSmsPhoneNumber(""), null);
		assert.equal(normalizeSmsPhoneNumber("abc"), null);
	});
});

describe("WebEngageSmsRequestSchema", () => {
	it("accepts WebEngage SSP v1 payload", () => {
		const parsed = WebEngageSmsRequestSchema.parse(validPayload);
		assert.equal(parsed.smsData.body, "Hello from WebEngage test");
	});

	it("rejects missing smsData", () => {
		assert.throws(() =>
			WebEngageSmsRequestSchema.parse({ version: "1.0" }),
		);
	});
});

describe("POST /webhooks/webengage/sms", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
		mock.restoreAll();
	});

	it("returns 401 when Authorization is missing", async () => {
		const app = mountApp();
		const res = await app.request(
			"/webhooks/webengage/sms",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(validPayload),
			},
			testEnv(),
		);
		assert.equal(res.status, 401);
		const json = (await res.json()) as { status: string; statusCode: number };
		assert.equal(json.status, "sms_rejected");
		assert.equal(json.statusCode, 2011);
	});

	it("returns 401 when secret is wrong", async () => {
		const app = mountApp();
		const res = await app.request(
			"/webhooks/webengage/sms",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer not-the-secret",
				},
				body: JSON.stringify(validPayload),
			},
			testEnv(),
		);
		assert.equal(res.status, 401);
	});

	it("returns 401 when WEBENGAGE_API_SECRET is unset", async () => {
		const app = mountApp();
		const res = await app.request(
			"/webhooks/webengage/sms",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${SECRET}`,
				},
				body: JSON.stringify(validPayload),
			},
			testEnv({ WEBENGAGE_API_SECRET: "" }),
		);
		assert.equal(res.status, 401);
	});

	it("returns 400 for invalid payload after auth", async () => {
		const app = mountApp();
		const res = await app.request(
			"/webhooks/webengage/sms",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${SECRET}`,
				},
				body: JSON.stringify({ version: "1.0" }),
			},
			testEnv(),
		);
		assert.equal(res.status, 400);
		const json = (await res.json()) as { status: string };
		assert.equal(json.status, "sms_rejected");
	});

	it("accepts SMS when Africa's Talking is mocked successful", async () => {
		globalThis.fetch = mock.fn(async () => {
			return new Response(
				JSON.stringify({
					SMSMessageData: {
						Message: "Sent",
						Recipients: [
							{
								statusCode: 100,
								number: "+2348012345678",
								status: "Success",
								messageId: "ATXid_mock",
							},
						],
					},
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		}) as typeof fetch;

		const app = mountApp();
		const res = await app.request(
			"/webhooks/webengage/sms",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${SECRET}`,
				},
				body: JSON.stringify(validPayload),
			},
			testEnv(),
		);

		assert.equal(res.status, 200);
		const json = (await res.json()) as { status: string };
		assert.equal(json.status, "sms_accepted");

		const fetchMock = globalThis.fetch as unknown as {
			mock: {
				callCount: () => number;
				calls: Array<{ arguments: unknown[] }>;
			};
		};
		assert.equal(fetchMock.mock.callCount(), 1);

		const call = fetchMock.mock.calls[0];
		assert.ok(call);
		const url = String(call.arguments[0]);
		assert.match(url, /api\.africastalking\.com\/version1\/messaging\/bulk/);
		const init = call.arguments[1] as RequestInit;
		const headers = init.headers as Record<string, string>;
		assert.equal(headers.apiKey, "at-key");
		const body = JSON.parse(String(init.body)) as {
			username: string;
			phoneNumbers: string[];
			message: string;
			senderId: string;
		};
		assert.equal(body.username, "at-user");
		assert.deepEqual(body.phoneNumbers, ["+2348012345678"]);
		assert.equal(body.message, "Hello from WebEngage test");
		assert.equal(body.senderId, "SPORTSDEY");
	});

	it("accepts X-WebEngage-Secret header", async () => {
		globalThis.fetch = mock.fn(async () => {
			return new Response(
				JSON.stringify({
					SMSMessageData: {
						Recipients: [
							{
								statusCode: 101,
								number: "+2348012345678",
								status: "Success",
							},
						],
					},
				}),
				{ status: 200 },
			);
		}) as typeof fetch;

		const app = mountApp();
		const res = await app.request(
			"/webhooks/webengage/sms",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-WebEngage-Secret": SECRET,
				},
				body: JSON.stringify(validPayload),
			},
			testEnv(),
		);
		assert.equal(res.status, 200);
		assert.equal(((await res.json()) as { status: string }).status, "sms_accepted");
	});
});
