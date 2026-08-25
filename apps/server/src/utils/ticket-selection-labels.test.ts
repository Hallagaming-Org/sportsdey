import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	collectTicketOdds,
	competitorsFromMatchTitle,
	compileTemplate,
	decodeSpecifiers,
	formatOdds,
	formatTicketSelection,
	parseMarketId,
	type MarketDefinition,
} from "./ticket-selection-labels";

const MARKET_20: MarketDefinition = {
	id: 20,
	outcomes: [
		{ name: "1", value: "{$competitor1}" },
		{ name: "2", value: "draw" },
		{ name: "3", value: "{$competitor2}" },
	],
	localizations: [{ locale: "en", template: "1x2" }],
	specifiers: [],
};

const MARKET_201: MarketDefinition = {
	id: 201,
	outcomes: [
		{ name: "1", value: "yes" },
		{ name: "2", value: "no" },
	],
	localizations: [{ locale: "en", template: "Both Teams to Score" }],
	specifiers: [],
};

const MARKET_398: MarketDefinition = {
	id: 398,
	outcomes: [
		{ name: "1", value: "over {total}" },
		{ name: "2", value: "under {total}" },
	],
	localizations: [{ locale: "en", template: "Total goals" }],
	specifiers: [{ name: "total", value: "decimal" }],
};

const MARKET_17: MarketDefinition = {
	id: 17,
	outcomes: [
		{ name: "1", value: "{$competitor1} ({+hcp})" },
		{ name: "2", value: "{$competitor2} ({-hcp})" },
	],
	localizations: [{ locale: "en", template: "Map handicap" }],
	specifiers: [{ name: "hcp", value: "decimal" }],
};

const MARKET_261: MarketDefinition = {
	id: 261,
	outcomes: [
		{ name: "1", value: "{$competitor1} ({+hcp})" },
		{ name: "2", value: "{$competitor2} ({-hcp})" },
	],
	localizations: [{ locale: "en", template: "{!setnr} set - point handicap" }],
	specifiers: [
		{ name: "hcp", value: "decimal" },
		{ name: "setnr", value: "integer" },
	],
};

const MARKET_292: MarketDefinition = {
	id: 292,
	outcomes: [
		{ name: "1", value: "odd" },
		{ name: "2", value: "even" },
	],
	localizations: [{ locale: "en", template: "Odd/Even maps" }],
	specifiers: [],
};

const MARKET_349: MarketDefinition = {
	id: 349,
	outcomes: [
		{ name: "1", value: "2:0" },
		{ name: "2", value: "2:1" },
		{ name: "3", value: "0:2" },
		{ name: "4", value: "1:2" },
	],
	localizations: [{ locale: "en", template: "Correct map score" }],
	specifiers: [],
};

const MARKET_913: MarketDefinition = {
	id: 913,
	outcomes: [
		{ name: "1", value: "over {total}" },
		{ name: "2", value: "under {total}" },
	],
	localizations: [
		{
			locale: "en",
			template: "Map {mapnr} - {variant} - total kills(incl. overtime)",
		},
	],
	specifiers: [
		{ name: "mapnr", value: "integer" },
		{ name: "total", value: "decimal" },
		{ name: "variant", value: "string" },
	],
};

const MARKET_1280: MarketDefinition = {
	id: 1280,
	outcomes: [
		{ name: "1", value: "({+hcp})" },
		{ name: "2", value: "({-hcp})" },
	],
	localizations: [
		{
			locale: "en",
			template:
				"Map {mapnr} - {variant} - Duel of players - Handicap by kills(incl. overtime)",
		},
	],
	specifiers: [
		{ name: "hcp", value: "decimal" },
		{ name: "mapnr", value: "integer" },
		{ name: "variant", value: "string" },
	],
};

const MARKET_1592: MarketDefinition = {
	id: 1592,
	outcomes: [
		{ name: "1", value: "{$competitor1} {score}" },
		{ name: "2", value: "{$competitor2} {score}" },
	],
	localizations: [
		{ locale: "en", template: "Map {mapnr} - Winning margin (incl. overtime)" },
	],
	specifiers: [
		{ name: "mapnr", value: "integer" },
		{ name: "score", value: "variable_text" },
	],
};

const FOREST = "Nottingham Forest vs Leeds United";

describe("ticket selection labels", () => {
	it("splits composite Databet market ids", () => {
		assert.deepEqual(parseMarketId("398t1_5"), {
			typeId: "398",
			encodedSpecifiers: "t1_5",
		});
		assert.deepEqual(parseMarketId("913m3t15_5vlack1"), {
			typeId: "913",
			encodedSpecifiers: "m3t15_5vlack1",
		});
		assert.deepEqual(parseMarketId("201"), {
			typeId: "201",
			encodedSpecifiers: "",
		});
	});

	it("decodes totals, handicaps, ranges, and player variants from real ids", () => {
		assert.deepEqual(
			decodeSpecifiers("t1_5", [{ name: "total", value: "decimal" }]),
			{ total: "1.5" },
		);
		assert.deepEqual(
			decodeSpecifiers("h-1_5s2", [
				{ name: "hcp", value: "decimal" },
				{ name: "setnr", value: "integer" },
			]),
			{ hcp: "-1.5", setnr: "2" },
		);
		assert.deepEqual(
			decodeSpecifiers("m3s5-7", [
				{ name: "mapnr", value: "integer" },
				{ name: "score", value: "variable_text" },
			]),
			{ mapnr: "3", score: "5-7" },
		);
		assert.deepEqual(
			decodeSpecifiers("m3t15_5vlack1", [
				{ name: "mapnr", value: "integer" },
				{ name: "total", value: "decimal" },
				{ name: "variant", value: "string" },
			]),
			{ mapnr: "3", total: "15.5", variant: "lack1" },
		);
		assert.deepEqual(
			decodeSpecifiers("h1_5m3vlack1vschucky", [
				{ name: "hcp", value: "decimal" },
				{ name: "mapnr", value: "integer" },
				{ name: "variant", value: "string" },
			]),
			{ hcp: "1.5", mapnr: "3", variant: "lack1 vs chucky" },
		);
	});

	it("splits fixture titles on vs", () => {
		assert.deepEqual(competitorsFromMatchTitle(FOREST), {
			competitor1: "Nottingham Forest",
			competitor2: "Leeds United",
		});
	});

	it("compiles over/under, ordinals, and signed handicaps", () => {
		assert.equal(
			compileTemplate("over {total}", { specifiers: { total: "1.5" } }),
			"over 1.5",
		);
		assert.equal(
			compileTemplate("{!setnr} set - point handicap", {
				specifiers: { setnr: "2", hcp: "-1.5" },
			}),
			"2nd set - point handicap",
		);
		assert.equal(
			compileTemplate("{$competitor2} ({-hcp})", {
				competitor2: "Leeds United",
				specifiers: { hcp: "-1.5" },
			}),
			"Leeds United (+1.5)",
		);
	});

	it("formats Over and Under for any total line", () => {
		const over15 = formatTicketSelection({
			odd: { odd_id: "1", odd_ratio: "1.300000", market_id: "398t1_5" },
			matchTitle: FOREST,
			marketDef: MARKET_398,
		});
		assert.equal(over15.pick, "Over 1.5");
		const over30 = formatTicketSelection({
			odd: { odd_id: "1", odd_ratio: "1.360000", market_id: "398t3_0" },
			matchTitle: FOREST,
			marketDef: MARKET_398,
		});
		assert.equal(over30.market, "Total goals");
		assert.equal(over30.pick, "Over 3.0");
		const under25 = formatTicketSelection({
			odd: { odd_id: "2", odd_ratio: "1.900000", market_id: "398t2_5" },
			matchTitle: FOREST,
			marketDef: MARKET_398,
		});
		assert.equal(under25.pick, "Under 2.5");
	});

	it("formats BTTS Yes and No", () => {
		assert.equal(
			formatTicketSelection({
				odd: { odd_id: "1", odd_ratio: "1.650000", market_id: "201" },
				matchTitle: FOREST,
				marketDef: MARKET_201,
			}).pick,
			"Yes",
		);
		assert.equal(
			formatTicketSelection({
				odd: { odd_id: "2", odd_ratio: "2.100000", market_id: "201" },
				matchTitle: FOREST,
				marketDef: MARKET_201,
			}).pick,
			"No",
		);
	});

	it("formats 1x2 home, draw, and away from the match title", () => {
		const title = "Carrarese vs Mantova FC";
		assert.equal(
			formatTicketSelection({
				odd: { odd_id: "1", odd_ratio: "2.350000", market_id: "20" },
				matchTitle: title,
				marketDef: MARKET_20,
			}).pick,
			"Carrarese",
		);
		assert.equal(
			formatTicketSelection({
				odd: { odd_id: "2", odd_ratio: "3.200000", market_id: "20" },
				matchTitle: title,
				marketDef: MARKET_20,
			}).pick,
			"Draw",
		);
		assert.equal(
			formatTicketSelection({
				odd: { odd_id: "3", odd_ratio: "2.800000", market_id: "20" },
				matchTitle: title,
				marketDef: MARKET_20,
			}).pick,
			"Mantova FC",
		);
	});

	it("formats handicap, correct score, odd/even, player kills, duel, and winning margin", () => {
		const title = "Team Alpha vs Team Bravo";
		const handicap = formatTicketSelection({
			odd: { odd_id: "2", odd_ratio: "1.850000", market_id: "17h-1_5" },
			matchTitle: title,
			marketDef: MARKET_17,
		});
		assert.equal(handicap.market, "Map handicap");
		assert.equal(handicap.pick, "Team Bravo (+1.5)");

		const setHcp = formatTicketSelection({
			odd: { odd_id: "2", odd_ratio: "1.900000", market_id: "261h-1_5s2" },
			matchTitle: title,
			marketDef: MARKET_261,
		});
		assert.equal(setHcp.market, "2nd set - point handicap");
		assert.equal(setHcp.pick, "Team Bravo (+1.5)");

		assert.equal(
			formatTicketSelection({
				odd: { odd_id: "1", odd_ratio: "3.400000", market_id: "349" },
				matchTitle: title,
				marketDef: MARKET_349,
			}).pick,
			"2:0",
		);
		assert.equal(
			formatTicketSelection({
				odd: { odd_id: "1", odd_ratio: "1.900000", market_id: "292" },
				matchTitle: title,
				marketDef: MARKET_292,
			}).pick,
			"Odd",
		);

		const playerKills = formatTicketSelection({
			odd: {
				odd_id: "2",
				odd_ratio: "1.720000",
				market_id: "913m3t15_5vlack1",
			},
			matchTitle: title,
			marketDef: MARKET_913,
		});
		assert.equal(
			playerKills.market,
			"Map 3 - lack1 - total kills(incl. overtime)",
		);
		assert.equal(playerKills.pick, "Under 15.5");

		const duel = formatTicketSelection({
			odd: {
				odd_id: "2",
				odd_ratio: "1.880000",
				market_id: "1280h1_5m3vlack1vschucky",
			},
			matchTitle: title,
			marketDef: MARKET_1280,
		});
		assert.equal(
			duel.market,
			"Map 3 - lack1 vs chucky - Duel of players - Handicap by kills(incl. overtime)",
		);
		assert.equal(duel.pick, "(-1.5)");

		const margin = formatTicketSelection({
			odd: { odd_id: "1", odd_ratio: "2.100000", market_id: "1592m3s5-7" },
			matchTitle: title,
			marketDef: MARKET_1592,
		});
		assert.equal(margin.pick, "Team Alpha 5-7");
	});

	it("does not invent Market {id} or @odds when dictionary is missing", () => {
		const labels = formatTicketSelection({
			odd: {
				odd_id: "1",
				odd_ratio: "1.300000",
				market_id: "398t1_5",
			},
			matchTitle: FOREST,
			marketDef: null,
		});
		assert.equal(labels.market, null);
		assert.equal(labels.pick, null);
		assert.equal(labels.odds, "1.3");
	});

	it("includes bet-builder legs with regular bet_odds", () => {
		const odds = collectTicketOdds({
			bet_odds: [{ odd_id: "1", market_id: "20", match_id: "m1" }],
			bet_builder_odds: [
				{
					match_id: "m2",
					odds: [
						{ odd_id: "1", market_id: "201", match_id: "m2" },
						{ odd_id: "2", market_id: "398t1_5", match_id: "m2" },
					],
				},
			],
		});
		assert.equal(odds.length, 3);
		assert.equal(odds[1]?.market_id, "201");
		assert.equal(odds[2]?.market_id, "398t1_5");
	});

	it("strips trailing zeros from odd_ratio", () => {
		assert.equal(formatOdds("1.300000"), "1.3");
		assert.equal(formatOdds(undefined), null);
	});
});
