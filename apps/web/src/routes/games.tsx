import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, type Variants } from "framer-motion";
import { Loader2, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { useSession } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import FilerAToZ from "@/logos/FilerAToZ";
import BlackjackLogo from "../logos/blackjack.svg?react";
import BlocksLogo from "../logos/blocks.svg?react";
import PlinkoLogo from "../logos/plinko.svg?react";
import SlotsLogo from "../logos/slots.svg?react";
import SolitaireLogo from "../logos/solitaire.svg?react";
import TwentyOneLogo from "../logos/twentyone.svg?react";

export const Route = createFileRoute("/games")({
	component: GamesPage,
	validateSearch: (search: Record<string, unknown>): { category?: string } => ({
		category: (search.category as string) || undefined,
	}),
});

const CATEGORIES = [
	"popular",
	"crash-games",
	"original",
	"pvp",
	"slots",
	"tablecardgames",
	"arcade",
	"classic",
	"bingo",
	"dice",
	"jackpot",
	"lottery",
	"others",
	"roulette",
	"scratch",
] as const;

const CATEGORY_EMOJIS: Record<string, string> = {
	popular: "🔥",
	"crash-games": "🚀",
	original: "🎯",
	pvp: "⚔️",
	slots: "🎰",
	tablecardgames: "🃏",
	arcade: "🕹️",
	classic: "👑",
	bingo: "🎱",
	dice: "🎲",
	jackpot: "💰",
	lottery: "🎟️",
	others: "🧩",
	roulette: "🎡",
	scratch: "🎫",
};

type Category = {
	id: string;
	name: string;
	slug: string;
};

type Game = {
	id: string;
	name: string;
	code: string;
	imageUrl: string | null;
	categories: Category[];
	enabled: boolean;
	createdAt: number;
	updatedAt: number;
};

type LaunchResponse = {
	success: boolean;
	data:
		| {
				url?: string;
		  }
		| undefined;
	error?: string;
};

const POPULAR_GAME_NAMES = [
	"Aviator",
	"Lagos Rush",
	"Penalty Shoot Out",
	"Sweet Bonanza",
	"Mines",
	"Plinko",
	"Gates of Olympus",
	"High Flyer",
	"Keno",
	"Big Bass Splash",
	"Baccarat",
	"JetX",
	"Helicopter X",
	"Balloon",
	"Xcape",
	"Hi Lo",
	"Blocks",
	"Eagle",
	"Avia Rush",
	"Avia Masters",
	"Roulette",
	"Space",
	"Wild Fortune",
	"Mystic Fortune",
	"Football X",
	"Greyhound",
	"Car Racing",
	"Crash X",
];

const PRIORITY_GAMES = [
	"solitaire",
	"blocks",
	"twentyone",
	"blackjack",
	"slots",
	"plinko",
	"XCAPEHB",
	"EAGLEHB",
	"LUCKYRISEHB",
	"LAGOSRUSH",
];

const THUNDR_CODES = [
	"solitaire",
	"blocks",
	"twentyone",
	"blackjack",
	"slots",
	"plinko",
];

const ORIGINALS_CODES = ["LAGOSRUSH", "sportsdey-crash"];

const SPECIAL_CATEGORIES = ["popular", "pvp", "original"];

const KNOWN_GAMES: Record<
	string,
	{
		subtitle: string;
		icon?: React.ComponentType<{ className?: string }>;
		image?: string;
		gradient: string;
	}
> = {
	solitaire: {
		subtitle: "classic card game",
		icon: SolitaireLogo,
		gradient: "linear-gradient(to bottom, #1e3a5f, #2d5a87, #4a90d9)",
	},
	blocks: {
		subtitle: "puzzle game",
		icon: BlocksLogo,
		gradient: "linear-gradient(to bottom, #ff6b35, #f7931e, #ffcc00)",
	},
	twentyone: {
		subtitle: "card game",
		icon: TwentyOneLogo,
		gradient: "linear-gradient(to bottom, #1a1a2e, #16213e, #0f3460)",
	},
	blackjack: {
		subtitle: "card game",
		icon: BlackjackLogo,
		gradient: "linear-gradient(to bottom, #2d2d2d, #4a4a4a, #6b6b6b)",
	},
	slots: {
		subtitle: "slot machine",
		icon: SlotsLogo,
		gradient: "linear-gradient(to bottom, #7b1fa2, #9c27b0, #ba68c8)",
	},
	plinko: {
		subtitle: "lucky drop",
		icon: PlinkoLogo,
		gradient: "linear-gradient(to bottom, #00897b, #26a69a, #4db6ac)",
	},
	XCAPEHB: {
		subtitle: "fulfilling games",
		image: "/xcape-thumbnail-16x9.jpg",
		gradient: "linear-gradient(to bottom, #1fe0c8, #7a5cff, #c43cff)",
	},
	EAGLEHB: {
		subtitle: "fulfilling games",
		image: "/eagle-thumbnail-16x9.jpg",
		gradient: "linear-gradient(to bottom, #d9f27c, #8bbf4f, #5f9e7a)",
	},
	LUCKYRISEHB: {
		subtitle: "fulfilling games",
		image: "/luckyrise-thumbnail-16x9.png",
		gradient: "linear-gradient(to bottom, #0E0E2B, #1f3a5f, #d4a017)",
	},
	LAGOSRUSH: {
		subtitle: "fulfilling games",
		image: "/lagos-rush.png",
		gradient: "linear-gradient(to bottom, #ff6b35, #f7931e, #ffcc00)",
	},
	"sportsdey-crash": {
		subtitle: "sportsdey original",
		image: "/sportsdey-crash.jpeg",
		gradient: "linear-gradient(to bottom, #ff6b35, #f7931e, #ffcc00)",
	},
};

const DEFAULT_GRADIENT =
	"linear-gradient(to bottom, #1a1a2e, #16213e, #0f3460)";

const PAGE_SIZE = 24;

const getUniquePopularGames = (games: Game[], limit: number) => {
	const result: Game[] = [];
	const addedIds = new Set<string>();
	for (const popName of POPULAR_GAME_NAMES) {
		if (result.length >= limit) break;
		const match = games.find(
			(g) =>
				!addedIds.has(g.id) &&
				g.name.toLowerCase().includes(popName.toLowerCase()),
		);
		if (match) {
			result.push(match);
			addedIds.add(match.id);
		}
	}
	return result;
};

const isThundrGame = (code: string) => {
	return THUNDR_CODES.includes(code);
};

function GamesPage() {
	const navigate = useNavigate({ from: "/games" });
	const { category } = Route.useSearch();
	const [loadingGame, setLoadingGame] = useState<string | null>(null);
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
	const [searchInput, setSearchInput] = useState("");
	const [search, setSearch] = useState("");
	const [sortAsc, setSortAsc] = useState<boolean | null>(null);
	const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

	useEffect(() => {
		setSelectedCategory(category || null);
	}, [category]);

	useEffect(() => {
		window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
		const mains = document.querySelectorAll("main");
		mains.forEach((main) => {
			main.scrollTo({ top: 0, left: 0, behavior: "smooth" });
		});
	}, [selectedCategory]);

	useEffect(() => {
		setDisplayCount(PAGE_SIZE);
	}, [selectedCategory, search]);

	useEffect(() => {
		const timer = setTimeout(() => {
			setSearch(searchInput);
		}, 300);
		return () => clearTimeout(timer);
	}, [searchInput]);

	const containerVariants: Variants = {
		hidden: { opacity: 0 },
		show: {
			opacity: 1,
			transition: {
				staggerChildren: 0.04,
			},
		},
	};

	const itemVariants: Variants = {
		hidden: { opacity: 0, y: 20, scale: 0.95 },
		show: {
			opacity: 1,
			y: 0,
			scale: 1,
			transition: { type: "tween", ease: "easeOut", duration: 0.4 },
		},
	};

	const { data: session, isPending: isSessionLoading } = useSession();

	const {
		data: allGames = [],
		isLoading,
		error,
	} = useQuery<Game[]>({
		queryKey: ["games"],
		queryFn: async () => {
			const games = await apiRequest<Game[]>("games");
			return games.filter((game) => game.enabled);
		},
	});

	const categoryCounts =
		allGames.length > 0
			? CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
					if (SPECIAL_CATEGORIES.includes(cat)) {
						let count: number;
						switch (cat) {
							case "popular":
								count = getUniquePopularGames(allGames, Infinity).length;
								break;
							case "pvp":
								count = allGames.filter((g) =>
									THUNDR_CODES.includes(g.code),
								).length;
								break;
							case "crash-games":
								count = allGames.filter((g) =>
									g.name.toLowerCase().includes("aviator"),
								).length;
								break;
							case "original":
								count = allGames.filter((g) =>
									ORIGINALS_CODES.includes(g.code),
								).length;
								break;
							default:
								count = 0;
						}
						acc[cat] = count;
					} else {
						acc[cat] = allGames.filter((g) =>
							g.categories?.some((c) => c.slug === cat),
						).length;
					}
					return acc;
				}, {})
			: {};

	let filteredGames = allGames;

	if (selectedCategory) {
		if (SPECIAL_CATEGORIES.includes(selectedCategory)) {
			switch (selectedCategory) {
				case "popular":
					filteredGames = getUniquePopularGames(allGames, Infinity);
					break;
				case "pvp":
					filteredGames = allGames.filter((g) => THUNDR_CODES.includes(g.code));
					break;
				case "crash-games":
					filteredGames = allGames.filter((g) =>
						g.name.toLowerCase().includes("aviator"),
					);
					break;
				case "original":
					filteredGames = allGames.filter((g) =>
						ORIGINALS_CODES.includes(g.code),
					);
					break;
			}
		} else {
			filteredGames = allGames.filter((g) =>
				g.categories?.some((c) => c.slug === selectedCategory),
			);
		}
	}

	if (search) {
		const q = search.toLowerCase();
		filteredGames = filteredGames.filter((g) =>
			g.name.toLowerCase().includes(q),
		);
	}

	const sortedGames = [...filteredGames].sort((a, b) => {
		const aAviator = a.name.toLowerCase().includes("aviator");
		const bAviator = b.name.toLowerCase().includes("aviator");
		if (aAviator && !bAviator) return -1;
		if (!aAviator && bAviator) return 1;

		if (sortAsc === true) return a.name.localeCompare(b.name);
		if (sortAsc === false) return b.name.localeCompare(a.name);

		const aPriority = PRIORITY_GAMES.indexOf(a.code);
		const bPriority = PRIORITY_GAMES.indexOf(b.code);
		if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
		if (aPriority !== -1) return -1;
		if (bPriority !== -1) return 1;
		return a.name.localeCompare(b.name);
	});

	const displayGames = sortedGames.slice(0, displayCount);
	const hasMore = sortedGames.length > displayCount;

	const chunkSize = 3;
	const gameChunks: Game[][] = [];
	for (let i = 0; i < displayGames.length; i += chunkSize) {
		gameChunks.push(displayGames.slice(i, i + chunkSize));
	}

	const loadMoreRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!loadMoreRef.current) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMore) {
					setDisplayCount((prev) => prev + PAGE_SIZE);
				}
			},
			{ threshold: 0.1, rootMargin: "200px" },
		);
		observer.observe(loadMoreRef.current);
		return () => observer.disconnect();
	}, [hasMore]);

	const handleGameClick = async (game: Game) => {
		if (!session?.user) {
			navigate({ to: "/auth/sign-in" });
			return;
		}

		if (game.code === "sportsdey-crash") {
			window.open(
				"https://binary.sportsdey.com/sportsdayApi/connectSportsDay?type=casino",
				"_blank",
			);
			return;
		}

		setLoadingGame(game.code);
		try {
			const knownGame = KNOWN_GAMES[game.code];
			const isKnownGame = !!knownGame;

			let url: string;
			let body: Record<string, unknown>;

			if (isKnownGame) {
				if (["XCAPEHB", "EAGLEHB", "LUCKYRISEHB"].includes(game.code)) {
					url = `${import.meta.env.VITE_SERVER_URL}casino/play/${game.code}`;
					body = {};
				} else if (game.code === "LAGOSRUSH") {
					url = `${import.meta.env.VITE_SERVER_URL}lagos-rush/launcher`;
					body = { game: game.code };
				} else {
					url = `${import.meta.env.VITE_SERVER_URL}thndr/play/${game.code}`;
					body = {};
				}
			} else {
				url = `${import.meta.env.VITE_SERVER_URL}slotegrator/launch`;
				body = { game_uuid: game.code };
			}

			const response = await fetch(url, {
				method: "POST",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
			});

			const data: LaunchResponse = await response.json();

			if (!response.ok || data.success === false) {
				if (data.error === "Unauthorized" || response.status === 401) {
					navigate({ to: "/auth/sign-in" });
					return;
				}
				throw new Error(data.error || "Failed to launch game");
			}

			if (!data.data) {
				throw new Error("Missing response data");
			}

			const gameUrl = data.data?.url;

			if (!gameUrl) {
				throw new Error("Missing launch URL in response");
			}

			navigate({
				to: "/game/$gameId",
				params: { gameId: game.code },
				search: { category: selectedCategory || undefined },
				state: { gameUrl } as any,
			});
		} catch (error) {
		} finally {
			setLoadingGame(null);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent, game: Game) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			handleGameClick(game);
		}
	};

	const getGameDisplay = (game: Game) => {
		const knownGame = KNOWN_GAMES[game.code];

		return {
			name: game.name,
			subtitle: knownGame?.subtitle ?? "Play now",
			icon: knownGame?.icon,
			image: game.imageUrl ?? knownGame?.image ?? "/lagos-rush.png",
			gradient: knownGame?.gradient ?? DEFAULT_GRADIENT,
		};
	};

	if (isSessionLoading || isLoading) {
		return (
			<div className="min-h-screen dark:bg-[#121212]">
				<div className="container mx-auto px-4 pb-8 relative">
					<div className="sticky top-0 z-20 bg-[#121212] pt-8 pb-4 mb-4">
						<Skeleton className="mb-6 h-8 w-40 bg-gray-200 dark:bg-[#1B2722]" />
						<div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide">
							{Array.from({ length: 8 }).map((_, i) => (
								<Skeleton
									key={i}
									className="h-9 w-24 shrink-0 rounded-2xl bg-gray-200 dark:bg-[#1B2722]"
								/>
							))}
						</div>
					</div>

					<div className="flex flex-col gap-4 md:hidden">
						{Array.from({ length: 4 }).map((_, row) => (
							<div
								key={row}
								className="flex overflow-x-auto gap-2 scrollbar-hide"
							>
								{Array.from({ length: 4 }).map((_, col) => (
									<Skeleton
										key={col}
										className="h-[110px] w-[110px] flex-none rounded-xl bg-gray-200 dark:bg-[#1B2722]"
									/>
								))}
							</div>
						))}
					</div>

					<div className="hidden md:grid md:grid-cols-4 md:gap-4">
						{Array.from({ length: 16 }).map((_, i) => (
							<Skeleton
								key={i}
								className="aspect-square w-full rounded-2xl bg-gray-200 dark:bg-[#1B2722]"
							/>
						))}
					</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex min-h-screen items-center justify-center dark:bg-[#121212]">
				<p className="text-red-500">Failed to load games. Please try again.</p>
			</div>
		);
	}

	return (
		<div className="min-h-screen dark:bg-[#121212]">
			<div className="container mx-auto px-4 pb-8 relative">
				<div className="sticky top-0 z-20 bg-[#121212] pt-8 pb-4 mb-4">
					<div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
						<h1 className="font-bold text-2xl text-gray-900 dark:text-white">
							Casino
						</h1>

						<div className="flex flex-wrap items-center gap-2">
							<div className="relative flex-1 min-w-[200px] md:w-[300px]">
								<input
									type="text"
									placeholder="Search games"
									value={searchInput}
									onChange={(e) => setSearchInput(e.target.value)}
									className="w-full pl-4 pr-10 py-2 bg-[#1B2722] border border-[#2a3a33] rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:border-[#1BAA04] transition-colors"
								/>
								<Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
							</div>

							{selectedCategory === null && (
								<button
									onClick={() =>
										setSortAsc((prev) =>
											prev === null ? true : prev === true ? false : null,
										)
									}
									className={`w-10 h-10 flex items-center justify-center rounded-lg border cursor-pointer ${
										sortAsc === null
											? "border-[#1BAA04] bg-[#1BAA04]/10"
											: "border-[#1B2722]"
									}`}
								>
									<FilerAToZ />
								</button>
							)}
						</div>
					</div>

					<div className="flex overflow-x-auto gap-3 pb-2 better-scrollbar">
						<button
							onClick={() =>
								navigate({
									search: (prev) => ({ ...prev, category: undefined }),
								})
							}
							className={`flex items-center shrink-0 gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
								selectedCategory === null
									? "border-[#1BAA04] bg-[#1BAA04] text-white"
									: "border-[#1B2722] text-gray-300 hover:border-[#1B2722]"
							}`}
						>
							🎮 All
							<span
								className={`flex h-7 min-w-[28px] px-2 items-center justify-center rounded-full text-[11px] ${
									selectedCategory === null
										? "bg-[#040C01] text-white"
										: "bg-[#1B2722] text-gray-300"
								}`}
							>
								{allGames.length.toLocaleString()}
							</span>
						</button>
						{CATEGORIES.map((cat) => {
							const emoji = CATEGORY_EMOJIS[cat];
							return (
								<button
									key={cat}
									onClick={() =>
										navigate({
											search: (prev) => ({
												...prev,
												category: selectedCategory === cat ? undefined : cat,
											}),
										})
									}
									className={`flex items-center shrink-0 gap-2 text-white rounded-2xl border px-4 py-2 text-sm font-medium capitalize transition-colors cursor-pointer ${
										selectedCategory === cat
											? "border-[#1BAA04] bg-[#1BAA04]"
											: "border-[#1B2722] text-gray-300 hover:border-[#1B2722]"
									}`}
								>
									{emoji && <span>{emoji}</span>}
									<span className="capitalize">
										{cat === "pvp"
											? "PVP"
											: cat === "tablecardgames"
												? "Table Card Games"
												: cat.replace("-", " ")}
									</span>
									<span
										className={`flex h-7 min-w-[28px] px-2 items-center justify-center rounded-full text-[11px] ${
											selectedCategory === cat
												? "bg-[#040C01] text-white"
												: "bg-[#1B2722] text-gray-300"
										}`}
									>
										{categoryCounts[cat]?.toLocaleString() ?? 0}
									</span>
								</button>
							);
						})}
					</div>
				</div>

				{displayGames.length === 0 ? (
					<p className="text-center text-gray-500">
						No games found in this category.
					</p>
				) : (
					<>
						<div className="flex flex-col gap-4 md:hidden">
							{gameChunks.map((chunk, rowIndex) => (
								<motion.div
									key={rowIndex}
									variants={containerVariants}
									initial="hidden"
									animate="show"
									className="flex overflow-x-auto gap-2 snap-x snap-mandatory scrollbar-hide"
								>
									{chunk.map((game) => {
										const display = getGameDisplay(game);
										return (
											<motion.div
												key={game.code}
												variants={itemVariants}
												className={cn(
													"relative flex flex-none snap-start cursor-pointer flex-col items-center justify-end overflow-hidden rounded-xl transition-all hover:scale-[1.02]",
													loadingGame === game.code &&
														"ring-2 ring-accent ring-offset-2 ring-offset-background cursor-wait scale-[0.98] opacity-90",
												)}
												style={{
													background: display.gradient,
													flex: "0 0 110px",
													height: "110px",
												}}
												onClick={() => handleGameClick(game)}
												onKeyDown={(e) => handleKeyDown(e, game)}
												role="button"
												tabIndex={0}
											>
												{loadingGame === game.code && (
													<div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
														<Loader2 className="h-6 w-6 animate-spin text-white" />
													</div>
												)}

												{display.icon ? (
													<div
														className="absolute inset-0 flex items-center justify-center p-4"
														style={{
															opacity: loadingGame === game.code ? 0.35 : 1,
														}}
													>
														{display.icon && (
															<display.icon className="h-full w-full object-contain" />
														)}
													</div>
												) : display.image ? (
													<img
														src={display.image}
														alt={display.name}
														loading="lazy"
														className="absolute inset-0 h-full w-full object-cover transition-opacity"
														style={{
															opacity: loadingGame === game.code ? 0.35 : 1,
														}}
													/>
												) : (
													<div
														className="absolute inset-0 flex items-center justify-center"
														style={{
															opacity: loadingGame === game.code ? 0.35 : 1,
														}}
													>
														<span className="font-bold text-4xl text-white/50">
															{display.name.charAt(0)}
														</span>
													</div>
												)}

												{isThundrGame(game.code) && (
													<div className="relative z-[1] w-full text-center pb-2">
														<p
															className="truncate font-normal text-sm text-white"
															style={{ fontFamily: "Luckiest Guy" }}
														>
															{display.name}
														</p>
													</div>
												)}
											</motion.div>
										);
									})}
								</motion.div>
							))}
						</div>

						<motion.div
							variants={containerVariants}
							initial="hidden"
							animate="show"
							className="hidden md:grid md:grid-cols-4 md:gap-4 lg:grid-cols-6 lg:gap-4"
						>
							{displayGames.map((game) => {
								const display = getGameDisplay(game);
								return (
									<motion.div
										key={game.code}
										variants={itemVariants}
										className={cn(
											"relative flex aspect-square w-full cursor-pointer flex-col items-center justify-end overflow-hidden rounded-2xl transition-all hover:scale-[1.02]",
											loadingGame === game.code &&
												"ring-2 ring-accent ring-offset-2 ring-offset-background cursor-wait scale-[0.98] opacity-90",
										)}
										style={{ background: display.gradient }}
										onClick={() => handleGameClick(game)}
										onKeyDown={(e) => handleKeyDown(e, game)}
										role="button"
										tabIndex={0}
									>
										{loadingGame === game.code && (
											<div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
												<Loader2 className="h-10 w-10 animate-spin text-white" />
											</div>
										)}

										{display.icon ? (
											<div
												className="absolute inset-0 flex items-center justify-center p-4"
												style={{
													opacity: loadingGame === game.code ? 0.35 : 1,
												}}
											>
												{display.icon && (
													<display.icon className="h-full w-full object-contain" />
												)}
											</div>
										) : display.image ? (
											<img
												src={display.image}
												alt={display.name}
												loading="lazy"
												className="absolute inset-0 h-full w-full object-cover transition-opacity"
												style={{
													opacity: loadingGame === game.code ? 0.35 : 1,
												}}
											/>
										) : (
											<div
												className="absolute inset-0 flex items-center justify-center"
												style={{
													opacity: loadingGame === game.code ? 0.35 : 1,
												}}
											>
												<span className="font-bold text-4xl text-white/50">
													{display.name.charAt(0)}
												</span>
											</div>
										)}

										{isThundrGame(game.code) && (
											<div className="relative z-[1] w-full text-center pb-3">
												<p
													className="truncate font-normal text-base text-white"
													style={{ fontFamily: "Luckiest Guy" }}
												>
													{display.name}
												</p>
											</div>
										)}
									</motion.div>
								);
							})}
						</motion.div>

						{hasMore && (
							<div
								ref={loadMoreRef}
								className="flex items-center justify-center py-6"
							>
								<Loader2 className="h-6 w-6 animate-spin text-[#1BAA04]" />
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}
