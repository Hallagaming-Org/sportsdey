import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	catalogCodesForGame,
	pickCatalogGameName,
} from "./game-display-name";

describe("catalogCodesForGame", () => {
	it("prefixes Scorpio ledger codes with provider id", () => {
		assert.deepEqual(catalogCodesForGame("vs20olympgate", "Scorpio", 12), [
			"vs20olympgate",
			"scorpio:12:vs20olympgate",
		]);
	});

	it("keeps an already-prefixed Scorpio catalog code", () => {
		assert.deepEqual(
			catalogCodesForGame("scorpio:12:vs20olympgate", "Scorpio", 12),
			["scorpio:12:vs20olympgate"],
		);
	});

	it("leaves non-Scorpio codes unchanged", () => {
		assert.deepEqual(catalogCodesForGame("kings-scratch", "Slotegrator"), [
			"kings-scratch",
		]);
	});
});

describe("pickCatalogGameName", () => {
	it("prefers the prefixed Scorpio catalog name", () => {
		const names = new Map<string, string | null>([
			["scorpio:12:vs20olympgate", "Gates of Olympus"],
		]);
		assert.equal(
			pickCatalogGameName(names, "vs20olympgate", "Scorpio", 12),
			"Gates of Olympus",
		);
	});

	it("matches a prefixed catalog row when provider id is missing", () => {
		const names = new Map<string, string | null>([
			["scorpio:4:vs20olympgate", "Gates of Olympus"],
		]);
		assert.equal(
			pickCatalogGameName(names, "vs20olympgate", "Scorpio", null),
			"Gates of Olympus",
		);
	});
});
