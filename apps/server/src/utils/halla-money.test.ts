import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { koboToNaira, nairaToKobo } from "./halla-money";

describe("halla-money Naira ↔ kobo", () => {
	it("converts whole Naira to kobo", () => {
		assert.equal(nairaToKobo(100), 10_000);
		assert.equal(nairaToKobo(1), 100);
		assert.equal(nairaToKobo(10_000), 1_000_000);
		assert.equal(nairaToKobo(0), 0);
	});

	it("converts kobo back to Naira for Halla balance responses", () => {
		assert.equal(koboToNaira(10_000), 100);
		assert.equal(koboToNaira(50_000), 500);
		assert.equal(koboToNaira(1_000_000), 10_000);
		assert.equal(koboToNaira(0), 0);
	});

	it("round-trips typical bet amounts", () => {
		for (const naira of [50, 100, 169, 500, 10_000]) {
			assert.equal(koboToNaira(nairaToKobo(naira)), naira);
		}
	});

	it("simulates debit: ₦100 bet against ₦500 wallet leaves ₦400", () => {
		const walletKobo = nairaToKobo(500);
		const betKobo = nairaToKobo(100);
		assert.ok(walletKobo >= betKobo);
		const afterKobo = walletKobo - betKobo;
		assert.equal(koboToNaira(afterKobo), 400);
		// response to Halla must be Naira, not raw kobo
		assert.notEqual(afterKobo, 400);
		assert.equal(koboToNaira(afterKobo), 400);
	});

	it("simulates credit: ₦50 win on ₦400 wallet → ₦450", () => {
		const walletKobo = nairaToKobo(400);
		const winKobo = nairaToKobo(50);
		const afterKobo = walletKobo + winKobo;
		assert.equal(koboToNaira(afterKobo), 450);
	});

	it("withdrawal of ₦10,000 is unaffected by Halla conversion math", () => {
		// User deposits ₦10,000 → ledger stores kobo
		let walletKobo = nairaToKobo(10_000);
		// Plays: bet ₦100, win ₦50
		walletKobo -= nairaToKobo(100);
		walletKobo += nairaToKobo(50);
		assert.equal(koboToNaira(walletKobo), 9_950);
		// Withdraw remaining ₦9,950 — still whole Naira value
		const withdrawNaira = koboToNaira(walletKobo);
		assert.equal(withdrawNaira, 9_950);
	});
});
