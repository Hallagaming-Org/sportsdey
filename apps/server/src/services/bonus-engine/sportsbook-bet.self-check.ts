import assert from "node:assert/strict";
import { extractSportsbookBetReportIds } from "./sportsbook-bet.service";

const live = extractSportsbookBetReportIds([
	{ match_id: "987654", meta: { sport_id: 1 } },
]);
assert.equal(live.sportId, "1");
assert.equal(live.eventId, "987654");

const stub = extractSportsbookBetReportIds([
	{ match_id: "5000", meta: { sport_id: 1 } },
]);
assert.equal(stub.sportId, "1");
assert.equal(stub.eventId, undefined);

console.log("bonus-engine sportsbook-bet.self-check: ok");
