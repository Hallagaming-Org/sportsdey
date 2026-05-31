import { useLocation, useNavigate } from "@tanstack/react-router";
import {
	Gamepad2,
	Gift,
	Home,
	Newspaper,
	Trophy,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentSport } from "@/hooks/use-current-sport";
import { SPORTS } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { useActiveTab } from "./active-tab-context";
import Soccer from "@/logos/Soccer";
import PredictionMarket from "@/logos/PredictionMarket";
import Video from "@/logos/Video";
import Trading from "@/logos/Trading";
import LiveSupport from "@/logos/LiveSupport";

type MenuItem = {
	id: string;
	label: string;
	icon: any;
	isActive: boolean;
	onClick: () => void;
	disabled?: boolean;
};

type SidebarProps = {
	onItemClick?: () => void;
};

const Sidebar = ({ onItemClick }: SidebarProps = {}) => {
	const { setTab } = useActiveTab();
	const navigate = useNavigate();
	const location = useLocation();
	const searchStr = location.search || "";
	const currentSport = useCurrentSport();
	const params = new URLSearchParams(searchStr);
	const [email, setEmail] = useState("");

	const goToHome = () => {
		setTab("scores");
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

	const goToSportsbook = () => {
		setTab("betting");
		navigate({ to: "/sportsbook" });
	};

	const goToCasino = () => {
		setTab("games");
		navigate({ to: "/games" });
	};

	const goToNews = () => {
		setTab("news");
		navigate({
			to: "/news",
			search: { sports: currentSport || SPORTS.FOOTBALL, tab: "news" },
		});
	};

	const goToPredictions = () => {
		setTab("betting");
		navigate({
			to: "/betting",
			search: { type: "jackpots" },
		});
	};

	const goToVideos = () => {
		setTab("videos");
		navigate({
			to: "/news",
			search: { sports: currentSport || SPORTS.FOOTBALL, tab: "videos" },
		});
	};

	const showComingSoon = (feature: string) => {
		toast.info(`${feature} is coming soon!`);
	};

	const handleSubscribe = (e: React.FormEvent) => {
		e.preventDefault();
		if (!email || !email.includes("@")) {
			toast.error("Please enter a valid email address");
			return;
		}
		toast.success("Thank you for subscribing to our newsletter!");
		setEmail("");
	};

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
			isActive: isHomeActive,
			onClick: goToHome,
		},
		{
			id: "sportsbook",
			label: "Sportsbook",
			icon: Soccer,
			isActive: location.pathname.startsWith("/sportsbook"),
			onClick: goToSportsbook,
		},
		{
			id: "casino",
			label: "Casino",
			icon: Gamepad2,
			isActive:
				location.pathname.startsWith("/games") ||
				location.pathname.startsWith("/game/"),
			onClick: goToCasino,
		},
		{
			id: "news",
			label: "News",
			icon: Newspaper,
			isActive:
				location.pathname.startsWith("/news") && params.get("tab") !== "videos",
			onClick: goToNews,
		},
		{
			id: "predictions",
			label: "Predictions Market",
			icon: PredictionMarket,
			isActive: location.pathname.startsWith("/betting"),
			onClick: goToPredictions,
		},
		{
			id: "videos",
			label: "Videos",
			icon: Video,
			isActive:
				location.pathname.startsWith("/news") && params.get("tab") === "videos",
			onClick: goToVideos,
		},
		{
			id: "trading",
			label: "Trading",
			icon: Trading,
			isActive: false,
			onClick: () => window.open("https://Binary.sportsdey.com", "_blank"),
		},
		{
			id: "tournament",
			label: "Tournament",
			icon: Trophy,
			isActive: false,
			disabled: true,
			onClick: () => showComingSoon("Tournament"),
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
		{
			id: "promotions",
			label: "Promotions",
			icon: Gift,
			isActive: false,
			disabled: true,
			onClick: () => showComingSoon("Promotions"),
		},
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
	];

	return (
		<div className="w-full space-y-6">
			{/* Menu list */}
			<div className="w-full rounded-2xl border border-[#F1F2F4] bg-white p-3 shadow-sm transition-colors dark:border-[#2F3033] dark:bg-[#1C1D1F]">
				<nav className="space-y-1" aria-label="Sidebar navigation">
					{menuItems.map((item) => {
						const Icon = item.icon;
						return (
							<button
								key={item.id}
								onClick={() => {
									item.onClick();
									onItemClick?.();
								}}
								type="button"
								disabled={item.disabled}
								className={cn(
									"flex w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left font-semibold text-sm transition-all",
									item.isActive
										? "bg-accent text-white shadow-md shadow-accent/15"
										: "text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-card/45 dark:hover:text-white",
									item.disabled &&
									"cursor-not-allowed opacity-50 hover:bg-transparent hover:text-gray-500 dark:hover:bg-transparent dark:hover:text-gray-400",
								)}
							>
								<Icon className="h-4 w-4 shrink-0" />
								<span>{item.label}</span>
							</button>
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
};

export default Sidebar;
