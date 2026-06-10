import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, apiRequest } from "@/lib/api";
import { useSession } from "@/lib/auth/client";
import {
	getSportsbookTheme,
	isSportsbookConfigured,
	loadSportsbookWidgets,
	SPORTSBOOK_CONTAINER_ID,
} from "@/lib/sportsbook";
import { cn } from "@/lib/utils";
import BlackjackLogo from "@/logos/blackjack.svg?react";
import BlocksLogo from "@/logos/blocks.svg?react";
import PlinkoLogo from "@/logos/plinko.svg?react";
import SlotsLogo from "@/logos/slots.svg?react";
import SolitaireLogo from "@/logos/solitaire.svg?react";
import TwentyOneLogo from "@/logos/twentyone.svg?react";

type Game = {
	id: string;
	name: string;
	code: string;
	imageUrl: string | null;
	enabled: boolean;
	createdAt: number;
	updatedAt: number;
};

type LaunchResponse = {
	success: boolean;
	data?: { url?: string };
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
		gradient: "linear-gradient(to bottom, #7b1fa2, #9c27b0, #ba68c2)",
	},
	plinko: {
		subtitle: "lucky drop",
		icon: PlinkoLogo,
		gradient: "linear-gradient(to bottom, #00897b, #26a69a, #4db6ac)",
	},
};

const DEFAULT_GRADIENT =
	"linear-gradient(to bottom, #1a1a2e, #16213e, #0f3460)";

const HOT_CASINO_LIMIT = 6;

const WIDGET_LOAD_TIMEOUT_MS = 5000;

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
	const initRef = useRef(false);

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

	useEffect(() => {
		if (initRef.current) return;
		initRef.current = true;

		if (!isSportsbookConfigured()) {
			setWidgetError(
				"Sportsbook widget is not configured. Set VITE_DATABET_SPA_BOOTSTRAP_SCRIPT.",
			);
			return;
		}

		let cancelled = false;
		const fallbackTimer = window.setTimeout(() => {
			if (!cancelled) setWidgetReady(true);
		}, WIDGET_LOAD_TIMEOUT_MS);

		const init = async () => {
			try {
				const data = await apiRequest<{ token: string }>(
					"sportsbook/token/create",
					{
						method: "POST",
						credentials: "include",
					},
				);
				if (cancelled) return;
				await loadSportsbookWidgets(data.token, isDarkRef.current, () => {
					if (!cancelled) setWidgetReady(true);
				});
			} catch (err) {
				if (cancelled) return;
				console.error("[PopularAndCasinoSection] Widget init error:", err);
				const message =
					err instanceof Error
						? err.message
						: "Failed to load popular matches.";
				setWidgetError(message);
				setWidgetReady(true);
			}
		};

		void init();

		return () => {
			cancelled = true;
			window.clearTimeout(fallbackTimer);
		};
	}, []);

	const widgetStyle = buildWidgetStyle(isDark);

	return (
		<section className="space-y-4">
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
								"rounded-full px-4 py-2 cursor-pointer font-semibold text-sm transition-colors",
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
				{activeTab === "popular" ? (
					<PopularMatchesPanel
						widgetReady={widgetReady}
						widgetError={widgetError}
						widgetStyle={buildWidgetStyle(isDark)}
						isDark={isDark}
					/>
				) : (
					<HotCasinoPanel />
				)}
			</div>
		</section>
	);
}

function buildWidgetStyle(isDark: boolean): React.CSSProperties {
	const palette = getSportsbookTheme(isDark, 0).palette;
	return {
		"--bet-font-sans": '"Inter", "Geist", ui-sans-serif, system-ui, sans-serif',
		"--bet-base-font-size": "14px",
		"--bet-colors-primary-1": palette.colorsPrimary1,
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
			<div id={SPORTSBOOK_CONTAINER_ID} className="hidden" />
			{showSkeleton && (
				<div className="absolute inset-0 z-10 flex flex-col gap-3 bg-white/80 dark:bg-card/80 sm:p-2">
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
	const { data: session } = useSession();
	const [loadingCode, setLoadingCode] = useState<string | null>(null);

	const { data: games = [], isLoading } = useQuery<Game[]>({
		queryKey: ["games"],
		queryFn: async () => {
			const all = await apiRequest<Game[]>("games");
			return all.filter((game) => game.enabled);
		},
	});

	const hotGames = games.slice(0, HOT_CASINO_LIMIT);

	const handleGameClick = useCallback(
		async (game: Game) => {
			setLoadingCode(game.code);
			try {
				const knownGame = KNOWN_GAMES[game.code];
				const isKnownGame = Boolean(knownGame);

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
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				});

				const data: LaunchResponse = await response.json();

				if (!response.ok || data.success === false || !data.data?.url) {
					if (data.error === "Unauthorized" || response.status === 401) {
						if (!session?.user) {
							navigate({ to: "/auth/sign-in" });
							return;
						}
					}
					throw new Error(data.error || "Failed to launch game");
				}

				navigate({
					to: "/game/$gameId",
					params: { gameId: game.code },
					state: { gameUrl: data.data.url } as never,
				});
			} catch (error) {
				console.error("Failed to launch game:", error);
			} finally {
				setLoadingCode(null);
			}
		},
		[navigate, session?.user],
	);

	if (isLoading) {
		return (
			<div className="custom-scrollbar grid snap-x snap-mandatory auto-cols-[minmax(160px,55%)] grid-flow-col gap-3 overflow-hidden pr-1 pb-2 lg:snap-none lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-3 lg:gap-4 lg:overflow-visible lg:pr-0 lg:pb-0 xl:grid-cols-6">
				{Array.from({ length: 6 }).map((_, i) => (
					<Skeleton
						key={`casino-skel-${i}`}
						className="h-44 min-w-[55%] rounded-xl lg:min-w-0"
					/>
				))}
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
		<div className="custom-scrollbar grid snap-x snap-mandatory auto-cols-[minmax(160px,55%)] grid-flow-col gap-3 overflow-x-auto pr-1 pb-2 lg:snap-none lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-3 lg:gap-4 lg:overflow-visible lg:pr-0 lg:pb-0 xl:grid-cols-6">
			{hotGames.map((game) => {
				const known = KNOWN_GAMES[game.code];
				const display = {
					name: game.name,
					subtitle: known?.subtitle ?? "Play now",
					Icon: known?.icon,
					image: known?.image ?? game.imageUrl ?? "",
					gradient: known?.gradient ?? DEFAULT_GRADIENT,
				};
				const isLoadingThis = loadingCode === game.code;
				return (
					<button
						key={game.code}
						type="button"
						onClick={() => void handleGameClick(game)}
						disabled={isLoadingThis}
						className="group relative flex h-44 min-w-[55%] snap-start flex-col items-center justify-end overflow-hidden rounded-xl p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 lg:min-w-0 lg:snap-none"
						style={{ background: display.gradient }}
					>
						{isLoadingThis && (
							<div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
								<Loader2 className="h-6 w-6 animate-spin text-white" />
							</div>
						)}
						{display.Icon ? (
							<div
								className="absolute inset-0 flex items-center justify-center p-4"
								style={{ opacity: isLoadingThis ? 0.35 : 1 }}
							>
								<display.Icon className="h-full w-full object-contain" />
							</div>
						) : display.image ? (
							<img
								src={display.image}
								alt={display.name}
								loading="lazy"
								className="absolute inset-0 h-full w-full object-contain p-2"
								style={{ opacity: isLoadingThis ? 0.35 : 1 }}
							/>
						) : (
							<div className="absolute inset-0 flex items-center justify-center">
								<span className="font-bold text-3xl text-white/50">
									{display.name.charAt(0)}
								</span>
							</div>
						)}
						<div className="relative z-[1] w-full text-center">
							<p
								className="truncate font-normal text-base text-white"
								style={{ fontFamily: "Luckiest Guy" }}
							>
								{display.name}
							</p>
							<p
								className="truncate text-[11px] text-gray-100"
								style={{ fontFamily: "Quicksand" }}
							>
								{display.subtitle}
							</p>
						</div>
					</button>
				);
			})}
		</div>
	);
}
