import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	authorizeHellodutyRequest,
	parseHellodutyAllowedIps,
} from "./helloduty-auth";

describe("authorizeHellodutyRequest", () => {
	it("allows an allowlisted IP", () => {
		assert.equal(
			authorizeHellodutyRequest({
				clientIp: "203.0.113.10",
				allowedIpsRaw: "203.0.113.10, 203.0.113.11",
			}),
			"ok",
		);
		assert.deepEqual(parseHellodutyAllowedIps("203.0.113.10, 203.0.113.11"), [
			"203.0.113.10",
			"203.0.113.11",
		]);
	});

	it("rejects a non-allowlisted IP", () => {
		assert.equal(
			authorizeHellodutyRequest({
				clientIp: "1.2.3.4",
				allowedIpsRaw: "203.0.113.10",
			}),
			"forbidden",
		);
	});

	it("is unconfigured when the allowlist is empty, off, or wildcard", () => {
		for (const allowedIpsRaw of [undefined, "", "   ", "off", "*"]) {
			assert.equal(
				authorizeHellodutyRequest({
					clientIp: "203.0.113.10",
					allowedIpsRaw,
				}),
				"unconfigured",
			);
		}
	});
});
