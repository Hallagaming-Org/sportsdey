import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { koboToNairaDecimal, nairaDecimalToKobo } from "./money";

describe("Swipe Games Naira decimal ↔ kobo", () => {
	it("converts documented main-unit strings without floating point", () => {
		assert.equal(nairaDecimalToKobo("0.90"), 90);
		assert.equal(nairaDecimalToKobo("100.10"), 10_010);
		assert.equal(nairaDecimalToKobo("0"), 0);
		assert.equal(nairaDecimalToKobo("1"), 100);
		assert.equal(nairaDecimalToKobo("1.5"), 150);
	});

	it("formats kobo as two-decimal main-unit strings", () => {
		assert.equal(koboToNairaDecimal(90), "0.90");
		assert.equal(koboToNairaDecimal(10_010), "100.10");
		assert.equal(koboToNairaDecimal(0), "0.00");
		assert.equal(koboToNairaDecimal(100), "1.00");
	});

	it("round-trips typical bet amounts", () => {
		assert.equal(koboToNairaDecimal(nairaDecimalToKobo("0.90")), "0.90");
		assert.equal(koboToNairaDecimal(nairaDecimalToKobo("50.00")), "50.00");
		assert.equal(koboToNairaDecimal(nairaDecimalToKobo("100.10")), "100.10");
		assert.equal(koboToNairaDecimal(nairaDecimalToKobo("1.5")), "1.50");
		assert.equal(koboToNairaDecimal(nairaDecimalToKobo("10000")), "10000.00");
	});

	it("rejects more than two decimal places", () => {
		assert.throws(() => nairaDecimalToKobo("1.234"));
		assert.throws(() => nairaDecimalToKobo("-1"));
		assert.throws(() => nairaDecimalToKobo("01"));
	});
});
