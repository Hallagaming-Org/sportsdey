import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const sports = [
	{ id: "football", label: "Football", route: "/index/matches" },
	{ id: "basketball", label: "Basketball", route: "/basketball/matches" },
	{ id: "tennis", label: "Tennis", route: "/tennis/matches" },
	{ id: "boxing", label: "Boxing", route: "/boxing" },
	{ id: "ufc", label: "UFC", route: "/ufc" },
];

export function MobileSportsFilter() {
	const location = useLocation();
	const currentPath = location.pathname;

	return (
		<div className="lg:hidden w-full overflow-x-auto no-scrollbar border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#121212] sticky top-0 z-20">
			<nav className="flex items-center px-4 py-3 gap-6">
				{sports.map((sport) => {
					const isActive = currentPath === sport.route || currentPath.startsWith(sport.route + "/");
					return (
						<Link
							key={sport.id}
							to={sport.route}
							className={cn(
								"whitespace-nowrap font-medium text-sm transition-colors relative pb-1",
								isActive
									? "text-accent font-bold"
									: "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
							)}
						>
							{sport.label}
							{isActive && (
								<div className="absolute -bottom-[13px] left-0 right-0 h-0.5 bg-accent rounded-t-full" />
							)}
						</Link>
					);
				})}
			</nav>
		</div>
	);
}
