import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	isD1CapacityError,
	isD1MissingColumnError,
	isD1MissingTableError,
} from "./d1-errors";

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

describe("isD1MissingColumnError", () => {
	it("detects D1 schema drift on a selected column", () => {
		const error = new Error("D1_ERROR: no such column: game_transactions.round_id");
		assert.equal(isD1MissingColumnError(error), true);
	});

	it("returns false for quota failures", () => {
		assert.equal(
			isD1MissingColumnError(new Error("daily row read limit [code: 7500]")),
			false,
		);
	});
});

describe("isD1MissingTableError", () => {
	it("detects a missing table", () => {
		assert.equal(
			isD1MissingTableError(new Error("D1_ERROR: no such table: user_phone_number")),
			true,
		);
	});

	it("returns false for missing columns", () => {
		assert.equal(
			isD1MissingTableError(new Error("no such column: game_transactions.round_id")),
			false,
		);
	});
});
