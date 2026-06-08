import { Skeleton } from "@/components/ui/skeleton";
import { formatAmount, formatDateTime } from "@/lib/utils";

type WalletTransaction = {
	id: string;
	userId: string;
	amount?: number | null;
	type: string;
	reference: string;
	status: string;
	createdAt?: string | null;
};

type WalletRecentTransactionsProps = {
	transactions: WalletTransaction[];
	isLoading: boolean;
};

import EmptyStateWithdrawal from "@/logos/EmptyStateWithdrawal.png";

export function WalletRecentTransactions({
	transactions,
	isLoading,
}: WalletRecentTransactionsProps) {
	return (
		<>
			<p className="mt-4 font-semibold text-[20px] text-primary dark:text-white">
				Recent Transactions
			</p>
			<div className="mt-2 rounded-2xl border border-[#1B2722] bg-[#000606] p-6 shadow-sm min-h-[355px] max-h-[355px] overflow-y-auto">
				<div className="mt-4">
					{isLoading ? (
						<ul className="space-y-3">
							{[...Array(3)].map((_, i) => (
								<li
									key={i}
									className="flex items-center justify-between rounded-lg bg-[#F9F9F9] p-3 dark:bg-[#2B2C2B]"
								>
									<div className="space-y-2">
										<Skeleton className="h-4 w-[120px]" />
										<Skeleton className="h-3 w-[80px]" />
									</div>
									<div className="space-y-2 flex flex-col items-end">
										<Skeleton className="h-4 w-[100px]" />
										<Skeleton className="h-3 w-[60px]" />
									</div>
								</li>
							))}
						</ul>
					) : transactions.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-8 text-center">
							<img
								src={EmptyStateWithdrawal}
								alt="No transactions"
								className="h-21 w-21 max-w-[160px]"
							/>
							<p className="mt-4 font-medium text-base text-primary dark:text-[#6C7073]">
								Looks like you don&apos;t have any transaction yet!
							</p>
						</div>
					) : (
						<ul className="space-y-3">
							{transactions.slice(0, 10).map((transaction) => (
								<li
									key={transaction.id}
									className="flex items-center justify-between rounded-lg bg-[#F9F9F9] p-3 dark:bg-[#2B2C2B]"
								>
									<div>
										<p className="font-medium text-primary text-sm capitalize dark:text-white">
											{transaction.type}
										</p>
										<p className="text-[#6E6E6E] text-xs">
											{formatDateTime(transaction.createdAt)}
										</p>
									</div>
									<div className="text-right">
										<p className="font-semibold text-primary text-sm dark:text-white">
											₦{formatAmount(transaction.amount)}
										</p>
										<p className="text-xs uppercase">{transaction.status}</p>
									</div>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</>
	);
}
