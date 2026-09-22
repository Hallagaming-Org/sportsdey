import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import {
	Bell,
	Clock3,
	FileText,
	LogOut,
	Medal,
	Settings,
	Star,
	TicketPercent,
	Trophy,
	User,
	UserRound,
	Wallet,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { useState } from "react";
import { signOut, useSession } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

type UserMenuItem = {
	label: string;
	icon: ComponentType<SVGProps<SVGSVGElement>>;
	path?: string;
};

const userMenuItems: UserMenuItem[] = [
	{ label: "My profile", icon: UserRound, path: "/account" },
	// { label: "Notifications", icon: Bell },
	{ label: "Wallet", icon: Wallet, path: "/wallet" },
	{ label: "KYC Documents", icon: FileText, path: "/kyc" },
	{ label: "Bet history", icon: Clock3, path: "/bet-history" },
	{ label: "Loyalty points", icon: Medal, path: "/loyalty" },
	{ label: "Bonuses", icon: TicketPercent, path: "/bonuses" },
	// { label: "Engage", icon: Star },
	// { label: "Settings", icon: Settings },
];

export function UserMenu() {
	const { data: session, isPending: isLoading } = useSession();
	const [isOpen, setIsOpen] = useState(false);
	const navigate = useNavigate();
	const location = useLocation();

	const handleSignOut = async () => {
		await signOut();
		setIsOpen(false);
		navigate({ to: "/auth/sign-in" });
	};
	const handleMenuNavigation = (path?: string) => {
		setIsOpen(false);
		if (!path) {
			return;
		}
		const destination = session?.user ? path : "/auth/sign-in";
		navigate({ to: destination });
	};

	if (isLoading) {
		return (
			<button
				type="button"
				className="flex items-center justify-center p-2"
				aria-label="Loading"
			>
				<div className="h-6 w-6 animate-pulse rounded-full bg-white/20" />
			</button>
		);
	}

	if (session?.user) {
		const user = session.user;
		const displayName = user.name || "User";
		const initials = displayName
			.split(" ")
			.map((n: string) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);

		return (
			<div className="relative">
				<button
					type="button"
					onClick={() => setIsOpen(!isOpen)}
					className={cn(
						"flex items-center gap-2.5 rounded-full p-1.5 transition-colors",
						"hover:bg-white/10",
					)}
					aria-label="User menu"
					aria-expanded={isOpen}
				>
					{user.image ? (
						<img
							src={user.image}
							alt={displayName}
							className="h-7 w-7 rounded-full bg-[#F7C9B6] object-cover"
						/>
					) : (
						<div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F7C9B6] font-medium text-[#5D2E1F] text-xs">
							{initials}
						</div>
					)}
					<span className="hidden font-extrabold text-secondary text-xs md:inline dark:text-white">
						Hi {displayName.split(" ")[0]}
					</span>
					<svg
						viewBox="0 0 20 20"
						aria-hidden="true"
						className={cn(
							"h-4 w-4 fill-current text-secondary transition-transform dark:text-white",
							isOpen ? "rotate-180" : "rotate-0",
						)}
					>
						<polygon points="10,13.5 4.5,7.5 15.5,7.5" />
					</svg>
				</button>

				{isOpen && (
					<>
						<button
							type="button"
							className="fixed inset-0 z-40"
							onClick={() => setIsOpen(false)}
							aria-label="Close user menu"
						/>
						<div className="absolute top-full right-8 z-50 mt-2 w-52 rounded-2xl bg-[#020D02] p-3 shadow-lg md:right-0 md:w-64">
							<nav aria-label="User menu options">
								<ul className="space-y-3">
									{userMenuItems.map(({ label, icon: Icon, path }) => (
										<li key={label}>
											<button
												type="button"
												onClick={() => handleMenuNavigation(path)}
												className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left text-[#F2EEFB] transition-colors hover:bg-white/5"
											>
												<span className="flex h-7 w-7 shrink-0 items-center justify-center text-[#C9D2D0]">
													<Icon width={18} height={18} className="block" />
												</span>
												<span className="font-medium text-xs">{label}</span>
											</button>
										</li>
									))}
									<li>
										<button
											type="button"
											onClick={handleSignOut}
											className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/5"
										>
											<span className="flex h-7 w-7 shrink-0 items-center justify-center text-[#FF484B]">
												<LogOut width={20} height={20} className="block" />
											</span>
											<span className="font-medium text-[#FF484B] text-base">
												Log out
											</span>
										</button>
									</li>
								</ul>
							</nav>
						</div>
					</>
				)}
			</div>
		);
	}

	return (
		<Link
			to="/auth/phone-sign-in"
			search={{ returnTo: location.href, mode: "login" }}
			aria-label="Sign In"
			className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
		>
			<User className="h-4 w-4 text-gray-600 dark:text-gray-300" />
		</Link>
	);
}
