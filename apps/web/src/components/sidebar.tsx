import { useLocation, useNavigate } from "@tanstack/react-router";
import {
	ChevronDown,
	Gamepad2,
	Gift,
	Home,
	Newspaper,
	Target,
	Trophy,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useCurrentSport } from "@/hooks/use-current-sport";
import { SPORTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { trackWebengageEvent } from "@/lib/webengage";
import LiveSupport from "@/logos/LiveSupport";
import PredictionMarket from "@/logos/PredictionMarket";
import PVPIcon from "@/logos/PVPIcon";
import Soccer from "@/logos/Soccer";
import { FaHandshakeAngle } from "react-icons/fa6";
import SportsIcon from "@/logos/sport.svg?react";
import Trading from "@/logos/Trading";
import ScoresIcon from "@/logos/scores.svg?react";
import Video from "@/logos/Video";
import { useActiveTab } from "./active-tab-context";


type MenuItem = {
	id: string;
	label: string;
	icon: any;
	isActive: boolean;
	onClick?: () => void;
	disabled?: boolean;
	subItems?: {
		id: string;
		label: string;
		onClick: () => void;
		isActive: boolean;
	}[];
};

type SidebarProps = {
	onItemClick?: () => void;
	isMobile?: boolean;
};

const Sidebar = ({ onItemClick, isMobile }: SidebarProps = {}) => {
	const { setTab } = useActiveTab();
	const navigate = useNavigate();
	const location = useLocation();
	const search = (location.search || {}) as Record<string, any>;
	const currentSport = useCurrentSport();
	// const [email, setEmail] = useState("");

	const [activeOverride, setActiveOverride] = useState<string | null>(null);
	const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(
		{},
	);

	useEffect(() => {
		setActiveOverride(null);
		setExpandedItems({});
	}, [location.pathname, location.search]);

	const isItemActive = (id: string, defaultActive: boolean) => {
		if (activeOverride) return activeOverride === id;
		return defaultActive;
	};

	const goToHome = () => {
		setTab("scores");
		trackWebengageEvent("Category", { Name: "Home" });
		const target =
			currentSport === SPORTS.TENNIS
				? "/tennis"
				: currentSport === SPORTS.BASKETBALL
					? "/basketball"
					: currentSport === SPORTS.BOXING
						? "/boxing"
						: currentSport === SPORTS.UFC
							? "/ufc"
							: "/";
		navigate({
			to: target,
			search: { league: undefined, sports: currentSport } as any,
		});
	};

	const goToScores = () => {
		setTab("match-scores");
		trackWebengageEvent("Category", { Name: "Scores" });
		const targetSport = currentSport || "football";
		navigate({
			to:
				targetSport === "tennis"
					? "/tennis/matches"
					: targetSport === "basketball"
						? "/basketball/matches"
						: "/index/matches",
			search: { league: undefined, sports: targetSport } as any,
		});
	};

	const goToCasino = () => {
		setTab("games");
		trackWebengageEvent("Category", { Name: "Casino" });
		navigate({
			to: "/games",
			search: { category: undefined },
		});
	};

	const goToSportsbook = () => {
		setTab("betting");
		trackWebengageEvent("Category", { Name: "Sportsbook" });
		navigate({
			to: "/sportsbetting",
			search: { sports: currentSport } as any,
		});
	};

	const goToNews = () => {
		setTab("news");
		trackWebengageEvent("Category", { Name: "News" });
		navigate({
			to: "/news",
			search: { sports: currentSport || SPORTS.FOOTBALL },
		});
	};

	// const goToPredictions = () => {
	// 	setTab("betting");
	// 	navigate({
	// 		to: "/betting",
	// 		search: { type: "jackpots" },
	// 	});
	// };

	const goToVideos = () => {
		setTab("videos");
		trackWebengageEvent("Category", { Name: "Videos" });
		navigate({
			to: "/videos",
			search: { sports: currentSport || SPORTS.FOOTBALL },
		});
	};

	const showComingSoon = (feature: string) => {
		toast.info(`${feature} is coming soon!`);
	};

	// const handleSubscribe = (e: React.FormEvent) => {
	// 	e.preventDefault();
	// 	if (!email || !email.includes("@")) {
	// 		toast.error("Please enter a valid email address");
	// 		return;
	// 	}
	// 	toast.success("Thank you for subscribing to our newsletter!");
	// 	setEmail("");
	// };

	const isHomeActive =
		location.pathname === "/" ||
		location.pathname === "/basketball" ||
		location.pathname === "/basketball/" ||
		location.pathname === "/tennis" ||
		location.pathname === "/tennis/" ||
		location.pathname === "/boxing" ||
		location.pathname === "/boxing/" ||
		location.pathname === "/ufc" ||
		location.pathname === "/ufc/";

	const menuItems: MenuItem[] = [
		{
			id: "home",
			label: "Home",
			icon: Home,
			isActive: isItemActive("home", isHomeActive),
			onClick: goToHome,
		},
		{
			id: "betting",
			label: "Sports",
			icon: SportsIcon,
			isActive: isItemActive(
				"betting",
				location.pathname.startsWith("/sportsbetting"),
			),
			onClick: goToSportsbook,
		},
		{
			id: "scores",
			label: "Scores",
			icon: ScoresIcon,
			isActive: isItemActive(
				"scores",
				location.pathname.includes("matches"),
			),
			onClick: goToScores,
		},
		{
			id: "casino",
			label: "Casino",
			icon: Gamepad2,
			isActive: isItemActive(
				"casino",
				(location.pathname.startsWith("/games") ||
					location.pathname.startsWith("/game/")) &&
					search.category !== "pvp",
			),
			onClick: goToCasino,
		},
		{
			id: "p2p",
			label: "PvP",
			icon: (className?: string) => (
				<PVPIcon className={className} height={24} width={24} />
			),
			isActive: isItemActive(
				"p2p",
				location.pathname.startsWith("/games") &&
					search.category === "pvp",
			),
			subItems: [
				{
					id: "pvp-casino",
					label: "PvP Games",
					isActive:
						location.pathname.startsWith("/games") &&
						search.category === "pvp",
					onClick: () => {
						setTab("games");
						navigate({
							to: "/games",
							search: { category: "pvp" },
						});
					},
				},
				{
					id: "pvp-esports",
					label: "Tournaments",
					isActive: false,
					onClick: () =>
						window.open("https://tournaments.sportsdey.com/", "_blank"),
				},
			],
		},
		{
			id: "news",
			label: "News",
			icon: Newspaper,
			isActive: isItemActive(
				"news",
				location.pathname.startsWith("/news") && search.tab !== "videos",
			),
			onClick: goToNews,
		},
		{
			id: "videos",
			label: "Videos",
			icon: Video,
			isActive: isItemActive("videos", location.pathname.startsWith("/videos")),
			onClick: goToVideos,
		},
		{
			id: "prediction",
			label: "Prediction Market",
			icon: Trading,
			isActive: isItemActive("prediction", false),
			onClick: () => {
				setActiveOverride("prediction");
				window.open(
					"https://prediction.sportsdey.com/",
					"_blank",
				);
			},
		},	
		{
			id: "trading",
			label: "Trading",
			icon: Trading,
			isActive: isItemActive("trading", false),
			onClick: () => {
				setActiveOverride("trading");
				window.open(
					"https://binary.sportsdey.com/sportsdayApi/connectSportsDay",
					"_blank",
				);
			},
		},
		// {
		// 	id: "tournament",
		// 	label: "Tournament",
		// 	icon: Trophy,
		// 	isActive: false,
		// 	disabled: true,
		// 	onClick: () => showComingSoon("Tournament"),
		// },

		{
			id: "missions",
			label: "Missions",
			icon: Target,
			isActive: isItemActive(
				"missions",
				location.pathname.startsWith("/missions"),
			),
			onClick: () => {
				setTab("missions");
				trackWebengageEvent("Category", { Name: "Missions" });
				navigate({ to: "/missions" as any });
			},
		},

		{
			id: "promotions",
			label: "Promotions",
			icon: Gift,
			isActive: isItemActive(
				"promotions",
				location.pathname.startsWith("/promotions"),
			),
			onClick: () => {
				setTab("promotions");
				trackWebengageEvent("Category", { Name: "Promotions" });
				navigate({ to: "/promotions" as any });
			},
		},
		
		{
			id: "partner",
			label: "Become a Partner",
			icon: FaHandshakeAngle,
			isActive: isItemActive("partner", false),
			onClick: () => {
				setActiveOverride("partner");
				window.open("https://Partners.sportsdey.com", "_blank");
			},
		},




		// {
		// 	id: "lottery",
		// 	label: "Lottery",
		// 	icon: Ticket,
		// 	isActive: false,
		// 	onClick: () => showComingSoon("Lottery"),
		// },
		// {
		// 	id: "jackpots",
		// 	label: "Jackpots",
		// 	icon: Coins,
		// 	isActive:
		// 		location.pathname.startsWith("/betting") &&
		// 		params.get("type") === "jackpots",
		// 	onClick: () => {
		// 		setTab("betting");
		// 		navigate({ to: "/betting", search: { type: "jackpots" } });
		// 	},
		// },


		// {
		// 	id: "refer",
		// 	label: "Refer & Earn",
		// 	icon: Users,
		// 	isActive: false,
		// 	onClick: () => showComingSoon("Refer & Earn"),
		// },
		{
			id: "support",
			label: "Live support",
			icon: LiveSupport,
			isActive: false,
			onClick: () =>
				window.open(
					"https://tawk.to/chat/69a13f9e865cc31c343af2ac/1jieu113b",
					"_blank",
				),
		},
	]

return (
		<div className="w-full space-y-6">
			{/* Menu list */}
			<div
				className={cn(
					"w-full transition-colors",
					!isMobile &&
						"rounded-2xl border border-[#F1F2F4] bg-white p-3 shadow-sm dark:border-[#2F3033] dark:bg-[#1C1D1F]",
				)}
			>
				<nav
					className={cn(isMobile ? "space-y-0" : "space-y-1")}
					aria-label="Sidebar navigation"
				>
					{menuItems.map((item, idx) => {
						const Icon = item.icon;
						const isLast = idx === menuItems.length - 1;
						const isExpanded = expandedItems[item.id];
						return (
							<div key={item.id} className="flex flex-col">
								<button
									onClick={() => {
										if (item.subItems) {
											setExpandedItems((prev) => ({
												...prev,
												[item.id]: !prev[item.id],
											}));
										} else {
											item.onClick?.();
											onItemClick?.();
										}
									}}
									type="button"
									disabled={item.disabled}
									className={cn(
										"flex w-full cursor-pointer items-center justify-between text-left font-semibold text-sm transition-all",
										isMobile ? "px-2 py-4" : "rounded-xl px-4 py-3",
										isMobile &&
											!isLast &&
											"border-b border-gray-300 dark:border-[#2F3033]",
										!isMobile &&
											item.isActive &&
											"bg-accent text-white shadow-md shadow-accent/15",
										!isMobile &&
											!item.isActive &&
											"text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-card/45 dark:hover:text-white",
										isMobile && item.isActive && "text-accent",
										isMobile &&
											!item.isActive &&
											"text-gray-900 dark:text-[#8C8F8F]",
										item.disabled &&
											"cursor-not-allowed opacity-50 hover:bg-transparent dark:hover:bg-transparent",
									)}
								>
									<div className="flex items-center gap-3">
										<Icon
											className={cn(
												"h-4 w-4 shrink-0 transition-all",
												!isMobile &&
													item.isActive &&
													"text-white fill-white stroke-white [filter:brightness(0)_invert(1)] opacity-100",
												isMobile && item.isActive && "text-accent fill-accent stroke-accent opacity-100",
												isMobile &&
													!item.isActive &&
													"text-gray-500 dark:text-[#8C8F8F]",
											)}
										/>
										<span>{item.label}</span>
									</div>
									{item.subItems && (
										<ChevronDown
											className={cn(
												"w-4 h-4 transition-transform",
												isExpanded && "rotate-180",
											)}
										/>
									)}
								</button>
								{item.subItems && isExpanded && (
									<div className="flex flex-col gap-1 pl-11 pr-4 py-2">
										{item.subItems.map((sub) => (
											<button
												key={sub.id}
												onClick={() => {
													sub.onClick();
													if (!isMobile) onItemClick?.();
												}}
												className={cn(
													"text-left text-sm py-2 px-3 rounded-lg transition-colors",
													sub.isActive
														? "text-accent font-semibold bg-accent/10"
														: "text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-card/45",
												)}
											>
												{sub.label}
											</button>
										))}
									</div>
								)}
							</div>
						);
					})}
				</nav>
			</div>

			{/* Winners & Community widget */}
			{/*<div className="w-full rounded-2xl border border-[#F1F2F4] bg-white p-5 shadow-sm dark:border-[#2F3033] dark:bg-[#1C1D1F] transition-colors space-y-4">
				<h3 className="font-extrabold text-sm text-gray-800 dark:text-white">
					Winners & Community
				</h3>

				<div className="space-y-3">
					{[
						{ phone: "0703*****90", date: "Won 5 minutes ago", avatarColor: "bg-red-500" },
						{ phone: "0812*****34", date: "Won 10 minutes ago", avatarColor: "bg-purple-500" },
						{ phone: "0905*****78", date: "Won 15 minutes ago", avatarColor: "bg-blue-500" },
					].map((winner, idx) => (
						<div key={idx} className="flex items-center gap-3">
							<div className={cn("h-9 w-9 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-xs", winner.avatarColor)}>
								W
							</div>
							<div className="space-y-0.5 leading-none">
								<p className="font-extrabold text-xs text-[#FFD700]">
									₦100,000 Winner
								</p>
								<p className="font-semibold text-xs text-gray-700 dark:text-gray-300">
									{winner.phone}
								</p>
								<p className="text-[10px] text-gray-400 dark:text-gray-500">
									{winner.date}
								</p>
							</div>
						</div>
					))}
				</div>

				<button
					type="button"
					onClick={() => showComingSoon("Winners Forum")}
					className="text-xs font-bold text-accent hover:underline block pt-1 text-left"
				>
					View all &gt;
				</button>
			</div>*/}
		</div>
	);
}

export default Sidebar;
