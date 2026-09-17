export const SPORTSBOOK_TABLET_BREAKPOINT = 768;
export const SPORTSBOOK_DESKTOP_BREAKPOINT = 1024;
export const SPORTSBOOK_SIDE_COLUMN_FLEX = "0 0 320px";
/** Same as DataBet lobby pages (`RootClasic`): grow/shrink with a 0% basis. */
export const SPORTSBOOK_CENTER_COLUMN_FLEX = "1";

export type DatabetLayoutNode = {
	breakpoint?: number;
	flexSize?: string;
	items?: DatabetLayoutNode[];
	grid?: { items?: DatabetLayoutNode[] };
	pages?: Record<string, DatabetLayoutNode>;
	[key: string]: unknown;
};

export type DatabetLayoutConfig = {
	mobile?: DatabetLayoutNode;
	tablet?: DatabetLayoutNode;
	desktop?: DatabetLayoutNode;
};

function isPxSideColumn(flexSize: unknown): boolean {
	return typeof flexSize === "string" && /\b320px\b/.test(flexSize);
}

/**
 * Desktop sport / live / tournament / outright pages use
 * `flex: 0 1 100%` for the middle column. That basis is 100% of the
 * host *plus* the two 320px side columns, so the nowrap row overflows
 * and clips Betslip. Lobby pages already use `flex: 1`.
 */
function patchThreeColumnPage(page: DatabetLayoutNode) {
	const items = page.grid?.items;
	if (!Array.isArray(items) || items.length < 3) return false;
	const first = items[0];
	const center = items[1];
	const last = items[items.length - 1];
	if (!first || !center || !last) return false;
	if (!isPxSideColumn(first.flexSize) || !isPxSideColumn(last.flexSize)) {
		return false;
	}
	first.flexSize = SPORTSBOOK_SIDE_COLUMN_FLEX;
	last.flexSize = SPORTSBOOK_SIDE_COLUMN_FLEX;
	center.flexSize = SPORTSBOOK_CENTER_COLUMN_FLEX;
	return true;
}

export function patchDatabetLayoutConfig(
	layout: DatabetLayoutConfig | null | undefined,
): DatabetLayoutConfig | null | undefined {
	if (!layout) return layout;

	if (layout.tablet) layout.tablet.breakpoint = SPORTSBOOK_TABLET_BREAKPOINT;
	if (layout.desktop) layout.desktop.breakpoint = SPORTSBOOK_DESKTOP_BREAKPOINT;

	const pages = layout.desktop?.pages;
	if (pages && typeof pages === "object") {
		for (const page of Object.values(pages)) {
			if (page && typeof page === "object") {
				patchThreeColumnPage(page);
			}
		}
	}

	return layout;
}

function looksLikeSideColumn(el: Element): el is HTMLElement {
	if (!(el instanceof HTMLElement)) return false;
	const haystack = `${el.getAttribute("style") ?? ""} ${el.className ?? ""}`;
	return /\b320px\b/.test(haystack);
}

function pinSideColumn(el: HTMLElement) {
	el.style.setProperty("flex", SPORTSBOOK_SIDE_COLUMN_FLEX, "important");
	el.style.setProperty("flex-shrink", "0", "important");
	el.style.setProperty("min-width", "320px", "important");
	el.style.setProperty("max-width", "320px", "important");
}

/**
 * Pin 320px nav/betslip columns in the live shadow tree and let the
 * middle column scroll internally instead of overflowing the page.
 */
export function constrainSportsbookThreeColumnRows(root: ParentNode) {
	const sides = root.querySelectorAll<HTMLElement>(
		'[style*="320px"], [class*="320px"]',
	);
	const seen = new Set<HTMLElement>();

	for (const side of sides) {
		const row = side.parentElement;
		if (!row || seen.has(row) || row.children.length !== 3) continue;
		const left = row.children[0];
		const center = row.children[1];
		const right = row.children[2];
		if (!looksLikeSideColumn(left) || !looksLikeSideColumn(right)) continue;
		if (!(center instanceof HTMLElement)) continue;
		seen.add(row);

		row.style.setProperty("max-width", "100%", "important");
		row.style.setProperty("min-width", "0", "important");
		row.style.setProperty("width", "100%", "important");
		pinSideColumn(left);
		pinSideColumn(right);
		center.style.setProperty("flex", "1 1 0%", "important");
		center.style.setProperty("min-width", "0", "important");
		center.style.setProperty("overflow-x", "auto", "important");
	}
}
