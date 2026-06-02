import { Link, useNavigate } from "@tanstack/react-router";
import {
	Bell,
	Clock3,
	LogOut,
	Settings,
	Star,
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
	{ label: "Notifications", icon: Bell },
	{ label: "Wallet", icon: Wallet, path: "/wallet" },
	{ label: "Bet history", icon: Clock3 },
	{ label: "Engage", icon: Star },
	{ label: "Settings", icon: Settings },
];

export function UserMenu() {
	const { data: session, isPending: isLoading } = useSession();
	const [isOpen, setIsOpen] = useState(false);
	const navigate = useNavigate();

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
					<span className="text-secondary dark:text-white text-xs font-extrabold hidden md:inline">
						Hi {displayName.split(" ")[0]}
					</span>
					<svg
						viewBox="0 0 20 20"
						aria-hidden="true"
						className={cn(
							"h-4 w-4 fill-current text-secondary dark:text-white transition-transform",
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
						<div className="absolute top-full right-8 md:right-0 z-50 mt-2 w-52 md:w-64 rounded-2xl bg-[#020D02] p-3 shadow-lg">
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
													<Icon width={20} height={20} className="block" />
												</span>
												<span className="font-medium text-base">{label}</span>
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
											<span className="font-medium text-base text-[#FF484B]">
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
			to="/auth/sign-in"
			aria-label="Sign In"
			className="flex items-center justify-center h-7 w-7 rounded-full bg-gray-200 dark:bg-gray-700 transition-colors hover:bg-gray-300 dark:hover:bg-gray-600 shrink-0"
		>
			<User className="h-4 w-4 text-gray-600 dark:text-gray-300" />
		</Link>
	);
}
