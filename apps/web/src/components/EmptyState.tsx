import { Calendar, SearchX } from "lucide-react";
import { cn } from "../lib/utils";

interface EmptyStateProps {
	title: string;
	description?: string;
	iconType?: "search" | "calendar";
	titleClassName?: string;
}

export function EmptyState({
	title,
	description,
	iconType = "search",
	titleClassName,
}: EmptyStateProps) {
	return (
		<div className="fade-in zoom-in flex animate-in flex-col items-center justify-center px-4 py-20 text-center duration-500">
			<div className="relative mb-6">
				<div className="absolute inset-0 animate-pulse rounded-full bg-accent/5 blur-2xl" />
				<div className="relative flex size-20 items-center justify-center rounded-full bg-white shadow-accent/5 shadow-xl ring-1 ring-accent/10">
					{iconType === "search" ? (
						<SearchX className="size-10 text-accent/60" />
					) : (
						<Calendar className="size-10 text-accent/60" />
					)}
				</div>
			</div>

			<h3 className={cn("mb-2 font-bold text-lg text-primary", titleClassName)}>{title}</h3>

			{description && (
				<p className="max-w-[280px] text-gray-400 text-sm italic leading-relaxed">
					{description}
				</p>
			)}
		</div>
	);
}
