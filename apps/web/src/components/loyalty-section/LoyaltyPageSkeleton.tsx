import { Skeleton } from "@/components/ui/skeleton";

export function LoyaltyPageSkeleton() {
	return (
		<div className="space-y-6">
			<div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
				<Skeleton className="h-44 rounded-2xl bg-[#1B2722]" />
				<Skeleton className="h-44 rounded-2xl bg-[#1B2722]" />
			</div>
			<Skeleton className="h-28 rounded-2xl bg-[#1B2722]" />
			<Skeleton className="h-36 rounded-2xl bg-[#1B2722]" />
			<Skeleton className="h-56 rounded-2xl bg-[#1B2722]" />
		</div>
	);
}
