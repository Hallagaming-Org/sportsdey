import { MobileSportsFilter } from "@/components/MobileSportsFilter";
import RightSidebar from "@/components/RightSidebar";
import { Skeleton } from "@/components/ui/skeleton";

export function MatchesSkeleton() {
	return (
		<div className="h-full">
			<div className="h-full items-start gap-6 lg:grid lg:grid-cols-[3fr_1fr]">
				<div className="no-scrollbar h-full space-y-6 overflow-y-auto pb-20">
					<MobileSportsFilter />
					<div className="sticky top-0 z-10 hidden w-full bg-background/95 px-1 py-4 backdrop-blur-sm lg:block">
						<div className="flex gap-2">
							{[1, 2, 3, 4].map((i) => (
								<Skeleton key={i} className="h-8 w-16 rounded-full" />
							))}
						</div>
					</div>

					{[1, 2, 3].map((i) => (
						<div
							key={i}
							className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-[#202120]"
						>
							<div className="flex items-center gap-3 bg-gray-50 p-4 dark:bg-[#2A2B2A]">
								<Skeleton className="h-8 w-8 rounded-full" />
								<div className="space-y-2">
									<Skeleton className="h-4 w-32" />
									<Skeleton className="h-3 w-24" />
								</div>
							</div>
							<div className="divide-y divide-gray-100 dark:divide-gray-800">
								{[1, 2].map((j) => (
									<div
										key={j}
										className="flex items-center justify-between p-4"
									>
										<div className="flex-1 space-y-3">
											<div className="flex items-center gap-3">
												<Skeleton className="h-5 w-5 rounded-full" />
												<Skeleton className="h-4 w-32" />
												<Skeleton className="mr-8 ml-auto h-4 w-6" />
											</div>
											<div className="flex items-center gap-3">
												<Skeleton className="h-5 w-5 rounded-full" />
												<Skeleton className="h-4 w-40" />
												<Skeleton className="mr-8 ml-auto h-4 w-6" />
											</div>
										</div>
										<div className="flex flex-col items-end gap-2 border-gray-100 border-l pl-4 dark:border-gray-800">
											<Skeleton className="h-4 w-12" />
											<Skeleton className="h-4 w-8" />
										</div>
									</div>
								))}
							</div>
						</div>
					))}
				</div>
				<div className="no-scrollbar hidden h-full overflow-y-auto pb-20 lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-2rem)]">
					<RightSidebar />
				</div>
			</div>
		</div>
	);
}
