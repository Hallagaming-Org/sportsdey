import { useState } from "react";
import { ApiError } from "@/lib/api";
import type { LoyaltyRedeemOffer } from "@/lib/loyalty";
import { cn } from "@/lib/utils";

type LoyaltyRedeemPanelProps = {
	offers: LoyaltyRedeemOffer[];
	availablePoints: number;
	isRedeeming: boolean;
	listsErrorMessage?: string | null;
	onRedeem: (pointsToRedeem: number) => Promise<void>;
};

export function LoyaltyRedeemPanel({
	offers,
	availablePoints,
	isRedeeming,
	listsErrorMessage = null,
	onRedeem,
}: LoyaltyRedeemPanelProps) {
	const [activeOfferId, setActiveOfferId] = useState<string | null>(null);
	const [localError, setLocalError] = useState<string | null>(null);

	if (listsErrorMessage) {
		return (
			<section className="rounded-2xl border border-[#1B2722] bg-[#151616] px-4 py-6 text-center text-sm text-red-400">
				{listsErrorMessage}
			</section>
		);
	}

	if (offers.length === 0) return null;

	const handleRedeem = async (offer: LoyaltyRedeemOffer) => {
		setLocalError(null);
		if (offer.pointsCost > availablePoints) {
			setLocalError(
				`You need ${offer.pointsCost.toLocaleString()} points to redeem this reward.`,
			);
			return;
		}
		setActiveOfferId(offer.id);
		try {
			await onRedeem(offer.pointsCost);
		} catch (error) {
			setLocalError(
				error instanceof ApiError
					? error.message
					: "Could not redeem points. Try again.",
			);
		} finally {
			setActiveOfferId(null);
		}
	};

	return (
		<section className="space-y-3">						
					<h2 className="font-extrabold text-lg text-white">
						Recommended For You
					</h2>										
			

			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				{offers.map((offer) => {
					const canAfford = availablePoints >= offer.pointsCost;
					const progressPercent = Math.min(
						100,
						(availablePoints / Math.max(1, offer.pointsCost)) * 100,
					);
					const isThisRedeeming = isRedeeming && activeOfferId === offer.id;

					return (
						<article
							key={offer.id}
							className="flex flex-col rounded-2xl border border-[#1B2722] bg-[#151616] p-4 sm:p-5"
						>
							<p className="text-sm text-[#8C8F8F]">{offer.categoryLabel}</p>
							<p className="mt-2 font-extrabold text-3xl text-accent sm:text-4xl">
								{offer.rewardLabel}
							</p>						

							<div className="mt-4">
								<div className="mb-1.5 flex justify-between text-xs text-[#8C8F8F]">
									<span>
										{Math.min(availablePoints, offer.pointsCost).toLocaleString()}
										/{offer.pointsCost.toLocaleString()} pts
									</span>									
								</div>
								<div className="h-1.5 overflow-hidden rounded-full bg-[#1B2722]">
									<div
										className="h-full rounded-full bg-accent transition-[width] duration-500"
										style={{ width: `${progressPercent}%` }}
									/>
								</div>
							</div>

							<p className="mt-3 text-xs leading-relaxed text-[#8C8F8F]">
								{canAfford
									? "You have enough points. Redeem whenever you’re ready."
									: offer.howToUnlockLabel}
							</p>
							
							<button
								type="button"
								disabled={isRedeeming || !canAfford}
								onClick={() => {
									void handleRedeem(offer);
								}}
								className={cn(
									"mt-5 h-11 w-full rounded-xl font-bold transition-colors",
									canAfford
										? "bg-accent text-[#040C01] hover:bg-[#158f03] hover:text-white"
										: "cursor-not-allowed bg-[#2A2C2C] text-[#8C8F8F]",
									isRedeeming && "opacity-70",
								)}
							>
								{isThisRedeeming
									? "Redeeming…"
									:  "Redeem Now"
}
							</button>
						</article>
					);
				})}
			</div>

			{localError ? (
				<p className="text-sm text-red-400">{localError}</p>
			) : null}
		</section>
	);
}
