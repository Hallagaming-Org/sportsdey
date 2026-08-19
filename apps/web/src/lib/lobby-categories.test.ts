import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	canonicalLobbySlug,
	overlayScorpioLobbyCategories,
} from "./lobby-categories";

describe("lobby categories", () => {
	it("maps legacy crash and table slugs onto Casino tabs", () => {
		assert.equal(canonicalLobbySlug("crashgames"), "crash-games");
		assert.equal(canonicalLobbySlug("crash-games"), "crash-games");
		assert.equal(canonicalLobbySlug("table_card_games"), "tablecardgames");
		assert.equal(canonicalLobbySlug("tablecardgames"), "tablecardgames");
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
			overlaid[0]?.categories.some((c) => c.slug === "crash-games"),
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
});
