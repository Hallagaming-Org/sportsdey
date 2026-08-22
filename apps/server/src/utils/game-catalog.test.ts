import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collapseGamesByCode } from "./game-catalog";

const base = {
	name: "Lagos Rush",
	code: "LAGOSRUSH",
	imageUrl: null,
	createdAt: "2026-01-01T00:00:00.000+01:00",
	categories: [] as { id: string; name: string; slug: string }[],
};

describe("collapseGamesByCode", () => {
	it("keeps a single row as-is", () => {
		const games = [
			{
				...base,
				id: "a",
				enabled: true,
				updatedAt: "2026-01-02T00:00:00.000+01:00",
			},
		];
		assert.equal(collapseGamesByCode(games).length, 1);
		assert.equal(collapseGamesByCode(games)[0]?.id, "a");
	});

	it("prefers a disabled duplicate so a kill-switch sticks", () => {
		const games = [
			{
				...base,
				id: "enabled-new",
				enabled: true,
				updatedAt: "2026-08-20T00:00:00.000+01:00",
			},
			{
				...base,
				id: "disabled-old",
				enabled: false,
				updatedAt: "2026-01-01T00:00:00.000+01:00",
			},
		];
		const collapsed = collapseGamesByCode(games);
		assert.equal(collapsed.length, 1);
		assert.equal(collapsed[0]?.id, "disabled-old");
		assert.equal(collapsed[0]?.enabled, false);
	});

	it("unions categories from duplicate rows", () => {
		const games = [
			{
				...base,
				id: "a",
				enabled: true,
				updatedAt: "2026-01-01T00:00:00.000+01:00",
				categories: [{ id: "1", name: "Others", slug: "others" }],
			},
			{
				...base,
				id: "b",
				enabled: true,
				updatedAt: "2026-02-01T00:00:00.000+01:00",
				categories: [
					{ id: "2", name: "crash-games", slug: "crash-games" },
				],
			},
		];
		const collapsed = collapseGamesByCode(games);
		assert.equal(collapsed[0]?.id, "b");
		assert.deepEqual(
			collapsed[0]?.categories.map((c) => c.slug).sort(),
			["crash-games", "others"],
		);
	});
});
