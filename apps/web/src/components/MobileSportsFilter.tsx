import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const sports = [
	{ id: "football", label: "Football", route: "/index/matches" },
	{ id: "basketball", label: "Basketball", route: "/basketball/matches" },
];

export function MobileSportsFilter() {
	const location = useLocation();
	const currentPath = location.pathname;

	return (
		<div className="no-scrollbar sticky top-0 z-20 w-full overflow-x-auto border-gray-100 border-b bg-white dark:border-gray-800 dark:bg-[#121212]">
			<nav className="flex items-center gap-6 px-4 py-3">
				{sports.map((sport) => {
					const isActive =
						currentPath === sport.route ||
						currentPath.startsWith(sport.route + "/");
					return (
						<Link
							key={sport.id}
							to={sport.route}
							className={cn(
								"relative whitespace-nowrap pb-1 font-medium text-sm transition-colors",
								isActive
									? "font-bold text-accent"
									: "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white",
							)}
						>
							{sport.label}
							{isActive && (
								<div className="absolute right-0 -bottom-[13px] left-0 h-0.5 rounded-t-full bg-accent" />
							)}
						</Link>
					);
				})}
			</nav>
		</div>
	);
}
