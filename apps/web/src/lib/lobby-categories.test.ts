import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	canonicalLobbySlug,
	gameMatchesLobbyCategory,
	overlayScorpioLobbyCategories,
} from "./lobby-categories";

describe("lobby categories", () => {
	it("maps duplicate lobby labels onto a single tab", () => {
		assert.equal(canonicalLobbySlug("crash"), "crash");
		assert.equal(canonicalLobbySlug("Crash"), "crash");
		assert.equal(canonicalLobbySlug("crash-game"), "crash");
		assert.equal(canonicalLobbySlug("crash-games"), "crash");
		assert.equal(canonicalLobbySlug("crashgames"), "crash");
		assert.equal(canonicalLobbySlug("jackpot-slot"), "slots");
		assert.equal(canonicalLobbySlug("jackpot_slot"), "slots");
		assert.equal(canonicalLobbySlug("jackpot"), "jackpot");
		assert.equal(canonicalLobbySlug("lotto"), "lottery");
		assert.equal(canonicalLobbySlug("lottery"), "lottery");
		assert.equal(canonicalLobbySlug("virtuals"), "virtuals");
		assert.equal(canonicalLobbySlug("virtual-sports"), "virtuals");
		assert.equal(canonicalLobbySlug("table_card_games"), "tablecardgames");
		assert.equal(canonicalLobbySlug("tablecardgames"), "tablecardgames");
		assert.equal(canonicalLobbySlug("instant"), "arcade");
		assert.equal(canonicalLobbySlug("instant-games"), "arcade");
	});

	it("treats games tagged with any crash variant as matching Crash", () => {
		const crashGames = {
			categories: [{ id: "1", name: "Crash Games", slug: "crash-games" }],
		};
		const crashGame = {
			categories: [{ id: "2", name: "Crash Game", slug: "crash-game" }],
		};
		const crash = {
			categories: [{ id: "3", name: "Crash", slug: "crash" }],
		};
		const slots = {
			categories: [{ id: "4", name: "Slots", slug: "slots" }],
		};

		assert.equal(gameMatchesLobbyCategory(crashGames, "crash"), true);
		assert.equal(gameMatchesLobbyCategory(crashGame, "crash-games"), true);
		assert.equal(gameMatchesLobbyCategory(crash, "crash-game"), true);
		assert.equal(gameMatchesLobbyCategory(slots, "crash"), false);
	});

	it("folds jackpot-slot into slots and lotto into lottery", () => {
		const jackpotSlot = {
			categories: [{ id: "1", name: "Jackpot Slot", slug: "jackpot-slot" }],
		};
		const lotto = {
			categories: [{ id: "2", name: "Lotto", slug: "lotto" }],
		};
		const jackpot = {
			categories: [{ id: "3", name: "Jackpot", slug: "jackpot" }],
		};

		assert.equal(gameMatchesLobbyCategory(jackpotSlot, "slots"), true);
		assert.equal(gameMatchesLobbyCategory(lotto, "lottery"), true);
		assert.equal(gameMatchesLobbyCategory(jackpot, "slots"), false);
		assert.equal(gameMatchesLobbyCategory(jackpot, "jackpot"), true);

		const instant = {
			categories: [{ id: "4", name: "Instant", slug: "instant" }],
		};
		assert.equal(gameMatchesLobbyCategory(instant, "arcade"), true);
		assert.equal(gameMatchesLobbyCategory(instant, "instant"), true);
	});

	it("counts a game with several crash labels once", () => {
		const game = {
			id: "aviator",
			categories: [
				{ id: "a", name: "Crash", slug: "crash" },
				{ id: "b", name: "Crash Games", slug: "crash-games" },
				{ id: "c", name: "Crash Game", slug: "crash-game" },
			],
		};
		assert.equal(gameMatchesLobbyCategory(game, "crash"), true);
		assert.equal(
			new Set(game.categories.map((c) => canonicalLobbySlug(c.slug))).size,
			1,
		);
	});

	it("unions name and code categories so an others-only duplicate does not win", () => {
		const scorpio = [
			{
				id: "scorpio:1:crash-x",
				name: "Crash X",
				code: "crash-x",
				providerId: 1,
				categories: [{ id: "1", name: "Provider", slug: "provider" }],
			},
		];
		const catalog = [
			{
				name: "Crash X",
				code: "scorpio:1:crash-x",
				categories: [{ id: "others", name: "Others", slug: "others" }],
			},
			{
				name: "Crash X",
				code: "abc",
				categories: [
					{ id: "crash-games", name: "crash-games", slug: "crash-games" },
				],
			},
		];

		const overlaid = overlayScorpioLobbyCategories(scorpio, catalog);
		assert.equal(
			overlaid[0]?.categories.some((c) => c.slug === "crash"),
			true,
		);
	});

	it("overlays D1 categories onto Scorpio by name and falls back to others", () => {
		const scorpio = [
			{
				id: "scorpio:1:unknown",
				name: "Brand New Title",
				code: "unknown",
				providerId: 1,
				categories: [{ id: "1", name: "Provider", slug: "provider" }],
			},
		];
		const catalog = [
			{
				name: "Crash X",
				code: "abc",
				categories: [
					{ id: "crashgames", name: "crash-games", slug: "crash-games" },
				],
			},
		];

		const overlaid = overlayScorpioLobbyCategories(scorpio, catalog);
		assert.equal(
			overlaid[0]?.categories.some((c) => c.slug === "others"),
			true,
		);
	});

	it("fills a missing Scorpio thumbnail from D1", () => {
		const scorpio = [
			{
				id: "scorpio:16:619",
				name: "10 Bulky Fruits",
				code: "619",
				providerId: 16,
				imageUrl: null as string | null,
				categories: [{ id: "16", name: "Amusnet", slug: "amusnet" }],
			},
		];
		const catalog = [
			{
				name: "10 Bulky Fruits",
				code: "scorpio:16:619",
				imageUrl: "https://bucket.sportsdey.com/gdrive-files/10%20Bulky%20Fruits.jpg",
				categories: [{ id: "slots", name: "slots", slug: "slots" }],
			},
		];

		const overlaid = overlayScorpioLobbyCategories(scorpio, catalog);
		assert.equal(
			overlaid[0]?.imageUrl,
			"https://bucket.sportsdey.com/gdrive-files/10%20Bulky%20Fruits.jpg",
		);
		assert.equal(overlaid[0]?.fallbackImageUrl, null);
	});

	it("keeps live Scorpio art and uses D1 R2 as onError fallback", () => {
		const scorpio = [
			{
				id: "scorpio:2:TBHRSlot",
				name: "10 Burning Heart",
				code: "TBHRSlot",
				providerId: 2,
				imageUrl: "https://cdn.example/live-heart.jpg",
				categories: [{ id: "2", name: "EGT", slug: "egt" }],
			},
		];
		const catalog = [
			{
				name: "10 Burning Heart",
				code: "scorpio:2:TBHRSlot",
				imageUrl: "https://bucket.sportsdey.com/gdrive-files/10%20Burning%20Heart.jpg",
			},
		];

		const overlaid = overlayScorpioLobbyCategories(scorpio, catalog);
		assert.equal(overlaid[0]?.imageUrl, "https://cdn.example/live-heart.jpg");
		assert.equal(
			overlaid[0]?.fallbackImageUrl,
			"https://bucket.sportsdey.com/gdrive-files/10%20Burning%20Heart.jpg",
		);
	});

	it("moves Instant-tagged catalog games onto Arcade", () => {
		const scorpio = [
			{
				id: "scorpio:1:aviatrix-mines",
				name: "Aviatrix Mines",
				code: "aviatrix-mines",
				providerId: 1,
				categories: [{ id: "1", name: "Provider", slug: "provider" }],
			},
		];
		const catalog = [
			{
				name: "Aviatrix Mines",
				code: "scorpio:1:aviatrix-mines",
				categories: [{ id: "instant", name: "Instant", slug: "instant" }],
			},
		];

		const overlaid = overlayScorpioLobbyCategories(scorpio, catalog);
		assert.equal(
			overlaid[0]?.categories.some((c) => c.slug === "arcade"),
			true,
		);
		assert.equal(
			overlaid[0]?.categories.some((c) => c.slug === "instant"),
			false,
		);
	});
});
