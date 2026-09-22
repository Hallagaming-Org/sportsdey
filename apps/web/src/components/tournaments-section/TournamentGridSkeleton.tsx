import { Skeleton } from "@/components/ui/skeleton";

export function TournamentGridSkeleton() {
	return (
		<div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
			{Array.from({ length: 4 }).map((_, index) => (
				<div
					key={index}
					className="overflow-hidden rounded-2xl border border-accent/35 bg-[#151616]"
				>
					<Skeleton className="aspect-[16/10] w-full rounded-none" />
					<div className="space-y-3 p-4">
						<Skeleton className="h-5 w-2/3" />
						<Skeleton className="h-6 w-24" />
						<Skeleton className="h-11 w-full rounded-xl" />
					</div>
				</div>
			))}
		</div>
	);
}
