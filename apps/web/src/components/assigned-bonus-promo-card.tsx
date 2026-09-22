import { Check, Gift, Loader2 } from "lucide-react";
import { BONUS_ACTION_LABEL, BONUS_STATUS } from "@/lib/bonuses.constant";
import type { BonusCard } from "@/lib/bonuses";
import { cn } from "@/lib/utils";

type AssignedBonusPromoCardProps = {
	bonus: BonusCard;
	isMutating?: boolean;
	onActivate?: (userbonusId: string) => void;
};

function endsOnLabel(endAt: string | null): string {
	if (!endAt) return "No expiry listed";
	const date = new Date(endAt);
	if (Number.isNaN(date.getTime())) return "No expiry listed";
	return `Ends on ${date.toLocaleDateString("en-US", {
		day: "numeric",
		month: "long",
		year: "numeric",
	})}`;
}

export function AssignedBonusPromoCard({
	bonus,
	isMutating = false,
	onActivate,
}: AssignedBonusPromoCardProps) {
	const isActive = bonus.status === BONUS_STATUS.ACTIVE;
	const showActivate = bonus.canActivate && !isActive;

	return (
		<article className="overflow-hidden rounded-2xl border border-[#F1F2F4] bg-white dark:border-[#2F3033] dark:bg-[#1C1D1F]">
			<div className="relative aspect-[21/9] w-full overflow-hidden bg-gradient-to-br from-[#04100B] via-[#12351F] to-[#1BAA04]">
				<div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.18),transparent_45%)]" />
				<div className="relative flex h-full flex-col justify-between p-4 sm:p-5">
					<div className="flex items-center gap-2">
						<span className="flex size-8 items-center justify-center rounded-full bg-black/35 text-accent">
							<Gift className="size-4" />
						</span>
						<span className="rounded-full bg-black/40 px-2 py-0.5 font-semibold text-[10px] uppercase tracking-wide text-white">
							{bonus.statusLabel}
						</span>
					</div>
					<p className="font-extrabold text-2xl text-white drop-shadow-sm sm:text-3xl">
						{bonus.rewardLabel}
					</p>
				</div>
			</div>

			<div className="flex items-center justify-between gap-3 p-4">
				<div className="min-w-0">
					<h3 className="truncate font-extrabold text-sm text-gray-900 capitalize dark:text-white">
						{bonus.title}
					</h3>
					<p className="mt-0.5 text-gray-500 text-xs dark:text-gray-400">
						{endsOnLabel(bonus.endAt)}
					</p>
					{bonus.wageringRequired > 0 ? (
						<p className="mt-1 text-[11px] text-[#8C8F8F]">
							{bonus.wageringLabel}
						</p>
					) : null}
				</div>

				{showActivate ? (
					<button
						type="button"
						disabled={isMutating}
						onClick={() => onActivate?.(bonus.id)}
						className={cn(
							"shrink-0 rounded-lg bg-accent px-3 py-1.5 font-bold text-[10px] text-[#000606] transition-colors hover:bg-[#158f03] hover:text-white",
							isMutating && "cursor-wait opacity-70",
						)}
					>
						{isMutating ? (
							<Loader2 className="size-3.5 animate-spin" />
						) : (
							BONUS_ACTION_LABEL.ACTIVATE
						)}
					</button>
				) : (
					<div className="flex shrink-0 items-center gap-1 rounded-lg bg-[#1B2722] px-3 py-1.5 font-bold text-[10px] text-accent">
						<Check className="size-3.5" />
						Activated
					</div>
				)}
			</div>
		</article>
	);
}
