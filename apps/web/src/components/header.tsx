import { useQuery } from "@tanstack/react-query";
import {
	Link,
	useLocation,
	useParams,
	useRouter,
} from "@tanstack/react-router";
import { ChevronDown, Menu, Plus, Undo2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useCurrentFilter } from "@/hooks/use-current-filter";
import { useCurrentSport } from "@/hooks/use-current-sport";
import { apiRequest } from "@/lib/api";
import { useSession } from "@/lib/auth/client";
import { SPORTS } from "@/lib/constants";
import { cn, formatAmount } from "@/lib/utils";
import BasketballIcon from "@/logos/basketball.svg?react";
import BellIcon from "@/logos/bell.svg?react";
import BoxingIcon from "@/logos/boxing.svg?react";
import FootballIcon from "@/logos/football.svg?react";
import TennisIcon from "@/logos/tennis.svg?react";
import WorldIcon from "@/logos/world.svg?react";
import { useActiveTab } from "./active-tab-context";
import { socials } from "./socials";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

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
	const { setTab, tab } = useActiveTab();
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
	const { currentFilter, changeCurrentFilter } = useCurrentFilter();
	const router = useRouter();

	const params = useParams({ strict: false });
	const hasPathParams = Object.keys(params).length > 0;
	const isHomeRoute =
		location.pathname === "/" ||
		location.pathname === "/basketball" ||
		location.pathname === "/basketball/" ||
		location.pathname === "/tennis" ||
		location.pathname === "/tennis/" ||
		location.pathname === "/boxing" ||
		location.pathname === "/boxing/" ||
		location.pathname === "/ufc" ||
		location.pathname === "/ufc/";
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
		router.navigate({ to: "/" });
	};

	return (
		<div className="z-30 w-full pb-4 lg:pb-0">
			<div className="w-full bg-white text-foreground lg:bg-primary">
				<div className="flex h-[72px] min-w-0 items-center justify-between gap-3 px-4 py-2 lg:hidden">
					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={() => setOpen(!open)}
							ref={menuButtonRef}
							aria-expanded={open}
							aria-controls="mobile-menu"
							aria-label={open ? "Close main menu" : "Open main menu"}
							className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm"
						>
							<Menu className="h-5 w-5 text-gray-900" />
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
								src="/sportsdey-logo.jpeg"
								className="h-8 w-auto"
								alt="sportsdey's logo"
							/>
						</Link>
					</div>

					<div className="flex items-center gap-2">
						<div className="flex items-center overflow-hidden rounded-full border border-gray-200 bg-white shadow-sm">
							<Link
								to="/wallet"
								className="flex h-9 min-w-[112px] items-center gap-2 px-3"
								aria-label="Wallet balance"
							>
								<span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0B7A3B]" />
								<span className="truncate font-medium text-[12px] text-gray-700">
									{mobileBalance}
								</span>
							</Link>
							<button
								type="button"
								onClick={() =>
									router.navigate({
										to: "/wallet",
										state: { openDeposit: true },
									})
								}
								aria-label="Add funds"
								className="flex h-9 w-9 cursor-pointer items-center justify-center bg-[#1E78FF] text-white"
							>
								<Plus className="h-4 w-4" />
							</button>
						</div>

						<button
							type="button"
							className="relative flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-transparent text-gray-500"
							aria-label="Notifications"
						>
							<BellIcon className="h-5 w-5" />
							<span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-white" />
						</button>

						<Link
							to={session?.user ? "/account" : "/auth/sign-in"}
							className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-white"
							aria-label="Account"
						>
							<img
								src={mobileAvatarSrc}
								alt="Account"
								className="h-full w-full object-cover"
							/>
						</Link>
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
					</div>

					{!shouldHideSportsNav && (
						<nav
							aria-label="Sports navigation"
							className="hidden lg:flex lg:items-center lg:gap-3"
						>
							{links.map((l) => {
								const isActive = (currentSport || SPORTS.FOOTBALL) === l.sport;
								const Icon = l.icon as React.FC<any>;
								return (
									<Link
										key={l.to}
										to={l.to}
										search={{ sports: l.sport }}
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
						</nav>
					)}

					<div className="flex items-center gap-6">
						<ThemeToggle />

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
							"fixed top-0 left-0 h-full w-[80%] transform bg-primary text-background shadow-xl transition-transform duration-300 sm:w-80",
							open ? "translate-x-0" : "-translate-x-full",
						)}
					>
						<div className="flex min-w-0 justify-between p-4">
							<img
								src="/sportsdey-logo.png"
								className="h-10"
								alt="sportsdey's logo"
							/>
							<button
								ref={closeButtonRef}
								type="button"
								className="p-2"
								aria-label="Close main menu"
								onClick={() => setOpen(false)}
							>
								<X width={28} height={28} color="#f4f4f4" />
							</button>
						</div>

						<div className="min-w-0 space-y-8 text-base dark:text-white">
							<div className="">
								<div className="w-full bg-[#202120] px-4 py-4 text-base">
									Features
								</div>
								<ul className="mt-4 space-y-4 px-4">
									<li
										className={cn(
											"cursor-pointer",
											currentFilter === "all" ? "text-accent" : "",
										)}
										onClick={() => {
											setOpen(false);
											changeCurrentFilter("all");
											setTab("scores");
											const target =
												currentSport === SPORTS.TENNIS
													? "/tennis"
													: currentSport === SPORTS.BASKETBALL
														? "/basketball"
														: "/";
											router.navigate({
												to: target,
												search: {
													league: undefined,
													sports: currentSport,
												} as any,
											});
										}}
									>
										All
									</li>
									<li
										className={cn(
											"cursor-pointer",
											currentFilter === "live" ? "text-accent" : "",
										)}
										onClick={() => {
											setOpen(false);
											changeCurrentFilter("live");
											setTab("scores");
											const target =
												currentSport === SPORTS.TENNIS
													? "/tennis"
													: currentSport === SPORTS.BASKETBALL
														? "/basketball"
														: "/";
											router.navigate({
												to: target,
												search: {
													league: undefined,
													sports: currentSport,
												} as any,
											});
										}}
									>
										Live
									</li>
									<li
										className={cn(
											"cursor-pointer",
											currentFilter === "finished" ? "text-accent" : "",
										)}
										onClick={() => {
											setOpen(false);
											changeCurrentFilter("finished");
											setTab("scores");
											const target =
												currentSport === SPORTS.TENNIS
													? "/tennis"
													: currentSport === SPORTS.BASKETBALL
														? "/basketball"
														: "/";
											router.navigate({
												to: target,
												search: {
													league: undefined,
													sports: currentSport,
												} as any,
											});
										}}
									>
										Finished
									</li>
									<li
										className={cn(
											"cursor-pointer",
											currentFilter === "upcoming" ? "text-accent" : "",
										)}
										onClick={() => {
											setOpen(false);
											changeCurrentFilter("upcoming");
											setTab("scores");
											const target =
												currentSport === SPORTS.TENNIS
													? "/tennis"
													: currentSport === SPORTS.BASKETBALL
														? "/basketball"
														: "/";
											router.navigate({
												to: target,
												search: {
													league: undefined,
													sports: currentSport,
												} as any,
											});
										}}
									>
										Upcoming
									</li>
								</ul>
							</div>

							<div className="dark:text-white">
								<div className="w-full bg-[#202120] px-4 py-4 text-base">
									Betting
								</div>
								<ul className="mt-4 space-y-4 px-4">
									{/* <li
										className={cn(
											"cursor-pointer",
											tab === "betting" ? "text-accent" : "",
										)}
										onClick={() => {
											setOpen(false);
											setTab("betting");
											router.navigate({ to: "/betting" });
										}}
									>
										Play bet
									</li> */}
									<li>
										<Link
											to="/sportsbook"
											className="flex cursor-pointer items-center gap-2"
											onClick={() => {
												setOpen(false);
												setTab("betting");
											}}
										>
											<img
												src="/betting-logo.png"
												className="h-5 w-5 object-contain"
												alt="Betting"
											/>
											Sportsbook
										</Link>
									</li>

									{/* <li
									>
										About us
									</li>
									<li
									>
										Finished
									</li> */}
								</ul>
								<ul className="mt-4 space-y-4 px-4" />
							</div>
							<div className="">
								<div className="w-full bg-[#202120] px-4 py-4 text-base">
									Social Links
								</div>
								<div className="mt-4 flex items-center gap-2 px-4">
									{socials.map(({ icon: Icon, id, link }) => (
										<a
											key={id}
											href={link}
											target="_blank"
											rel="noopener noreferrer"
											className="flex size-8 items-center justify-center rounded-full bg-white p-2"
										>
											<Icon />
										</a>
									))}
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
