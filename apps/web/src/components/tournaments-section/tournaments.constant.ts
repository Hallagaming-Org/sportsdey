export type TournamentStatus = "active" | "upcoming" | "results";
export type TournamentSport = "football" | "casino" | "virtual" | "basketball";

export type Tournament = {
	id: string;
	title: string;
	prize: number;
	image: string;
	players: number;
	remaining: string;
	status: TournamentStatus;
	sport: TournamentSport;
};

export type LeaderboardEntry = {
	id: string;
	rank: number;
	player: string;
	tournament: string;
	points: number;
	prize: number;
};

export const TOURNAMENT_STATUS_TABS = [
	{ id: "active", label: "Active" },
	{ id: "upcoming", label: "Upcoming" },
	{ id: "results", label: "Results" },
] as const satisfies ReadonlyArray<{ id: TournamentStatus; label: string }>;

export const TOURNAMENT_SPORT_FILTERS = [
	{ id: "all", label: "All sports" },
	{ id: "football", label: "Football" },
	{ id: "casino", label: "Casino" },
	{ id: "virtual", label: "Virtual" },
	{ id: "basketball", label: "Basketball" },
] as const;

export const FEATURED_TOURNAMENT_ID = "weekend-football-challenge";

export const DUMMY_TOURNAMENTS: Tournament[] = [
	{
		id: FEATURED_TOURNAMENT_ID,
		title: "Weekend Football Challenge",
		prize: 2_000_000,
		image: "/tournaments/football.png",
		players: 5442,
		remaining: "2D:2H:25M",
		status: "active",
		sport: "football",
	},
	{
		id: "casino-rush",
		title: "Casino Rush",
		prize: 500_000,
		image: "/tournaments/casino-rush.png",
		players: 5442,
		remaining: "3D:3H:35M",
		status: "active",
		sport: "casino",
	},
	{
		id: "virtual-race-cup",
		title: "Virtual Race Cup",
		prize: 300_000,
		image: "/tournaments/virtual.png",
		players: 5442,
		remaining: "4D:4H:45M",
		status: "active",
		sport: "virtual",
	},
	{
		id: "hoops-battle",
		title: "Hoops Battle",
		prize: 750_000,
		image: "/tournaments/basketball.png",
		players: 2356,
		remaining: "5D:5H:55M",
		status: "active",
		sport: "basketball",
	},
	{
		id: "super-eagles-qualifiers",
		title: "Super Eagles Qualifiers",
		prize: 1_500_000,
		image: "/tournaments/football.png",
		players: 3120,
		remaining: "6D:12H:10M",
		status: "upcoming",
		sport: "football",
	},
	{
		id: "live-roulette-masters",
		title: "Live Roulette Masters",
		prize: 400_000,
		image: "/tournaments/casino-rush.png",
		players: 1874,
		remaining: "8D:4H:00M",
		status: "upcoming",
		sport: "casino",
	},
	{
		id: "midnight-grand-prix",
		title: "Midnight Grand Prix",
		prize: 250_000,
		image: "/tournaments/virtual.png",
		players: 964,
		remaining: "9D:1H:30M",
		status: "upcoming",
		sport: "virtual",
	},
	{
		id: "nba-playoff-clash",
		title: "NBA Playoff Clash",
		prize: 900_000,
		image: "/tournaments/basketball.png",
		players: 2210,
		remaining: "10D:6H:45M",
		status: "upcoming",
		sport: "basketball",
	},
	{
		id: "champions-league-night",
		title: "Champions League Night",
		prize: 1_200_000,
		image: "/tournaments/football.png",
		players: 4102,
		remaining: "12D:0H:15M",
		status: "upcoming",
		sport: "football",
	},
	{
		id: "poker-high-roller",
		title: "Poker High Roller",
		prize: 350_000,
		image: "/tournaments/casino-rush.png",
		players: 1288,
		remaining: "14D:8H:20M",
		status: "upcoming",
		sport: "casino",
	},
];

export const DUMMY_LEADERBOARD: LeaderboardEntry[] = [
	{
		id: "lb-1",
		rank: 1,
		player: "DotunFC",
		tournament: "Weekend Football Challenge",
		points: 8520,
		prize: 150_000,
	},
	{
		id: "lb-2",
		rank: 2,
		player: "Mighty guard",
		tournament: "Weekend Football Challenge",
		points: 7840,
		prize: 80_000,
	},
	{
		id: "lb-3",
		rank: 3,
		player: "Demon Fox",
		tournament: "Weekend Football Challenge",
		points: 8520,
		prize: 150_000,
	},
	{
		id: "lb-4",
		rank: 4,
		player: "Web insider",
		tournament: "Weekend Football Challenge",
		points: 7840,
		prize: 80_000,
	},
	{
		id: "lb-5",
		rank: 5,
		player: "Gabewinner",
		tournament: "Weekend Football Challenge",
		points: 8520,
		prize: 150_000,
	},
	{
		id: "lb-6",
		rank: 6,
		player: "Robert Fox",
		tournament: "Weekend Football Challenge",
		points: 7840,
		prize: 80_000,
	},
	{
		id: "lb-7",
		rank: 7,
		player: "Gabewinner",
		tournament: "Weekend Football Challenge",
		points: 8520,
		prize: 150_000,
	},
	{
		id: "lb-8",
		rank: 8,
		player: "Robert Fox",
		tournament: "Weekend Football Challenge",
		points: 7840,
		prize: 80_000,
	},
];

export function formatTournamentPrize(
	amount: number,
	withDecimals = false,
): string {
	return `₦${amount.toLocaleString("en-NG", {
		minimumFractionDigits: withDecimals ? 2 : 0,
		maximumFractionDigits: withDecimals ? 2 : 0,
	})}`;
}

export function playerInitials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
