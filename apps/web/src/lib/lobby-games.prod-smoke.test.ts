import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	excludeScorpioStoredGames,
	isScorpioStoredCode,
	mergeLobbyGames,
	parseScorpioStoredCode,
} from "./lobby-games";

type ProdGame = {
	name: string;
	code: string;
	imageUrl: string | null;
	enabled: boolean;
	categories: { id: string; name: string; slug: string }[];
};

async function fetchProdGames(search: string): Promise<ProdGame[]> {
	const url = `https://api.sportsdey.com/games?search=${encodeURIComponent(search)}`;
	const response = await fetch(url);
	assert.equal(response.ok, true, `GET ${url} failed: ${response.status}`);
	const body = (await response.json()) as {
		success: boolean;
		data: ProdGame[];
	};
	assert.equal(body.success, true);
	return body.data;
}

describe("production lobby smoke", () => {
	it("does not send known Scorpio D1 rows through Slotegrator", async () => {
		const bulky = await fetchProdGames("10 Bulky Fruits");
		const burning = await fetchProdGames("10 Burning Heart");
		const megaways = await fetchProdGames("1 Million Megaways BC");

		const bulkyRow = bulky.find((g) => g.name === "10 Bulky Fruits");
		assert.ok(bulkyRow, "10 Bulky Fruits missing from prod D1");
		assert.ok(
			isScorpioStoredCode(bulkyRow.code),
			`expected scorpio:* code, got ${bulkyRow.code}`,
		);
		assert.deepEqual(parseScorpioStoredCode(bulkyRow.code), {
			providerId: 16,
			gameCode: "619",
		});

		const blankHeart = burning.find(
			(g) => g.name === "10 Burning Heart" && g.imageUrl == null,
		);
		assert.ok(blankHeart, "null-image 10 Burning Heart missing from prod D1");
		assert.ok(isScorpioStoredCode(blankHeart.code));

		const gis = megaways.find((g) => g.name === "1 Million Megaways BC");
		assert.ok(gis);
		assert.equal(isScorpioStoredCode(gis.code), false);

		const catalog = [...bulky, ...burning, ...megaways].map((g) => ({
			id: g.code,
			name: g.name,
			code: g.code,
			imageUrl: g.imageUrl,
			categories: g.categories,
			enabled: g.enabled,
		}));

		const slotegratorOnly = excludeScorpioStoredGames(catalog);
		assert.equal(
			slotegratorOnly.some((g) => g.name === "10 Bulky Fruits"),
			false,
		);
		assert.equal(
			slotegratorOnly.some((g) => g.name === "10 Burning Heart"),
			false,
		);
		assert.equal(
			slotegratorOnly.some((g) => g.name === "1 Million Megaways BC"),
			true,
		);

		const liveScorpio = [
			{
				id: "scorpio:16:619",
				name: "10 Bulky Fruits",
				code: "619",
				imageUrl: "https://example.com/live-619.jpg",
				categories: bulkyRow.categories,
				enabled: true,
				createdAt: 0,
				updatedAt: 0,
				provider: "scorpio" as const,
				providerId: 16,
				providerName: "Amusnet",
			},
			{
				id: "scorpio:2:TBHRSlot",
				name: "10 Burning Heart",
				code: "TBHRSlot",
				imageUrl: "https://example.com/live-heart.jpg",
				categories: blankHeart.categories,
				enabled: true,
				createdAt: 0,
				updatedAt: 0,
				provider: "scorpio" as const,
				providerId: 2,
				providerName: "EGT",
			},
		];

		const merged = mergeLobbyGames(catalog, liveScorpio);
		assert.equal(
			merged.some((g) => g.code.toLowerCase().startsWith("scorpio:")),
			false,
			"merged lobby still contains D1 scorpio:* codes",
		);
		assert.equal(merged.filter((g) => g.name === "10 Bulky Fruits").length, 1);
		const bulkyTile = merged.find((g) => g.name === "10 Bulky Fruits");
		assert.equal(
			bulkyTile && "provider" in bulkyTile && bulkyTile.provider,
			"scorpio",
		);
		assert.equal(bulkyTile?.code, "619");
		assert.equal(bulkyTile?.imageUrl, "https://example.com/live-619.jpg");

		for (const tile of merged.filter((g) => g.name === "10 Burning Heart")) {
			assert.equal("provider" in tile && tile.provider, "scorpio");
		}
		assert.equal(
			merged.some((g) => g.code === gis.code),
			true,
		);
	});
});
