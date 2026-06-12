import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { apiRequest } from "@/lib/api";
import { useSession } from "@/lib/auth/client";
import BlackjackLogo from "../logos/blackjack.svg?react";
import BlocksLogo from "../logos/blocks.svg?react";
import PlinkoLogo from "../logos/plinko.svg?react";
import SlotsLogo from "../logos/slots.svg?react";
import SolitaireLogo from "../logos/solitaire.svg?react";
import TwentyOneLogo from "../logos/twentyone.svg?react";

export const Route = createFileRoute("/games")({
	component: GamesPage,
});

const CATEGORIES = [
	"arcade",
	"bingo",
	"classic",
	"crash-games",
	"dice",
	"jackpot",
	"lottery",
	"others",
	"roulette",
	"scratch",
	"slots",
	"table/card-games",
] as const;

type Game = {
	id: string;
	name: string;
	code: string;
	imageUrl: string | null;
	category: string | null;
	enabled: boolean;
	createdAt: number;
	updatedAt: number;
};

type GameResponse = {
	success: boolean;
	data: Game[];
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
};

const DEFAULT_GRADIENT =
	"linear-gradient(to bottom, #1a1a2e, #16213e, #0f3460)";

const PRIORITY_GAMES = ["solitaire", "blocks", "twentyone", "blackjack", "slots", "plinko", "XCAPEHB", "EAGLEHB", "LUCKYRISEHB", "LAGOSRUSH"];

function GamesPage() {
	const navigate = useNavigate();
	const [loadingGame, setLoadingGame] = useState<string | null>(null);
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

	const { data: session, isPending: isSessionLoading } = useSession();

	const {
		data: games = [],
		isLoading,
		error,
	} = useQuery<Game[]>({
		queryKey: ["games"],
		queryFn: async () => {
			const games = await apiRequest<Game[]>("games");
			return games.filter((game) => game.enabled);
		},
	});

	const sortedGames = [...games].sort((a, b) => {
		const aIndex = PRIORITY_GAMES.indexOf(a.code);
		const bIndex = PRIORITY_GAMES.indexOf(b.code);
		if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
		if (aIndex !== -1) return -1;
		if (bIndex !== -1) return 1;
		return a.name.localeCompare(b.name);
	});

	const categoryCounts = sortedGames.reduce(
		(acc, game) => {
			const cat = game.category ?? "others";
			acc[cat] = (acc[cat] ?? 0) + 1;
			return acc;
		},
		{} as Record<string, number>,
	);

	const filteredGames = selectedCategory
		? sortedGames.filter((game) => (game.category ?? "others") === selectedCategory)
		: sortedGames;

	const chunkSize = 3;
	const gameChunks: Game[][] = [];
	for (let i = 0; i < filteredGames.length; i += chunkSize) {
		gameChunks.push(filteredGames.slice(i, i + chunkSize));
	}

	const handleGameClick = async (game: Game) => {
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
				state: { gameUrl } as any,
			});
		} catch (error) {
			console.error("Failed to launch game:", error);
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

		if (knownGame) {
			return {
				name: game.name,
				subtitle: knownGame.subtitle || "",
				icon: knownGame.icon,
				image: knownGame.image || "",
				gradient: knownGame.gradient,
			};
		}

		return {
			name: game.name,
			subtitle: "Play now",
			icon: undefined,
			image: game.imageUrl || "",
			gradient: DEFAULT_GRADIENT,
		};
	};

	if (isSessionLoading || isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center dark:bg-[#121212]">
				<Loader2 className="h-10 w-10 animate-spin dark:text-white text-primary" />
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

	if (!isSessionLoading && !session?.user) {
		return <Navigate to="/auth/sign-in" />;
	}

	return (
		<div className="min-h-screen dark:bg-[#121212]">
			<div className="container mx-auto px-4 py-8">
				<h1 className="mb-6 font-bold text-2xl text-gray-900 dark:text-white">
					All Games
				</h1>

				<div className="mb-8 flex overflow-x-auto gap-3 pb-2 scrollbar-hide">
					<button
						onClick={() => setSelectedCategory(null)}
						className={`flex items-center shrink-0 gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition-colors ${selectedCategory === null
							? "border-[#1BAA04] bg-[#1BAA04] text-white"
							: "border-[#1B2722] text-gray-300 hover:border-gray-500"
							}`}
					>
						All
						<span
							className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] ${selectedCategory === null
								? "bg-[#040C01] text-white"
								: "bg-[#1B2722] text-gray-300"
								}`}
						>
							{sortedGames.length}
						</span>
					</button>
					{CATEGORIES.map((cat) => {
						const count = categoryCounts[cat] ?? 0;
						return (
							<button
								key={cat}
								onClick={() =>
									setSelectedCategory(
										selectedCategory === cat ? null : cat,
									)
								}
								className={`flex items-center shrink-0 gap-2 rounded-2xl border px-4 py-2 text-sm font-medium capitalize transition-colors ${selectedCategory === cat
									? "border-[#1BAA04] bg-[#1BAA04] text-white"
									: count === 0
										? "border-[#1B2722] text-gray-600 cursor-default"
										: "border-[#1B2722] text-gray-300 hover:border-gray-500"
									}`}
							>
								{cat}
								<span
									className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] ${selectedCategory === cat
										? "bg-white/20 text-white"
										: "bg-[#1B2722] text-gray-300"
										}`}
								>
									{count}
								</span>
							</button>
						);
					})}
				</div>

				{filteredGames.length === 0 ? (
					<p className="text-center text-gray-500">
						No games found in this category.
					</p>
				) : (
					<>
						<div className="flex flex-col gap-4 lg:hidden">
							{gameChunks.map((chunk, rowIndex) => (
								<div
									key={rowIndex}
									className="flex overflow-x-auto gap-2 snap-x snap-mandatory scrollbar-hide"
								>
									{chunk.map((game) => {
										const display = getGameDisplay(game);
										return (
											<div
												key={game.code}
												className="relative flex h-[240px] flex-none snap-start cursor-pointer flex-col items-center justify-end overflow-hidden rounded-lg border border-gray-200 p-3"
												style={{ background: display.gradient, flex: "0 0 160px" }}
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
														className="absolute inset-0 h-full w-full object-contain p-2 transition-opacity"
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
														<span className="text-4xl font-bold text-white/50">
															{display.name.charAt(0)}
														</span>
													</div>
												)}
												<p
													className="text-center font-normal text-[27px] text-white"
													style={{ fontFamily: "Luckiest Guy" }}
												>
													{display.name}
												</p>
												{display.subtitle && (
													<p
														className="text-center text-gray-100 text-sm"
														style={{ fontFamily: "Quicksand" }}
													>
														{display.subtitle}
													</p>
												)}
											</div>
										);
									})}
								</div>
							))}
						</div>

						<div className="hidden lg:grid lg:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] lg:gap-6">
							{filteredGames.map((game) => {
								const display = getGameDisplay(game);
								return (
									<div
										key={game.code}
										className="relative flex h-[270px] w-full cursor-pointer flex-col items-center justify-end overflow-hidden rounded-lg border border-gray-200 p-3"
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
												className="absolute inset-0 h-full w-full object-contain p-2 transition-opacity"
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
												<span className="text-4xl font-bold text-white/50">
													{display.name.charAt(0)}
												</span>
											</div>
										)}
										<p
											className="text-center font-normal text-[27px] text-white"
											style={{ fontFamily: "Luckiest Guy" }}
										>
											{display.name}
										</p>
										{display.subtitle && (
											<p
												className="text-center text-gray-100 text-sm"
												style={{ fontFamily: "Quicksand" }}
											>
												{display.subtitle}
											</p>
										)}
									</div>
								);
							})}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
