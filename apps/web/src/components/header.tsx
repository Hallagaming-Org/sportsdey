import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Plus, Undo2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useCurrentSport } from "@/hooks/use-current-sport";
import { apiRequest } from "@/lib/api";
import { useSession } from "@/lib/auth/client";
import { SPORTS } from "@/lib/constants";
import { cn, formatAmount } from "@/lib/utils";
import MenuBar from "@/logos/MenuBar";
import NewSportsdeyLogo from "@/logos/NewSportsdeyLogo.svg?react";
import NigerianFlag from "@/logos/NigerianFlag";
import NotificationIcon from "@/logos/NotificationIcon";
import Whatsapp from "@/logos/Whatsapp";
import WorldIcon from "@/logos/world.svg?react";
import Sidebar from "./sidebar";
import { socials } from "./socials";
import { UserMenu } from "./user-menu";

// type HeaderProps = {
// 	hideSportsNav?: boolean;
// };

export default function Header(
	//{ hideSportsNav = false }: HeaderProps//
) {
	const isStaging =
		import.meta.env.MODE === "staging" ||
		import.meta.env.VITE_ENVIRONMENT === "staging";
	const showPreviewUI = isStaging || import.meta.env.DEV;
	const location = useLocation();
	const isAuthRoute = location.pathname.startsWith("/auth");
	// const shouldHideSportsNav = hideSportsNav || isAuthRoute;
	const currentSport = useCurrentSport();
	const { data: session, isPending: isSessionLoading } = useSession();
	// const { setTab, tab } = useActiveTab();
	// const { totalFavoritesCount } = useFavorites();

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
		refetchInterval: 30 * 1000,
		retry: true,
	});
	const mobileBalance = walletData?.balance
		? `₦ ${formatAmount(walletData.balance)}`
		: "₦ 0.00";

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
			<div className="w-full bg-white text-foreground lg:bg-black dark:bg-[#121212] dark:lg:bg-black">
				<div className="flex h-[72px] min-w-0 items-center justify-between gap-1 px-2 py-2 sm:px-2 lg:hidden">
					<div className="flex shrink-0 items-center gap-1.5">
						<button
							type="button"
							onClick={() => setOpen(!open)}
							ref={menuButtonRef}
							aria-expanded={open}
							aria-controls="mobile-menu"
							aria-label={open ? "Close main menu" : "Open main menu"}
							className="flex shrink-0 items-center justify-center"
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
								className="hidden h-7 w-auto sm:h-8 dark:block"
								alt="sportsdey's logo"
							/>
							<NewSportsdeyLogo className="block h-7 w-auto sm:h-8 dark:hidden" />
						</Link>
					</div>

					<div className="flex shrink-0 items-center gap-1.5">
						{!!session?.user && (
							<div className="flex h-8 w-[150px] shrink items-center justify-between rounded-md border border-gray-300 bg-[#F8F8F8] p-0.5 dark:border-gray-700 dark:bg-[#202120]">
								<div
									className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden px-1.5"
									aria-label="Wallet balance"
								>
									<NigerianFlag />
									<span
										className="truncate font-semibold text-[#4b5563] tracking-tight transition-all dark:text-gray-300"
										style={{
											fontSize:
												mobileBalance.length > 15
													? "9px"
													: mobileBalance.length > 12
														? "10px"
														: "11px",
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
									className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-[4px] bg-accent text-white transition-colors hover:bg-blue-600"
								>
									<Plus className="h-4 w-4" />
								</button>
							</div>
						)}

						<button
							type="button"
							className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-transparent bg-transparent text-black dark:text-white"
							aria-label="Notifications"
						>
							<NotificationIcon />
							<span className="absolute top-0 right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-emerald-400 font-bold text-[#070711] text-[6px]">
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
					</div>

					{/* {!shouldHideSportsNav && (
						<nav
							aria-label="Sports navigation"
							className="hidden font-bold text-sm lg:flex lg:items-center lg:gap-6"
						>
							<Link
								to="/index/matches"
								className={cn(
									"flex items-center gap-2 px-1 transition-colors",
									location.pathname.includes("matches")
										? "border-accent border-b-2 pb-1 text-accent"
										: "pb-1.5 text-secondary hover:text-white",
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
										: "pb-1.5 text-secondary hover:text-white",
								)}
							>
								Favorites
							</Link>

					
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
							
						</nav>
					)} */}

					<div className="flex items-center gap-4 xl:gap-6">
						{!isAuthRoute && !!session?.user && (
							<div className="flex h-[40px] w-[229px] shrink-0 items-center justify-between rounded-[6.88px] border border-[#F2EEFB] bg-[#04100B] px-[6px] py-[7px] dark:border-[#F2EEFB] dark:bg-[#04100B]">
								<div
									className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden px-2.5"
									aria-label="Wallet balance"
								>
									<NigerianFlag />
									<span className="truncate font-semibold text-white text-xs tracking-tight transition-all xl:text-sm">
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
									className="flex h-6 shrink-0 cursor-pointer items-center justify-center rounded-[6px] bg-accent px-2 font-semibold text-[11px] text-white transition-colors hover:bg-[#00d600]"
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

						{!isAuthRoute && showPreviewUI && (
							isSessionLoading ? (
								<div className="h-8 w-24 animate-pulse rounded-full bg-white/10" />
							) : session?.user ? (
								<UserMenu />
							) : (
								<div className="flex justify-center gap-x-2">
									<Link to="/auth/sign-in" className="bg-white px-3 py-1.5 text-secondary text-xs text-black cursor-pointer rounded-full transition-colors">
										Log in
									</Link>
									<Link to="/auth/sign-up" className="flex text-xs items-center justify-center gap-x-2 bg-accent px-4 py-1.5 text-white cursor-pointer rounded-full transition-colors">
										Join now
										<ChevronRight className="h-3.5 w-3.5" />
									</Link>
								</div>
							)
						)}
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
							"bg-[#f2f2f2] text-gray-900 dark:bg-[#121212] dark:text-[#8C8F8F]", // #8C8F8F0D is roughly #f2f2f2
						)}
					>
						<div className="flex min-w-0 justify-between p-4">
							<img
								src="/sportsdey-logo.png"
								className="hidden h-10 dark:block"
								alt="sportsdey's logo"
							/>
							<NewSportsdeyLogo className="block h-10 w-auto dark:hidden" />
							<button
								ref={closeButtonRef}
								type="button"
								className="p-2"
								aria-label="Close main menu"
								onClick={() => setOpen(false)}
							>
								<X
									width={28}
									height={28}
									className="text-gray-900 dark:text-gray-400"
								/>
							</button>
						</div>

						<div className="h-[calc(100vh-80px)] space-y-6 overflow-y-auto px-4 pt-4 pb-8">
							<Sidebar onItemClick={() => setOpen(false)} isMobile />

							<div className="w-full px-2 pt-2 pb-12">
								<h3 className="mb-3 font-semibold text-gray-900 text-sm dark:text-[#8C8F8F]">
									Social links
								</h3>

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
									href="https://wa.link/25tnk8"
									target="_blank"
									rel="noopener noreferrer"
									className="mt-5 flex w-full items-center gap-4 rounded-lg bg-gray-200 p-3.5 transition-colors hover:bg-[#1E78FF]/10 dark:border-[#1E78FF]/30 dark:bg-[#1E78FF]/10 dark:hover:bg-[#1E78FF]/20"
								>
									<Whatsapp className="h-8 w-8 shrink-0" />
									<span className="font-medium text-gray-900 text-xs dark:text-gray-200">
										Contact us on Whatsapp <br /> for support.
									</span>
								</a>
							</div>
						</div>
					</aside>
				</div>
			</div>

			{/* mobile sub-navigation removed */}
		</div>
	);
}
