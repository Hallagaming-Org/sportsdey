import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	CasinoLaunchActions,
	CasinoLaunchSheet,
} from "@/components/casino-launch-actions";
import { InsufficientBalanceModal } from "@/components/insufficient-balance-modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, apiRequest } from "@/lib/api";
import { signOut, useSession } from "@/lib/auth/client";
import {
	CLASSIC_KNOWN_GAMES,
	CLASSIC_PRIORITY_GAMES,
	type ClassicLaunchMode,
	type ClassicLobbyGame,
	fetchClassicLobbyGames,
	isSlotegratorLobbyGame,
	launchClassicGame,
} from "@/lib/classic-lobby";
import {
	fetchScorpioLobbyGames,
	launchScorpioGame,
	type ScorpioLobbyGame,
} from "@/lib/scorpio-catalog";
import {
	getSportsbookTheme,
	isSportsbookConfigured,
	loadSportsbookWidgets,
	SPORTSBOOK_CONTAINER_ID,
} from "@/lib/sportsbook";
import { cn } from "@/lib/utils";

const DEFAULT_GRADIENT = "linear-gradient(to bottom, #1a1a2e, #16213e, #0f3460)";
const HOT_CASINO_LIMIT = 30;
const WIDGET_LOAD_TIMEOUT_MS = 5000;

type HotLobbyGame =
	| ScorpioLobbyGame
	| (ClassicLobbyGame & { provider: "classic"; providerName: string });

function isScorpioHotGame(game: HotLobbyGame): game is ScorpioLobbyGame {
	return game.provider === "scorpio";
}

type TabId = "popular" | "casino";

interface TabConfig {
	id: TabId;
	label: string;
}

const TABS: TabConfig[] = [
	{ id: "popular", label: "Popular Matches" },
	{ id: "casino", label: "Hot Casino" },
];

export default function PopularAndCasinoSection() {
	const [activeTab, setActiveTab] = useState<TabId>("popular");
	const [isDark, setIsDark] = useState(true);
	const [widgetReady, setWidgetReady] = useState(false);
	const [widgetError, setWidgetError] = useState<string | null>(null);
	const [showBalanceModal, setShowBalanceModal] = useState(false);
	const navigate = useNavigate();
	const { data: session, isPending: isSessionLoading } = useSession();
	const userId = session?.user?.id;

	// Observe dark-mode class changes on <html>
	useEffect(() => {
		const isDarkMode = document.documentElement.classList.contains("dark");
		setIsDark(isDarkMode);
		const observer = new MutationObserver(() => {
			setIsDark(document.documentElement.classList.contains("dark"));
		});
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});
		return () => observer.disconnect();
	}, []);

	const isDarkRef = useRef(isDark);
	isDarkRef.current = isDark;

	// Re-init when auth identity changes so the sportsbook token includes player_id after login.
	useEffect(() => {
		if (!isSportsbookConfigured()) {
			setWidgetError(
				"Sportsbook widget is not configured. Set VITE_DATABET_SPA_BOOTSTRAP_SCRIPT.",
			);
			setWidgetReady(true);
			return;
		}

		// Wait for session resolution so we don't create a guest token then ignore login.
		if (isSessionLoading) return;

		let cancelled = false;
		setWidgetReady(false);
		setWidgetError(null);

		const fallbackTimer = window.setTimeout(() => {
			if (!cancelled) setWidgetReady(true);
		}, WIDGET_LOAD_TIMEOUT_MS);

		const init = async () => {
			try {
				const data = await apiRequest<{ token: string }>(
					"sportsbook/token/create",
					{ method: "POST", credentials: "include" },
				);
				if (cancelled) return;

				await loadSportsbookWidgets(
					data.token,
					isDarkRef.current,
					(bettingAPI) => {
						if (cancelled) return;
						setWidgetReady(true);

						bettingAPI.subscribe("redirect", ({ destination, link }) => {
							switch (destination) {
								case "login": {
									sessionStorage.setItem(
										"post_login_redirect",
										window.location.pathname + window.location.search,
									);
									navigate({
										to: "/auth/sign-in",
										search: {
											returnTo:
												window.location.pathname + window.location.search,
										},
									});
									break;
								}
								case "logout": {
									signOut().then(() => {
										navigate({ to: "/auth/sign-in" });
									});
									break;
								}
								case "betting-page": {
									if (link) {
										const cleanLink = link.startsWith("/")
											? link.slice(1)
											: link;
										navigate({
											to: "/sportsbetting/$",
											params: { _splat: cleanLink },
										});
									} else {
										navigate({ to: "/sportsbetting" });
									}
									window.scrollTo({ top: 0, behavior: "smooth" });
									break;
								}
							}
						});

						bettingAPI.subscribe("handle-not-enough-balance", () => {
							setShowBalanceModal(true);
						});
					},
				);
			} catch (err) {
				if (cancelled) return;
				const message =
					err instanceof Error ? err.message : "Failed to load popular matches.";
				setWidgetError(message);
				setWidgetReady(true);
			}
		};

		void init();

		return () => {
			cancelled = true;
			window.clearTimeout(fallbackTimer);
		};
	}, [isSessionLoading, userId, navigate]);

	return (
		<section className="space-y-4">
			<InsufficientBalanceModal
				isOpen={showBalanceModal}
				onClose={() => setShowBalanceModal(false)}
				onTopUp={() => {
					setShowBalanceModal(false);
					navigate({ to: "/wallet" });
				}}
			/>

			{/*
			 * Keep the Databet root mount in the DOM for the lifetime of this section.
			 * Unmounting it when switching to Hot Casino breaks betslip / widget state.
			 */}
			<div
				id={SPORTSBOOK_CONTAINER_ID}
				aria-hidden="true"
				style={{
					position: "absolute",
					width: 0,
					height: 0,
					overflow: "visible",
					pointerEvents: "none",
				}}
			/>

			<div
				role="tablist"
				aria-label="Popular matches and hot casino"
				className="flex flex-wrap items-center gap-2"
			>
				{TABS.map((tab) => {
					const isActive = activeTab === tab.id;
					return (
						<button
							key={tab.id}
							role="tab"
							aria-selected={isActive}
							aria-controls={`tab-panel-${tab.id}`}
							id={`tab-${tab.id}`}
							type="button"
							onClick={() => setActiveTab(tab.id)}
							className={cn(
								"cursor-pointer rounded-full px-4 py-2 font-semibold text-sm transition-colors",
								"focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
								isActive
									? "bg-accent text-accent-foreground shadow-sm"
									: "text-gray-600 hover:bg-accent/10 hover:text-accent dark:text-gray-300",
							)}
						>
							{tab.label}
						</button>
					);
				})}
			</div>

			<div
				role="tabpanel"
				id={`tab-panel-${activeTab}`}
				aria-labelledby={`tab-${activeTab}`}
				className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4 dark:border-0 dark:bg-card"
			>
				{/* Keep popular widget mounted so tab switches don't remount Databet widgets */}
				<div className={cn(activeTab !== "popular" && "hidden")}>
					<PopularMatchesPanel
						widgetReady={widgetReady}
						widgetError={widgetError}
						widgetStyle={buildWidgetStyle(isDark)}
						isDark={isDark}
					/>
				</div>
				{activeTab === "casino" && <HotCasinoPanel />}
			</div>
		</section>
	);
}

function buildWidgetStyle(isDark: boolean): React.CSSProperties {
	const palette = getSportsbookTheme(isDark, 0).palette;
	return {
		"--bet-font-sans": '"Inter", "Geist", ui-sans-serif, system-ui, sans-serif',
		"--bet-base-font-size": "14px",
		"--bet-colors-primary-1": isDark ? "#ffffff" : palette.colorsPrimary1,
		"--bet-colors-primary-2": palette.colorsPrimary2,
		"--bet-colors-secondary-1": palette.colorsSecondary1,
		"--bet-colors-secondary-2": palette.colorsSecondary2,
		"--bet-colors-secondary-3": palette.colorsSecondary3,
		"--bet-colors-accent-1": palette.colorsAccent1,
		"--bet-colors-accent-2": palette.colorsAccent2,
		"--bet-colors-accent-3": palette.colorsAccent3,
		"--bet-text-button": palette.textButton,
		"--bet-text-primary": palette.textPrimary,
		"--bet-text-secondary": palette.textSecondary,
		"--bet-notification-blocked": palette.notificationBlocked,
		"--bet-notification-error": palette.notificationError,
		"--bet-notification-info": palette.notificationInfo,
		"--bet-notification-success": palette.notificationSuccess,
		"--bet-notification-warning": palette.notificationWarning,
	} as React.CSSProperties;
}

interface PopularMatchesPanelProps {
	widgetReady: boolean;
	widgetError: string | null;
	widgetStyle: React.CSSProperties;
	isDark: boolean;
}

function PopularMatchesPanel({
	widgetReady,
	widgetError,
	widgetStyle,
	isDark,
}: PopularMatchesPanelProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [widgetContentReady, setWidgetContentReady] = useState(false);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const widget = container.querySelector("top-events-outside-widget");
		if (!widget) return;

		const hasContent = () =>
			widget.children.length > 0 ||
			(widget.shadowRoot !== null && widget.shadowRoot.children.length > 0);

		if (hasContent()) {
			setWidgetContentReady(true);
			return;
		}

		const observer = new MutationObserver(() => {
			if (hasContent()) {
				setWidgetContentReady(true);
				observer.disconnect();
				clearInterval(pollTimer);
			}
		});

		const setupObserver = () => {
			observer.observe(widget, { childList: true, subtree: true });
			if (widget.shadowRoot) {
				observer.observe(widget.shadowRoot, { childList: true, subtree: true });
			}
		};

		setupObserver();

		const pollTimer = setInterval(() => {
			if (hasContent()) {
				setWidgetContentReady(true);
				observer.disconnect();
				clearInterval(pollTimer);
			}
		}, 200);

		return () => {
			observer.disconnect();
			clearInterval(pollTimer);
		};
	}, []);

	if (widgetError) {
		return (
			<div className="flex h-48 items-center justify-center text-center text-gray-500 text-sm dark:text-gray-400">
				{widgetError}
			</div>
		);
	}

	const showSkeleton = !widgetReady && !widgetContentReady;

	return (
		<div ref={containerRef} className="relative min-h-[200px]">
			{showSkeleton && (
				<div className="absolute inset-0 z-10 flex flex-col gap-3 bg-white/80 sm:p-2 dark:bg-card/80">
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton key={i} className="h-20 w-full rounded-xl" />
					))}
				</div>
			)}

			<top-events-outside-widget
				sport-type="sports"
				with-sport-title={false}
				className="block w-full"
				style={widgetStyle}
				theme={isDark ? "dark" : "light"}
			/>
		</div>
	);
}

function HotCasinoPanel() {
	const navigate = useNavigate();
	const { data: session, isPending: isSessionLoading } = useSession();
	const [loadingId, setLoadingId] = useState<string | null>(null);
	const [activeLaunchId, setActiveLaunchId] = useState<string | null>(null);
	const [showBalanceModal, setShowBalanceModal] = useState(false);

	const scorpioQuery = useQuery<ScorpioLobbyGame[]>({
		queryKey: ["scorpio-games"],
		queryFn: fetchScorpioLobbyGames,
		enabled: !isSessionLoading,
		staleTime: 60_000,
	});

	const classicQuery = useQuery<ClassicLobbyGame[]>({
		queryKey: ["games"],
		queryFn: fetchClassicLobbyGames,
		enabled: !isSessionLoading,
		staleTime: 60_000,
	});

	const isLoading =
		(scorpioQuery.isLoading && !scorpioQuery.data) ||
		(classicQuery.isLoading && !classicQuery.data);
	const isError =
		scorpioQuery.isError &&
		classicQuery.isError &&
		!(scorpioQuery.data?.length || classicQuery.data?.length);
	const isFetching = scorpioQuery.isFetching || classicQuery.isFetching;
	const refetch = () => {
		void scorpioQuery.refetch();
		void classicQuery.refetch();
	};

	const hotGames = useMemo(() => {
		const classic: HotLobbyGame[] = (classicQuery.data ?? [])
			.filter((game) => game.enabled)
			.map((game) => ({
				...game,
				provider: "classic" as const,
				providerName: CLASSIC_KNOWN_GAMES[game.code]
					? "Classic"
					: "Slotegrator",
			}));

		const classicPriority = [...classic].sort((a, b) => {
			const aPri = CLASSIC_PRIORITY_GAMES.indexOf(a.code);
			const bPri = CLASSIC_PRIORITY_GAMES.indexOf(b.code);
			if (aPri !== -1 && bPri !== -1) return aPri - bPri;
			if (aPri !== -1) return -1;
			if (bPri !== -1) return 1;
			return a.name.localeCompare(b.name);
		});

		const scorpio = [...(scorpioQuery.data ?? [])]
			.filter((game) => game.enabled)
			.sort((a, b) => a.name.localeCompare(b.name));

		// Classic priority first so Slotegrator/Thndr originals appear, then Scorpio.
		const merged: HotLobbyGame[] = [...classicPriority, ...scorpio];
		const seen = new Set<string>();
		const unique: HotLobbyGame[] = [];
		for (const game of merged) {
			const key = `${game.provider}:${game.code}`;
			if (seen.has(key)) continue;
			seen.add(key);
			unique.push(game);
			if (unique.length >= HOT_CASINO_LIMIT) break;
		}
		return unique;
	}, [classicQuery.data, scorpioQuery.data]);

	const goSignIn = useCallback(() => {
		navigate({
			to: "/auth/sign-in",
			search: {
				returnTo: window.location.pathname + window.location.search,
			},
		});
	}, [navigate]);

	const supportsDualLaunch = (game: HotLobbyGame) =>
		!isScorpioHotGame(game) && isSlotegratorLobbyGame(game);

	const handleGameLaunch = useCallback(
		async (game: HotLobbyGame, mode: ClassicLaunchMode = "real") => {
			const needsAuth = isScorpioHotGame(game) || mode === "real";
			if (needsAuth && !session?.user) {
				goSignIn();
				return;
			}

			setActiveLaunchId(null);
			setLoadingId(game.id);
			try {
				let gameUrl: string | null;
				if (isScorpioHotGame(game)) {
					const launch = await launchScorpioGame({
						providerId: game.providerId,
						gameCode: game.code,
						returnUrl: `${window.location.origin}/games`,
					});
					gameUrl = launch.url;
				} else {
					gameUrl = await launchClassicGame(game, { mode });
					if (!gameUrl) return;
				}

				navigate({
					to: "/game/$gameId",
					params: { gameId: game.code },
					search: {},
					state: { gameUrl } as never,
				});
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Failed to launch game";
				const status = error instanceof ApiError ? error.status : null;
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
				const friendly =
					/demo url|does not support demo|demo mode/i.test(message)
						? "Demo is not available for this game. Try Play Now."
						: /immediate_exit|could not start|closed the session|zero limits/i.test(
									message,
							  )
							? "This game is not playable yet on our Slotegrator contract. Try another title."
							: message;
				toast.error(friendly);
			} finally {
				setLoadingId(null);
			}
		},
		[goSignIn, navigate, session?.user],
	);

	const handleCardActivate = (game: HotLobbyGame) => {
		if (supportsDualLaunch(game)) {
			setActiveLaunchId((prev) => (prev === game.id ? null : game.id));
			return;
		}
		void handleGameLaunch(game, "real");
	};

	const activeLaunchGame = useMemo(
		() =>
			activeLaunchId
				? (hotGames.find((g) => g.id === activeLaunchId) ?? null)
				: null,
		[activeLaunchId, hotGames],
	);

	if (isSessionLoading || isLoading) {
		return (
			<div className="custom-scrollbar grid snap-x snap-mandatory auto-cols-[110px] grid-flow-col gap-3 overflow-hidden pr-1 pb-2">
				{Array.from({ length: 10 }).map((_, i) => (
					<Skeleton
						key={`casino-skel-${i}`}
						className="h-[110px] w-full rounded-xl"
					/>
				))}
			</div>
		);
	}

	if (isError) {
		return (
			<div className="flex h-48 flex-col items-center justify-center gap-3 text-center text-gray-500 text-sm dark:text-gray-400">
				<p>Unable to load casino games right now.</p>
				<Button
					size="sm"
					variant="outline"
					disabled={isFetching}
					onClick={() => void refetch()}
				>
					{isFetching ? "Retrying…" : "Retry"}
				</Button>
			</div>
		);
	}

	if (hotGames.length === 0) {
		return (
			<div className="flex h-48 items-center justify-center text-center text-gray-500 text-sm dark:text-gray-400">
				No casino games available right now.
			</div>
		);
	}

	return (
		<>
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
					activeLaunchGame && loadingId === activeLaunchGame.id,
				)}
				onClose={() => setActiveLaunchId(null)}
				onDemo={() => {
					if (activeLaunchGame) void handleGameLaunch(activeLaunchGame, "demo");
				}}
				onPlay={() => {
					if (activeLaunchGame) void handleGameLaunch(activeLaunchGame, "real");
				}}
			/>
			<div className="custom-scrollbar grid snap-x snap-mandatory auto-cols-[110px] grid-flow-col gap-3 overflow-x-auto pr-1 pb-2">
				{hotGames.map((game) => {
					const isLoadingThis = loadingId === game.id;
					const known = !isScorpioHotGame(game)
						? CLASSIC_KNOWN_GAMES[game.code]
						: undefined;
					const image = game.imageUrl || known?.image || null;
					const Icon = image ? undefined : known?.icon;
					const dual = supportsDualLaunch(game);
					return (
						<div
							key={game.id}
							role="button"
							tabIndex={isLoadingThis ? -1 : 0}
							onClick={() => {
								if (!isLoadingThis) handleCardActivate(game);
							}}
							onKeyDown={(e) => {
								if (isLoadingThis) return;
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									handleCardActivate(game);
								}
							}}
							className={cn(
								"group relative flex h-[110px] w-full cursor-pointer snap-start flex-col items-center justify-end overflow-hidden rounded-xl text-left transition-all hover:scale-[1.02] hover:shadow-md",
								isLoadingThis &&
									"scale-[0.98] cursor-wait opacity-90 ring-2 ring-accent ring-offset-2 ring-offset-background",
							)}
							style={{ background: known?.gradient ?? DEFAULT_GRADIENT }}
						>
							{isLoadingThis && !dual && (
								<div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
									<Loader2 className="h-6 w-6 animate-spin text-white" />
								</div>
							)}
							{image ? (
								<img
									src={image}
									alt={game.name}
									loading="lazy"
									className="absolute inset-0 h-full w-full object-cover transition-opacity"
									style={{ opacity: isLoadingThis ? 0.35 : 1 }}
									onError={(e) => {
										e.currentTarget.style.display = "none";
									}}
								/>
							) : Icon ? (
								<Icon className="pointer-events-none absolute inset-0 z-0 m-auto h-[72%] w-[72%] p-2" />
							) : null}
							{dual && (
								<CasinoLaunchActions
									compact
									active={activeLaunchId === game.id}
									loading={isLoadingThis}
									onDemo={() => void handleGameLaunch(game, "demo")}
									onPlay={() => void handleGameLaunch(game, "real")}
								/>
							)}
							<div className="pointer-events-none relative z-[1] w-full bg-gradient-to-t from-black/70 to-transparent px-1 pb-2 pt-6 text-center">
								<p className="truncate font-semibold text-white text-xs">
									{game.name}
								</p>
								<p className="truncate text-[10px] text-white/80">
									{game.providerName}
								</p>
							</div>
						</div>
					);
				})}
			</div>
		</>
	);
}
