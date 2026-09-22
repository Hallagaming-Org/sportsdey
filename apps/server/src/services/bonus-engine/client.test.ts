import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	extractBonusEngineMessage,
	isBonusEngineEnvelopeFailure,
	readBonusEngineEnvelopeStatus,
} from "./client";

describe("readBonusEngineEnvelopeStatus", () => {
	it("returns the numeric vendor status", () => {
		assert.equal(readBonusEngineEnvelopeStatus({ status: 411 }), 411);
	});

	it("returns null when status is missing or not a number", () => {
		assert.equal(readBonusEngineEnvelopeStatus(null), null);
		assert.equal(readBonusEngineEnvelopeStatus("PLAYER_NOT_FOUND"), null);
		assert.equal(readBonusEngineEnvelopeStatus({ message: "ok" }), null);
		assert.equal(readBonusEngineEnvelopeStatus({ status: "411" }), null);
	});
});

describe("isBonusEngineEnvelopeFailure", () => {
	it("treats HTTP-200 PLAYER_NOT_FOUND envelopes as failure", () => {
		assert.equal(
			isBonusEngineEnvelopeFailure({
				status: 411,
				data: {},
				message: "PLAYER_NOT_FOUND",
			}),
			true,
		);
	});

	it("treats success:false as failure", () => {
		assert.equal(isBonusEngineEnvelopeFailure({ success: false }), true);
	});

	it("accepts vendor success envelopes", () => {
		assert.equal(
			isBonusEngineEnvelopeFailure({
				status: 200,
				message: "Player logged in successfully",
			}),
			false,
		);
		assert.equal(isBonusEngineEnvelopeFailure({ success: true, data: [] }), false);
		assert.equal(isBonusEngineEnvelopeFailure({ accessToken: "jwt" }), false);
	});

	it("returns false for non-objects", () => {
		assert.equal(isBonusEngineEnvelopeFailure(null), false);
		assert.equal(isBonusEngineEnvelopeFailure("error"), false);
	});
});

describe("extractBonusEngineMessage", () => {
	it("prefers nested error.message then message", () => {
		assert.equal(
			extractBonusEngineMessage(
				{ error: { message: "PLAYER_NOT_FOUND" } },
				"fallback",
			),
			"PLAYER_NOT_FOUND",
		);
		assert.equal(
			extractBonusEngineMessage({ error: "invalid" }, "fallback"),
			"invalid",
		);
		assert.equal(
			extractBonusEngineMessage({ message: "Access token has been generated...!" }, "fallback"),
			"Access token has been generated...!",
		);
		assert.equal(extractBonusEngineMessage({}, "fallback"), "fallback");
	});
});
