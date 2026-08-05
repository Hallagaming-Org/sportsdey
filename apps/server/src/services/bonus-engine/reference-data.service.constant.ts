/**
 * Curated sportsbook catalog for Bonus Engine Admin dropdowns.
 * SportsDey sportsbetting is Data.Bet-iframe backed (no local betting tree),
 * so these IDs are stable allow-list stubs until a live feed is available.
 */
export const BONUS_ENGINE_SPORTSBOOK_CATALOG = {
	sports: [{ SportId: 1, Name: "Soccer" }],
	categories: [
		{ sportId: 1, categoryId: 10, name: "England" },
		{ sportId: 1, categoryId: 11, name: "Spain" },
		{ sportId: 1, categoryId: 12, name: "Italy" },
		{ sportId: 1, categoryId: 13, name: "Germany" },
		{ sportId: 1, categoryId: 14, name: "France" },
		{ sportId: 1, categoryId: 15, name: "International Clubs" },
	],
	championships: [
		{
			sportId: 1,
			categoryId: 10,
			championshipId: 100,
			name: "Premier League",
		},
		{
			sportId: 1,
			categoryId: 11,
			championshipId: 101,
			name: "La Liga",
		},
		{
			sportId: 1,
			categoryId: 12,
			championshipId: 102,
			name: "Serie A",
		},
		{
			sportId: 1,
			categoryId: 13,
			championshipId: 103,
			name: "Bundesliga",
		},
		{
			sportId: 1,
			categoryId: 14,
			championshipId: 104,
			name: "Ligue 1",
		},
		{
			sportId: 1,
			categoryId: 15,
			championshipId: 105,
			name: "UEFA Champions League",
		},
	],
	events: [
		{
			sportId: 1,
			categoryId: 10,
			championshipId: 100,
			EventId: 5000,
			EventName: "Manchester United vs Arsenal",
		},
		{
			sportId: 1,
			categoryId: 15,
			championshipId: 105,
			EventId: 5001,
			EventName: "Real Madrid vs Bayern Munich",
		},
	],
	markets: [
		{ EventId: 5000, EventName: "Manchester United vs Arsenal", MarketId: 1, MarketName: "Match Result" },
		{ EventId: 5000, EventName: "Manchester United vs Arsenal", MarketId: 2, MarketName: "Both Teams To Score" },
		{ EventId: 5001, EventName: "Real Madrid vs Bayern Munich", MarketId: 1, MarketName: "Match Result" },
	],
} as const;
