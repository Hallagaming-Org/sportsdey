import { Link } from "@tanstack/react-router";
import { Gift } from "lucide-react";
import { BONUS_ACTION_LABEL, BONUS_KIND } from "@/lib/bonuses.constant";
import type { BonusCard as BonusCardModel } from "@/lib/bonuses";
import { cn } from "@/lib/utils";

type BonusCardProps = {
	bonus: BonusCardModel;
	isMutating?: boolean;
	onActivate?: (userbonusId: string) => void;
	onCancel?: (userbonusId: string) => void;
};

const pathWithoutHash = (href: string): string => {
	return href.split("#")[0] ?? href;
};

export function BonusCard({
	bonus,
	isMutating = false,
	onActivate,
	onCancel,
}: BonusCardProps) {
	const wageringPercent =
		bonus.wageringRequired > 0
			? Math.min(100, (bonus.wageringCurrent / bonus.wageringRequired) * 100)
			: 0;

	return (
		<article className="relative flex flex-col overflow-hidden rounded-2xl border border-[#1B2722] bg-[#151616] p-5">
			<div className="mb-5 flex items-start gap-3">
				<div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
					<Gift className="size-5" />
				</div>
				<div className="min-w-0">
					<div className="mb-1 flex items-center gap-2">
						<h3 className="font-extrabold text-base text-white">{bonus.title}</h3>
						<span className="rounded-full bg-[#1B2722] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#8C8F8F]">
							{bonus.statusLabel}
						</span>
					</div>
					<p className="mt-1 line-clamp-2 text-sm text-[#8C8F8F]">
						{bonus.description}
					</p>
				</div>
			</div>

			{bonus.kind === BONUS_KIND.ASSIGNMENT ? (
				<>
					<div className="mb-1 flex items-center justify-between gap-3 text-xs">
						<span className="text-[#8C8F8F]">{bonus.wageringLabel}</span>
						<span className="font-semibold text-white">
							{Math.round(wageringPercent)}%
						</span>
					</div>
					<div className="mb-5 h-2 overflow-hidden rounded-full bg-[#1B2722]">
						<div
							className="h-full rounded-full bg-accent transition-[width] duration-500"
							style={{ width: `${wageringPercent}%` }}
						/>
					</div>
				</>
			) : (
				<p className="mb-5 text-sm text-[#8C8F8F]">{bonus.wageringLabel}</p>
			)}

			<div className="mb-5 flex items-center justify-between text-sm">
				<span className="text-[#8C8F8F]">Reward</span>
				<span className="font-bold text-white">{bonus.rewardLabel}</span>
			</div>

			<div className="mt-auto flex flex-col gap-2">
				{bonus.canActivate ? (
					<button
						type="button"
						disabled={isMutating}
						onClick={() => onActivate?.(bonus.id)}
						className={cn(
							"flex h-11 w-full items-center justify-center rounded-xl bg-accent font-bold text-sm text-[#040C01] transition-colors hover:bg-[#158f03] hover:text-white",
							isMutating && "cursor-wait opacity-70",
						)}
					>
						{BONUS_ACTION_LABEL.ACTIVATE}
					</button>
				) : (
					<Link
						to={pathWithoutHash(bonus.actionHref)}
						search={bonus.actionSearch}
						className="flex h-11 w-full items-center justify-center rounded-xl bg-accent font-bold text-sm text-[#040C01] transition-colors hover:bg-[#158f03] hover:text-white"
					>
						{bonus.actionLabel}
					</Link>
				)}

				{bonus.canCancel ? (
					<button
						type="button"
						disabled={isMutating}
						onClick={() => onCancel?.(bonus.id)}
						className="h-10 w-full rounded-xl border border-[#1B2722] font-semibold text-sm text-[#8C8F8F] transition-colors hover:border-red-500 hover:text-red-400 disabled:cursor-wait disabled:opacity-70"
					>
						{BONUS_ACTION_LABEL.CANCEL}
					</button>
				) : null}
			</div>
		</article>
	);
}
