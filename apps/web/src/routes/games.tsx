import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, type Variants } from "framer-motion";
import { Loader2, Search } from "lucide-react";
import {
	type ComponentType,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	CasinoLaunchActions,
	CasinoLaunchSheet,
} from "@/components/casino-launch-actions";
import { CasinoLobbyArt } from "@/components/casino-lobby-art";
import { InsufficientBalanceModal } from "@/components/insufficient-balance-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth/client";
import {
	CLASSIC_CATEGORIES,
	CLASSIC_CATEGORY_EMOJIS,
	CLASSIC_CATEGORY_LABELS,
	CLASSIC_KNOWN_GAMES,
	CLASSIC_PRIORITY_GAMES,
	CLASSIC_THUNDR_CODES,
	type ClassicLaunchMode,
	type ClassicLobbyGame,
	classicCategoryCounts,
	fetchClassicLobbyGames,
	filterClassicGames,
	isSlotegratorLobbyGame,
	launchClassicGame,
	resolveKnownLobbyImage,
} from "@/lib/classic-lobby";
import {
	canonicalLobbySlug,
	gameMatchesLobbyCategory,
	overlayScorpioLobbyCategories,
} from "@/lib/lobby-categories";
import {
	excludeScorpioStoredGames,
	mergeLobbyGames,
	parseScorpioStoredCode,
} from "@/lib/lobby-games";
import {
	fetchScorpioLobbyGames,
	launchScorpioGame,
	type ScorpioLobbyGame,
} from "@/lib/scorpio-catalog";
import { cn } from "@/lib/utils";
import FilerAToZ from "@/logos/FilerAToZ";

export const Route = createFileRoute("/games")({
	component: GamesPage,
	validateSearch: (
		search: Record<string, unknown>,
	): { category?: string; play?: string } => ({
		category:
			typeof search.category === "string" && search.category
				? canonicalLobbySlug(search.category)
				: undefined,
		play:
			typeof search.play === "string" && search.play.trim()
				? search.play.trim()
				: undefined,
	}),
});

type LobbyGame = ScorpioLobbyGame | ClassicLobbyGame;

const DEFAULT_GRADIENT =
	"linear-gradient(to bottom, #1a1a2e, #16213e, #0f3460)";

const PAGE_SIZE = 24;

const GAMES_HIDDEN_FROM_ALL = new Set(CLASSIC_THUNDR_CODES);

function isScorpioGame(game: LobbyGame): game is ScorpioLobbyGame {
	return "provider" in game && game.provider === "scorpio";
}

function scorpioMatchesCategory(
	game: ScorpioLobbyGame,
	category: string,
): boolean {
	if (
		category === "popular" ||
		category === "pvp" ||
		category === "original" ||
		category === "virtuals"
	) {
		return false;
	}
	return gameMatchesLobbyCategory(game, category);
}

function GamesPage() {
	const navigate = useNavigate({ from: "/games" });
	const { category, play } = Route.useSearch();
	const [loadingGame, setLoadingGame] = useState<string | null>(null);
	const [activeLaunchId, setActiveLaunchId] = useState<string | null>(null);
	const [showBalanceModal, setShowBalanceModal] = useState(false);
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
	const [searchInput, setSearchInput] = useState("");
	const [search, setSearch] = useState("");
	const [sortAsc, setSortAsc] = useState<boolean | null>(null);
	const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
	const [launchError, setLaunchError] = useState<string | null>(null);
	const autoPlayHandledRef = useRef<string | null>(null);

	useEffect(() => {
		setSelectedCategory(category || null);
	}, [category]);

	useEffect(() => {
		window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
		document.querySelectorAll("main").forEach((main) => {
			main.scrollTo({ top: 0, left: 0, behavior: "smooth" });
		});
	}, [selectedCategory]);

	useEffect(() => {
		setDisplayCount(PAGE_SIZE);
	}, [selectedCategory, search]);

	useEffect(() => {
		const timer = setTimeout(() => setSearch(searchInput), 300);
		return () => clearTimeout(timer);
	}, [searchInput]);

	const containerVariants: Variants = {
		hidden: { opacity: 0 },
		show: {
			opacity: 1,
			transition: { staggerChildren: 0.04 },
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

	const scorpioQuery = useQuery<ScorpioLobbyGame[]>({
		queryKey: ["scorpio-games"],
		enabled: !isSessionLoading,
		queryFn: fetchScorpioLobbyGames,
		staleTime: 60_000,
		retry: 1,
	});

	const classicQuery = useQuery<ClassicLobbyGame[]>({
		queryKey: ["games"],
		enabled: !isSessionLoading,
		queryFn: fetchClassicLobbyGames,
		staleTime: 60_000,
		retry: 1,
	});

	const classicGames = classicQuery.data ?? [];
	const scorpioGames = useMemo(
		() =>
			overlayScorpioLobbyCategories(
				scorpioQuery.data ?? [],
				classicQuery.data ?? [],
			),
		[scorpioQuery.data, classicQuery.data],
	);

	const allGames = useMemo(
		() => mergeLobbyGames(classicGames, scorpioGames),
		[classicGames, scorpioGames],
	);

	const allGamesVisible = useMemo(
		() => allGames.filter((g) => !GAMES_HIDDEN_FROM_ALL.has(g.code)),
		[allGames],
	);

	const isLoading =
		isSessionLoading ||
		((classicQuery.isLoading || scorpioQuery.isLoading) &&
			allGames.length === 0);
	const isFetching = classicQuery.isFetching || scorpioQuery.isFetching;
	const error =
		classicQuery.isError && scorpioQuery.isError && allGames.length === 0
			? (classicQuery.error ?? scorpioQuery.error)
			: null;

	const refetch = () => {
		void classicQuery.refetch();
		void scorpioQuery.refetch();
	};

	const categoryTabs = useMemo(
		() =>
			CLASSIC_CATEGORIES.map((slug) => ({
				slug,
				name: CLASSIC_CATEGORY_LABELS[slug] ?? slug.replace(/-/g, " "),
				emoji: CLASSIC_CATEGORY_EMOJIS[slug],
			})),
		[],
	);

	const categoryCounts = useMemo(() => {
		const counts = classicCategoryCounts(
			excludeScorpioStoredGames(classicGames),
		);
		for (const slug of CLASSIC_CATEGORIES) {
			if (
				slug === "popular" ||
				slug === "pvp" ||
				slug === "original" ||
				slug === "virtuals"
			) {
				continue;
			}
			const scorpioCount = scorpioGames.filter((g) =>
				scorpioMatchesCategory(g, slug),
			).length;
			counts[slug] = (counts[slug] ?? 0) + scorpioCount;
		}
		return counts;
	}, [classicGames, scorpioGames]);

	const filteredGames = useMemo(() => {
		const classicFiltered = filterClassicGames(
			classicGames,
			selectedCategory,
			search,
		);

		let scorpioFiltered = scorpioGames;
		if (selectedCategory) {
			scorpioFiltered = scorpioGames.filter((g) =>
				scorpioMatchesCategory(g, selectedCategory),
			);
		}
		if (search) {
			const q = search.toLowerCase();
			scorpioFiltered = scorpioFiltered.filter((g) => {
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

		const visibleClassicFiltered = !selectedCategory
			? classicFiltered.filter((g) => !GAMES_HIDDEN_FROM_ALL.has(g.code))
			: classicFiltered;
		const visibleScorpioFiltered = !selectedCategory
			? scorpioFiltered.filter((g) => !GAMES_HIDDEN_FROM_ALL.has(g.code))
			: scorpioFiltered;

		return mergeLobbyGames(visibleClassicFiltered, visibleScorpioFiltered);
	}, [classicGames, scorpioGames, selectedCategory, search]);

	const sortedGames = useMemo(() => {
		const list = [...filteredGames];
		list.sort((a, b) => {
			const aAviator = a.name.toLowerCase().includes("aviator");
			const bAviator = b.name.toLowerCase().includes("aviator");
			if (aAviator && !bAviator) return -1;
			if (!aAviator && bAviator) return 1;

			if (sortAsc === true) return a.name.localeCompare(b.name);
			if (sortAsc === false) return b.name.localeCompare(a.name);

			const aPriority = CLASSIC_PRIORITY_GAMES.indexOf(
				a.code as (typeof CLASSIC_PRIORITY_GAMES)[number],
			);
			const bPriority = CLASSIC_PRIORITY_GAMES.indexOf(
				b.code as (typeof CLASSIC_PRIORITY_GAMES)[number],
			);
			if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
			if (aPriority !== -1) return -1;
			if (bPriority !== -1) return 1;

			// Classic (Slotegrator) before Scorpio when otherwise equal
			const aScorpio = isScorpioGame(a);
			const bScorpio = isScorpioGame(b);
			if (!aScorpio && bScorpio) return -1;
			if (aScorpio && !bScorpio) return 1;

			return a.name.localeCompare(b.name);
		});
		return list;
	}, [filteredGames, sortAsc]);

	const displayGames = sortedGames.slice(0, displayCount);
	const hasMore = sortedGames.length > displayCount;

	const chunkSize = 3;
	const gameChunks: LobbyGame[][] = [];
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

	const goSignIn = () => {
		navigate({
			to: "/auth/sign-in",
			search: {
				returnTo: window.location.pathname + window.location.search,
			},
		});
	};

	const supportsDualLaunch = (game: LobbyGame) =>
		!isScorpioGame(game) && isSlotegratorLobbyGame(game);

	const handleGameLaunch = async (
		game: LobbyGame,
		mode: ClassicLaunchMode = "real",
	) => {
		const needsAuth =
			isScorpioGame(game) ||
			parseScorpioStoredCode(game.code) != null ||
			mode === "real";
		if (needsAuth && !session?.user) {
			goSignIn();
			return;
		}

		setLaunchError(null);
		setActiveLaunchId(null);
		setLoadingGame(game.id);
		try {
			let gameUrl: string | null;

			if (isScorpioGame(game)) {
				const launch = await launchScorpioGame({
					providerId: game.providerId,
					gameCode: game.code,
					returnUrl: `${window.location.origin}/games`,
				});
				gameUrl = launch.url;
			} else {
				const stored = parseScorpioStoredCode(game.code);
				if (stored) {
					const launch = await launchScorpioGame({
						providerId: stored.providerId,
						gameCode: stored.gameCode,
						returnUrl: `${window.location.origin}/games`,
					});
					gameUrl = launch.url;
				} else {
					gameUrl = await launchClassicGame(game, { mode });
					if (!gameUrl) return;
				}
			}

			navigate({
				to: "/game/$gameId",
				params: { gameId: game.code },
				search: {
					category: selectedCategory || undefined,
				},
				state: { gameUrl } as never,
			});
		} catch (err) {
			const status =
				err instanceof ApiError
					? err.status
					: typeof err === "object" &&
							err &&
							"status" in err &&
							typeof (err as { status?: number }).status === "number"
						? (err as { status: number }).status
						: null;
			const message =
				err instanceof Error ? err.message : "Failed to launch game";
			const isSessionMissing =
				message === "Unauthorized" ||
				((status === 401 || status === 403) &&
					/unauthorized|not authenticated/i.test(message));
			if (isSessionMissing) {
				goSignIn();
				return;
			}
			if (/insufficient|not enough|balance/i.test(message)) {
				setShowBalanceModal(true);
				return;
			}
			const friendly = /demo url|does not support demo|demo mode/i.test(message)
				? "Demo is not available for this game. Try Play Now."
				: /immediate_exit|could not start|closed the session|zero limits/i.test(
							message,
						)
					? "This game is not playable yet on our Slotegrator contract. Try another title or provider."
					: message;
			setLaunchError(friendly);
		} finally {
			setLoadingGame(null);
		}
	};

	const handleCardActivate = (game: LobbyGame) => {
		if (supportsDualLaunch(game)) {
			setActiveLaunchId((prev) => (prev === game.id ? null : game.id));
			return;
		}
		void handleGameLaunch(game, "real");
	};

	useEffect(() => {
		if (!play || isLoading || allGames.length === 0) return;
		if (autoPlayHandledRef.current === play) return;
		autoPlayHandledRef.current = play;

		const needle = play.trim().toLowerCase();
		const target = allGames.find((game) => {
			const id = game.id.trim().toLowerCase();
			const code = game.code.trim().toLowerCase();
			return id === needle || code === needle;
		});

		navigate({
			to: "/games",
			search: {
				category: selectedCategory || undefined,
				play: undefined,
			},
			replace: true,
		});

		if (!target) {
			setLaunchError(
				"This mission game is not available in the lobby yet. Pick another title below.",
			);
			return;
		}

		handleCardActivate(target);
	}, [play, isLoading, allGames, navigate, selectedCategory]);

	const activeLaunchGame = useMemo(
		() =>
			activeLaunchId
				? (displayGames.find((g) => g.id === activeLaunchId) ??
					allGames.find((g) => g.id === activeLaunchId) ??
					null)
				: null,
		[activeLaunchId, displayGames, allGames],
	);

	const handleKeyDown = (e: React.KeyboardEvent, game: LobbyGame) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			handleCardActivate(game);
		}
	};

	const getGameDisplay = (game: LobbyGame) => {
		const image = resolveKnownLobbyImage(game);
		const fallback =
			"fallbackImageUrl" in game ? (game.fallbackImageUrl ?? null) : null;
		if (!isScorpioGame(game)) {
			const known = CLASSIC_KNOWN_GAMES[game.code];
			return {
				name: game.name,
				image,
				fallback,
				Icon: image ? undefined : known?.icon,
				gradient: known?.gradient ?? DEFAULT_GRADIENT,
			};
		}

		return {
			name: game.name,
			image,
			fallback,
			Icon: undefined as ComponentType<{ className?: string }> | undefined,
			gradient: DEFAULT_GRADIENT,
		};
	};

	if (isLoading) {
		return (
			<div className="min-h-screen dark:bg-[#121212]">
				<div className="container relative mx-auto px-4 pb-8">
					<div className="sticky top-0 z-20 mb-4 bg-[#121212] pt-8 pb-4">
						<Skeleton className="mb-6 h-8 w-40 bg-gray-200 dark:bg-[#1B2722]" />
						<div className="scrollbar-hide flex gap-3 overflow-x-auto pb-2">
							{Array.from({ length: 8 }).map((_, i) => (
								<Skeleton
									key={i}
									className="h-9 w-24 shrink-0 rounded-2xl bg-gray-200 dark:bg-[#1B2722]"
								/>
							))}
						</div>
					</div>
					<div className="hidden gap-4 md:grid md:grid-cols-4">
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
			<div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 dark:bg-[#121212]">
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
			<InsufficientBalanceModal
				isOpen={showBalanceModal}
				onClose={() => setShowBalanceModal(false)}
				onTopUp={() => {
					setShowBalanceModal(false);
					navigate({ to: "/wallet" });
				}}
			/>
			<CasinoLaunchSheet
				open={Boolean(activeLaunchGame)}
				gameName={activeLaunchGame?.name ?? ""}
				loading={Boolean(
					activeLaunchGame && loadingGame === activeLaunchGame.id,
				)}
				onClose={() => setActiveLaunchId(null)}
				onDemo={() => {
					if (activeLaunchGame) void handleGameLaunch(activeLaunchGame, "demo");
				}}
				onPlay={() => {
					if (activeLaunchGame) void handleGameLaunch(activeLaunchGame, "real");
				}}
			/>
			<div className="container relative mx-auto px-4 pb-8">
				<div className="sticky top-0 z-20 mb-4 bg-[#121212] pt-8 pb-4">
					<div className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-center">
						<h1 className="font-bold text-2xl text-gray-900 dark:text-white">
							Casino
						</h1>

						<div className="flex flex-wrap items-center gap-2">
							<div className="relative min-w-[200px] flex-1 md:w-[300px]">
								<input
									type="text"
									placeholder="Search games"
									value={searchInput}
									onChange={(e) => setSearchInput(e.target.value)}
									className="w-full rounded-lg border border-[#2a3a33] bg-[#1B2722] py-2 pr-10 pl-4 text-sm text-white placeholder-gray-400 transition-colors focus:border-[#1BAA04] focus:outline-none"
								/>
								<Search className="absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-gray-400" />
							</div>

							{selectedCategory === null && (
								<button
									type="button"
									onClick={() =>
										setSortAsc((prev) =>
											prev === null ? true : prev === true ? false : null,
										)
									}
									className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border ${
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
						<p className="mb-3 text-red-400 text-sm">{launchError}</p>
					)}

					{(classicQuery.isError || scorpioQuery.isError) &&
						allGames.length > 0 && (
							<p className="mb-3 text-amber-400 text-sm">
								{classicQuery.isError && scorpioQuery.isError
									? null
									: classicQuery.isError
										? "Classic games could not be loaded; showing Scorpio only."
										: "Scorpio games could not be loaded; showing Classic only."}
							</p>
						)}

					<div className="better-scrollbar flex gap-3 overflow-x-auto pb-2">
						<button
							type="button"
							onClick={() =>
								navigate({
									search: (prev) => ({ ...prev, category: undefined }),
								})
							}
							className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-2xl border px-4 py-2 font-medium text-sm transition-colors ${
								selectedCategory === null
									? "border-[#1BAA04] bg-[#1BAA04] text-white"
									: "border-[#1B2722] text-gray-300"
							}`}
						>
							🎮 All Games
							<span
								className={`flex h-7 min-w-[28px] items-center justify-center rounded-full px-2 text-[11px] ${
									selectedCategory === null
										? "bg-[#040C01] text-white"
										: "bg-[#1B2722] text-gray-300"
								}`}
							>
								{allGamesVisible.length.toLocaleString()}
							</span>
						</button>
						{categoryTabs.map((cat) => {
							const isActive =
								selectedCategory != null &&
								canonicalLobbySlug(selectedCategory) ===
									canonicalLobbySlug(cat.slug);
							return (
								<button
									type="button"
									key={cat.slug}
									onClick={() =>
										navigate({
											search: (prev) => ({
												...prev,
												category: isActive ? undefined : cat.slug,
											}),
										})
									}
									className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-2xl border px-4 py-2 font-medium text-sm text-white transition-colors ${
										isActive
											? "border-[#1BAA04] bg-[#1BAA04]"
											: "border-[#1B2722] text-gray-300"
									}`}
								>
									{cat.emoji ? <span>{cat.emoji}</span> : null}
									<span>{cat.name}</span>
									<span
										className={`flex h-7 min-w-[28px] items-center justify-center rounded-full px-2 text-[11px] ${
											isActive
												? "bg-[#040C01] text-white"
												: "bg-[#1B2722] text-gray-300"
										}`}
									>
										{categoryCounts[cat.slug]?.toLocaleString() ?? 0}
									</span>
								</button>
							);
						})}
					</div>
				</div>

				{displayGames.length === 0 ? (
					<p className="text-center text-gray-500">
						{allGames.length === 0
							? "No games available right now."
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
									className="scrollbar-hide flex snap-x snap-mandatory gap-2 overflow-x-auto"
								>
									{chunk.map((game) => {
										const display = getGameDisplay(game);
										const dual = supportsDualLaunch(game);
										return (
											<motion.div
												key={game.id}
												variants={itemVariants}
												className={cn(
													"group relative flex flex-none cursor-pointer snap-start flex-col items-center justify-end overflow-hidden rounded-xl transition-all hover:scale-[1.02]",
													loadingGame === game.id &&
														"scale-[0.98] cursor-wait opacity-90 ring-2 ring-accent ring-offset-2 ring-offset-background",
												)}
												style={{
													background: display.gradient,
													flex: "0 0 110px",
													height: "110px",
												}}
												onClick={() => handleCardActivate(game)}
												onKeyDown={(e) => handleKeyDown(e, game)}
												role="button"
												tabIndex={0}
											>
												{loadingGame === game.id && !dual && (
													<div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
														<Loader2 className="h-6 w-6 animate-spin text-white" />
													</div>
												)}
												<CasinoLobbyArt
													src={display.image}
													fallbackSrc={display.fallback}
													name={display.name}
													icon={display.Icon}
													dimmed={loadingGame === game.id}
													compact
												/>
												{dual && (
													<CasinoLaunchActions
														compact
														active={activeLaunchId === game.id}
														loading={loadingGame === game.id}
														onDemo={() => void handleGameLaunch(game, "demo")}
														onPlay={() => void handleGameLaunch(game, "real")}
													/>
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
							className="hidden gap-4 md:grid md:grid-cols-4 lg:grid-cols-6"
						>
							{displayGames.map((game) => {
								const display = getGameDisplay(game);
								const dual = supportsDualLaunch(game);
								return (
									<motion.div
										key={game.id}
										variants={itemVariants}
										className={cn(
											"group relative flex aspect-square w-full cursor-pointer flex-col items-center justify-end overflow-hidden rounded-2xl transition-all hover:scale-[1.02]",
											loadingGame === game.id &&
												"scale-[0.98] cursor-wait opacity-90 ring-2 ring-accent ring-offset-2 ring-offset-background",
										)}
										style={{ background: display.gradient }}
										onClick={() => handleCardActivate(game)}
										onKeyDown={(e) => handleKeyDown(e, game)}
										role="button"
										tabIndex={0}
									>
										{loadingGame === game.id && !dual && (
											<div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
												<Loader2 className="h-10 w-10 animate-spin text-white" />
											</div>
										)}
										<CasinoLobbyArt
											src={display.image}
											fallbackSrc={display.fallback}
											name={display.name}
											icon={display.Icon}
											dimmed={loadingGame === game.id}
										/>
										{dual && (
											<CasinoLaunchActions
												active={activeLaunchId === game.id}
												loading={loadingGame === game.id}
												onDemo={() => void handleGameLaunch(game, "demo")}
												onPlay={() => void handleGameLaunch(game, "real")}
											/>
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
