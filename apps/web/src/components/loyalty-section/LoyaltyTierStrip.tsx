import type { LoyaltyDisplayTier } from "@/lib/loyalty.constant";
import { cn } from "@/lib/utils";

type LoyaltyTierStripProps = {
	tiers: LoyaltyDisplayTier[];
	currentTierId: string;
};

export function LoyaltyTierStrip({
	tiers,
	currentTierId,
}: LoyaltyTierStripProps) {
	if (tiers.length === 0) return null;

	return (
		<section className="rounded-2xl border border-[#1B2722] bg-[#151616] px-3 py-5 sm:px-6">
			<div className="flex items-end justify-between gap-2 overflow-x-auto pb-1">
				{tiers.map((tier) => {
					const isCurrent = tier.id === currentTierId;
					return (
						<div
							key={tier.id}
							className="flex min-w-[72px] flex-1 flex-col items-center gap-2"
						>
							<img
								src={tier.iconSrc}
								alt={tier.label}
								className={cn(
									"size-12 object-contain sm:size-14",
									isCurrent
										? "opacity-100 drop-shadow-[0_0_12px_rgba(255,200,3,0.45)]"
										: "opacity-70",
								)}
							/>
							<p
								className={cn(
									"text-center font-semibold text-xs sm:text-sm",
									isCurrent ? "text-white" : "text-[#8C8F8F]",
								)}
							>
								{tier.label}
							</p>
							<p className="text-[11px] text-[#8C8F8F] sm:text-xs">
								{tier.minPoints.toLocaleString()} XP
							</p>
						</div>
					);
				})}
			</div>
		</section>
	);
}
