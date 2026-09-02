import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	fixtureTitle,
	looksLikeSportEventId,
	matchDisplayName,
	titleFromCompetitors,
} from "./fixtures";

describe("fixture match titles", () => {
	it("detects DataBet sport event ids so they are never shown as names", () => {
		assert.equal(
			looksLikeSportEventId("46:90228dd3-98c4-45d8-baf0-25bd186c46f0"),
			true,
		);
		assert.equal(looksLikeSportEventId("Croatia vs Latvia"), false);
		assert.equal(looksLikeSportEventId("Unknown match"), false);
	});

	it("prefers fixture.title and falls back to competitor names", () => {
		assert.equal(
			fixtureTitle({
				id: "46:abc",
				fixture: { title: "Croatia vs Latvia" },
			}),
			"Croatia vs Latvia",
		);
		assert.equal(
			titleFromCompetitors([
				{ name: "France", templatePosition: 1 },
				{ name: "Slovenia", templatePosition: 2 },
			]),
			"France vs Slovenia",
		);
		assert.equal(
			fixtureTitle({
				id: "46:abc",
				fixture: {
					title: "46:90228dd3-98c4-45d8-baf0-25bd186c46f0",
					competitors: [
						{ name: "Croatia", templatePosition: 1 },
						{ name: "Latvia", templatePosition: 2 },
					],
				},
			}),
			"Croatia vs Latvia",
		);
	});

	it("never returns a raw match id as the display name", () => {
		assert.equal(
			matchDisplayName(undefined, "46:90228dd3-98c4-45d8-baf0-25bd186c46f0"),
			"Unknown match",
		);
		assert.equal(
			matchDisplayName(
				"46:90228dd3-98c4-45d8-baf0-25bd186c46f0",
				"46:90228dd3-98c4-45d8-baf0-25bd186c46f0",
			),
			"Unknown match",
		);
		assert.equal(
			matchDisplayName(
				"Croatia vs Latvia",
				"46:90228dd3-98c4-45d8-baf0-25bd186c46f0",
			),
			"Croatia vs Latvia",
		);
	});
});
