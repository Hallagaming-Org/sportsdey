import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Gift, Plus, Wallet } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import {
	activeAssignedBonuses,
	fetchPlayerBonuses,
	type BonusCard,
} from "@/lib/bonuses";
import { BONUS_QUERY_KEY, BONUS_STATUS } from "@/lib/bonuses.constant";
import { cn, formatAmount } from "@/lib/utils";
import NigerianFlag from "@/logos/NigerianFlag";

export type WalletOverview = {
	id: string;
	balance?: number | null;
	bonusBalance?: number | null;
};

type WalletBalanceMenuProps = {
	wallet?: WalletOverview;
	compact?: boolean;
	onDeposit: () => void;
	enabled: boolean;
};

function naira(value: number | null | undefined): string {
	return `₦ ${formatAmount(value)}`;
}

export function WalletBalanceMenu({
	wallet,
	compact = false,
	onDeposit,
	enabled,
}: WalletBalanceMenuProps) {
	const panelId = useId();
	const rootRef = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);

	const bonusesQuery = useQuery({
		queryKey: BONUS_QUERY_KEY.LIST,
		queryFn: async () => {
			try {
				return await fetchPlayerBonuses();
			} catch (error) {
				if (
					error instanceof ApiError &&
					(error.status === 502 || error.status === 503)
				) {
					return [] as BonusCard[];
				}
				throw error;
			}
		},
		enabled,
		retry: false,
		refetchInterval: 15_000,
		staleTime: 10_000,
	});

	const mainBalance = wallet?.balance ?? 0;
	const bonusBalance = wallet?.bonusBalance ?? 0;
	const activeBonuses = activeAssignedBonuses(bonusesQuery.data ?? []);
	const headerLabel = naira(mainBalance);

	useEffect(() => {
		if (!open) return;
		const onPointer = (event: MouseEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) {
				setOpen(false);
			}
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onPointer);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onPointer);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	return (
		<div ref={rootRef} className="relative">
			<div
				className={cn(
					"flex shrink-0 items-center justify-between rounded-md border p-0.5",
					compact
						? "h-8 w-[150px] border-gray-300 bg-[#F8F8F8] dark:border-gray-700 dark:bg-[#202120]"
						: "h-[40px] w-[229px] rounded-[6.88px] border-[#F2EEFB] bg-[#04100B] px-[6px] py-[7px] dark:border-[#F2EEFB] dark:bg-[#04100B]",
				)}
			>
				<button
					type="button"
					aria-expanded={open}
					aria-controls={panelId}
					aria-label="Wallet balance details"
					onClick={() => setOpen((value) => !value)}
					className={cn(
						"flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden px-1.5 text-left",
						!compact && "gap-2 px-2.5",
					)}
				>
					<NigerianFlag />
					<span
						className={cn(
							"truncate font-semibold tracking-tight",
							compact
								? "text-[#4b5563] dark:text-gray-300"
								: "text-white text-xs xl:text-sm",
						)}
						style={
							compact
								? {
										fontSize:
											headerLabel.length > 15
												? "9px"
												: headerLabel.length > 12
													? "10px"
													: "11px",
									}
								: undefined
						}
					>
						{headerLabel}
					</span>
					<ChevronDown
						className={cn(
							"size-3 shrink-0 opacity-70 transition-transform",
							compact ? "text-[#4b5563] dark:text-gray-300" : "text-white",
							open && "rotate-180",
						)}
					/>
				</button>

				<button
					type="button"
					onClick={onDeposit}
					aria-label={compact ? "Add funds" : "Deposit"}
					className={cn(
						"shrink-0 cursor-pointer bg-accent font-semibold text-white transition-colors",
						compact
							? "flex h-6 w-6 items-center justify-center rounded-[4px] hover:bg-blue-600"
							: "flex h-6 items-center justify-center rounded-[6px] px-2 text-[11px] hover:bg-[#00d600]",
					)}
				>
					{compact ? (
						<Plus className="h-4 w-4" />
					) : (
						"Deposit"
					)}
				</button>
			</div>

			{open ? (
				<div
					id={panelId}
					role="dialog"
					aria-label="Wallet breakdown"
					className={cn(
						"absolute z-[80] mt-2 overflow-hidden rounded-xl border border-[#2F3033] bg-[#151616] shadow-xl",
						compact
							? "right-0 w-[min(calc(100vw-1.5rem),18rem)]"
							: "right-0 w-[280px]",
					)}
				>
					<div className="space-y-3 p-3">
						<div className="flex items-start justify-between gap-3">
							<div className="flex items-center gap-2">
								<span className="flex size-8 items-center justify-center rounded-full bg-white/5 text-white">
									<Wallet className="size-4" />
								</span>
								<div>
									<p className="text-[11px] font-medium uppercase tracking-wide text-[#8C8F8F]">
										Main balance
									</p>
									<p className="font-bold text-sm text-white">
										{naira(mainBalance)}
									</p>
								</div>
							</div>
						</div>
						<p className="text-[10px] text-[#8C8F8F]">
							Withdrawable cash. Bonus funds are listed separately below.
						</p>

						<div className="flex items-start justify-between gap-3 rounded-lg border border-accent/25 bg-accent/10 p-2.5">
							<div className="flex items-center gap-2">
								<span className="flex size-8 items-center justify-center rounded-full bg-accent/20 text-accent">
									<Gift className="size-4" />
								</span>
								<div>
									<p className="text-[11px] font-medium uppercase tracking-wide text-accent">
										Bonus balance
									</p>
									<p className="font-bold text-sm text-white">
										{naira(bonusBalance)}
									</p>
								</div>
							</div>
						</div>
						<p className="text-[10px] text-[#8C8F8F]">
							Usable for bets per bonus rules. Not withdrawable until wagering
							is complete.
						</p>

						{activeBonuses.length > 0 ? (
							<ul className="max-h-40 space-y-2 overflow-y-auto">
								{activeBonuses.map((bonus) => (
									<li
										key={bonus.id}
										className="rounded-lg border border-[#2F3033] bg-[#1C1D1F] p-2"
									>
										<p className="truncate text-xs font-semibold text-white">
											{bonus.title}
										</p>
										<p className="text-[11px] text-accent">{bonus.rewardLabel}</p>
										{bonus.wageringRequired > 0 ? (
											<p className="mt-0.5 text-[10px] text-[#8C8F8F]">
												{bonus.wageringLabel}
											</p>
										) : null}
										{bonus.status === BONUS_STATUS.ACTIVE && bonus.endAt ? (
											<p className="text-[10px] text-[#8C8F8F]">
												Expires{" "}
												{new Date(bonus.endAt).toLocaleDateString("en-US", {
													day: "numeric",
													month: "short",
												})}
											</p>
										) : null}
									</li>
								))}
							</ul>
						) : (
							<p className="text-center text-[11px] text-[#8C8F8F]">
								No active bonuses.
							</p>
						)}
					</div>
				</div>
			) : null}
		</div>
	);
}
