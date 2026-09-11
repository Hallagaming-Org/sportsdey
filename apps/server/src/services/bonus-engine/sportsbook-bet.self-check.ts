import assert from "node:assert/strict";
import { BONUS_ENGINE_PRODUCT_TYPE } from "./bonus-engine.service.constant";
import { buildBonusEngineBetReportBody } from "./events.service";
import { matchTopEuropeanChampionship } from "./reference-data.service.constant";
import { extractSportsbookBetReportIds } from "./sportsbook-bet.service";

const live = extractSportsbookBetReportIds([
	{
		match_id: "987654",
		meta: {
			sport_id: 1,
			sport_event_info_tournament_id: "17",
		},
	},
]);
assert.equal(live.sportId, "1");
assert.equal(live.eventId, "987654");
assert.equal(live.leagueId, "17");

const stub = extractSportsbookBetReportIds([
	{ match_id: "5000", meta: { sport_id: 1 } },
]);
assert.equal(stub.sportId, "1");
assert.equal(stub.eventId, undefined);
assert.equal(stub.leagueId, undefined);

const sportsBody = buildBonusEngineBetReportBody({
	clientId: "client",
	projectId: "project",
	currency: "NGN",
	bet: {
		userId: "user-1",
		betId: "bet-1",
		amount: 100,
		productType: BONUS_ENGINE_PRODUCT_TYPE.SPORTSBOOK,
		sportId: "1",
		eventId: "987654",
		leagueId: "17",
	},
});
assert.equal(sportsBody.provider_id, undefined);
assert.equal(sportsBody.game_id, undefined);
assert.equal(sportsBody.sport_id, "1");
assert.equal(sportsBody.event_id, "987654");
assert.equal(sportsBody.league_id, "17");

const casinoBody = buildBonusEngineBetReportBody({
	clientId: "client",
	projectId: "project",
	currency: "NGN",
	bet: {
		userId: "user-1",
		betId: "bet-1",
		amount: 50,
		productType: BONUS_ENGINE_PRODUCT_TYPE.CASINO,
		providerId: "netent",
		gameId: "starburst",
	},
});
assert.equal(casinoBody.sport_id, undefined);
assert.equal(casinoBody.league_id, undefined);
assert.equal(casinoBody.provider_id, "netent");
assert.equal(casinoBody.game_id, "starburst");

assert.equal(matchTopEuropeanChampionship("Premier League")?.name, "Premier League");
assert.equal(matchTopEuropeanChampionship("Premier League 2"), undefined);
assert.equal(matchTopEuropeanChampionship("UEFA Champions League")?.name, "UEFA Champions League");
assert.equal(matchTopEuropeanChampionship("UEFA Europa League")?.name, "UEFA Europa League");
assert.equal(matchTopEuropeanChampionship("Europa League")?.name, "UEFA Europa League");
assert.equal(matchTopEuropeanChampionship("UEFA Europa Conference League"), undefined);
assert.equal(matchTopEuropeanChampionship("LaLiga")?.name, "La Liga");

console.log("bonus-engine sportsbook-bet.self-check: ok");
