/**
 * Reserved-height placeholder for the DataBet host so the prematch lobby
 * does not expand from an empty box once odds/events paint.
 */
export function SportsbookSkeleton() {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl bg-[#1c1d1f] p-3"
		>
			<div className="mb-3 flex gap-2">
				<div className="h-8 w-20 animate-pulse rounded-full bg-white/10" />
				<div className="h-8 w-24 animate-pulse rounded-full bg-white/10" />
				<div className="h-8 w-16 animate-pulse rounded-full bg-white/10" />
			</div>
			<div className="mb-3 h-36 animate-pulse rounded-xl bg-white/5" />
			<div className="space-y-2">
				{["a", "b", "c", "d", "e", "f", "g", "h"].map((row) => (
					<div
						key={row}
						className="flex h-14 items-center gap-3 rounded-lg bg-white/5 px-3"
					>
						<div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-white/10" />
						<div className="min-w-0 flex-1 space-y-2">
							<div className="h-3 w-2/3 animate-pulse rounded bg-white/10" />
							<div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
						</div>
						<div className="flex gap-1">
							<div className="h-8 w-12 animate-pulse rounded bg-white/10" />
							<div className="h-8 w-12 animate-pulse rounded bg-white/10" />
							<div className="h-8 w-12 animate-pulse rounded bg-white/10" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
