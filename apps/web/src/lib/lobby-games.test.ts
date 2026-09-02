import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	d1ScorpioFallbackGames,
	excludeScorpioStoredGames,
	mergeLobbyGames,
	parseScorpioStoredCode,
} from "./lobby-games";
import type { ScorpioLobbyGame } from "./scorpio-catalog";

const slots = [{ id: "slots", name: "slots", slug: "slots" }];

function classic(
	partial: Partial<{
		id: string;
		name: string;
		code: string;
		imageUrl: string | null;
		enabled: boolean;
	}> & { name: string; code: string },
) {
	return {
		id: partial.id ?? partial.code,
		name: partial.name,
		code: partial.code,
		imageUrl: partial.imageUrl ?? null,
		categories: slots,
		enabled: partial.enabled ?? true,
	};
}

function scorpio(
	partial: Partial<ScorpioLobbyGame> & {
		name: string;
		code: string;
		providerId: number;
	},
): ScorpioLobbyGame {
	return {
		id: `scorpio:${partial.providerId}:${partial.code}`,
		name: partial.name,
		code: partial.code,
		imageUrl: partial.imageUrl ?? "https://cdn.example/tile.jpg",
		categories: slots,
		enabled: true,
		createdAt: 0,
		updatedAt: 0,
		provider: "scorpio",
		providerId: partial.providerId,
		providerName: "Amusnet",
	};
}

describe("parseScorpioStoredCode", () => {
	it("parses D1 Scorpio codes from production", () => {
		assert.deepEqual(parseScorpioStoredCode("scorpio:16:619"), {
			providerId: 16,
			gameCode: "619",
		});
		assert.deepEqual(parseScorpioStoredCode("scorpio:2:TBHRSlot"), {
			providerId: 2,
			gameCode: "TBHRSlot",
		});
		assert.equal(
			parseScorpioStoredCode("4bc0d67409ba4af3bdab71293794872d"),
			null,
		);
	});
});

describe("mergeLobbyGames", () => {
	it("does not list D1 scorpio:* rows as Slotegrator tiles", () => {
		const bulky = classic({
			name: "10 Bulky Fruits",
			code: "scorpio:16:619",
			imageUrl: "https://amuse-gc.example/619.jpg",
		});
		const megaways = classic({
			name: "1 Million Megaways BC",
			code: "4bc0d67409ba4af3bdab71293794872d",
			imageUrl: "https://gis-static.com/games/x.png",
		});
		const live = scorpio({
			name: "10 Bulky Fruits",
			code: "619",
			providerId: 16,
			imageUrl: "https://amuse-gc.example/live-619.jpg",
		});

		const merged = mergeLobbyGames([bulky, megaways], [live]);
		assert.equal(
			merged.some((g) => g.code === "scorpio:16:619"),
			false,
		);
		assert.equal(merged.filter((g) => g.name === "10 Bulky Fruits").length, 1);
		const bulkyTile = merged.find((g) => g.name === "10 Bulky Fruits");
		assert.equal(
			bulkyTile && "provider" in bulkyTile && bulkyTile.provider,
			"scorpio",
		);
		assert.equal(bulkyTile?.code, "619");
		assert.equal(
			merged.some((g) => g.code === "4bc0d67409ba4af3bdab71293794872d"),
			true,
		);
	});

	it("drops blank D1 EGT copies when live Scorpio has the same game", () => {
		const d1Blank = classic({
			name: "10 Burning Heart",
			code: "scorpio:2:TBHRSlot",
			imageUrl: null,
		});
		const live = scorpio({
			name: "10 Burning Heart",
			code: "TBHRSlot",
			providerId: 2,
			imageUrl: "https://cdn.example/heart.jpg",
		});

		const merged = mergeLobbyGames([d1Blank], [live]);
		assert.equal(merged.length, 1);
		const tile = merged[0];
		assert.ok(tile);
		assert.equal(tile.imageUrl, "https://cdn.example/heart.jpg");
		assert.equal("provider" in tile && tile.provider, "scorpio");
	});

	it("keeps a D1 Scorpio row only when it is missing from the live catalog", () => {
		const onlyInDb = classic({
			name: "10 Alebrijes Eternal",
			code: "scorpio:16:5174",
			imageUrl: "https://amuse-gc.example/5174.jpg",
		});
		const fallback = d1ScorpioFallbackGames([onlyInDb], []);
		assert.equal(fallback.length, 1);
		assert.equal(fallback[0]?.code, "5174");
		assert.equal(fallback[0]?.providerId, 16);
		assert.equal(fallback[0]?.provider, "scorpio");

		const merged = mergeLobbyGames([onlyInDb], []);
		assert.equal(merged.length, 1);
		const tile = merged[0];
		assert.ok(tile);
		assert.equal("provider" in tile && tile.provider, "scorpio");
	});

	it("excludeScorpioStoredGames keeps GIS uuid rows", () => {
		const rows = [
			classic({
				name: "10 Blazing Treasures",
				code: "a0c7a77fc65a45699ae860d61a015f2a",
			}),
			classic({ name: "10 Bulky Fruits", code: "scorpio:16:619" }),
		];
		const kept = excludeScorpioStoredGames(rows);
		assert.equal(kept.length, 1);
		assert.equal(kept[0]?.name, "10 Blazing Treasures");
	});
});
