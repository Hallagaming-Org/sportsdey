import { Skeleton } from "@/components/ui/skeleton";

export function MissionsGridSkeleton() {
	return (
		<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
			{Array.from({ length: 6 }).map((_, index) => (
				<div
					key={index}
					className="rounded-2xl border border-[#1B2722] bg-[#151616] p-5"
				>
					<div className="mb-4 flex gap-3">
						<Skeleton className="size-12 rounded-full" />
						<div className="flex-1 space-y-2">
							<Skeleton className="h-5 w-2/3" />
							<Skeleton className="h-4 w-full" />
						</div>
					</div>
					<Skeleton className="mb-4 h-2 w-full rounded-full" />
					<Skeleton className="mb-4 h-4 w-24" />
					<Skeleton className="h-11 w-full rounded-xl" />
				</div>
			))}
		</div>
	);
}
