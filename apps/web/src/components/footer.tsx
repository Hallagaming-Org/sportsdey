import { useRouter } from "@tanstack/react-router";
import { useCurrentSport } from "@/hooks/use-current-sport";
import { cn } from "@/lib/utils";
import { trackWebengageEvent } from "@/lib/webengage";

import Games from "@/logos/game.svg?react";
import Home from "@/logos/home-Filled.svg?react";
import News from "@/logos/news-footer.svg?react";
import Sports from "@/logos/sport.svg?react";
import WalletIcon from "@/logos/wallet.svg?react";

import { type Tabs, useActiveTab } from "./active-tab-context";

const bottomBarItems: {
	id: number;
	item: Tabs;
	label: string;
	icon: React.FC<React.SVGProps<SVGSVGElement> & { title?: string }>;
}[] = [
	{ id: 1, item: "scores", label: "Home", icon: Home },
	{ id: 2, item: "betting", label: "Sports", icon: Sports },
	{ id: 3, item: "games", label: "Casino", icon: Games },
	{ id: 4, item: "news", label: "News", icon: News },
	{ id: 5, item: "favourites", label: "Wallet", icon: WalletIcon },
];
const Footer = () => {
	const currentSport = useCurrentSport();
	const { tab, setTab } = useActiveTab();
	const router = useRouter();
	const trackCategory = (name: string) =>
		trackWebengageEvent("Category", { Name: name });
	return (
		<div className="px-0 pt-3 lg:hidden">
			<div className="w-full">
				<div className="rounded-t-lg border-[#F1F2F4] border-t bg-white p-2 shadow-lg dark:border-[#2F3033] dark:bg-[#1C1D1F]">
					<div className="flex items-center justify-between">
						{bottomBarItems.map(({ id, icon: Icon, item, label }) => (
							<button
								key={id}
								onClick={() => {
									setTab(item);
									if (item === "scores") {
										trackCategory("Home");
										const targetSport = currentSport || "football";
										router.navigate({
											to:
												targetSport === "tennis"
													? "/tennis"
													: targetSport === "basketball"
														? "/basketball"
														: "/",
											search: { league: undefined, sports: targetSport } as any,
										});
									}

									if (item === "betting") {
										trackCategory("Sportsbetting");
										router.navigate({
											to: "/sportsbetting",
											search: { sports: currentSport } as any,
										});
									}

									if (item === "games") {
										trackCategory("Casino");
										router.navigate({ to: "/games" });
									}

									if (item === "favourites") {
										trackCategory("Wallet");
										router.navigate({
											to: "/wallet",
											search: { sports: currentSport } as any,
										});
									}

									if (item === "news") {
										trackCategory("News");
										router.navigate({
											to: "/news",
											search: { sports: currentSport } as any,
										});
									}
								}}
								className="flex flex-1 flex-col items-center space-y-1"
							>
								<div
									className={cn(
										"flex h-10 w-10 items-center justify-center rounded-full transition-all",
										tab === item ? "text-accent" : "text-[#8C8F8F]",
									)}
								>
									<Icon className={cn("h-5 w-5")} />
								</div>
								<span
									className={cn(
										"mt-1 text-[11px]",
										tab === item ? "text-accent" : "text-gray-400",
									)}
								>
									{label}
								</span>
							</button>
						))}
					</div>
				</div>
			</div>
		</div>
	);
};

export default Footer;
