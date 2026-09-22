import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verifyHellodutySecret } from "./helloduty-auth";

const SECRET = "test-helloduty-secret";

describe("verifyHellodutySecret", () => {
	it("accepts Bearer and X-HelloDuty-Secret", () => {
		assert.equal(
			verifyHellodutySecret({
				expectedSecret: SECRET,
				authorizationHeader: `Bearer ${SECRET}`,
			}),
			true,
		);
		assert.equal(
			verifyHellodutySecret({
				expectedSecret: SECRET,
				xHellodutySecretHeader: SECRET,
			}),
			true,
		);
	});

	it("rejects missing, wrong, or unbound secrets", () => {
		assert.equal(verifyHellodutySecret({ expectedSecret: SECRET }), false);
		assert.equal(
			verifyHellodutySecret({
				expectedSecret: SECRET,
				authorizationHeader: "Bearer wrong",
			}),
			false,
		);
		assert.equal(
			verifyHellodutySecret({
				expectedSecret: undefined,
				authorizationHeader: `Bearer ${SECRET}`,
			}),
			false,
		);
		assert.equal(
			verifyHellodutySecret({
				expectedSecret: "   ",
				authorizationHeader: "Bearer    ",
			}),
			false,
		);
	});
});
