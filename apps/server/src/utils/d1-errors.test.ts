import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isD1CapacityError } from "./d1-errors";

describe("isD1CapacityError", () => {
	it("detects cloudflare quota error codes in cause", () => {
		const error = new Error("Failed query") as Error & { cause?: unknown };
		error.cause = "daily row read limit [code: 7500]";
		assert.equal(isD1CapacityError(error), true);
	});

	it("returns false for schema drift errors", () => {
		const error = new Error("Failed query") as Error & { cause?: unknown };
		error.cause = "D1_ERROR: no such column: user.profile_self_edited_at";
		assert.equal(isD1CapacityError(error), false);
	});

	it("returns false for unrelated errors", () => {
		assert.equal(isD1CapacityError(new Error("Invalid password hash")), false);
	});
});
