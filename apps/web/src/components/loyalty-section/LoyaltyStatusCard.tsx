import type { LoyaltyPointsSummary } from "@/lib/loyalty";

type LoyaltyStatusCardProps = {
	summary: LoyaltyPointsSummary;
};

export function LoyaltyStatusCard({ summary }: LoyaltyStatusCardProps) {
	const nextLabel = summary.nextTier?.label;

	return (
		<section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
			<article className="rounded-2xl border border-[#1B2722] bg-[#151616] p-5 sm:p-6">
				<div className="flex flex-col gap-5 sm:flex-row sm:items-center">
					<img
						src={summary.currentTier.iconSrc}
						alt={summary.currentTier.label}
						className="mx-auto size-20 object-contain sm:mx-0 sm:size-24"
					/>
					<div className="min-w-0 flex-1">
						<p className="font-extrabold text-lg text-white sm:text-xl">
							Current Tier: {summary.currentTier.label}
						</p>
						<p className="mt-1 text-sm text-[#8C8F8F]">
							Your Progress:{" "}
							<span className="font-semibold text-white">
								{summary.progressCurrent.toLocaleString()}/
								{summary.progressTarget.toLocaleString()} XP
							</span>
						</p>
						<div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#1B2722]">
							<div
								className="h-full rounded-full bg-[#FFC803] transition-[width] duration-500"
								style={{ width: `${summary.progressPercent}%` }}
							/>
						</div>
						{nextLabel ? (
							<p className="mt-2 text-sm text-accent">
								{summary.pointsToNextTier.toLocaleString()} XP to reach{" "}
								{nextLabel}
							</p>
						) : (
							<p className="mt-2 text-sm text-accent">You are at the top tier</p>
						)}
					</div>
				</div>
			</article>

			<article className="flex flex-col justify-center rounded-2xl border border-[#1B2722] bg-[#151616] p-5 sm:p-6">
				<p className="text-sm text-[#8C8F8F]">Available Points</p>
				<p className="mt-2 font-extrabold text-3xl text-accent sm:text-4xl">
					{summary.totalPoints.toLocaleString()}
				</p>
				{summary.loyaltyLevel ? (
					<p className="mt-2 text-xs text-[#8C8F8F]">
						Engine level: {summary.loyaltyLevel}
					</p>
				) : null}
			</article>
		</section>
	);
}
