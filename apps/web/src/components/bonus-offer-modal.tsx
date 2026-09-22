import { Gift, Loader2, X } from "lucide-react";
import {
	BONUS_ACTION_LABEL,
	BONUS_TYPE_LABEL,
	isBonusCampaignType,
} from "@/lib/bonuses.constant";
import type { BonusCard } from "@/lib/bonuses";
import { cn } from "@/lib/utils";

type BonusOfferModalProps = {
	bonus: BonusCard;
	isActivating: boolean;
	onActivate: (userbonusId: string) => void;
	onDismiss: () => void;
};

function offerTitle(bonus: BonusCard): string {
	if (isBonusCampaignType(bonus.bonusType)) {
		return `${BONUS_TYPE_LABEL[bonus.bonusType]} bonus`;
	}
	return bonus.title;
}

export function BonusOfferModal({
	bonus,
	isActivating,
	onActivate,
	onDismiss,
}: BonusOfferModalProps) {
	return (
		<div className="fixed inset-0 z-[100] flex min-h-[100dvh] items-start justify-center overflow-y-auto overscroll-y-contain bg-black/60 p-3 backdrop-blur-[2px] sm:items-center sm:p-4">
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="bonus-offer-title"
				className="relative my-auto w-full max-w-[600px] overflow-hidden rounded-3xl border border-[#1B2722] bg-[#000606] text-center shadow-xl"
			>
				<button
					type="button"
					onClick={onDismiss}
					aria-label="Close"
					className="absolute top-4 right-4 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[#6C7073] text-[#6C7073] transition-colors hover:text-white"
				>
					<X className="h-4 w-4" />
				</button>

				<div className="relative bg-gradient-to-br from-[#04100B] via-[#12351F] to-[#1BAA04] px-6 pb-8 pt-10">
					<div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-black/35 text-accent">
						<Gift className="size-7" />
					</div>
					<p className="font-extrabold text-3xl text-white drop-shadow-sm">
						{bonus.rewardLabel}
					</p>
				</div>

				<div className="px-6 pb-6 pt-5">
					<h2
						id="bonus-offer-title"
						className="font-extrabold text-[22px] text-white tracking-tight"
					>
						{offerTitle(bonus)}
					</h2>
					<p className="mt-2 text-[15px] text-[#8C8F8F] leading-relaxed">
						{bonus.description}
					</p>
					{bonus.wageringRequired > 0 ? (
						<p className="mt-2 text-xs text-[#8C8F8F]">{bonus.wageringLabel}</p>
					) : null}

					<div className="mt-6 flex flex-col gap-3">
						<button
							type="button"
							disabled={isActivating}
							onClick={() => onActivate(bonus.id)}
							className={cn(
								"flex h-12 w-full cursor-pointer items-center justify-center rounded-lg bg-accent font-bold text-[17px] text-[#040C01] transition-opacity hover:opacity-90",
								isActivating && "cursor-wait opacity-70",
							)}
						>
							{isActivating ? (
								<Loader2 className="size-5 animate-spin" />
							) : (
								BONUS_ACTION_LABEL.ACTIVATE
							)}
						</button>
						<button
							type="button"
							disabled={isActivating}
							onClick={onDismiss}
							className="h-11 w-full cursor-pointer rounded-lg border border-[#1B2722] font-semibold text-sm text-[#8C8F8F] transition-colors hover:text-white disabled:opacity-70"
						>
							{BONUS_ACTION_LABEL.LATER}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
