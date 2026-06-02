import { useQuery } from "@tanstack/react-query";
import {
	Link,
	useLocation,
	useRouter,
} from "@tanstack/react-router";
import { ChevronDown, Menu, Plus, Undo2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useCurrentSport } from "@/hooks/use-current-sport";
import { apiRequest } from "@/lib/api";
import { useSession } from "@/lib/auth/client";
import { SPORTS } from "@/lib/constants";
import { cn, formatAmount } from "@/lib/utils";
import BasketballIcon from "@/logos/basketball.svg?react";
import BoxingIcon from "@/logos/boxing.svg?react";
import FootballIcon from "@/logos/football.svg?react";
import TennisIcon from "@/logos/tennis.svg?react";
import WorldIcon from "@/logos/world.svg?react";
import { useActiveTab } from "./active-tab-context";
import { socials } from "./socials";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import Sidebar from "./sidebar";
import MenuBar from "@/logos/MenuBar";
import NigerianFlag from "@/logos/NigerianFlag";
import NotificationIcon from "@/logos/NotificationIcon";
import Whatsapp from "@/logos/Whatsapp";
import NewSportsdeyLogo from "@/logos/NewSportsdeyLogo.svg?react";

const UfcIcon = (props: React.SVGProps<SVGSVGElement>) => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2.5"
		className={cn("h-5 w-5 text-yellow-500", props.className)}
		{...props}
	>
		<title>UFC</title>
		<path d="M3 5v6a3 3 0 0 0 6 0V5" />
		<path d="M12 14V5h5M12 9h4" />
		<path d="M21 7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v4a2 2 0 0 0 2 2 2 2 0 0 0 2-2" />
	</svg>
);

type HeaderProps = {
	hideSportsNav?: boolean;
};

export default function Header({ hideSportsNav = false }: HeaderProps) {
	const isStaging =
		import.meta.env.MODE === "staging" ||
		import.meta.env.VITE_ENVIRONMENT === "staging";
	const showPreviewUI = isStaging || import.meta.env.DEV;
	const location = useLocation();
	const isAuthRoute = location.pathname.startsWith("/auth");
	const shouldHideSportsNav = hideSportsNav || isAuthRoute;
	const currentSport = useCurrentSport();
	const { data: session } = useSession();
	// const { setTab, tab } = useActiveTab();
	// const { totalFavoritesCount } = useFavorites();

	const links = [
		{ to: "/", label: "Football", icon: FootballIcon, sport: SPORTS.FOOTBALL },
		{
			to: "/basketball",
			label: "Basketball",
			icon: BasketballIcon,
			sport: SPORTS.BASKETBALL,
		},
		{ to: "/tennis", label: "Tennis", icon: TennisIcon, sport: SPORTS.TENNIS },
		{ to: "/boxing", label: "Boxing", icon: BoxingIcon, sport: "boxing" },
		{ to: "/ufc", label: "UFC", icon: UfcIcon, sport: "ufc" },
	] as const;

	const [open, setOpen] = useState(false);
	const menuButtonRef = useRef<HTMLButtonElement | null>(null);
	const closeButtonRef = useRef<HTMLButtonElement | null>(null);
	const router = useRouter();
	const { data: walletData } = useQuery({
		queryKey: ["wallet"],
		queryFn: () =>
			apiRequest<{ id: string; balance?: number | null }>("wallet", {
				credentials: "include",
			}),
		enabled: !!session?.user,
	});
	const mobileBalance = walletData?.balance
		? `₦ ${formatAmount(walletData.balance)}`
		: "₦ 0.00";
	const mobileAvatarSrc = session?.user?.image || "/Profile.png";

	useEffect(() => {
		if (open) {
			document.documentElement.classList.add("overflow-hidden");
			closeButtonRef.current?.focus();
		} else {
			document.documentElement.classList.remove("overflow-hidden");
			menuButtonRef.current?.focus();
		}

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("keydown", onKeyDown);

		return () => {
			document.removeEventListener("keydown", onKeyDown);
			document.documentElement.classList.remove("overflow-hidden");
		};
	}, [open]);

	const handleBackToSite = () => {
		if (typeof window !== "undefined" && window.history.length > 1) {
			window.history.back();
			return;
		}
		router.navigate({ to: "/", search: { league: undefined } as any });
	};

	return (
		<div className="z-30 w-full pb-4 lg:pb-0">
			<div className="w-full bg-white dark:bg-[#121212] text-foreground lg:bg-black dark:lg:bg-black">
				<div className="flex h-[72px] min-w-0 items-center justify-between gap-1 px-2 sm:px-2 py-2 lg:hidden">
					<div className="flex items-center gap-1.5 shrink-0">
						<button
							type="button"
							onClick={() => setOpen(!open)}
							ref={menuButtonRef}
							aria-expanded={open}
							aria-controls="mobile-menu"
							aria-label={open ? "Close main menu" : "Open main menu"}
							className="flex items-center justify-center shrink-0"
						>
							<MenuBar />
						</button>
						<Link
							to="/"
							search={{
								league: undefined,
								sports: currentSport || SPORTS.FOOTBALL,
							}}
							className="shrink-0"
						>
							<img
								src="/sportsdey-logo.png"
								className="h-7 sm:h-8 w-auto hidden dark:block"
								alt="sportsdey's logo"
							/>
							<NewSportsdeyLogo className="h-7 sm:h-8 w-auto block dark:hidden" />
						</Link>
					</div>

					<div className="flex items-center gap-1.5 shrink-0">
						<div className="flex h-8 w-[150px] shrink items-center justify-between rounded-md border border-gray-300 dark:border-gray-700 bg-[#F8F8F8] dark:bg-[#202120] p-0.5">
							<div
								className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden px-1.5"
								aria-label="Wallet balance"
							>
								<NigerianFlag />
								<span
									className="truncate font-semibold tracking-tight text-[#4b5563] dark:text-gray-300 transition-all"
									style={{
										fontSize: mobileBalance.length > 15 ? '9px' : mobileBalance.length > 12 ? '10px' : '11px'
									}}
								>
									{mobileBalance}
								</span>
							</div>

							<button
								type="button"
								onClick={() =>
									router.navigate({
										to: "/wallet",
										state: { openDeposit: true } as any,
									})
								}
								aria-label="Add funds"
								className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-[4px] bg-[#1E78FF] text-white transition-colors hover:bg-blue-600"
							>
								<Plus className="h-4 w-4" />
							</button>
						</div>

						<button
							type="button"
							className="relative flex h-8 w-8 shrink-0 text-black dark:text-white items-center justify-center rounded-full border border-transparent bg-transparent"
							aria-label="Notifications"
						>
							<NotificationIcon />
							<span className="absolute top-0 right-0.5 h-3 w-3 rounded-full bg-emerald-400 text-[#070711] flex items-center justify-center font-bold text-[6px]" >
								{"1"}
							</span>
						</button>

						<UserMenu />
					</div>
				</div>

				<div className="hidden min-w-0 lg:flex lg:h-20 lg:w-full lg:items-center lg:justify-between lg:px-[10%] lg:py-1">
					<div className="flex items-center gap-6">
						<Link
							to="/"
							search={{
								league: undefined,
								sports: currentSport || SPORTS.FOOTBALL,
							}}
						>
							<img
								src="/sportsdey-logo.png"
								className="h-8"
								alt="sportsdey's logo"
							/>
						</Link>
						<div className="flex cursor-pointer items-center gap-1 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 font-extrabold text-[10px] text-secondary transition-colors hover:bg-white/20 dark:bg-white/5 dark:text-white">
							<WorldIcon className="h-3.5 w-3.5" />
							<span>EN</span>
							<ChevronDown className="h-2.5 w-2.5" />
						</div>
						<ThemeToggle />
					</div>

					{!shouldHideSportsNav && (
						<nav
							aria-label="Sports navigation"
							className="hidden lg:flex lg:items-center lg:gap-6 font-bold text-sm"
						>
							<Link
								to="/"
								search={{ sports: undefined, league: undefined } as any}
								className={cn(
									"flex items-center gap-2 px-1 transition-colors",
									!location.pathname.includes("favorites")
										? "border-accent border-b-2 pb-1 text-accent"
										: "text-secondary hover:text-white pb-1.5"
								)}
							>
								Scores
							</Link>
							<Link
								to="/favorites"
								className={cn(
									"flex items-center gap-2 px-1 transition-colors",
									location.pathname.includes("favorites")
										? "border-accent border-b-2 pb-1 text-accent"
										: "text-secondary hover:text-white pb-1.5"
								)}
							>
								Favorites
							</Link>

							{/* Legacy Sports Nav - Commented out as requested
							{links.map((l) => {
								const isActive = (currentSport || SPORTS.FOOTBALL) === l.sport;
								const Icon = l.icon as React.FC<any>;
								return (
									<Link
										key={l.to}
										to={l.to}
										search={{ sports: l.sport, league: undefined } as any}
										className={cn(
											"flex items-center gap-2 rounded-full px-3 py-2 font-medium text-sm transition-colors",
											isActive
												? "border-accent border-b-2 pb-1 text-accent"
												: "text-secondary hover:bg-white/5",
										)}
										onClick={() => {
											setTab("scores");
										}}
									>
										<Icon className="h-4 w-4" />
										<span className="hidden sm:inline-block">{l.label}</span>
									</Link>
								);
							})}
							*/}
						</nav>
					)}

					<div className="flex items-center gap-4 xl:gap-6">
						{!isAuthRoute && (
							<div className="flex h-9 w-[180px] xl:w-[200px] shrink-0 items-center justify-between rounded-[8px] bg-[#1A1A1A] p-0.5 dark:bg-[#111211] dark:border dark:border-gray-700">
								<div
									className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden px-2.5"
									aria-label="Wallet balance"
								>
									<NigerianFlag />
									<span
										className="truncate font-semibold tracking-tight text-white transition-all text-xs xl:text-sm"
									>
										{mobileBalance}
									</span>
								</div>

								<button
									type="button"
									onClick={() =>
										router.navigate({
											to: "/wallet",
											state: { openDeposit: true } as any,
										})
									}
									aria-label="Add funds"
									className="flex h-8 px-4 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent font-bold text-[11px] text-black transition-colors hover:bg-[#00d600]"
								>
									Deposit
								</button>
							</div>
						)}

						{/* Search Magnifying Glass */}
						<button
							type="button"
							className="cursor-pointer rounded-full p-1.5 text-secondary transition-colors hover:bg-white/10 dark:text-white"
							aria-label="Search"
						>
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.5"
								className="h-4 w-4"
							>
								<title>Search</title>
								<circle cx="11" cy="11" r="8" />
								<path d="m21 21-4.3-4.3" />
							</svg>
						</button>

						{/* Notification Bell */}
						<button
							type="button"
							className="relative cursor-pointer rounded-full p-1.5 text-secondary transition-colors hover:bg-white/10 dark:text-white"
							aria-label="Notifications"
						>
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.5"
								className="h-4 w-4"
							>
								<title>Notifications</title>
								<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
							</svg>
						</button>

						{!isAuthRoute && showPreviewUI && <UserMenu />}
						{isAuthRoute && (
							<button
								type="button"
								onClick={handleBackToSite}
								className="flex items-center gap-1 text-secondary hover:text-white"
							>
								<Undo2 className="h-4 w-4" />
								<span className="text-sm underline">Back to site</span>
							</button>
						)}
					</div>
				</div>

				{/* MOBILE SLIDE MENU */}
				<div
					className={cn(
						"fixed inset-0 z-50",
						open ? "pointer-events-auto" : "pointer-events-none",
					)}
				>
					<div
						className={cn(
							"absolute inset-0 bg-black transition-opacity duration-300",
							open ? "opacity-50" : "opacity-0",
						)}
						onClick={() => setOpen(false)}
						aria-hidden="true"
					/>
					<aside
						id="mobile-menu"
						role="dialog"
						aria-modal="true"
						className={cn(
							"fixed top-0 left-0 h-full w-[80%] transform shadow-xl transition-transform duration-300 sm:w-80",
							open ? "translate-x-0" : "-translate-x-full",
							"bg-[#f2f2f2] text-gray-900 dark:bg-[#121212] dark:text-[#8C8F8F]" // #8C8F8F0D is roughly #f2f2f2
						)}
					>
						<div className="flex min-w-0 justify-between p-4">
							<img
								src="/sportsdey-logo.png"
								className="h-10 hidden dark:block"
								alt="sportsdey's logo"
							/>
							<NewSportsdeyLogo className="h-10 w-auto block dark:hidden" />
							<button
								ref={closeButtonRef}
								type="button"
								className="p-2"
								aria-label="Close main menu"
								onClick={() => setOpen(false)}
							>
								<X width={28} height={28} className="text-gray-900 dark:text-gray-400" />
							</button>
						</div>

						<div className="h-[calc(100vh-80px)] overflow-y-auto px-4 pb-8 space-y-6 pt-4">
							<Sidebar onItemClick={() => setOpen(false)} isMobile />

							<div className="w-full px-2 pt-2 pb-6">
								<h3 className="mb-3 font-semibold text-gray-900 text-sm dark:text-[#8C8F8F]">Social links</h3>
								<div className="flex flex-wrap items-center gap-3">
									{socials.map(({ icon: Icon, id, link }) => (
										<a
											key={id}
											href={link}
											target="_blank"
											rel="noopener noreferrer"
											className="flex size-8 items-center justify-center rounded-full border border-gray-300 bg-transparent p-1 text-gray-900 transition-colors hover:bg-gray-100 dark:border-[#2F3033] dark:text-[#8C8F8F] dark:hover:bg-[#2F3033] dark:hover:text-white"
										>
											<Icon />
										</a>
									))}
								</div>

								{/* WhatsApp Contact Button */}
								<a
									href="https://wa.me/2340000000000" // Replace with actual number
									target="_blank"
									rel="noopener noreferrer"
									className="mt-5 flex w-full bg-gray-200 items-center gap-4 rounded-lg p-3.5 transition-colors hover:bg-[#1E78FF]/10 dark:border-[#1E78FF]/30 dark:bg-[#1E78FF]/10 dark:hover:bg-[#1E78FF]/20"
								>
									<Whatsapp className="h-8 w-8 shrink-0" />
									<span className="font-medium text-xs text-gray-900 dark:text-gray-200">
										Contact us on Whatsapp <br /> for support.
									</span>
								</a>

								<div className="mt-8 text-center text-[9px] leading-relaxed text-gray-500 dark:text-gray-400">
									<p className="mb-4">
										This Website and the "Sportsdey" trademark are owned and operated by Halla Gaming Limited, a company established in Nigeria with RC1396896, having its registered address at First floor, Lagos City Mall, Onikan, Lagos state. Halla Gaming Limited is licensed and regulated by the National Lottery Regulatory Commission under license 00000010, issued on the 15th of August 2023.
									</p>
									<div className="flex flex-wrap items-center justify-center gap-1.5 font-bold text-[8px] tracking-wider text-gray-700 dark:text-gray-300">
										<span>PLAY RESPONSIBLY</span>
										<span className="text-gray-300 dark:text-gray-600">|</span>
										<span>18+ ONLY</span>
										<span className="text-gray-300 dark:text-gray-600">|</span>
										<span>PLEASE GAMBLE RESPONSIBLY</span>
									</div>
								</div>

								<div className="mt-6 flex items-center justify-end">
									<div className="flex items-center gap-2 rounded-full bg-primary">

										<ThemeToggle />
									</div>
								</div>
							</div>
						</div>
					</aside>
				</div>
			</div>

			{/* mobile sub-navigation removed */}
		</div>
	);
}
