import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPasswordStrength, validateNewPassword } from "./password";

describe("password rules", () => {
	it("rejects short passwords and missing numbers", () => {
		assert.equal(
			validateNewPassword("secret", "secret"),
			"Password must be at least 8 characters long.",
		);
		assert.equal(
			validateNewPassword("longpassword", "longpassword"),
			"Password must include at least one number.",
		);
		assert.equal(
			validateNewPassword("secret12", "secret13"),
			"Passwords do not match.",
		);
		assert.equal(validateNewPassword("secret12", "secret12"), null);
	});

	it("scores strength like the reset-password meter", () => {
		assert.equal(getPasswordStrength("").score, 0);
		assert.equal(getPasswordStrength("a").label, "Weak");
		assert.ok(getPasswordStrength("secret12").score >= 2);
	});
});
