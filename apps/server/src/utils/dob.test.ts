import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDobInput } from "./dob";

describe("parseDobInput", () => {
	it("accepts ISO and DD/MM/YYYY", () => {
		assert.deepEqual(parseDobInput("1998-04-12"), {
			ok: true,
			value: "1998-04-12",
		});
		assert.deepEqual(parseDobInput("12/04/1998"), {
			ok: true,
			value: "1998-04-12",
		});
	});

	it("rejects under-18 and invalid dates", () => {
		const thisYear = new Date().getUTCFullYear();
		assert.equal(parseDobInput(`${thisYear}-01-01`).ok, false);
		assert.equal(parseDobInput("31/02/1990").ok, false);
		assert.equal(parseDobInput("not-a-date").ok, false);
	});

	it("treats empty as clear and omitted as no-op", () => {
		assert.deepEqual(parseDobInput(""), { ok: true, value: null });
		assert.deepEqual(parseDobInput(undefined), { ok: true, value: undefined });
	});
});
