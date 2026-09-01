import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	normalizeNigerianPhone,
	phoneNumberLookupValues,
} from "./nigerian-phone";

describe("normalizeNigerianPhone", () => {
	it("accepts local 0… and +234… as the same E.164", () => {
		assert.equal(normalizeNigerianPhone("08012345678"), "+2348012345678");
		assert.equal(normalizeNigerianPhone("09012345678"), "+2349012345678");
		assert.equal(normalizeNigerianPhone("+2348012345678"), "+2348012345678");
		assert.equal(normalizeNigerianPhone("2348012345678"), "+2348012345678");
		assert.equal(normalizeNigerianPhone("8012345678"), "+2348012345678");
		assert.equal(
			normalizeNigerianPhone("+234 801 234 5678"),
			"+2348012345678",
		);
	});

	it("accepts country code + local leading 0 (common mistake)", () => {
		assert.equal(normalizeNigerianPhone("+23408012345678"), "+2348012345678");
		assert.equal(normalizeNigerianPhone("23409012345678"), "+2349012345678");
	});

	it("rejects invalid Nigerian mobiles", () => {
		assert.equal(normalizeNigerianPhone(""), null);
		assert.equal(normalizeNigerianPhone("0123456789"), null);
		assert.equal(normalizeNigerianPhone("12345"), null);
		assert.equal(normalizeNigerianPhone("abc"), null);
	});
});

describe("phoneNumberLookupValues", () => {
	it("includes E.164, digits, and local forms", () => {
		const values = phoneNumberLookupValues("+2348012345678");
		assert.ok(values.includes("+2348012345678"));
		assert.ok(values.includes("2348012345678"));
		assert.ok(values.includes("08012345678"));
	});
});
