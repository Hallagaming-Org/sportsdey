import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chunkSizeFor } from "./service";
import { buildTicketHistoryPageQuery } from "./ticket-history-source";

describe("admin export throughput", () => {
	it("uses larger chunks so fewer queue round-trips are needed", () => {
		assert.equal(chunkSizeFor("pdf"), 5_000);
		assert.equal(chunkSizeFor("xlsx"), 20_000);
		assert.equal(chunkSizeFor("docx"), 20_000);
	});

	it("pages ticket history with LIMIT/OFFSET instead of over-fetching each provider", () => {
		const page = buildTicketHistoryPageQuery({
			type: "all",
			search: "kg1",
			offset: 20_000,
			limit: 5_000,
		});
		assert.match(page.sql, /UNION ALL/i);
		assert.match(page.sql, /LIMIT \? OFFSET \?/);
		assert.equal(page.binds.at(-2), 5_000);
		assert.equal(page.binds.at(-1), 20_000);
		assert.ok(page.binds.includes("%kg1%"));
	});

	it("omits sportsbook rows when exporting casino tickets only", () => {
		const page = buildTicketHistoryPageQuery({
			type: "casino",
			offset: 0,
			limit: 100,
		});
		assert.doesNotMatch(page.sql, /sportsbook_bet/);
		assert.match(page.sql, /game_transactions/);
	});
});
