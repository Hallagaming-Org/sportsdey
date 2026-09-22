import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import {
	queryParamsToCanonicalJSON,
	toCanonicalJSON,
} from "./canonical-json";
import {
	hmacSha256Hex,
	signCanonicalPayload,
	verifyQuerySignature,
	verifyRawBodySignature,
} from "./sign";

const DOCUMENTED_CREATE_GAME = {
	cID: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
	extCID: "your_ext_id",
	gameID: "sg_catch_97",
	demo: true,
	returnURL: "https://your-site.com/game-lobby",
	platform: "desktop",
	currency: "USD",
	locale: "en_us",
};

const DOCUMENTED_CANONICAL =
	'{"cID":"a1b2c3d4-e5f6-7890-abcd-ef1234567890","currency":"USD","demo":true,"extCID":"your_ext_id","gameID":"sg_catch_97","locale":"en_us","platform":"desktop","returnURL":"https://your-site.com/game-lobby"}';

const NESTED_CANONICAL =
	'{"currency":"USD","gameID":"sg_catch_97","user":{"firstName":"John","id":"ext_user_456","nickName":"player123"}}';

describe("Swipe Games canonical JSON", () => {
	it("matches the documented create-new-game example byte-for-byte", () => {
		assert.equal(toCanonicalJSON(DOCUMENTED_CREATE_GAME), DOCUMENTED_CANONICAL);
	});

	it("sorts nested object keys as in the documented nested example", () => {
		const nested = {
			gameID: "sg_catch_97",
			currency: "USD",
			user: {
				nickName: "player123",
				id: "ext_user_456",
				firstName: "John",
			},
		};
		assert.equal(toCanonicalJSON(nested), NESTED_CANONICAL);
	});

	it("builds GET /balance canonical JSON from query params", () => {
		assert.equal(
			queryParamsToCanonicalJSON({
				sessionID: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
			}),
			'{"sessionID":"a1b2c3d4-e5f6-7890-abcd-ef1234567890"}',
		);
	});

	it("does not escape slashes or add whitespace", () => {
		assert.ok(DOCUMENTED_CANONICAL.includes("https://your-site.com/game-lobby"));
		assert.equal(toCanonicalJSON({ a: 1, b: 2 }), '{"a":1,"b":2}');
	});
});

describe("Swipe Games HMAC-SHA256 signing", () => {
	const key = "your-api-token-here";

	it("round-trips the documented JS algorithm (node:crypto createHmac)", async () => {
		const ours = await hmacSha256Hex(key, DOCUMENTED_CANONICAL);
		const documented = createHmac("sha256", key)
			.update(DOCUMENTED_CANONICAL)
			.digest("hex");
		assert.equal(ours, documented);
		assert.match(ours, /^[0-9a-f]{64}$/);
	});

	it("signs outbound payload and verifies the same key + body", async () => {
		const { canonicalJSON, signature } = await signCanonicalPayload(
			key,
			DOCUMENTED_CREATE_GAME,
		);
		assert.equal(canonicalJSON, DOCUMENTED_CANONICAL);
		const raw = new TextEncoder().encode(canonicalJSON);
		assert.equal(await verifyRawBodySignature(key, raw, signature), true);
		assert.equal(await verifyRawBodySignature(key, raw, "00".repeat(32)), false);
		assert.equal(await verifyRawBodySignature("other-key", raw, signature), false);
	});

	it("verifies GET /balance against canonical query JSON", async () => {
		const params = { sessionID: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" };
		const canonical = queryParamsToCanonicalJSON(params);
		const signature = createHmac("sha256", key).update(canonical).digest("hex");
		assert.equal(await verifyQuerySignature(key, params, signature), true);
		assert.equal(
			await verifyQuerySignature(key, { sessionID: "other" }, signature),
			false,
		);
	});
});
