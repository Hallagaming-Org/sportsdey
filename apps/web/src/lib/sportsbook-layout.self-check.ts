import assert from "node:assert/strict";
import {
	SPORTSBOOK_CENTER_COLUMN_FLEX,
	SPORTSBOOK_DESKTOP_BREAKPOINT,
	SPORTSBOOK_SIDE_COLUMN_FLEX,
	SPORTSBOOK_TABLET_BREAKPOINT,
	type DatabetLayoutConfig,
	patchDatabetLayoutConfig,
} from "./sportsbook-layout.ts";

function col(flexSize: string) {
	return { type: "col", flexSize, items: [] };
}

function page(
	path: string,
	sizes: [string, string, string] | [string, string],
) {
	return {
		path,
		grid: { type: "row", wrap: false, items: sizes.map((size) => col(size)) },
	};
}

const layout: DatabetLayoutConfig = {
	tablet: {
		breakpoint: 1040,
		pages: {
			Sport: page("/:sportTypeSlug/prematch/:sportSlug", [
				"0 0 320px",
				"1 100%",
			]),
		},
	},
	desktop: {
		breakpoint: 1440,
		pages: {
			RootClasic: page("/sports/prematch", ["0 0 320px", "1", "0 0 320px"]),
			Sport: {
				path: "/:sportTypeSlug/prematch/:sportSlug",
				grid: {
					type: "row",
					wrap: false,
					items: [
						{
							type: "col",
							flexSize: "0 0 320px",
							items: [
								{
									type: "col",
									flexSize: "0 1 100%",
								},
							],
						},
						col("0 1 100%"),
						col("0 0 320px"),
					],
				},
			},
			SportLive: page("/:sportTypeSlug/live/:sportSlug", [
				"0 0 320px",
				"0 1 100%",
				"0 0 320px",
			]),
			Tournaments: page("/:sportTypeSlug/prematch/:sportSlug/tournaments", [
				"0 0 320px",
				"0 1 100%",
				"0 0 320px",
			]),
			Outrights: page("/:sportTypeSlug/prematch/:sportSlug/outrights", [
				"0 0 320px",
				"0 1 100%",
				"0 0 320px",
			]),
			Match: page("/:sportTypeSlug/:sportEventStatusSlug/match/:matchSlug", [
				"0 0 320px",
				"1 100%",
				"1 0 320px",
			]),
			Home: page("/", ["0 0 320px", "1 100%", "0 0 320px"]),
		},
	},
};

patchDatabetLayoutConfig(layout);

assert.equal(layout.tablet?.breakpoint, SPORTSBOOK_TABLET_BREAKPOINT);
assert.equal(layout.desktop?.breakpoint, SPORTSBOOK_DESKTOP_BREAKPOINT);

const desktopPages = layout.desktop?.pages ?? {};
for (const name of [
	"RootClasic",
	"Sport",
	"SportLive",
	"Tournaments",
	"Outrights",
	"Match",
	"Home",
]) {
	const items = desktopPages[name]?.grid?.items ?? [];
	assert.equal(items.length, 3, `${name} should stay 3-column`);
	assert.equal(
		items[0]?.flexSize,
		SPORTSBOOK_SIDE_COLUMN_FLEX,
		`${name} left nav must not shrink`,
	);
	assert.equal(
		items[1]?.flexSize,
		SPORTSBOOK_CENTER_COLUMN_FLEX,
		`${name} center must fill remaining width`,
	);
	assert.equal(
		items[2]?.flexSize,
		SPORTSBOOK_SIDE_COLUMN_FLEX,
		`${name} betslip must stay 320px and not shrink`,
	);
}

const tabletItems = layout.tablet?.pages?.Sport?.grid?.items ?? [];
assert.deepEqual(
	tabletItems.map((item) => item.flexSize),
	["0 0 320px", "1 100%"],
	"tablet 2-column pages must keep the inline betslip dropped",
);

const nestedNav = desktopPages.Sport?.grid?.items?.[0]?.items?.[0];
assert.equal(
	nestedNav?.flexSize,
	"0 1 100%",
	"nested left-nav flex sizes must stay untouched",
);

assert.equal(patchDatabetLayoutConfig(undefined), undefined);

console.log("sportsbook-layout.self-check: ok");
