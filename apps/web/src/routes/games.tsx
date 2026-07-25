import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, type Variants } from "framer-motion";
import { Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth/client";
import {
	buildScorpioCategoryTabs,
	fetchScorpioLobbyGames,
	launchScorpioGame,
	type ScorpioLobbyGame,
} from "@/lib/scorpio-catalog";
import { cn } from "@/lib/utils";
import FilerAToZ from "@/logos/FilerAToZ";

export const Route = createFileRoute("/games")({
	component: GamesPage,
	validateSearch: (search: Record<string, unknown>): { category?: string } => ({
		category: (search.category as string) || undefined,
	}),
});

type Game = ScorpioLobbyGame;

const DEFAULT_GRADIENT =
	"linear-gradient(to bottom, #1a1a2e, #16213e, #0f3460)";

const PAGE_SIZE = 24;
const PLACEHOLDER_IMAGE = "/lagos-rush.png";

function GamesPage() {
	const navigate = useNavigate({ from: "/games" });
	const { category } = Route.useSearch();
	const [loadingGame, setLoadingGame] = useState<string | null>(null);
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
	const [searchInput, setSearchInput] = useState("");
	const [search, setSearch] = useState("");
	const [sortAsc, setSortAsc] = useState<boolean | null>(null);
	const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
	const [launchError, setLaunchError] = useState<string | null>(null);

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
		refetch,
		isFetching,
	} = useQuery<Game[]>({
		queryKey: ["scorpio-games"],
		// Catalog is public; only launch requires auth
		enabled: !isSessionLoading,
		queryFn: fetchScorpioLobbyGames,
		staleTime: 60_000,
	});

	const categoryTabs = useMemo(
		() => buildScorpioCategoryTabs(allGames),
		[allGames],
	);

	const categoryCounts = useMemo(() => {
		const counts: Record<string, number> = {};
		for (const cat of categoryTabs) {
			counts[cat.slug] = allGames.filter((g) =>
				g.categories.some((c) => c.slug === cat.slug),
			).length;
		}
		return counts;
	}, [allGames, categoryTabs]);

	const filteredGames = useMemo(() => {
		let list = allGames;

		if (selectedCategory) {
			list = list.filter((g) =>
				g.categories.some((c) => c.slug === selectedCategory),
			);
		}

		if (search) {
			const q = search.toLowerCase();
			list = list.filter((g) => {
				const inName = g.name.toLowerCase().includes(q);
				const inProvider = g.providerName.toLowerCase().includes(q);
				const inCategory = g.categories.some(
					(c) =>
						c.name.toLowerCase().includes(q) ||
						c.slug.toLowerCase().includes(q),
				);
				return inName || inProvider || inCategory;
			});
		}

		return list;
	}, [allGames, selectedCategory, search]);

	const sortedGames = useMemo(() => {
		const list = [...filteredGames];
		list.sort((a, b) => {
			if (sortAsc === true) return a.name.localeCompare(b.name);
			if (sortAsc === false) return b.name.localeCompare(a.name);
			return a.name.localeCompare(b.name);
		});
		return list;
	}, [filteredGames, sortAsc]);

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
			navigate({
				to: "/auth/sign-in",
				search: {
					returnTo: window.location.pathname + window.location.search,
				},
			});
			return;
		}

		setLaunchError(null);
		setLoadingGame(game.id);
		try {
			const { url: gameUrl } = await launchScorpioGame({
				providerId: game.providerId,
				gameCode: game.code,
				returnUrl: `${window.location.origin}/games`,
			});

			navigate({
				to: "/game/$gameId",
				params: { gameId: game.code },
				search: { category: selectedCategory || undefined },
				state: { gameUrl } as never,
			});
		} catch (err) {
			if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
				navigate({
					to: "/auth/sign-in",
					search: {
						returnTo: window.location.pathname + window.location.search,
					},
				});
				return;
			}
			setLaunchError(
				err instanceof Error ? err.message : "Failed to launch game",
			);
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
		const typeCategory = game.categories.find((c) => c.id.startsWith("type-"));
		const categoryLabel =
			typeCategory?.name ??
			game.categories.find((c) => c.id !== String(game.providerId))?.name;
		return {
			name: game.name,
			subtitle: [game.providerName, categoryLabel].filter(Boolean).join(" · "),
			image: game.imageUrl || PLACEHOLDER_IMAGE,
			gradient: DEFAULT_GRADIENT,
			enabled: game.enabled,
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
			<div className="flex min-h-screen flex-col items-center justify-center gap-4 dark:bg-[#121212] px-4">
				<p className="text-center text-red-500">
					{error instanceof ApiError
						? error.message
						: "Failed to load games. Please try again."}
				</p>
				<button
					type="button"
					onClick={() => refetch()}
					disabled={isFetching}
					className="rounded-lg border border-[#1BAA04] px-4 py-2 text-sm text-white"
				>
					{isFetching ? "Retrying…" : "Retry"}
				</button>
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
									placeholder="Search games, providers, categories"
									value={searchInput}
									onChange={(e) => setSearchInput(e.target.value)}
									className="w-full pl-4 pr-10 py-2 bg-[#1B2722] border border-[#2a3a33] rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:border-[#1BAA04] transition-colors"
								/>
								<Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
							</div>

							{selectedCategory === null && (
								<button
									type="button"
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

					{launchError && (
						<p className="mb-3 text-sm text-red-400">{launchError}</p>
					)}

					<div className="flex overflow-x-auto gap-3 pb-2 better-scrollbar">
						<button
							type="button"
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
							🎮 All Games
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
						{categoryTabs.map((cat) => (
							<button
								type="button"
								key={cat.slug}
								onClick={() =>
									navigate({
										search: (prev) => ({
											...prev,
											category:
												selectedCategory === cat.slug ? undefined : cat.slug,
										}),
									})
								}
								className={`flex items-center shrink-0 gap-2 text-white rounded-2xl border px-4 py-2 text-sm font-medium capitalize transition-colors cursor-pointer ${
									selectedCategory === cat.slug
										? "border-[#1BAA04] bg-[#1BAA04]"
										: "border-[#1B2722] text-gray-300 hover:border-[#1B2722]"
								}`}
							>
								<span className="capitalize">{cat.name}</span>
								<span
									className={`flex h-7 min-w-[28px] px-2 items-center justify-center rounded-full text-[11px] ${
										selectedCategory === cat.slug
											? "bg-[#040C01] text-white"
											: "bg-[#1B2722] text-gray-300"
									}`}
								>
									{categoryCounts[cat.slug]?.toLocaleString() ?? 0}
								</span>
							</button>
						))}
					</div>
				</div>

				{displayGames.length === 0 ? (
					<p className="text-center text-gray-500">
						{allGames.length === 0
							? "No Scorpio games available right now."
							: "No games found in this category."}
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
												key={game.id}
												variants={itemVariants}
												className={cn(
													"relative flex flex-none snap-start cursor-pointer flex-col items-center justify-end overflow-hidden rounded-xl transition-all hover:scale-[1.02]",
													loadingGame === game.id &&
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
												{loadingGame === game.id && (
													<div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
														<Loader2 className="h-6 w-6 animate-spin text-white" />
													</div>
												)}

												<img
													src={display.image}
													alt={display.name}
													loading="lazy"
													className="absolute inset-0 h-full w-full object-cover transition-opacity"
													style={{
														opacity: loadingGame === game.id ? 0.35 : 1,
													}}
													onError={(e) => {
														e.currentTarget.src = PLACEHOLDER_IMAGE;
													}}
												/>

												<div className="relative z-[1] w-full bg-gradient-to-t from-black/80 to-transparent px-1 pb-1.5 pt-6 text-center">
													<p className="truncate text-[11px] font-medium text-white">
														{display.name}
													</p>
													<p className="truncate text-[9px] text-white/70">
														{display.subtitle}
													</p>
												</div>
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
										key={game.id}
										variants={itemVariants}
										className={cn(
											"relative flex aspect-square w-full cursor-pointer flex-col items-center justify-end overflow-hidden rounded-2xl transition-all hover:scale-[1.02]",
											loadingGame === game.id &&
												"ring-2 ring-accent ring-offset-2 ring-offset-background cursor-wait scale-[0.98] opacity-90",
										)}
										style={{ background: display.gradient }}
										onClick={() => handleGameClick(game)}
										onKeyDown={(e) => handleKeyDown(e, game)}
										role="button"
										tabIndex={0}
									>
										{loadingGame === game.id && (
											<div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
												<Loader2 className="h-10 w-10 animate-spin text-white" />
											</div>
										)}

										<img
											src={display.image}
											alt={display.name}
											loading="lazy"
											className="absolute inset-0 h-full w-full object-cover transition-opacity"
											style={{
												opacity: loadingGame === game.id ? 0.35 : 1,
											}}
											onError={(e) => {
												e.currentTarget.src = PLACEHOLDER_IMAGE;
											}}
										/>

										<div className="relative z-[1] w-full bg-gradient-to-t from-black/80 to-transparent px-2 pb-3 pt-8 text-center">
											<p className="truncate text-sm font-medium text-white">
												{display.name}
											</p>
											<p className="truncate text-xs text-white/70">
												{display.subtitle}
											</p>
										</div>
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
