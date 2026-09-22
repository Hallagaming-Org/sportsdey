import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	betAggregates,
	isDepositTransaction,
	isWithdrawalTransaction,
	kycStatusBoolean,
	toWebengageIso,
	walletTxAggregates,
} from "./webengage-user-profile";

describe("webengage user profile aggregates", () => {
	it("treats approved KYC as boolean true", () => {
		assert.equal(kycStatusBoolean("approved", "pending_review"), true);
		assert.equal(kycStatusBoolean("not_verified", "approved"), true);
		assert.equal(kycStatusBoolean("not_verified", "rejected"), false);
	});

	it("ISO-formats dates for the Users API Date type", () => {
		const iso = toWebengageIso(new Date("2026-08-01T12:00:00.000Z"));
		assert.equal(iso, "2026-08-01T12:00:00.000Z");
		assert.equal(toWebengageIso(null), undefined);
	});

	it("formats date_of_birth for WebEngage birthDate attribute", async () => {
		const { toWebengageBirthDate, buildWebengageUserPayload } = await import(
			"./webengage-event"
		);
		assert.equal(toWebengageBirthDate("1998-04-12"), "1998-04-12");
		assert.equal(toWebengageBirthDate("12/04/1998"), "1998-04-12");
		assert.equal(toWebengageBirthDate(""), undefined);
		const payload = buildWebengageUserPayload({
			userId: "u1",
			date_of_birth: "1998-04-12",
			kyc_status: true,
		});
		assert.equal(payload.birthDate, "1998-04-12");
		assert.deepEqual(payload.attributes, {
			date_of_birth: "1998-04-12",
			kyc_status: true,
		});
	});

	it("counts deposits and withdrawals with the sheet names and number types", () => {
		const stats = walletTxAggregates([
			{
				type: "credit",
				status: "success",
				paymentMethod: "card",
				amount: 10_000,
				createdAt: new Date("2026-08-10T00:00:00.000Z"),
			},
			{
				type: "credit",
				status: "completed",
				paymentMethod: "wallet_transfer",
				amount: 5_000,
				createdAt: new Date("2026-08-11T00:00:00.000Z"),
			},
			{
				type: "debit",
				status: "completed",
				paymentMethod: "paystack",
				amount: 2_000,
				createdAt: new Date("2026-08-12T00:00:00.000Z"),
			},
			{
				type: "debit",
				status: "pending_approval",
				paymentMethod: "paystack",
				amount: 9_000,
				createdAt: new Date("2026-08-13T00:00:00.000Z"),
			},
		]);
		assert.equal(stats.total_deposited, 100);
		assert.equal(stats.deposit_count, 1);
		assert.equal(stats.last_deposit_date, "2026-08-10T00:00:00.000Z");
		assert.equal(stats.total_withdrawn, 20);
		assert.equal(typeof stats.total_deposited, "number");
		assert.equal(typeof stats.deposit_count, "number");
		assert.equal(
			isDepositTransaction({
				type: "credit",
				status: "success",
				paymentMethod: "sportsbook",
			}),
			false,
		);
		assert.equal(
			isWithdrawalTransaction({
				type: "debit",
				status: "completed",
				paymentMethod: "paystack",
			}),
			true,
		);
	});

	it("computes betting user attrs including live ratio and open count", () => {
		const stats = betAggregates([
			{
				betType: 1,
				status: "settled",
				stake: 10_000,
				settleAmount: 15_000,
				createdAt: new Date("2026-08-01T00:00:00.000Z"),
				betData: JSON.stringify({
					bet_odds: [
						{
							meta: {
								sport_event_info_sport_id: "football",
								sport_event_info_tournament_id: "EPL",
							},
						},
					],
				}),
			},
			{
				betType: 9,
				status: "accepted",
				stake: 5_000,
				settleAmount: null,
				createdAt: new Date("2026-08-20T00:00:00.000Z"),
				betData: JSON.stringify({
					bet_odds: [
						{
							meta: {
								sport_event_info_sport_id: "football",
								sport_event_info_tournament_id: "EPL",
							},
						},
					],
				}),
			},
		]);
		assert.equal(stats.total_bets_placed, 2);
		assert.equal(stats.total_amount_wagered, 150);
		assert.equal(stats.total_winnings, 150);
		assert.equal(stats.avg_bet_amount, 75);
		assert.equal(stats.last_bet_date, "2026-08-20T00:00:00.000Z");
		assert.equal(stats.favourite_sport, "football");
		assert.equal(stats.favourite_league, "EPL");
		assert.equal(stats.preferred_bet_type, "single");
		assert.equal(stats.live_bet_ratio, 0.5);
		assert.equal(stats.open_bets_count, 1);
		assert.equal(typeof stats.live_bet_ratio, "number");
		assert.equal(typeof stats.open_bets_count, "number");
	});

	it("keeps the first preferred_bet_type when counts tie", () => {
		const stats = betAggregates([
			{
				betType: 1,
				status: "settled",
				stake: 100,
				settleAmount: 0,
				createdAt: new Date("2026-08-01T00:00:00.000Z"),
				betData: null,
			},
			{
				betType: 9,
				status: "settled",
				stake: 100,
				settleAmount: 0,
				createdAt: new Date("2026-08-02T00:00:00.000Z"),
				betData: null,
			},
		]);
		assert.equal(stats.preferred_bet_type, "single");
	});
});
