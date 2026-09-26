import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	httpsCatalogImageUrl,
	mapInBatches,
	mapScorpioCatalogGames,
	resolveScorpioCatalogImage,
} from "./scorpio-catalog";

describe("scorpio catalog mapping", () => {
	it("upgrades http thumbnails to https", () => {
		assert.equal(
			httpsCatalogImageUrl("http://cdn.example/game.png"),
			"https://cdn.example/game.png",
		);
		assert.equal(httpsCatalogImageUrl("/relative.png"), null);
	});

	it("reads nested provider image maps", () => {
		assert.equal(
			resolveScorpioCatalogImage({
				mobile: { squareTile: "https://cdn.example/tile.png" },
			}),
			"https://cdn.example/tile.png",
		);
	});

	it("drops games without an id or name", () => {
		const mapped = mapScorpioCatalogGames(
			{ providerId: 7, providerName: "Pragmatic" },
			[
				{ gameID: "vs20olympgate", gameName: "Gates of Olympus" },
				{ gameID: "missing-name" },
				{ gameName: "No id" },
			],
		);
		assert.equal(mapped.length, 1);
		assert.equal(mapped[0]?.gameId, "vs20olympgate");
		assert.equal(mapped[0]?.providerName, "Pragmatic");
	});

	it("maps batches without dropping results", async () => {
		const values = await mapInBatches([1, 2, 3, 4, 5], 2, async (n) => n * 2);
		assert.deepEqual(values, [2, 4, 6, 8, 10]);
	});
});
